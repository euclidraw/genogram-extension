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
    createElementNS: () => new Element(),
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
    getComputed(_id, aspect) {
      if (aspect === "computed.layoutBounds" || aspect === `computed.${ids.person}`) return { ...transform, rotation: 0, width: 100, height: 120 };
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
        hitTest(x, y, project, out) {
          for (const h of handles.values()) {
            const point = {}, screen = {};
            if (h.getWorldPosition(point)) {
              project(point.x, point.y, screen);
              if (h.shape === "rect" ? Math.abs(x - screen.x) <= h.widthScreenPx / 2 && Math.abs(y - screen.y) <= h.heightScreenPx / 2 : Math.hypot(x - screen.x, y - screen.y) <= h.radiusScreenPx) {
                out.id = h.id;
                return true;
              }
            }
          }
          return false;
        },
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
    surface,
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
test("inline editing overlays the selected text transparently and restores it on close", () => {
  const f = fixture();
  try {
    const text = { style: {}, getAttribute: () => "name", closest: () => ({ getAttribute: () => "p" }) };
    f.element.querySelectorAll = () => [text];
    f.surface.host.getZoom = () => 2;
    const editor = mountInlineEditor(f.context);
    editor.open("p", "name");
    f.paint();
    const input = f.hud.children[0];
    assert.equal(input.style.background, "transparent");
    assert.equal(input.style.border, "0");
    assert.equal(input.style.fontSize, "24px");
    assert.equal(text.style.visibility, "hidden");
    input.dispatchEvent(event("blur"));
    assert.equal(text.style.visibility, "");
    editor.dispose();
  } finally { f.restore(); }
});
test("clinical note editing wraps without squeezing or clipping the text", () => {
  const f = fixture();
  try {
    const previous = lens.showNotes; lens.showNotes = true;
    const editor = mountInlineEditor(f.context);
    f.values.note = "가나다라마바사아자차카타파하";
    editor.open("p", "note"); f.paint();
    const input = f.hud.children[0];
    assert.equal(input.style.whiteSpace, "pre-wrap");
    assert.equal(input.style.overflowWrap, "anywhere");
    assert.equal(input.style.height, "32px");
    assert.equal(input.value, f.values.note);
    editor.dispose(); lens.showNotes = previous;
  } finally { f.restore(); }
});
test("person interactions do not register a separate move button", () => {
  const f = fixture();
  try {
    const dispose = mountInteractions(f.context, () => {});
    assert.equal(f.handles.has("diagram.genogram:move"), false);
    assert.equal(f.handles.has("diagram.genogram:add-child"), true);
    dispose();
    assert.equal(f.handles.size, 0);
  } finally {
    f.restore();
  }
});
test("union adjustment handle shows larger blue lines on a transparent background", () => {
  const f = fixture();
  try {
    const dispose = mountInteractions(f.context, () => {});
    const button = f.hud.children[4], handle = f.handles.get("diagram.genogram:union");
    assert.match(button.innerHTML, /M2 6H22 M2 18H22/);
    assert.equal(button.style.background, "transparent");
    assert.equal(button.style.color, "var(--alid-accent, #008FF0)");
    assert.equal(button.style.width, "24px");
    assert.equal(button.style.height, "24px");
    assert.equal(button.style.border, "none");
    assert.equal(handle.shape, "rect");
    assert.equal(handle.widthScreenPx, 24);
    f.surface.selection.gizmos.hitTest = (_x, _y, _project, hit) => { hit.id = "diagram.genogram:union"; return true; };
    f.element.dispatchEvent(event("pointermove", { clientX: 100, clientY: 100, buttons: 0, pointerType: "mouse" }));
    f.paint();
    assert.equal(f.element.style.cursor, "ns-resize");
    f.element.dispatchEvent(event("pointerleave"));
    assert.equal(f.element.style.cursor, "");
    dispose();
  } finally { f.restore(); }
});
test("parent-child branch handle shows the vertical adjustment cursor", () => {
  const f = fixture();
  try {
    const dispose = mountInteractions(f.context, () => {});
    const button = f.hud.children[5], handle = f.handles.get("diagram.genogram:parentage");
    assert.match(button.innerHTML, /M2 6H22 M2 18H22/);
    assert.equal(button.style.width, "24px");
    assert.equal(button.style.background, "transparent");
    assert.equal(button.style.color, "var(--alid-accent, #008FF0)");
    assert.equal(button.style.border, "none");
    assert.equal(handle.shape, "rect");
    assert.equal(handle.widthScreenPx, 24);
    f.surface.selection.gizmos.hitTest = (_x, _y, _project, hit) => { hit.id = "diagram.genogram:parentage"; return true; };
    f.element.dispatchEvent(event("pointermove", { clientX: 100, clientY: 100, buttons: 0, pointerType: "mouse" }));
    f.paint();
    assert.equal(f.element.style.cursor, "ns-resize");
    f.element.dispatchEvent(event("pointerleave"));
    assert.equal(f.element.style.cursor, "");
    dispose();
  } finally { f.restore(); }
});
test("addition gizmos show a plus and describe the hovered action", () => {
  const f = fixture();
  try {
    const dispose = mountInteractions(f.context, () => {});
    const tooltip = f.hud.children[0];
    for (const [index, x, y, label] of [[1, 194, 103, "배우자 추가"], [2, 150, 164, "자녀 추가"], [3, 150, 38, "부모 추가"]]) {
      assert.match(f.hud.children[index].innerHTML, /M10 4v12M4 10h12/);
      f.element.dispatchEvent(event("pointermove", { clientX: x, clientY: y, buttons: 0, pointerType: "mouse" }));
      f.paint();
      assert.equal(tooltip.textContent, label);
      assert.equal(tooltip.style.display, "block");
    }
    f.element.dispatchEvent(event("pointerleave"));
    assert.equal(tooltip.style.display, "none");
    dispose();
    assert.equal(tooltip.removed, true);
  } finally { f.restore(); }
});
test("addition gizmo offsets preserve the 4px screen gap at different zoom levels", () => {
  const f = fixture();
  try {
    const dispose = mountInteractions(f.context, () => {}), point = {};
    for (const zoom of [0.5, 1, 2]) {
      f.surface.host.getZoom = () => zoom;
      f.handles.get("diagram.genogram:add-parents").getWorldPosition(point);
      assert.equal((0 - point.y) * zoom - 8, 4);
      f.handles.get("diagram.genogram:add-partner").getWorldPosition(point);
      assert.equal((point.x - 82) * zoom - 8, 4);
      f.handles.get("diagram.genogram:add-child").getWorldPosition(point);
      assert.equal((point.y - 102) * zoom - 8, 4);
    }
    dispose();
  } finally { f.restore(); }
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
