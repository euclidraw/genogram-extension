import { build } from "vite";
import { mkdtemp, writeFile, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import plugin from "../dist/plugin.js";
import { registerGenogramTools } from "../src/tools.js";
const host = resolve(process.env.ALID_PATH ?? "../alid"),
  dir = await mkdtemp(join(tmpdir(), "genogram-host-"));
try {
  const entry = join(dir, "entry.js");
  await writeFile(
    entry,
    `export {CommandRegistry} from ${JSON.stringify(join(host, "packages/kernel/src/commands.ts"))};export {ServiceRegistry} from ${JSON.stringify(join(host, "packages/kernel/src/services.ts"))};export {ExtensionRuntimeRegistry} from ${JSON.stringify(join(host, "packages/kernel/src/extension-controller.ts"))};export {CanvasWorld} from ${JSON.stringify(join(host, "packages/kernel/src/kernel-data.ts"))};export {SceneVectorCompiler} from ${JSON.stringify(join(host, "packages/kernel/src/scene-compiler.ts"))};export {installPorcelainExtension} from ${JSON.stringify(join(host, "packages/kernel/src/porcelain-and-trust.ts"))};`,
  );
  await writeFile(entry, (await readFile(entry, 'utf8')) + `export {createWorkspaceChanges} from ${JSON.stringify(join(host, "packages/kernel/src/workspace-changes.ts"))};export {WorkspaceToolRegistry} from ${JSON.stringify(join(host, "packages/kernel/src/workspace-tools.ts"))};`);
  await build({
    configFile: false,
    logLevel: "error",
    build: {
      target: "esnext",
      outDir: join(dir, "out"),
      lib: { entry, formats: ["es"], fileName: () => "host.mjs" },
      rollupOptions: { external: ["quickjs-emscripten"] },
    },
  });
  const {
    CanvasWorld,
    installPorcelainExtension,
    SceneVectorCompiler,
    CommandRegistry,
    ServiceRegistry,
    ExtensionRuntimeRegistry,
    createWorkspaceChanges,
    WorkspaceToolRegistry,
  } = await import(pathToFileURL(join(dir, "out/host.mjs")));
  const wasm = await import(
    pathToFileURL(join(host, "crates/ecanvas-core/pkg/ecanvas_core.js"))
  );
  await wasm.default({
    module_or_path: await readFile(
      join(host, "crates/ecanvas-core/pkg/ecanvas_core_bg.wasm"),
    ),
  });
  const core = new wasm.WasmCanvasCore();
  let commits = 0;
  const world = new CanvasWorld({
    commitCanonicalBatch(bytes, origin) {
      commits++;
      core.commit_canonical_batch(bytes, origin);
    },
    updateSpatialBounds() {},
  });
  const compiler = new SceneVectorCompiler();
  world.registerCanonical({
    id: "core.transform",
    defaults: { x: 0, y: 0, rotation: 0 },
  });
  world.registerCanonical({
    id: "core.bounds",
    defaults: { width: 300 }, optionalFields: ['height'],
  });
  world.registerComputed({
    id: "computed.layoutBounds",
    symbol: "test:bounds",
    dependsOnCanonical: ["core.transform", "core.bounds"],
    compute(id, v) {
      const t = v.getCanonical(id, "core.transform"),
        b = v.getCanonical(id, "core.bounds");
      return t && b ? { ...t, ...b } : undefined;
    },
  });
  const specs = [];
  for (const s of plugin.aspects)
    installPorcelainExtension(
      s,
      world,
      {
        registerExtension(s) {
          specs.push(s);
          return compiler.registerExtension(s);
        },
      },
      "trusted-tier1",
    );
  let selected = [];
  const runtime = plugin.activate({
    world,
    commands: {
      register() {
        return () => {};
      },
    },
    services: {
      get(n) {
        if (n === "canvas.active-tool-surface")
          return {
            get: () => ({
              selection: {
                getSelection: () => selected,
                select(id) {
                  selected = [id];
                },
              },
              host: {
                history: {
                  begin() {
                    core.begin_undo_group();
                  },
                  commit() {
                    core.end_undo_group();
                  },
                  abort() {
                    core.abort_undo_group();
                    world.replaceCanonicalSnapshot(core.get_canonical_json());
                  },
                },
              },
            }),
          };
      },
    },
  });
  runtime.api.run("template-nuclear");
  assert.equal(commits, 1);
  for (const id of world.listEntityIds())
    for (const spec of specs) {
      const p = world.getCanonical(id, spec.id);
      if (p) {
        const g = world.getComputed(id, `computed.${spec.id}`);
        assert.ok(g, `${id} ${spec.id}`);
        assert.ok(!spec.renderSvg(p, g, id).svg.includes("NaN"));
      }
    }
  const before = commits;
  const snapshot = core.dump_canonical_jsonl();
  const svg = compiler.compileToPureSvg(world);
  assert.ok(svg.includes("data-entity-id"));
  assert.ok(!svg.includes("foreignObject"));
  assert.equal(core.dump_canonical_jsonl(), snapshot);
  assert.equal(commits, before);
  assert.equal(core.undo(), true);
  world.replaceCanonicalSnapshot(core.get_canonical_json());
  assert.equal(world.listEntityIds().length, 0);
  assert.equal(core.redo(), true);
  world.replaceCanonicalSnapshot(core.get_canonical_json());
  assert.equal(core.dump_canonical_jsonl(), snapshot);
  const preview = world.createScratchOverlay("test:preview");
  const personId = world
    .listEntityIds()
    .find((id) => world.getCanonical(id, "diagram.genogram.person"));
  preview.set(personId, "core.transform", { x: 999999 });
  assert.equal(compiler.compileToPureSvg(world), svg);
  preview.dispose();
  const lifetime = new AbortController();
  const changes = createWorkspaceChanges(world, (caller, ops) => {
    core.begin_undo_group();
    try { world.applyCanonicalTransaction(caller, ops); core.end_undo_group(); }
    catch (error) { core.abort_undo_group(); world.replaceCanonicalSnapshot(core.get_canonical_json()); throw error; }
  }, () => ({ documentId: 'test-doc', viewId: 'main', signal: lifetime.signal }));
  const toolRegistry = new WorkspaceToolRegistry(changes);
  const access = toolRegistry.forExtension('diagram.genogram', plugin.aspects.map(a => a.id), () => {}, () => true);
  const offTools = registerGenogramTools({ world, services: { get: () => access } });
  const beforePlan = core.dump_canonical_jsonl(), beforePlanCommits = commits;
  const toolPlan = await access.invoke('diagram.genogram:plan-changes', { actions: JSON.stringify([
    { action: 'create', kind: 'person', id: 'new', patch: { name: 'AI 제안 인물' }, x: 500, y: 240 },
    { action: 'create', kind: 'relation', patch: { from: personId, to: 'new', kind: 'close' } },
    { action: 'move', id: personId, x: 50, y: 20 },
  ]) }, lifetime.signal);
  assert.equal(core.dump_canonical_jsonl(), beforePlan, 'planning never writes');
  assert.equal(commits, beforePlanCommits);
  changes.apply(access.getChangeProposal(toolPlan.changeProposalId));
  assert.equal(commits, beforePlanCommits + 1, 'approval is one batch');
  assert.ok(compiler.compileToPureSvg(world).includes('AI 제안 인물'));
  assert.equal(core.undo(), true); world.replaceCanonicalSnapshot(core.get_canonical_json());
  assert.equal(core.dump_canonical_jsonl(), beforePlan, 'one Undo reverts entire AI batch');
  const deletePlan = await access.invoke('diagram.genogram:plan-changes', { actions: JSON.stringify([{ action: 'delete', id: personId }]) }, lifetime.signal);
  changes.apply(access.getChangeProposal(deletePlan.changeProposalId));
  assert.equal(world.isAlive(personId), false);
  assert.equal(core.undo(), true); world.replaceCanonicalSnapshot(core.get_canonical_json());
  assert.equal(core.dump_canonical_jsonl(), beforePlan, 'one Undo restores person and cascaded relationships');
  offTools();
  const unionId = world.listEntityIds().find(id => world.getCanonical(id, "diagram.genogram.union"));
  const parentId = world.getCanonical(unionId, "diagram.genogram.union").partnerA;
  world.applyCanonicalTransaction("test:label-clear", [{ id: parentId, aspect: "diagram.genogram.person", patch: { name: "", yearSpan: "", note: "" } }]);
  const beforeLabel = world.getComputed(unionId, "computed.diagram.genogram.union");
  world.applyCanonicalTransaction("test:label-edit", [{ id: parentId, aspect: "diagram.genogram.person", patch: { name: "가나다" } }]);
  const commitsAfterEdit = commits;
  const withLabel = world.getComputed(unionId, "computed.diagram.genogram.union");
  assert.notDeepEqual(withLabel.paths, beforeLabel.paths, "label edits update the derived line gaps");
  const saved = core.dump_canonical_jsonl();
  assert.ok(compiler.compileToPureSvg(world).includes("가나다"));
  assert.equal(core.dump_canonical_jsonl(), saved);
  assert.equal(commits, commitsAfterEdit, "reading line geometry never commits");
  const parentageId = world
    .listEntityIds()
    .find((id) => world.getCanonical(id, "diagram.genogram.parentage"));
  const p = world.getCanonical(parentageId, "diagram.genogram.parentage");
  world.applyCanonicalTransaction("test:delete", [
    { id: p.parentB, aspect: "diagram.genogram.person", patch: null },
  ]);
  assert.equal(
    world.getCanonical(parentageId, "diagram.genogram.parentage").parentB,
    null,
  );
  assert.ok(
    world.getComputed(parentageId, "computed.diagram.genogram.parentage"),
  );
  const postDeleteAccess = toolRegistry.forExtension('diagram.genogram', plugin.aspects.map(a => a.id), () => {}, () => true);
  const offPostDelete = registerGenogramTools({ world, services: { get: () => postDeleteAccess } });
  // Remove the child through the ordinary host path, retaining its cascade-hidden link.
  world.applyCanonicalTransaction('test:delete-child', [{ id: p.child, aspect: 'diagram.genogram.person', patch: null }]);
  assert.equal(world.isAlive(parentageId), false);
  assert.ok(world.exportCanonicalSnapshot()[parentageId], 'hidden relationship remains canonical for Undo');
  const beforeRetry = core.dump_canonical_jsonl(), retryCommits = commits;
  const retry = await postDeleteAccess.invoke('diagram.genogram:plan-changes', { actions: JSON.stringify([
    { action: 'create', kind: 'person', id: 'p1', patch: { name: '이재명', symbol: 'male', isIndexPerson: true }, x: 120, y: 120 },
  ]) }, lifetime.signal);
  assert.equal(core.dump_canonical_jsonl(), beforeRetry);
  assert.equal(commits, retryCommits, 'retry only prepares approval');
  assert.equal(retry.operations.length, 3);
  offPostDelete(); toolRegistry.dispose(); lifetime.abort();
  runtime.dispose();
  core.free();
  const manifest = JSON.parse(
    await readFile(new URL("../alid.extension.json", import.meta.url)),
  );
  const world2 = new CanvasWorld({
      commitCanonicalBatch() {},
      updateSpatialBounds() {},
    }),
    services = new ServiceRegistry(),
    commands = new CommandRegistry(world2);
  services.provide("canvas.creation", {
    create() {
      throw Error("No insertion during activation");
    },
  });
  const storage = new Map();
  const registry = new ExtensionRuntimeRegistry(
    { world: world2, compiler: new SceneVectorCompiler(), commands, services },
    {
      storage: {
        getItem: (k) => storage.get(k) ?? null,
        setItem: (k, v) => storage.set(k, v),
      },
      workspaceId: "integration",
    },
  );
  registry.registerPackages([{ spec: plugin, manifest }]);
  await registry.activateExtension(plugin.id);
  assert.equal(
    registry.getSnapshot().find((r) => r.id === plugin.id).state,
    "active",
  );
  commands.execute("diagram.genogram:privacy");
  assert.equal(
    registry.getSettingValue(plugin.id, "privacy"),
    "surname_masked",
  );
  await registry.reloadExtension(plugin.id);
  assert.equal(
    registry.getSettingValue(plugin.id, "privacy"),
    "surname_masked",
  );
  registry.dispose();
  console.log(
    "Host integration: real Rust Undo/Redo, canonical JSONL purity, headless SVG preview isolation, five aspects and nullify fallback passed.",
  );
} finally {
  await rm(dir, { recursive: true, force: true });
}
