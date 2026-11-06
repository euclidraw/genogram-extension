import { icons } from "./icons.js";
import { ids, prefix } from "./model.js";
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
      screen = { x: 0, y: 0 };
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
        kind === "move" ||
        kind.startsWith("add-") ||
        kind.includes("sibling")
      ) {
        if (!p) return false;
        const b = world.getComputed(id, "computed.layoutBounds");
        if (!b) return false;
        const dx =
            kind === "move"
              ? b.width / 2
              : kind === "older-sibling"
                ? -18
                : kind === "younger-sibling" || kind === "add-partner"
                  ? b.width + 18
                  : b.width / 2,
          dy =
            kind === "move"
              ? -42
              : kind === "add-parents"
                ? -18
                : kind === "add-child"
                  ? b.height + 18
                  : kind === "add-partner"
                    ? 32
                    : kind === "add-twin"
                      ? b.height
                      : 32;
        out.x = b.x + dx;
        out.y = b.y + dy;
        return true;
      }
      const g = world.getComputed(id, `computed.${ids[kind]}`);
      if (!g) return false;
      out.x = g.origin.x;
      out.y = g.origin.y;
      return true;
    }
    const kinds = [
      "move",
      "add-partner",
      "add-child",
      "add-parents",
      "union",
      "parentage",
      "relation",
    ];
    for (const kind of kinds) {
      const el = document.createElement("button");
      const title = {
        move: "세대·형제 간격 이동",
        "add-partner": "배우자 추가",
        "add-child": "자녀 추가",
        "add-parents": "부모 추가",
        union: "결합선 높이",
        parentage: "자녀 분기 높이",
        relation: "정서선 곡률",
      }[kind];
      const paths = icons[kind]?.paths;
      if (paths)
        el.innerHTML = `<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths.map((d) => `<path d="${d}"/>`).join("")}</svg>`;
      else el.textContent = "◆";
      el.title = title;
      el.setAttribute("aria-label", title);
      el.dataset.canvasUi = "true";
      Object.assign(el.style, {
        position: "absolute",
        width: "22px",
        height: "22px",
        padding: "0",
        border: "1px solid #64748b",
        borderRadius: "50%",
        background: "white",
        pointerEvents: "none",
        display: "none",
      });
      s.surface.hud.append(el);
      elements.push(el);
      const handle = {
        id: `${prefix}:${kind}`,
        priority: 30,
        shape: "circle",
        radiusScreenPx: 11,
        getWorldPosition: (out) => location(kind, out),
        onPointerDown(e) {
          if (
            composing ||
            e.isComposing ||
            Date.now() < until ||
            e.button !== 0
          )
            return false;
          if (kind !== "move" && !(kind in ids)) {
            run(kind);
            return true;
          }
          const id = target();
          if (kind === "move") {
            const base = world.getCanonical(id, "core.transform");
            s.host.screenToWorld(e.clientX, e.clientY, point);
            gesture = {
              id,
              kind,
              baseX: base.x,
              baseY: base.y,
              startX: point.x,
              startY: point.y,
              startClientY: e.clientY,
              startClientX: e.clientX,
              pointer: e.pointerId,
              x: base.x,
              y: base.y,
            };
            s.selection.stateMachine.transition(key);
            s.surface.element.setPointerCapture(e.pointerId);
            return true;
          }
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
    function move(e) {
      if (!gesture || e.pointerId !== gesture.pointer) return;
      s.host.screenToWorld(e.clientX, e.clientY, point);
      if (gesture.kind === "move") {
        let x = gesture.baseX + point.x - gesture.startX,
          y = gesture.baseY + point.y - gesture.startY;
        const threshold = 8 / Math.max(0.01, s.host.getZoom());
        for (const other of world.listEntityIds()) {
          if (other === gesture.id || !world.getCanonical(other, ids.person))
            continue;
          const t = world.getCanonical(other, "core.transform");
          if (!t) continue;
          for (let rail = -1; rail <= 1; rail++) {
            const rx = t.x + rail * 110,
              ry = t.y + rail * 240;
            if (Math.abs(x - rx) < threshold) x = rx;
            if (Math.abs(y - ry) < threshold) y = ry;
          }
        }
        gesture.x = x;
        gesture.y = y;
        if (
          Math.hypot(
            e.clientX - gesture.startClientX,
            e.clientY - gesture.startClientY,
          ) < 3.5
        )
          return;
        overlay.set(gesture.id, "core.transform", { x, y });
        s.host.requestRender();
        return;
      }
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
      if (g.kind === "move") {
        if (
          Math.hypot(e.clientX - g.startClientX, e.clientY - g.startClientY) <
          3.5
        )
          return;
        const current = world.getCanonical(g.id, "core.transform");
        if (!current) return;
        s.host.history.begin();
        try {
          world.applyCanonicalTransaction(`${prefix}:rail-move`, [
            {
              id: g.id,
              aspect: "core.transform",
              patch: {
                x: current.x + g.x - g.baseX,
                y: current.y + g.y - g.baseY,
              },
            },
          ]);
          s.host.history.commit();
        } catch (err) {
          s.host.history.abort();
          throw err;
        }
        return;
      }
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
        for (let i = 0; i < handles.length; i++) {
          const el = elements[i];
          if (!handles[i].getWorldPosition(point)) {
            el.style.display = "none";
            continue;
          }
          s.host.worldToScreen(point.x, point.y, screen);
          el.style.display = "block";
          const rect = s.surface.hud.getBoundingClientRect();
          el.style.left = `${screen.x - rect.left - 11}px`;
          el.style.top = `${screen.y - rect.top - 11}px`;
        }
      }),
    );
    clean = () => {
      cancel();
      for (const f of off.reverse()) f();
      overlay.dispose();
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
