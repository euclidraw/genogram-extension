import { ids, defaults, prefix, display, lens } from "./model.js";
import { symbols } from "./aspects/person.js";
import { enumerations } from "./aspects/lines.js";

const enums = {
  symbol: symbols,
  orientation: ["none", "gay", "lesbian", "bisexual"],
  lifeStatus: ["alive", "deceased"],
  clinical: ["none", "physical", "mental", "substance", "mental_substance", "recovering", "substance_recovery", "illness_remission", "suspected_substance", "recovery_with_illness"],
};

/** Discovery callbacks only read or prepare operations. Never execute UI commands. */
export function registerGenogramTools(context) {
  const tools = context.services.get("workspace.tools");
  if (!tools) return () => {};
  const off = [];
  const { world } = context;
  const read = id => {
    if (!world.isAlive(id)) throw Error("INVALID_INPUT: missing entity");
    const aspects = Object.fromEntries(Object.values(ids).flatMap(aspect => {
      const value = world.getCanonical(id, aspect);
      if (!value) return [];
      const copy = structuredClone(value);
      if (aspect === ids.person) {
        copy.name = display(copy.name, "name");
        copy.yearSpan = display(copy.yearSpan);
        copy.note = lens.showNotes ? display(copy.note) : "";
      }
      return [[aspect, copy]];
    }));
    return { id, aspects };
  };
  const register = (name, description, properties, required, execute) => off.push(tools.register({
    id: `${prefix}:${name}`, description,
    inputSchema: { type: "object", properties, required },
    execute: async (input, { signal }) => { signal.throwIfAborted(); return execute(input); },
  }));
  try {
    register("plan-changes", "가계도 genogram 생성·삭제·가족 구조·관계·배치 수정. actions is JSON array: [{action:'create',kind:'person',id:'alias',patch:{name:'Kim'},x:0,y:0},{action:'create',kind:'union',patch:{partnerA:'alias',partnerB:'existing-id'}},{action:'update',id:'existing-id',kind:'person',patch:{name:'Lee'}},{action:'move',id:'existing-id',x:180,y:240},{action:'delete',id:'existing-id'}]. kind: person/union/parentage/relation/household. References may use aliases defined in this batch. Create IDs are host-generated. Delete cascades attached relations and clears household/twin references. Returns approval proposal, NEVER applies. Up to 100 operations; no clinical inference. Use descriptors for fields and schema tool for defaults/enums.",
      { actions: { type: "string" } }, ["actions"], ({ actions }) => {
        if (!tools.prepareChange) throw Error("Host update required: extension change approvals");
        return tools.prepareChange(planGenogramChanges(world, JSON.parse(actions)));
      });
    register("schema", "가계도 genogram defaults, enum values and batch action format (read-only).", {}, [], () => ({ defaults, enums, ids,
      enumerations,
      instructions: 'Pass actions as a JSON array encoded in a string, not as an array value. Example decoded array: [{"action":"create","kind":"person","id":"p1","patch":{"name":"Kim","symbol":"male","isIndexPerson":true},"x":120,"y":120}]. Use isIndexPerson:true only when requested as the client/index person; symbol, not gender, selects the symbol. Create union with partnerA/B; parentage with parentA/B, child, union; relation with from/to/kind. plan-changes previews the complete atomic batch for user approval. Never infer sensitive attributes.' }));
    for (const [kind, aspect] of Object.entries(ids)) off.push(tools.registerDescriptor({
      aspect,
      description: `가계도 genogram ${kind}. References are entity IDs, not names. Do not infer clinical diagnoses. Use plan-changes for creation/deletion/structure/layout with explicit user approval; no direct mutation tools.`,
      fields: Object.fromEntries(Object.entries(defaults[kind]).map(([field, value]) => [field,
        enums[field] ? `Allowed: ${enums[field].join(", ")}` : `${value === null ? "entity reference or null" : typeof value}: ${field}`])),
    }));
    register("search", "가계도 genogram 인물·가족·관계 조회. Respects name/year privacy and hidden notes. Search query matches visible names or IDs. Paginated, no writes.",
      { query: { type: "string" }, offset: { type: "number" } }, [], ({ query = "", offset = 0 }) => {
        if (!Number.isInteger(offset) || offset < 0 || query.length > 200) throw Error("INVALID_INPUT");
        const matches = world.listEntityIds().filter(id => world.isAlive(id) && Object.values(ids).some(aspect => world.getCanonical(id, aspect)))
          .filter(id => `${id} ${display(world.getCanonical(id, ids.person)?.name, "name")}`.toLowerCase().includes(query.toLowerCase()));
        return { entities: matches.slice(offset, offset + 20).map(read), total: matches.length, nextOffset: offset + 20 < matches.length ? offset + 20 : null };
      });
    register("relationships", "가계도 genogram 인물의 부부·부모자녀·정서 관계 조회 (read-only).", { personId: { type: "string" } }, ["personId"], ({ personId }) => {
      if (!world.isAlive(personId) || !world.getCanonical(personId, ids.person)) throw Error("INVALID_INPUT: person required");
      const matches = world.listEntityIds().filter(id => world.isAlive(id) &&
        [[ids.union, ["partnerA", "partnerB"]], [ids.parentage, ["parentA", "parentB", "child"]], [ids.relation, ["from", "to"]]]
          .some(([aspect, fields]) => fields.some(field => world.getCanonical(id, aspect)?.[field] === personId)));
      return { person: read(personId), relationships: matches.slice(0, 50).map(read), truncated: matches.length > 50 };
    });
    register("plan-person-edit", "가계도 genogram 인물 속성 수정안. patch is a JSON object string. Returns operations only, DOES NOT APPLY. Target must be selected at send time; pass operations to changes_propose for user approval. Never infer diagnoses. No householdId/reference editing, creation or deletion.",
      { personId: { type: "string" }, patch: { type: "string" } }, ["personId", "patch"], ({ personId, patch }) => {
        if (!world.isAlive(personId) || !world.getCanonical(personId, ids.person)) throw Error("INVALID_INPUT: person required");
        const value = JSON.parse(patch);
        if (!value || Array.isArray(value) || typeof value !== "object" || !Object.keys(value).length) throw Error("INVALID_INPUT: patch object required");
        for (const [field, v] of Object.entries(value)) {
          if (!Object.hasOwn(defaults.person, field) || field === "householdId" || typeof v !== typeof defaults.person[field]) throw Error("INVALID_INPUT: field/type");
          if (enums[field] && !enums[field].includes(v)) throw Error("INVALID_INPUT: enum");
          if (typeof v === "string" && v.length > 4000 || typeof v === "number" && (!Number.isInteger(v) || Math.abs(v) > 10000)) throw Error("INVALID_INPUT: field budget");
        }
        return { status: "plan-only", requiresApproval: true, operations: [{ id: personId, aspect: ids.person, patch: value }] };
      });
  } catch (error) { for (const dispose of off.reverse()) dispose(); throw error; }
  return () => { for (const dispose of off.splice(0).reverse()) dispose(); };
}

