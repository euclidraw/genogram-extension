import test from "node:test";
import assert from "node:assert/strict";
import { mergeDraft, mountInlineEditor } from "../src/inline-editor.js";
import { bindPreferences, settingsSchema } from "../src/preferences.js";
import { mountInteractions } from "../src/interactions.js";
import { ids, lens } from "../src/model.js";
class Element extends EventTarget {
  constructor() {
    super();
    this.style = {};
    this.dataset = {};
    this.value = "";
    this.children = [];
  }
  append(e) {
    this.children.push(e);
  }
  remove() {
    this.removed = true;
  }
  setAttribute() {}
  focus() {
    globalThis.document.activeElement = this;
  }
  select() {}
  setPointerCapture() {}
  closest() {
    return null;
  }
  getBoundingClientRect() {
    return { left: 100, top: 50 };
  }
}
function event(type, data = {}) {
  const e = new Event(type, { cancelable: true });
  Object.assign(e, data);
  return e;
}
function fixture() {
  const old = globalThis.document;
  globalThis.document = {
    activeElement: null,
    createElement: () => new Element(),
  };
  let selection = ["p"],
    paint,
    subscribe,
    commits = 0,
    begin = 0,
    abort = 0;
  const values = { name: "홍길동", ageLabel: "34", yearSpan: "1992", note: "" },
    transform = { x: 0, y: 0 },
    previews = [];
  const element = new Element(),
    hud = new Element(),
    handles = new Map();
  const stateMachine = {
    stateId: "root.select",
    mountChildState(_p, s) {
      this.spec = s;
      return () => {};
    },
    transition(id) {
      if (this.stateId !== "root.select") this.spec.onExit();
      this.stateId = id;
    },
  };
  const world = {
    getCanonical(id, a) {
      if (id !== "p") return;
      if (a === ids.person) return values;
      if (a === "core.transform") return transform;
    },
    getComputed() {
      return { ...transform, width: 100, height: 120 };
    },
    listEntityIds: () => ["p", "other"],
    subscribe(fn) {
      subscribe = fn;
      return () => {};
    },
    applyCanonicalTransaction(_c, ops) {
      commits++;
      for (const op of ops)
        Object.assign(
          op.aspect === "core.transform" ? transform : values,
          op.patch,
        );
      subscribe?.();
    },
    createScratchOverlay() {
      return {
        set(id, a, patch) {
          previews.push({ id, a, patch });
        },
        clear() {
          previews.length = 0;
        },
        dispose() {},
      };
    },
  };
  const surface = {
    surface: { element, hud },
    selection: {
      getSelection: () => selection,
      stateMachine,
      gizmos: {
        register(h) {
          handles.set(h.id, h);
          return () => handles.delete(h.id);
        },
      },
    },
    host: {
      screenToWorld(x, y, out) {
        out.x = x - 100;
        out.y = y - 50;
      },
      worldToScreen(x, y, out) {
        out.x = x + 100;
        out.y = y + 50;
      },
      getZoom: () => 1,
      requestRender() {},
      history: {
        begin() {
          begin++;
        },
        commit() {},
        abort() {
          abort++;
        },
      },
    },
  };
  const services = {
    get(n) {
      if (n === "canvas.active-tool-surface")
        return { get: () => surface, subscribe: () => () => {} };
      if (n === "canvas.frames")
        return {
          subscribe(fn) {
            paint = fn;
            return () => {};
          },
        };
      if (n === "canvas.text-history")
        return {
          change() {
            begin++;
          },
          seal() {},
        };
    },
  };
  return {
    context: { world, services },
    element,
    hud,
    values,
    transform,
    handles,
    previews,
    paint: () => paint?.(),
    counts: () => ({ commits, begin, abort }),
    remote(patch) {
      Object.assign(values, patch);
      subscribe?.();
    },
    restore() {
      globalThis.document = old;
    },
  };
}
test("composition rebase preserves remote edits on either side and Unicode", () => {
  assert.equal(mergeDraft("홍동", "홍길동", "김홍동"), "김홍길동");
  assert.equal(mergeDraft("홍동", "홍길동", "홍동님"), "홍길동님");
  assert.equal(mergeDraft("A😀B", "A😀한B", "XA😀B"), "XA😀한B");
  assert.equal(mergeDraft("abc", "abc", "remote"), "remote");
});
test("inline editor protects IME, merges remote text, uses document history and survives remount disposal", () => {
  const f = fixture();
  try {
    lens.privacy = "full";
    const editor = mountInlineEditor(f.context);
    editor.open("p");
    const input = f.hud.children[0];
    input.dispatchEvent(event("compositionstart"));
    input.value = "홍길동님";
    input.dispatchEvent(event("input"));
    assert.equal(f.counts().commits, 0);
    f.remote({ name: "김홍길동" });
    input.dispatchEvent(event("keydown", { key: "Escape", isComposing: true }));
    assert.equal(input.style.display, "block");
    input.dispatchEvent(event("compositionend"));
    assert.equal(f.values.name, "김홍길동님");
    assert.equal(f.counts().commits, 1);
    assert.equal(f.counts().begin, 1);
    f.paint();
    assert.ok(input.style.left);
    editor.dispose();
    assert.equal(input.removed, true);
  } finally {
    f.restore();
  }
});
test("rail handle preview cancels without writes and commits one translation", () => {
  const f = fixture();
  try {
    const dispose = mountInteractions(f.context, () => {}),
      h = f.handles.get("diagram.genogram:move");
    const down = () =>
      h.onPointerDown(
        event("pointerdown", {
          clientX: 150,
          clientY: 50,
          pointerId: 1,
          button: 0,
        }),
      );
    down();
    f.element.dispatchEvent(
      event("pointermove", { clientX: 170, clientY: 80, pointerId: 1 }),
    );
    assert.equal(f.counts().commits, 0);
    assert.ok(f.previews.length);
    f.element.dispatchEvent(event("keydown", { key: "Escape" }));
    assert.equal(f.previews.length, 0);
    assert.equal(f.counts().commits, 0);
    down();
    f.element.dispatchEvent(
      event("pointermove", { clientX: 170, clientY: 80, pointerId: 1 }),
    );
    f.element.dispatchEvent(
      event("pointerup", { clientX: 170, clientY: 80, pointerId: 1 }),
    );
    assert.equal(f.counts().commits, 1);
    assert.deepEqual(f.transform, { x: 20, y: 30 });
    dispose();
    assert.equal(f.handles.size, 0);
  } finally {
    f.restore();
  }
});
test("workspace preferences persist through activation without document writes", () => {
  const store = new Map(settingsSchema.map((f) => [f.key, f.defaultValue]));
  let notify,
    invalidations = 0;
  const context = {
    world: {
      invalidateComputed() {
        invalidations++;
      },
    },
    services: {
      get() {
        return {
          get(key) {
            return store.get(key);
          },
          set(key, value) {
            store.set(key, value);
            notify?.();
          },
          subscribe(fn) {
            notify = fn;
            return () => {
              notify = null;
            };
          },
        };
      },
    },
  };
  const a = bindPreferences(context);
  a.change("privacy", "hidden");
  assert.equal(lens.privacy, "hidden");
  a.dispose();
  lens.privacy = "full";
  const b = bindPreferences(context);
  assert.equal(lens.privacy, "hidden");
  assert.ok(invalidations);
  b.change("privacy", "full");
  b.dispose();
});
