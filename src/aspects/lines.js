import { labels } from "../ui-labels.js";
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
    ? b.y + 110 + 16 * (String(p?.note ?? "").split("\n").length - 1)
    : 0;
}
function unionGeometry(p, id, v) {
  const a = anchor(v, p.partnerA, true),
    b = anchor(v, p.partnerB, true);
  if (!a || !b) return;
  const y =
    Math.max(a.y, b.y, labelBottom(v, p.partnerA), labelBottom(v, p.partnerB)) +
    Math.max(12, finite(p.barOffset, 44));
  return {
    paths: [[a, P(a.x, y), P(b.x, y), b]],
    origin: P((a.x + b.x) / 2, y),
    label: p.label,
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
  if (twin) {
    const mid = (c.x + twin.x) / 2;
    paths.push([P(mid, y), c]);
    if (p.child < p.twinWith && p.twinType === "identical")
      paths.push([
        P((mid + c.x) / 2, (y + c.y) / 2),
        P((mid + twin.x) / 2, (y + twin.y) / 2),
      ]);
  } else paths.push([P(c.x, y), c]);
  return { paths, origin: P(c.x, y), label: "" };
}
function relationGeometry(p, id, v) {
  const a = anchor(v, p.from, true),
    b = anchor(v, p.to);
  if (!a || !b) return;
  const dx = b.x - a.x,
    dy = b.y - a.y,
    len = Math.hypot(dx, dy);
  if (len < 1) return;
  const nx = -dy / len,
    ny = dx / len,
    off = finite(p.curveOffset),
    count = Math.max(2, Math.ceil(len / 6)),
    paths = [];
  const copies =
    p.kind === "fused"
      ? 3
      : p.kind === "close" || p.kind === "fused_hostile"
        ? 2
        : 1;
  for (let k = 0; k < copies; k++) {
    const pts = [];
    for (let i = 0; i <= count; i++) {
      const t = i / count,
        zig =
          (p.kind.includes("hostile") || p.kind.startsWith("abuse")) &&
          i > 0 &&
          i < count
            ? i % 2
              ? 4
              : -4
            : 0,
        h = 4 * off * t * (1 - t) + (k - (copies - 1) / 2) * 5 + zig;
      pts.push(P(a.x + dx * t + nx * h, a.y + dy * t + ny * h));
    }
    paths.push(pts);
  }
  const mid = P((a.x + b.x) / 2 + nx * off, (a.y + b.y) / 2 + ny * off);
  if (p.kind.startsWith("cutoff") || p.kind === "estranged") {
    const ps = paths.shift(),
      cut = Math.floor(ps.length / 2);
    paths.push(ps.slice(0, Math.max(1, cut - 1)), ps.slice(cut + 2));
    for (const d of [-4, 4])
      paths.push([
        P(mid.x + (dx / len) * d - nx * 8, mid.y + (dy / len) * d - ny * 8),
        P(mid.x + (dx / len) * d + nx * 8, mid.y + (dy / len) * d + ny * 8),
      ]);
  }
  if (p.kind === "focused_on" || p.kind.startsWith("abuse"))
    paths.push([
      P(b.x - (dx / len) * 12 + nx * 6, b.y - (dy / len) * 12 + ny * 6),
      b,
      P(b.x - (dx / len) * 12 - nx * 6, b.y - (dy / len) * 12 - ny * 6),
    ]);
  return { paths, origin: mid, label: p.label };
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
    derive,
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
      let paths = g.paths.map((ps) => `<path d="${pathData(ps)}"/>`).join("");
      const o = g.origin;
      if (kind === "relation" && p.kind === "cutoff_repaired")
        paths += `<circle cx="${o.x}" cy="${o.y}" r="5"/>`;
      if (
        kind === "union" &&
        [
          "separation",
          "divorce",
          "reunion_divorce",
          "reunion_separation",
        ].includes(p.status)
      ) {
        const n = p.status.includes("divorce") ? 2 : 1;
        for (let i = 0; i < n; i++)
          paths += `<path d="M ${o.x + i * 7 - 5} ${o.y + 8} l 10 -16"/>`;
        if (p.status.startsWith("reunion"))
          paths += `<circle cx="${o.x}" cy="${o.y}" r="12"/>`;
      }
      let dash =
        kind === "household" ||
        ["distant", "estranged", "abuse_emotional"].includes(p.kind) ||
        ["cohabitation", "engagement", "secret_affair"].includes(p.status) ||
        ["adopted", "foster"].includes(p.pedigree)
          ? ' stroke-dasharray="6 4"'
          : "";
      if (kind === "household" && p.strokeStyle === "dotted")
        dash = ' stroke-dasharray="1 5" stroke-linecap="round"';
      if (kind === "relation" && p.kind === "abuse_sexual")
        paths += `<circle cx="${o.x}" cy="${o.y}" r="6"/>`;
      const color =
        kind === "household" && /^#[\da-f]{6}$/i.test(p.color)
          ? p.color
          : "#334155";
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
      canTransform: () => false,
    },
    ui: {
      controls: [
        ...Object.entries(enumerations[kind]).map(([field, values]) => ({
          kind: "segmented",
          field,
          label: labels[field] ?? field,
          placement: "selection-bar",
          options: values.map((value) => ({
            value,
            label: labels[value] ?? value,
          })),
        })),
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
