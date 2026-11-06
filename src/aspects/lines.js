import { labels } from "../ui-labels.js";
import { labelExtent } from "./person.js";
import { relationshipIcons } from "../relationship-icons.js";
import { pathsAroundLabels } from "../geometry/label-gaps.js";
import {
  personSymbol,
  pathsOutsideSymbols,
} from "../geometry/person-anchors.js";
import {
  ids,
  defaults,
  personBounds,
  finite,
  lens,
  display,
  escapeXml as xml,
} from "../model.js";
import {
  point as P,
  bounds,
  distance,
  intersects,
  pathData,
} from "../geometry/paths.js";
const people = (v) => v.listEntityIds?.() ?? [];
const RELATION_WIDTH_SCALE = 2 / 3;
function anchor(v, id, bottom = false) {
  const b = personBounds(v, id);
  if (!b) return;
  const x = b.x + b.width / 2,
    y = b.y + (bottom ? 58 : 6),
    angle = finite(b.rotation),
    cx = b.x + b.width / 2,
    cy = b.y + b.height / 2;
  return P(
    cx + (x - cx) * Math.cos(angle) - (y - cy) * Math.sin(angle),
    cy + (x - cx) * Math.sin(angle) + (y - cy) * Math.cos(angle),
  );
}
function labelBottom(v, id) {
  const b = personBounds(v, id),
    p = v.getCanonical(id, ids.person);
  return b
    ? b.y +
        Math.max(
          110 + 16 * (String(p?.note ?? "").split("\n").length - 1),
          (labelExtent(p, b.width)?.bottom ?? 4) - 4,
        )
    : 0;
}
// Build display geometry from the same segments used for picking and export.
function dashLine(points, on = 6, off = 4) {
  const paths = [];
  let phase = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i],
      dx = b.x - a.x,
      dy = b.y - a.y,
      length = Math.hypot(dx, dy);
    if (!length) continue;
    let at = 0;
    while (at < length - 1e-9) {
      const draw = phase < on,
        take = Math.min(length - at, (draw ? on : on + off) - phase);
      if (take <= 1e-9) {
        phase = 0;
        continue;
      }
      if (draw)
        paths.push([
          P(a.x + (dx * at) / length, a.y + (dy * at) / length),
          P(
            a.x + (dx * (at + take)) / length,
            a.y + (dy * (at + take)) / length,
          ),
        ]);
      at += take;
      phase = (phase + take) % (on + off);
    }
  }
  return paths;
}
function ring(center, radius, steps = 24) {
  return Array.from({ length: steps + 1 }, (_, i) =>
    P(
      center.x + radius * Math.cos((i * 2 * Math.PI) / steps),
      center.y + radius * Math.sin((i * 2 * Math.PI) / steps),
    ),
  );
}
function parallel(points, offset) {
  const a = points[0],
    b = points[points.length - 1],
    dx = b.x - a.x,
    dy = b.y - a.y,
    length = Math.hypot(dx, dy) || 1;
  return points.map((point) =>
    P(point.x - (dy / length) * offset, point.y + (dx / length) * offset),
  );
}
function unionGeometry(p, id, v) {
  const a = anchor(v, p.partnerA, true),
    b = anchor(v, p.partnerB, true);
  if (!a || !b) return;
  const y =
    Math.max(a.y, b.y, labelBottom(v, p.partnerA), labelBottom(v, p.partnerB)) +
    Math.max(12, finite(p.barOffset, 44));
  const origin = P((a.x + b.x) / 2, y),
    middle = [P(a.x, y), P(b.x, y)];
  const middlePaths =
    p.status === "cohabitation"
      ? dashLine(middle, 6, 4)
      : p.status === "engagement"
        ? dashLine(middle, 2, 4)
        : p.status === "secret_affair"
          ? dashLine(middle, 1, 5)
          : [middle];
  const paths = [[a, middle[0]], ...middlePaths, [middle[1], b]];
  if (
    ["separation", "divorce", "reunion_divorce", "reunion_separation"].includes(
      p.status,
    )
  ) {
    const count = p.status.includes("divorce") ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const x = origin.x + (i - (count - 1) / 2) * 7;
      paths.push([P(x - 5, y + 8), P(x + 5, y - 8)]);
    }
    if (p.status.startsWith("reunion")) paths.push(ring(origin, 12));
  }
  return {
    paths,
    origin,
    label: p.label,
    adjustment: { x: origin.x, y: origin.y, axisX: 0, axisY: 1, units: 1 },
  };
}
function parentageGeometry(p, id, v) {
  const a = anchor(v, p.parentA, true),
    c = anchor(v, p.child);
  if (!a || !c) return;
  let o = a;
  const u = p.union && v.getComputed(p.union, `computed.${ids.union}`);
  if (u) o = u.origin;
  else {
    const b = anchor(v, p.parentB, true);
    if (b) o = P((a.x + b.x) / 2, Math.max(a.y, b.y) + 44);
  }
  const siblings = people(v)
    .filter((e) => {
      const q = v.getCanonical(e, ids.parentage);
      return (
        v.isAlive(e) &&
        q &&
        (p.union
          ? q.union === p.union
          : !q.union && q.parentA === p.parentA && q.parentB === p.parentB)
      );
    })
    .sort();
  const children = siblings
    .map((e) => anchor(v, v.getCanonical(e, ids.parentage).child))
    .filter(Boolean);
  const y =
    o.y +
    (Math.min(c.y, ...children.map((a) => a.y)) - o.y) *
      Math.max(0.1, Math.min(0.9, finite(p.barRatio, 0.5)));
  const paths = [];
  if (siblings[0] === id) {
    const xs = [o.x, ...children.map((a) => a.x)];
    paths.push([o, P(o.x, y)], [P(Math.min(...xs), y), P(Math.max(...xs), y)]);
  }
  const twin = p.twinType !== "none" && anchor(v, p.twinWith);
  const mid = twin ? (c.x + twin.x) / 2 : c.x;
  const branch = [P(mid, y), c];
  if (p.pedigree === "foster") paths.push(...dashLine(branch));
  else if (p.pedigree === "adopted")
    paths.push(parallel(branch, -3), ...dashLine(parallel(branch, 3)));
  else paths.push(branch);
  if (twin && p.child < p.twinWith && p.twinType === "identical")
    paths.push([
      P((mid + c.x) / 2, (y + c.y) / 2),
      P((mid + twin.x) / 2, (y + twin.y) / 2),
    ]);
  return {
    paths,
    origin: P(c.x, y),
    label: p.pedigree === "surrogate" ? "대리" : "",
    adjustment: {
      x:
        (Math.min(o.x, ...children.map((a) => a.x)) +
          Math.max(o.x, ...children.map((a) => a.x))) /
        2,
      y,
      axisX: 0,
      axisY: 1,
      units: Math.min(c.y, ...children.map((a) => a.y)) - o.y,
    },
    adjustmentIds: siblings,
  };
}
function relationGeometry(p, id, v) {
  const start = personSymbol(v, p.from),
    end = personSymbol(v, p.to);
  if (!start || !end) return;
  const a = P(start.x, start.y),
    b = P(end.x, end.y);
  const dx = b.x - a.x,
    dy = b.y - a.y,
    len = Math.hypot(dx, dy);
  if (len < 1) return;
  const nx = -dy / len,
    ny = dx / len,
    off = finite(p.curveOffset),
    count = Math.max(2, Math.ceil(len / 6));
  const mid = P((a.x + b.x) / 2 + nx * off, (a.y + b.y) / 2 + ny * off),
    paths = [],
    fills = [];
  const curve = (offset = 0, zigzag = false) => {
    const points = [];
    for (let i = 0; i <= count; i++) {
      const t = i / count,
        zig =
          zigzag && i > 0 && i < count
            ? (i % 2 ? 4 : -4) * RELATION_WIDTH_SCALE
            : 0;
      const h = 4 * off * t * (1 - t) + offset + zig;
      points.push(P(a.x + dx * t + nx * h, a.y + dy * t + ny * h));
    }
    return points;
  };
  const push = (points, fill = "none") => {
    paths.push(points);
    fills.push(fill);
  };
  const addDashed = (points) => {
    for (const segment of dashLine(points, 4, 3)) push(segment);
  };
  const kind = p.kind;
  const visibleCenter = pathsOutsideSymbols([curve()], [start, end]);
  if (!visibleCenter.length) return;
  const lastCenter = visibleCenter[visibleCenter.length - 1];
  const targetPoint = lastCenter[lastCenter.length - 1];
  const endParameter = Math.max(
    0,
    Math.min(
      1,
      ((targetPoint.x - a.x) * dx + (targetPoint.y - a.y) * dy) / (len * len),
    ),
  );
  if (kind === "cutoff" || kind === "cutoff_repaired" || kind === "estranged") {
    const base = curve(),
      cut = Math.floor(count / 2),
      left = base.slice(0, Math.max(1, cut - 1)),
      right = base.slice(Math.min(count, cut + 2));
    if (kind === "cutoff_repaired" || kind === "estranged") {
      addDashed(left);
      addDashed(right);
    } else {
      push(left);
      push(right);
    }
    for (const d of [-5, 5])
      push([
        P(
          mid.x + (dx / len) * d - nx * 7 * RELATION_WIDTH_SCALE,
          mid.y + (dy / len) * d - ny * 7 * RELATION_WIDTH_SCALE,
        ),
        P(
          mid.x + (dx / len) * d + nx * 7 * RELATION_WIDTH_SCALE,
          mid.y + (dy / len) * d + ny * 7 * RELATION_WIDTH_SCALE,
        ),
      ]);
    if (kind === "cutoff_repaired")
      push(ring(mid, 4 * RELATION_WIDTH_SCALE), "white");
  } else {
    if (
      [
        "close",
        "close_hostile",
        "fused",
        "fused_hostile",
        "abuse_sexual",
      ].includes(kind)
    ) {
      push(curve(-6 * RELATION_WIDTH_SCALE));
      push(curve(6 * RELATION_WIDTH_SCALE));
    }
    if (kind === "fused") push(curve());
    else if (kind === "fused_hostile") {
      push(curve());
      push(curve(0, true));
    } else if (
      [
        "close_hostile",
        "hostile",
        "negative_focused",
        "abuse_physical",
        "abuse_emotional",
        "abuse_sexual",
      ].includes(kind)
    )
      push(curve(0, true));
    else if (kind === "distant") addDashed(curve());
    else if (kind !== "close") push(curve());
    if (
      [
        "focused_on",
        "negative_focused",
        "caregiving",
        "abuse_physical",
        "abuse_emotional",
        "abuse_sexual",
      ].includes(kind)
    ) {
      const arrow = (distance, filled) => {
        const t = Math.max(0, endParameter - distance / len),
          h = 4 * off * t * (1 - t);
        const tip =
          distance === 0
            ? targetPoint
            : P(a.x + dx * t + nx * h, a.y + dy * t + ny * h);
        // The derivative of the same curve gives the arrow's exact local direction.
        const tx = dx + nx * 4 * off * (1 - 2 * t),
          ty = dy + ny * 4 * off * (1 - 2 * t),
          length = Math.hypot(tx, ty);
        const ux = tx / length,
          uy = ty / length,
          back = P(tip.x - ux * 10, tip.y - uy * 10);
        const left = P(
            back.x - uy * 5 * RELATION_WIDTH_SCALE,
            back.y + ux * 5 * RELATION_WIDTH_SCALE,
          ),
          right = P(
            back.x + uy * 5 * RELATION_WIDTH_SCALE,
            back.y - ux * 5 * RELATION_WIDTH_SCALE,
          );
        push(
          filled ? [left, tip, right, left] : [left, tip, right],
          filled === "solid" ? "solid" : filled === "hollow" ? "white" : "none",
        );
      };
      arrow(
        0,
        kind === "abuse_physical" || kind === "abuse_sexual"
          ? "solid"
          : kind === "abuse_emotional"
            ? "hollow"
            : false,
      );
      if (kind === "caregiving") arrow(12, false);
    }
  }
  return {
    paths,
    fills,
    origin: mid,
    label: p.label,
    clipSymbols: [start, end],
    adjustment: { x: mid.x, y: mid.y, axisX: nx, axisY: ny, units: 1 },
  };
}
function householdGeometry(p, id, v) {
  const boxes = people(v)
    .filter((e) => v.getCanonical(e, ids.person)?.householdId === id)
    .map((e) => personBounds(v, e))
    .filter(Boolean);
  if (!boxes.length) return;
  const pad = Math.max(0, finite(p.padding, 28)),
    x = Math.min(...boxes.map((b) => b.x)) - pad,
    y = Math.min(...boxes.map((b) => b.y)) - pad,
    r = Math.max(...boxes.map((b) => b.x + b.width)) + pad,
    b = Math.max(...boxes.map((b) => b.y + b.height)) + pad;
  return {
    paths: [[P(x, y), P(r, y), P(r, b), P(x, b), P(x, y)]],
    origin: P(x + 8, y + 16),
    label: p.label,
  };
}
const refs = {
  union: { partnerA: "cascade-hide", partnerB: "cascade-hide" },
  parentage: {
    parentA: "cascade-hide",
    child: "cascade-hide",
    parentB: "nullify",
    union: "nullify",
    twinWith: "nullify",
  },
  relation: { from: "cascade-hide", to: "cascade-hide" },
  household: {},
};
const enumerations = {
  union: {
    status: [
      "marriage",
      "engagement",
      "cohabitation",
      "separation",
      "divorce",
      "reunion_divorce",
      "reunion_separation",
      "secret_affair",
    ],
  },
  parentage: {
    pedigree: ["biological", "adopted", "foster", "surrogate"],
    twinType: ["none", "fraternal", "identical"],
  },
  relation: {
    kind: [
      "close",
      "fused",
      "distant",
      "hostile",
      "fused_hostile",
      "close_hostile",
      "negative_focused",
      "caregiving",
      "cutoff",
      "cutoff_repaired",
      "estranged",
      "focused_on",
      "abuse_physical",
      "abuse_emotional",
      "abuse_sexual",
    ],
  },
  household: { strokeStyle: ["dashed", "dotted"] },
};
function make(kind, derive) {
  const aspect = ids[kind],
    get = (id, v) => v.getComputed(id, `computed.${aspect}`);
  return {
    id: aspect,
    label: {
      union: "부부·파트너",
      parentage: "부모·자녀",
      relation: "정서 관계",
      household: "동거 가구",
    }[kind],
    defaults: defaults[kind],
    refs: refs[kind],
    textFields: kind === "parentage" ? [] : ["label"],
    dependsOnCanonical: Object.values(ids),
    dependsOnComputed: [
      "computed.layoutBounds",
      ...(kind === "parentage" ? [`computed.${ids.union}`] : []),
    ],
    derive(p, id, view) {
      const geometry = derive(p, id, view);
      if (!geometry || kind === "household") return geometry;
      const paths = [],
        fills = [];
      geometry.paths.forEach((path, index) => {
        const outside = geometry.clipSymbols
          ? pathsOutsideSymbols([path], geometry.clipSymbols)
          : [path];
        for (const candidate of outside)
          for (const visible of pathsAroundLabels([candidate], view)) {
            const first = visible[0],
              last = visible[visible.length - 1];
            const closed =
              first &&
              last &&
              Math.hypot(first.x - last.x, first.y - last.y) < 1e-8;
            paths.push(visible);
            fills.push(closed ? (geometry.fills?.[index] ?? "none") : "none");
          }
      });
      // Keep the union grip on a clear horizontal segment, away from status marks and labels.
      if (kind === "union") {
        let longest = 0;
        for (const path of paths)
          for (let i = 1; i < path.length; i++) {
            const a = path[i - 1],
              b = path[i];
            if (
              Math.abs(a.y - geometry.origin.y) > 1e-6 ||
              Math.abs(b.y - a.y) > 1e-6
            )
              continue;
            const left = Math.min(a.x, b.x),
              right = Math.max(a.x, b.x);
            const reserve = [
              "separation",
              "divorce",
              "reunion_divorce",
              "reunion_separation",
            ].includes(p.status)
              ? 26
              : 0;
            const intervals = reserve
              ? [
                  [left, Math.min(right, geometry.origin.x - reserve)],
                  [Math.max(left, geometry.origin.x + reserve), right],
                ]
              : [[left, right]];
            for (const [start, end] of intervals) {
              const length = end - start;
              if (length > longest) {
                longest = length;
                geometry.adjustment.x = (start + end) / 2;
                geometry.adjustment.y = a.y;
              }
            }
          }
      }
      return { ...geometry, paths, fills };
    },
    paintBounds: (g) => {
      if (!g) return;
      const b = bounds(g.paths, 20);
      if (b && g.label) {
        const right = g.origin.x + Array.from(String(g.label)).length * 12;
        b.width = Math.max(b.width, right - b.x);
        b.y = Math.min(b.y, g.origin.y - 24);
      }
      return b;
    },
    renderSvg(p, g) {
      if (
        !g ||
        (kind === "relation" && !lens.showRelations) ||
        (kind === "household" && !lens.showHouseholds)
      )
        return { svg: "" };
      const color =
        (kind === "relation" || kind === "household") &&
        typeof p.color === "string" &&
        /^#[\da-f]{6}$/i.test(p.color)
          ? p.color
          : kind === "relation"
            ? "#dc2626"
            : "#334155";
      const paths = g.paths
        .map(
          (ps, index) =>
            `<path d="${pathData(ps)}" fill="${g.fills?.[index] === "solid" ? color : g.fills?.[index] === "white" ? "white" : "none"}"/>`,
        )
        .join("");
      const o = g.origin;
      const dash =
        kind === "household"
          ? p.strokeStyle === "dotted"
            ? ' stroke-dasharray="1 5" stroke-linecap="round"'
            : ' stroke-dasharray="6 4"'
          : "";
      return {
        svg: `<g fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"${dash}>${paths}</g><text x="${o.x}" y="${o.y - 8}" font-family="sans-serif" font-size="12">${xml(display(g.label))}</text>`,
      };
    },
    selection: {
      priority: 20,
      getBounds(id, v, out) {
        const g = get(id, v),
          b = g && bounds(g.paths);
        if (!b) return false;
        Object.assign(out, b, { rotation: 0 });
        return true;
      },
      hitTest(id, v, x, y, zoom) {
        const g = get(id, v);
        if (
          !g ||
          (kind === "relation" && !lens.showRelations) ||
          (kind === "household" && !lens.showHouseholds)
        )
          return Infinity;
        const d = distance(g.paths, x, y);
        return d <= 8 / Math.max(0.01, zoom) ? d : Infinity;
      },
      intersectsRect(id, v, l, t, r, b) {
        const g = get(id, v);
        return (
          !!g &&
          !(
            (kind === "relation" && !lens.showRelations) ||
            (kind === "household" && !lens.showHouseholds)
          ) &&
          intersects(g.paths, l, t, r, b)
        );
      },
      getOutlinePath(id, view, projection) {
        const g = get(id, view);
        if (
          !g ||
          (kind === "relation" && !lens.showRelations) ||
          (kind === "household" && !lens.showHouseholds)
        )
          return "";
        // Preserve separate strokes and real dash/label gaps. No enclosing rectangle.
        const point = { x: 0, y: 0 };
        let path = "";
        for (const points of g.paths) {
          if (points.length < 2) continue;
          for (let i = 0; i < points.length; i++) {
            projection.worldToScreen(points[i].x, points[i].y, point);
            if (!Number.isFinite(point.x) || !Number.isFinite(point.y))
              return "";
            path += `${i ? "L" : "M"}${point.x},${point.y}`;
          }
        }
        return path;
      },
      canTransform: () => false,
    },
    ui: {
      controls: [
        ...Object.entries(enumerations[kind]).map(([field, values]) => ({
          kind: "segmented",
          field,
          label: labels[field] ?? field,
          placement: "inspector",
          options: values.map((value) => ({
            value,
            label: labels[value] ?? value,
            ...(kind === "relation" && field === "kind"
              ? { icon: relationshipIcons[value] }
              : {}),
          })),
        })),
        ...(kind === "relation"
          ? [
              {
                id: "relationship-floating",
                kind: "segmented",
                field: "kind",
                label: "정서 관계",
                placement: "selection-bar",
                options: enumerations.relation.kind.map((value) => ({
                  value,
                  label: labels[value] ?? value,
                  icon: relationshipIcons[value],
                })),
              },
            ]
          : []),
        ...(kind === "relation"
          ? [
              {
                kind: "color",
                field: "color",
                label: "관계선 색상",
                placement: "inspector",
              },
            ]
          : []),
        ...(kind === "parentage"
          ? []
          : [
              {
                kind: "text",
                field: "label",
                label: "메모·연도",
                placement: "inspector",
              },
            ]),
        {
          kind: "number",
          field:
            kind === "union"
              ? "barOffset"
              : kind === "parentage"
                ? "barRatio"
                : kind === "relation"
                  ? "curveOffset"
                  : "padding",
          label: "선 위치·여백",
          placement: "inspector",
        },
      ],
    },
  };
}
export const lines = [
  make("union", unionGeometry),
  make("parentage", parentageGeometry),
  make("relation", relationGeometry),
  make("household", householdGeometry),
];
