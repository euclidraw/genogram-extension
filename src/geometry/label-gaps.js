import { ids, personBounds } from "../model.js";
import { labelRows } from "../aspects/person.js";

/** Local label rectangles are deterministic and match the rendered text's size cap. */
function labelObstacles(view) {
  const result = [];
  for (const id of view.listEntityIds?.() ?? []) {
    const person = view.getCanonical(id, ids.person), box = person && personBounds(view, id);
    if (!box) continue;
    const angle = box.rotation ?? 0, cos = Math.cos(angle), sin = Math.sin(angle);
    for (const [text, baseline] of labelRows(person, box.width)) {
      const half = Math.min(Math.max(1, box.width - 8), Array.from(String(text)).length * 12) / 2 + 2;
      result.push({ cx: box.x + box.width / 2, cy: box.y + box.height / 2, cos, sin,
        left: box.width / 2 - half, right: box.width / 2 + half,
        top: baseline - 14, bottom: baseline + 6, width: box.width, height: box.height });
    }
  }
  return result;
}

/** Remove only the portions hidden by text, retaining the underlying relationship data. */
export function pathsAroundLabels(paths, view) {
  const obstacles = labelObstacles(view);
  if (!obstacles.length) return paths;
  const result = [];
  for (const path of paths) {
    let current;
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i], dx = b.x - a.x, dy = b.y - a.y;
      const blocked = [];
      for (const o of obstacles) {
        const ax = a.x - o.cx, ay = a.y - o.cy;
        const x = ax * o.cos + ay * o.sin + o.width / 2;
        const y = -ax * o.sin + ay * o.cos + o.height / 2;
        const vx = dx * o.cos + dy * o.sin, vy = -dx * o.sin + dy * o.cos;
        let lo = 0, hi = 1;
        for (const [p, q] of [[-vx, x-o.left], [vx, o.right-x], [-vy, y-o.top], [vy, o.bottom-y]]) {
          if (p === 0) { if (q < 0) { lo = 1; hi = 0; break; } }
          else if (p < 0) lo = Math.max(lo, q / p);
          else hi = Math.min(hi, q / p);
          if (lo > hi) break;
        }
        if (lo < hi && hi > 0 && lo < 1) blocked.push([Math.max(0, lo), Math.min(1, hi)]);
      }
      blocked.sort((l, r) => l[0] - r[0]);
      let start = 0;
      const emit = (end) => {
        if (end - start <= 1e-9) return;
        const from = { x: a.x + dx * start, y: a.y + dy * start }, to = { x: a.x + dx * end, y: a.y + dy * end };
        if (current && start === 0) current.push(to);
        else { current = [from, to]; result.push(current); }
      };
      for (const [lo, hi] of blocked) {
        if (hi <= start) continue;
        if (lo > start) emit(lo);
        current = undefined;
        start = Math.max(start, hi);
      }
      if (start < 1) emit(1);
      else current = undefined;
    }
  }
  return result;
}
