import { ids, prefix, lens } from "./model.js";
import { labelExtent, noteLines } from "./aspects/person.js";
/** Changes outside the locally edited span survive remote updates during composition. */
export function mergeDraft(base, local, remote) {
  if (remote === base || local === remote) return local;
  if (local === base) return remote;
  let a = 0,
    z = 0;
  while (a < base.length && a < local.length && base[a] === local[a]) a++;
  while (
    z < base.length - a &&
    z < local.length - a &&
    base[base.length - 1 - z] === local[local.length - 1 - z]
  )
    z++;
  let r = 0,
    t = 0;
  while (r < base.length && r < remote.length && base[r] === remote[r]) r++;
  while (
    t < base.length - r &&
    t < remote.length - r &&
    base[base.length - 1 - t] === remote[remote.length - 1 - t]
  )
    t++;
  const end = base.length - z,
    remoteEnd = base.length - t,
    insert = local.slice(a, local.length - z),
    delta = remote.length - base.length;
  if (remoteEnd <= a)
    return remote.slice(0, a + delta) + insert + remote.slice(end + delta);
  if (r >= end) return remote.slice(0, a) + insert + remote.slice(end);
  // Concurrent replacement of the same span retains both contributions.
  return (
    remote.slice(0, Math.min(a, r)) +
    remote.slice(r, remote.length - t) +
    insert +
    remote.slice(Math.max(remoteEnd, end) + delta)
  );
}
export function mountInlineEditor(context) {
  const provider = context.services.get("canvas.active-tool-surface"),
    frames = context.services.get("canvas.frames"),
    textHistory = context.services.get("canvas.text-history");
  let close = () => {},
    openCurrent = () => {},
    detach = () => {};
  function mount() {
    close();
    detach();
    const s = provider?.get();
    if (!s || !frames || typeof document === "undefined") return;
    let session = null,
      until = 0,
      composing = false,
      offWorld = () => {};
    const input = document.createElement("textarea");
    input.dataset.canvasEditor = "true";
    input.dataset.genogramEditor = "true";
    input.dataset.escapeOwner = "true";
    input.setAttribute("aria-label", "가계도 인물 편집");
    Object.assign(input.style, {
      position: "absolute",
      display: "none",
      boxSizing: "border-box",
      resize: "none",
      overflow: "hidden",
      padding: "0",
      border: "0",
      outline: "none",
      background: "transparent",
      color: "#334155",
      textAlign: "center",
      whiteSpace: "pre",
      transformOrigin: "top center",
      pointerEvents: "auto",
      zIndex: "20",
      fontFamily: "sans-serif",
    });
    s.surface.hud.append(input);
    let hidden = [];
    function restoreText() {
      for (const el of hidden) el.style.visibility = "";
      hidden = [];
    }
    function save() {
      if (!session || composing) return;
      const current = context.world.getCanonical(session.id, ids.person);
      if (!current) {
        finish(false);
        return;
      }
      const value = mergeDraft(
        session.base,
        input.value,
        String(current[session.field] ?? ""),
      );
      if (value !== current[session.field]) {
        textHistory?.change();
        context.world.applyCanonicalTransaction(`${prefix}:edit`, [
          {
            id: session.id,
            aspect: ids.person,
            patch: { [session.field]: value },
          },
        ]);
      }
      session.base = value;
      input.value = value;
    }
    function finish(commit = true) {
      if (!session) return;
      if (composing) return;
      if (commit) save();
      session = null;
      restoreText();
      input.style.display = "none";
      s.host.requestRender();
      textHistory?.seal();
    }
    close = () => {
      composing = false;
      finish(true);
      offWorld();
    };
    openCurrent = (id, field = "name") => {
      const p = context.world.getCanonical(id, ids.person);
      if (!p || context.world.isEntityReadOnly?.(id)) return;
      if (
        (field === "name" && lens.privacy !== "full") ||
        (field === "note" && !lens.showNotes)
      )
        return;
      finish();
      session = { id, field, base: String(p[field] ?? "") };
      input.value = session.base;
      input.setAttribute(
        "aria-label",
        {
          name: "이름",
          ageLabel: "나이",
          yearSpan: "출생·사망 연도",
          note: "임상 메모",
        }[field],
      );
      input.style.display = "block";
      s.host.requestRender();
      input.focus();
      input.select();
    };
    const locked = (e) =>
      composing ||
      e.isComposing ||
      e.keyCode === 229 ||
      e.key === "Process" ||
      Date.now() < until;
    input.addEventListener("compositionstart", () => {
      composing = true;
    });
    input.addEventListener("compositionend", () => {
      composing = false;
      until = Date.now() + 16;
      save();
    });
    input.addEventListener("input", () => save());
    input.addEventListener("blur", () => {
      if (!composing) finish();
    });
    input.addEventListener("keydown", (e) => {
      if (locked(e)) return;
      if (e.key === "Escape" || (e.key === "Enter" && !e.shiftKey)) {
        e.preventDefault();
        finish();
        s.surface.element.focus();
      } else if (e.key === "Tab" && session) {
        e.preventDefault();
        const fields = ["name", "ageLabel", "yearSpan", "note"],
          { id, field } = session,
          index = (fields.indexOf(field) + (e.shiftKey ? 3 : 1)) % 4;
        finish();
        openCurrent(id, fields[index]);
      }
    });
    const click = (e) => {
      if (
        locked(e) ||
        e.target?.closest?.("input,textarea,button,[contenteditable]")
      )
        return;
      const selected = s.selection.getSelection();
      if (selected.length !== 1) return;
      const id = selected[0],
        p = context.world.getCanonical(id, ids.person);
      if (!p) return;
      const b = context.world.getComputed(id, "computed.layoutBounds"),
        out = { x: 0, y: 0 };
      s.host.screenToWorld(e.clientX, e.clientY, out);
      if (
        !b ||
        out.x < b.x ||
        out.x > b.x + b.width ||
        out.y < b.y ||
        out.y > b.y + Math.max(b.height, labelExtent(p, b.width)?.bottom ?? b.height)
      )
        return;
      const y = out.y - b.y;
      openCurrent(
        id,
        y < 60 ? "ageLabel" : y < 85 ? "name" : y < 101 ? "yearSpan" : "note",
      );
      e.preventDefault();
    };
    s.surface.element.addEventListener("dblclick", click);
    offWorld =
      context.world.subscribe?.(() => {
        if (session && !composing) {
          const p = context.world.getCanonical(session.id, ids.person);
          if (!p) {
            session = null;
            restoreText();
            input.style.display = "none";
            return;
          }
          const value = mergeDraft(
            session.base,
            input.value,
            String(p[session.field] ?? ""),
          );
          session.base = String(p[session.field] ?? "");
          if (input.value !== value) input.value = value;
        }
      }) ?? (() => {});
    const worldPoint = { x: 0, y: 0 };
    const offFrame = frames.subscribe(() => {
      if (!session) return;
      const b = context.world.getComputed(session.id, "computed.layoutBounds");
      if (!b) return;
      const y = { ageLabel: 24, name: 66, yearSpan: 82, note: 98 }[session.field];
      const zoom = Math.max(0.01, s.host.getZoom());
      const angle = b.rotation ?? 0, cx = b.x + b.width / 2, cy = b.y + b.height / 2;
      const dy = y - b.height / 2;
      s.host.worldToScreen(cx - dy * Math.sin(angle), cy + dy * Math.cos(angle), worldPoint);
      const rect = s.surface.hud.getBoundingClientRect();
      const isNote = session.field === "note";
      input.style.width = `${Math.max(1, (isNote ? Math.max(12, b.width - 8) : b.width) * zoom)}px`;
      input.style.height = `${(isNote ? noteLines(input.value, b.width).length * 16 : 16) * zoom}px`;
      input.style.whiteSpace = isNote ? "pre-wrap" : "pre";
      input.style.overflowWrap = isNote ? "anywhere" : "normal";
      input.wrap = isNote ? "soft" : "off";
      input.style.fontSize = `${12 * zoom}px`;
      input.style.lineHeight = `${16 * zoom}px`;
      input.style.left = `${worldPoint.x - rect.left}px`;
      input.style.top = `${worldPoint.y - rect.top}px`;
      input.style.transform = `translateX(-50%) rotate(${angle}rad)`;
      restoreText();
      const fields = s.surface.element.querySelectorAll?.("[data-entity-id] [data-genogram-field]") ?? [];
      for (const el of fields) {
        if (el.getAttribute("data-genogram-field") === session.field && el.closest("[data-entity-id]")?.getAttribute("data-entity-id") === session.id) {
          el.style.visibility = "hidden";
          hidden.push(el);
        }
      }
    });
    detach = () => {
      offWorld();
      offFrame();
      s.surface.element.removeEventListener("dblclick", click);
      input.remove();
    };
  }
  mount();
  const off = provider?.subscribe?.(mount);
  return {
    open(id, field) {
      openCurrent(id, field);
    },
    dispose() {
      close();
      detach();
      off?.();
    },
  };
}
