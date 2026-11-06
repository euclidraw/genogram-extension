import { icons } from "./icons.js";
import { ids, prefix } from "./model.js";
import { selectionBox } from "./aspects/person.js";
/** Each active view owns handles and preview; the host owns the frame clock and input arbitration. */
export function mountInteractions(context, run) {
  const provider = context.services.get("canvas.active-tool-surface"),
    frames = context.services.get("canvas.frames");
  if (!provider || !frames) return () => {};
  let clean = () => {};
  function mount() {
    clean();
    const s = provider.get();
    if (!s) return;
    const { world } = context,
      off = [],
      overlay = world.createScratchOverlay(`${prefix}:handles`),
      elements = [],
      handles = [],
      point = { x: 0, y: 0 },
      screen = { x: 0, y: 0 },
      bounds = { x: 0, y: 0, width: 0, height: 0, rotation: 0 },
      hit = { id: "", priority: 0, distanceScreenPx: 0 };
    let hoverX = 0, hoverY = 0, hovering = false;
    const tooltip = document.createElement("div");
    tooltip.setAttribute("role", "tooltip");
    Object.assign(tooltip.style, {
      position: "absolute", display: "none", pointerEvents: "none",
      whiteSpace: "nowrap", padding: "5px 8px", borderRadius: "5px",
      background: "var(--alid-bg-surface, #fff)", color: "var(--alid-text, #18181b)",
      border: "1px solid var(--alid-border-subtle, #e4e4e7)",
      boxShadow: "var(--alid-shadow, 0 1px 2px #0001)",
      font: "12px/1.4 var(--alid-font, system-ui, sans-serif)",
    });
    s.surface.hud.append(tooltip);
    let gesture = null,
      composing = false,
      until = 0;
    const key = `root.select.${prefix}:adjust`;
    function cancel() {
      gesture = null;
      overlay.clear();
      if (s.selection.stateMachine.stateId === key)
        s.selection.stateMachine.transition("root.select");
    }
    off.push(
      s.selection.stateMachine.mountChildState("root.select", {
        id: `${prefix}:adjust`,
        onExit() {
          gesture = null;
          overlay.clear();
        },
      }),
    );
    function target() {
      const selected = s.selection.getSelection();
      return selected.length === 1 ? selected[0] : null;
    }
    function location(kind, out) {
      const id = target();
      if (!id) return false;
      const p = world.getCanonical(id, ids.person);
      if (
        kind.startsWith("add-") ||
        kind.includes("sibling")
      ) {
        if (!p) return false;
        const geometry = world.getComputed(id, `computed.${ids.person}`);
        if (!geometry) return false;
        selectionBox(p, geometry, bounds);
        // The half-button and gap remain 8px and 4px in screen coordinates.
        const offset = 12 / Math.max(0.01, s.host.getZoom());
        out.x = kind === "add-partner"
          ? bounds.x + bounds.width + offset
          : bounds.x + bounds.width / 2;
        out.y = kind === "add-parents"
          ? bounds.y - offset
          : kind === "add-child"
            ? bounds.y + bounds.height + offset
            : bounds.y + bounds.height / 2;
        return true;
      }
      const g = world.getComputed(id, `computed.${ids[kind]}`);
      if (!g) return false;
      out.x = g.origin.x;
      out.y = g.origin.y;
      return true;
    }
    const kinds = [
      "add-partner",
      "add-child",
      "add-parents",
      "union",
      "parentage",
      "relation",
    ];
    for (const kind of kinds) {
      const isLineHandle = kind === "union" || kind === "parentage";
      const el = isLineHandle
        ? document.createElementNS("http://www.w3.org/2000/svg", "svg")
        : document.createElement("button");
      const title = {
        "add-partner": "배우자 추가",
        "add-child": "자녀 추가",
        "add-parents": "부모 추가",
        union: "결합선 높이",
        parentage: "자녀 분기 높이",
        relation: "정서선 곡률",
      }[kind];
      const isAddButton = kind.startsWith("add-");
      const isBlueHandle = isAddButton || isLineHandle;
      const paths = isAddButton ? ["M10 4v12M4 10h12"] : icons[kind]?.paths;
      if (isLineHandle) {
        el.setAttribute("viewBox", "0 0 24 24");
        el.setAttribute("aria-hidden", "true");
        el.innerHTML = '<path d="M2 6H22 M2 18H22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';
      } else if (paths)
        el.innerHTML = `<svg viewBox="0 0 20 20" width="${isAddButton ? 12 : 14}" height="${isAddButton ? 12 : 14}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths.map((d) => `<path d="${d}"/>`).join("")}</svg>`;
      else el.textContent = "◆";
      if (!isLineHandle) el.title = title;
      el.setAttribute("aria-label", title);
      el.dataset.canvasUi = "true";
      Object.assign(el.style, {
        position: "absolute",
        width: isLineHandle ? "24px" : isAddButton ? "16px" : "22px",
        height: isLineHandle ? "24px" : isAddButton ? "16px" : "22px",
        padding: "0",
        border: isBlueHandle ? "none" : "1px solid #64748b",
        borderRadius: isBlueHandle ? "3px" : "50%",
        background: isLineHandle ? "transparent" : isAddButton ? "var(--alid-accent, #008FF0)" : "white",
        color: isLineHandle ? "var(--alid-accent, #008FF0)" : isAddButton ? "white" : "",
        pointerEvents: "none",
        display: "none",
      });
      s.surface.hud.append(el);
      elements.push(el);
      const handle = {
        id: `${prefix}:${kind}`,
        priority: 30,
        shape: isBlueHandle ? "rect" : "circle",
        radiusScreenPx: 11,
        widthScreenPx: isLineHandle ? 24 : isAddButton ? 16 : 22,
        heightScreenPx: isLineHandle ? 24 : isAddButton ? 16 : 22,
        getWorldPosition: (out) => location(kind, out),
        onPointerDown(e) {
          if (
            composing ||
            e.isComposing ||
            Date.now() < until ||
            e.button !== 0
          )
            return false;
          if (!(kind in ids)) {
            run(kind);
            return true;
          }
          const id = target();
          const field =
              kind === "union"
                ? "barOffset"
                : kind === "parentage"
                  ? "barRatio"
                  : "curveOffset",
            p = world.getCanonical(id, ids[kind]);
          s.host.screenToWorld(e.clientX, e.clientY, point);
          gesture = {
            id,
            kind,
            field,
            initial: p[field],
            startY: point.y,
            startClientY: e.clientY,
            delta: 0,
            pointer: e.pointerId,
          };
          s.selection.stateMachine.transition(key);
          s.surface.element.setPointerCapture(e.pointerId);
          return true;
        },
      };
      off.push(s.selection.gizmos.register(handle));
      handles.push(handle);
    }
    function clearAdjustmentCursor() {
      if (s.surface.element.style.cursor === "ns-resize") s.surface.element.style.cursor = "";
    }
    function move(e) {
      hovering = !gesture && !e.buttons && e.pointerType !== "touch";
      hoverX = e.clientX; hoverY = e.clientY;
      s.host.requestRender();
      if (!gesture || e.pointerId !== gesture.pointer) return;
      s.host.screenToWorld(e.clientX, e.clientY, point);
      gesture.delta =
        (point.y - gesture.startY) / (gesture.kind === "parentage" ? 200 : 1);
      if (Math.abs(e.clientY - gesture.startClientY) < 3.5) return;
      const value = gesture.initial + gesture.delta;
      overlay.set(gesture.id, ids[gesture.kind], {
        [gesture.field]:
          gesture.kind === "parentage"
            ? Math.max(0.1, Math.min(0.9, value))
            : value,
      });
      s.host.requestRender();
    }
    function up(e) {
      if (!gesture || e.pointerId !== gesture.pointer) return;
      const g = gesture;
      cancel();
      if (Math.abs(e.clientY - g.startClientY) < 3.5) return;
      const current = world.getCanonical(g.id, ids[g.kind]);
      if (!current) return;
      const value = current[g.field] + g.delta;
      s.host.history.begin();
      try {
        world.applyCanonicalTransaction(`${prefix}:adjust`, [
          {
            id: g.id,
            aspect: ids[g.kind],
            patch: {
              [g.field]:
                g.kind === "parentage"
                  ? Math.max(0.1, Math.min(0.9, value))
                  : value,
            },
          },
        ]);
        s.host.history.commit();
      } catch (err) {
        s.host.history.abort();
        throw err;
      }
    }
    function keydown(e) {
      if (
        !composing &&
        !e.isComposing &&
        e.keyCode !== 229 &&
        Date.now() >= until &&
        e.key === "Escape"
      )
        cancel();
    }
    const events = {
      pointermove: move,
      pointerleave: () => { hovering = false; tooltip.style.display = "none"; clearAdjustmentCursor(); },
      pointerdown: () => { hovering = false; tooltip.style.display = "none"; },
      pointerup: up,
      pointercancel: cancel,
      lostpointercapture: cancel,
      keydown,
      compositionstart: () => {
        composing = true;
        cancel();
      },
      compositionend: () => {
        composing = false;
        until = Date.now() + 16;
      },
    };
    for (const [name, fn] of Object.entries(events)) {
      s.surface.element.addEventListener(name, fn);
      off.push(() => s.surface.element.removeEventListener(name, fn));
    }
    off.push(
      frames.subscribe(() => {
        const hasHit = hovering && s.selection.gizmos.hitTest(hoverX, hoverY, s.host.worldToScreen, hit);
        if (hasHit && (hit.id === `${prefix}:union` || hit.id === `${prefix}:parentage`)) s.surface.element.style.cursor = "ns-resize";
        else clearAdjustmentCursor();
        const hovered = hasHit
          ? kinds.findIndex(kind => kind.startsWith("add-") && `${prefix}:${kind}` === hit.id) : -1;
        tooltip.style.display = hovered >= 0 ? "block" : "none";
        if (hovered >= 0 && handles[hovered].getWorldPosition(point)) {
          tooltip.textContent = elements[hovered].title;
          s.host.worldToScreen(point.x, point.y, screen);
          const rect = s.surface.hud.getBoundingClientRect();
          tooltip.style.left = `${screen.x - rect.left + 16}px`;
          tooltip.style.top = `${screen.y - rect.top + 14}px`;
        } else tooltip.style.display = "none";
        for (let i = 0; i < handles.length; i++) {
          const el = elements[i];
          if (!handles[i].getWorldPosition(point)) {
            el.style.display = "none";
            continue;
          }
          s.host.worldToScreen(point.x, point.y, screen);
          el.style.display = "block";
          const rect = s.surface.hud.getBoundingClientRect();
          const half = (kinds[i] === "union" || kinds[i] === "parentage") ? 12 : kinds[i].startsWith("add-") ? 8 : 11;
          el.style.left = `${screen.x - rect.left - half}px`;
          el.style.top = `${screen.y - rect.top - half}px`;
        }
      }),
    );
    clean = () => {
      cancel();
      clearAdjustmentCursor();
      for (const f of off.reverse()) f();
      overlay.dispose();
      tooltip.remove();
      for (const el of elements) el.remove();
    };
  }
  mount();
  const unsubscribe = provider.subscribe(mount);
  return () => {
    unsubscribe();
    clean();
  };
}