export function planGenogramChanges(world, actions) {
  if (!Array.isArray(actions) || !actions.length || actions.length > 50) throw Error("INVALID_INPUT: actions budget");
  const snapshot = world.exportCanonicalSnapshot(), next = structuredClone(snapshot), aliases = new Map(), ops = [];
  // Use the host's reference projection (including nullify) for graph checks,
  // while leaving the authoritative canonical snapshot and approval read set intact.
  for (const [id, entity] of Object.entries(next)) if (world.isAlive(id)) {
    for (const aspect of Object.values(ids)) if (entity[aspect]) entity[aspect] = structuredClone(world.getCanonical(id, aspect));
  }
  const resolve = id => aliases.get(id) ?? id;
  for (const action of actions) {
    if (!action || typeof action !== "object" || Array.isArray(action)) throw Error("INVALID_INPUT: action");
    if (action.action !== "create") continue;
    if (!Object.hasOwn(ids, action.kind)) throw Error("INVALID_INPUT: kind");
    if (action.id !== undefined && (typeof action.id !== "string" || !action.id || aliases.has(action.id) || Object.hasOwn(snapshot, action.id))) throw Error("INVALID_INPUT: duplicate alias");
    const id = `genogram-${crypto.randomUUID()}`;
    aliases.set(action.id ?? id, id);
  }
  let createIndex = 0;
  const newIds = [...aliases.values()];
  const push = (id, aspect, patch) => {
    ops.push({ id, aspect, patch });
    if (patch === null) delete next[id];
    else { next[id] ??= {}; next[id][aspect] = { ...next[id][aspect], ...patch }; }
  };
  const references = { person: ["householdId"], union: ["partnerA", "partnerB"], parentage: ["parentA", "parentB", "child", "union", "twinWith"], relation: ["from", "to"], household: [] };
  for (const action of actions) {
    if (!action || typeof action !== "object") throw Error("INVALID_INPUT: action");
    const id = action.action === "create" ? newIds[createIndex++] : resolve(action.id);
    if (typeof id !== "string" || !id) throw Error("INVALID_INPUT: id");
    if (action.action !== "create" && (!Object.values(ids).some(aspect => next[id]?.[aspect]) || Object.hasOwn(snapshot, id) && !world.isAlive(id))) throw Error("INVALID_INPUT: missing genogram entity");
    if (action.action === "delete") { push(id, ids.person, null); continue; }
    if (action.action === "move") {
      if (!next[id]?.[ids.person] || !Number.isFinite(action.x) || !Number.isFinite(action.y) || Math.abs(action.x) > 1e7 || Math.abs(action.y) > 1e7) throw Error("INVALID_INPUT: person position");
      push(id, "core.transform", { x: action.x, y: action.y }); continue;
    }
    if (!["create", "update"].includes(action.action) || !Object.hasOwn(ids, action.kind)) throw Error("INVALID_INPUT: action/kind");
    const kind = action.kind, aspect = ids[kind];
    if (action.action === "update" && !next[id]?.[aspect]) throw Error("INVALID_INPUT: aspect mismatch");
    const patch = action.patch ?? {};
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) throw Error("INVALID_INPUT: patch");
    for (const [field, value] of Object.entries(patch)) {
      if (!Object.hasOwn(defaults[kind], field)) throw Error("INVALID_INPUT: field");
      if (references[kind].includes(field)) { if (value !== null && typeof value !== "string") throw Error("INVALID_INPUT: reference"); }
      else if (typeof value !== typeof defaults[kind][field] || typeof value === "string" && value.length > 4000 || typeof value === "number" && (!Number.isFinite(value) || Math.abs(value) > 1e7)) throw Error("INVALID_INPUT: field type/budget");
      const allowed = kind === "person" ? enums[field] : enumerations[kind]?.[field];
      if (allowed && !allowed.includes(value)) throw Error("INVALID_INPUT: enum");
    }
    const values = { ...(action.action === "create" ? defaults[kind] : {}), ...patch };
    for (const field of references[kind]) if (typeof values[field] === "string") values[field] = resolve(values[field]);
    push(id, aspect, values);
    if (action.action === "create" && kind === "person") {
      const x = action.x ?? 0, y = action.y ?? 0;
      if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 1e7 || Math.abs(y) > 1e7) throw Error("INVALID_INPUT: position");
      push(id, "core.transform", { x, y, rotation: 0 }); push(id, "core.bounds", { width: 100, height: 120 });
    }
  }
  const deleted = new Set(ops.filter(op => op.patch === null).map(op => op.id));
  for (const [id, entity] of Object.entries(next)) {
    for (const kind of ["union", "parentage", "relation"]) {
      const value = entity[ids[kind]];
      if (value && references[kind].filter(field => field !== "twinWith").some(field => deleted.has(value[field]))) { push(id, ids[kind], null); deleted.add(id); }
    }
  }
  // A deleted union can invalidate a parentage discovered earlier in the scan.
  for (const [id, entity] of Object.entries(next)) if (entity[ids.parentage] && deleted.has(entity[ids.parentage].union)) { push(id, ids.parentage, null); deleted.add(id); }
  for (const [id, entity] of Object.entries(next)) {
    if (deleted.has(entity[ids.person]?.householdId)) push(id, ids.person, { householdId: null });
    if (deleted.has(entity[ids.parentage]?.twinWith)) push(id, ids.parentage, { twinWith: null, twinType: "none" });
  }
  // Canonical snapshots retain cascade-hidden relationships for Undo. They are
  // not part of the live graph and must not block unrelated new proposals.
  // Still validate every touched/new entity so invalid new references fail closed.
  const touched = new Set(ops.map(op => op.id));
  validateGraph(Object.fromEntries(Object.entries(next).filter(([id]) => touched.has(id) || world.isAlive(id))));
  if (ops.length > 100) throw Error("INVALID_INPUT: operation budget");
  return ops;
}

function validateGraph(snapshot) {
  const person = id => !!snapshot[id]?.[ids.person], unions = new Set(), parents = new Map();
  for (const entity of Object.values(snapshot)) {
    const p = entity[ids.person], u = entity[ids.union], c = entity[ids.parentage], r = entity[ids.relation];
    if (p?.householdId && !snapshot[p.householdId]?.[ids.household]) throw Error("INVALID_INPUT: household reference");
    if (u) {
      if (!person(u.partnerA) || !person(u.partnerB) || u.partnerA === u.partnerB) throw Error("INVALID_INPUT: partners");
      const key = [u.partnerA, u.partnerB].sort().join("\0");
      if (unions.has(key)) throw Error("INVALID_INPUT: duplicate union"); unions.add(key);
    }
    if (c) {
      if (!person(c.child) || ![c.parentA, c.parentB].some(person) || [c.parentA, c.parentB].some(id => id !== null && !person(id)) || c.parentA && c.parentA === c.parentB) throw Error("INVALID_INPUT: parentage");
      if (c.union) {
        const u = snapshot[c.union]?.[ids.union];
        if (!u || ![c.parentA, c.parentB].every(id => id === null || [u.partnerA, u.partnerB].includes(id))) throw Error("INVALID_INPUT: union reference");
      }
      if (c.twinWith && (!person(c.twinWith) || c.twinWith === c.child)) throw Error("INVALID_INPUT: twin reference");
      const list = parents.get(c.child) ?? [];
      for (const id of [c.parentA, c.parentB].filter(Boolean)) { if (list.includes(id)) throw Error("INVALID_INPUT: duplicate parentage"); list.push(id); }
      parents.set(c.child, list);
    }
    if (r && (!person(r.from) || !person(r.to) || r.from === r.to)) throw Error("INVALID_INPUT: relation endpoints");
  }
  const done = new Set(), visiting = new Set();
  function visit(id) { if (visiting.has(id)) throw Error("INVALID_INPUT: ancestry cycle"); if (done.has(id)) return; visiting.add(id); for (const p of parents.get(id) ?? []) visit(p); visiting.delete(id); done.add(id); }
  for (const id of parents.keys()) visit(id);
}
