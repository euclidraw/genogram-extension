import { labels } from "../ui-labels.js";
import {
  ids,
  defaults,
  escapeXml as xml,
  finite,
  display,
  lens,
} from "../model.js";
export const symbols = [
  "male",
  "female",
  "unknown",
  "trans_male",
  "trans_female",
  "nonbinary",
  "pregnancy",
  "miscarriage",
  "abortion",
  "stillbirth_male",
  "stillbirth_female",
  "pet",
];
/** Symbol box in the person's local frame; every symbol is drawn inside it. */
export const SYMBOL = { top: 6, bottom: 58, half: 26 };
/** Half-size of a death cross; stillbirth symbols retain their smaller cross. */
export function deathMarkSpan(p) {
  if (p.lifeStatus !== "deceased" && !String(p.symbol ?? "").startsWith("stillbirth")) return 0;
  return String(p.symbol ?? "").startsWith("stillbirth") ? 22 : p.isIndexPerson ? 35 : 32;
}
const graphemeSegmenter = typeof Intl.Segmenter === "function" ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;
/** Wrap notes conservatively without scaling glyphs or changing the saved text. */
export function noteLines(value, width = 120) {
  const limit = Math.max(1, Math.floor(Math.max(12, width - 8) / 12)), output = [];
  for (const paragraph of String(value ?? "").split("\n")) {
    const chars = graphemeSegmenter ? Array.from(graphemeSegmenter.segment(paragraph), part => part.segment) : Array.from(paragraph);
    if (!chars.length) output.push("");
    for (let i = 0; i < chars.length;) {
      let end = Math.min(chars.length, i + limit);
      if (end < chars.length) {
        for (let j = end - 1; j > i; j--) if (/\s/u.test(chars[j])) { end = j + 1; break; }
      }
      output.push(chars.slice(i, end).join("")); i = end;
    }
  }
  return output;
}
/** Baselines of the visible text rows drawn below the symbol. */
export function labelRows(p, width = 120) {
  const rows = [];
  if (display(p.name, "name")) rows.push([display(p.name, "name"), 78, "name"]);
  if (display(p.yearSpan)) rows.push([display(p.yearSpan), 94, "yearSpan"]);
  if (lens.showNotes) noteLines(display(p.note), width).forEach((line, i) => {
    if (line.trim()) rows.push([line, 110 + i * 16, "note"]);
  });
  return rows;
}
/** Vertical extent of the label block below the symbol, in local units, or undefined when empty. */
export function labelExtent(p, width = 120) {
  const rows = labelRows(p, width);
  if (!rows.length) return;
  return {
    top: Math.min(...rows.map(([, y]) => y)) - 12,
    bottom: Math.max(...rows.map(([, y]) => y)) + 4,
    width: Math.max(...rows.map(([v]) => Array.from(String(v)).length * 12)),
  };
}
function localToWorld(g, x, y, out) {
  const cx = g.width / 2,
    cy = g.height / 2,
    c = Math.cos(g.rotation),
    s = Math.sin(g.rotation);
  out.x = g.x + cx + (x - cx) * c - (y - cy) * s;
  out.y = g.y + cy + (x - cx) * s + (y - cy) * c;
  return out;
}
/** Tight world box around the symbol and its visible labels. */
export function selectionBox(p, g, out) {
  const cx = g.width / 2,
    extent = labelExtent(p, g.width),
    death = deathMarkSpan(p),
    half = Math.max(
      SYMBOL.half + 6,
      death ? death + 2 : 0,
      extent ? Math.min(g.width / 2, extent.width / 2 + 4) : 0,
    ),
    top = Math.min(SYMBOL.top - 6, death ? 32 - death - 2 : 0),
    bottom = Math.max(SYMBOL.bottom + 6, death ? 32 + death + 2 : 0, extent ? extent.bottom + 4 : 0);
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  const pt = { x: 0, y: 0 };
  for (const [x, y] of [
    [cx - half, top],
    [cx + half, top],
    [cx + half, bottom],
    [cx - half, bottom],
  ]) {
    localToWorld(g, x, y, pt);
    minX = Math.min(minX, pt.x);
    minY = Math.min(minY, pt.y);
    maxX = Math.max(maxX, pt.x);
    maxY = Math.max(maxY, pt.y);
  }
  out.x = minX;
  out.y = minY;
  out.width = maxX - minX;
  out.height = maxY - minY;
  out.rotation = 0;
  return out;
}
/** Outline of the symbol, slightly enlarged, as local points. */
function symbolOutline(p, g) {
  const cx = g.width / 2,
    cy = 32,
    pad = 4;
  const ring = (r) =>
    Array.from({ length: 33 }, (_, i) => [
      cx + r * Math.cos((i / 32) * 2 * Math.PI),
      cy + r * Math.sin((i / 32) * 2 * Math.PI),
    ]);
  const square = (r) => [
    [cx - r, cy - r],
    [cx + r, cy - r],
    [cx + r, cy + r],
    [cx - r, cy + r],
    [cx - r, cy - r],
  ];
  switch (p.symbol) {
    case "female":
    case "trans_female":
      return ring(26 + pad);
    case "male":
    case "trans_male":
      return square(26 + pad);
    case "stillbirth_female":
      return ring(15 + pad);
    case "stillbirth_male":
      return square(15 + pad);
    case "miscarriage":
    case "abortion":
      return ring(13 + pad);
    case "pregnancy":
      return [
        [cx, 2],
        [cx + 30, 55],
        [cx - 30, 55],
        [cx, 2],
      ];
    case "pet":
      return [
        [cx - 27, 6],
        [cx + 27, 6],
        [cx + 27, 39],
        [cx, 62],
        [cx - 27, 39],
        [cx - 27, 6],
      ];
    default: {
      const r = 26 + pad * Math.SQRT2;
      return [
        [cx, cy - r],
        [cx + r, cy],
        [cx, cy + r],
        [cx - r, cy],
        [cx, cy - r],
      ];
    }
  }
}
const scratch = { x: 0, y: 0 },
  box = { x: 0, y: 0, width: 0, height: 0, rotation: 0 };
function read(id, v) {
  const p = v.getCanonical(id, ids.person),
    g = p && v.getComputed(id, `computed.${ids.person}`);
  return g ? [p, g] : [];
}
const selection = {
  priority: 20,
  getBounds(id, v, out) {
    const [p, g] = read(id, v);
    if (!g) return false;
    selectionBox(p, g, out);
    return true;
  },
  hitTest(id, v, x, y, zoom) {
    const [p, g] = read(id, v);
    if (!g) return Infinity;
    selectionBox(p, g, box);
    const dx = Math.max(box.x - x, 0, x - box.x - box.width),
      dy = Math.max(box.y - y, 0, y - box.y - box.height),
      d = Math.hypot(dx, dy);
    return d <= 4 / Math.max(0.01, zoom) ? d : Infinity;
  },
  intersectsRect(id, v, l, t, r, b) {
    const [p, g] = read(id, v);
    if (!g) return false;
    selectionBox(p, g, box);
    return (
      box.x <= r && box.x + box.width >= l && box.y <= b && box.y + box.height >= t
    );
  },
  getOutlinePath(id, v, projection) {
    const [p, g] = read(id, v);
    if (!g) return "";
    return symbolOutline(p, g)
      .map(([x, y], i) => {
        localToWorld(g, x, y, scratch);
        projection.worldToScreen(scratch.x, scratch.y, scratch);
        return `${i ? "L" : "M"}${scratch.x},${scratch.y}`;
      })
      .join("");
  },
  canTransform: () => true,
  // The symbol has a fixed clinical size; only placement is edited directly.
  canResize: () => false,
  canRotate: () => false,
};
const options = (field, values, label) => ({
  kind: "segmented",
  field,
  label,
  placement: "inspector",
  options: values.map((value) => ({ value, label: labels[value] ?? value })),
});
export function body(p, g, id = "preview") {
  const cx = g.width / 2,
    cy = 32;
  let s = "";
  const circle = (r) => `<circle cx="${cx}" cy="${cy}" r="${r}"/>`,
    rect = (r) =>
      `<rect x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}"/>`,
    diamond = `<path d="M ${cx} 6 l 26 26 -26 26 -26 -26 Z"/>`;
  switch (p.symbol) {
    case "female":
      s = circle(26);
      break;
    case "male":
      s = rect(26);
      break;
    case "trans_male":
      s = rect(26) + circle(18);
      break;
    case "trans_female":
      s = circle(26) + rect(18);
      break;
    case "pregnancy":
      s = `<path d="M ${cx} 8 l 25 44 h -50 Z"/>`;
      break;
    case "miscarriage":
      s = `<circle cx="${cx}" cy="32" r="9" fill="#334155"/>`;
      break;
    case "abortion":
      s = `<path d="M ${cx - 9} 23 l 18 18 m 0 -18 l -18 18"/>`;
      break;
    case "stillbirth_male":
      s = rect(15);
      break;
    case "stillbirth_female":
      s = circle(15);
      break;
    case "pet":
      s = `<path d="M ${cx - 23} 10 h 46 v 27 l -23 20 -23 -20 Z"/>`;
      break;
    case "nonbinary":
      s = diamond + circle(16);
      break;
    default:
      s = diamond;
  }
  // Follow the supplied legend; preserve the unspecified legacy recovery value.
  const clipId = `genogram-clinical-${Array.from(String(id), c => c.codePointAt(0).toString(16)).join("-")}`;
  const clinical = p.clinical;
  const hasFill = ["physical", "mental", "substance", "mental_substance", "substance_recovery", "illness_remission", "suspected_substance", "recovery_with_illness"].includes(clinical);
  let marks = "";
  if (hasFill || p.smoking || p.obesity || p.languageDifficulty) {
    const bottomClip = `${clipId}-lower`;
    marks += `<defs><clipPath id="${clipId}">${s}</clipPath><clipPath id="${bottomClip}"><rect x="${cx - 26}" y="32" width="52" height="26"/></clipPath></defs>`;
    let fill = "";
    if (clinical === "physical") fill = `<rect x="${cx}" y="6" width="26" height="52"/>`;
    else if (clinical === "mental") fill = `<rect x="${cx - 26}" y="6" width="26" height="52"/>`;
    else if (clinical === "substance") fill = `<rect x="${cx - 26}" y="32" width="52" height="26"/>`;
    else if (clinical === "mental_substance") fill = `<path d="M ${cx - 26} 6 h 26 v 26 h 26 v 26 h -52 Z" fill="#94a3b8"/><path d="M ${cx} 6 v 52 M ${cx - 26} 32 h 52" fill="none" stroke="#334155" stroke-width="2"/>`;
    else if (["substance_recovery", "illness_remission", "recovery_with_illness"].includes(clinical)) {
      fill = `<rect x="${cx - 26}" y="32" width="26" height="26"/>`;
      if (clinical === "recovery_with_illness") fill += `<rect x="${cx}" y="6" width="26" height="26" fill="#cbd5e1"/>`;
      if (clinical !== "illness_remission") fill += `<path d="M ${cx} 32 h 26" fill="none" stroke="#334155" stroke-width="2"/>`;
      if (clinical !== "substance_recovery") fill += `<path d="M ${cx} 6 v 26" fill="none" stroke="#334155" stroke-width="2"/>`;
    } else if (clinical === "suspected_substance") {
      let hatch = "";
      for (let x = cx - 52; x < cx + 52; x += 7) hatch += `<path d="M ${x} 58 l 26 -26"/>`;
      fill = `<g clip-path="url(#${bottomClip})" fill="none" stroke="#334155" stroke-width="2">${hatch}</g><path d="M ${cx - 26} 32 h 52" fill="none" stroke="#334155" stroke-width="2"/>`;
    }
    if (p.languageDifficulty) {
      let hatch = "";
      for (let x = cx - 52; x < cx + 52; x += 7) hatch += `<path d="M ${x} 58 l 26 -26"/>`;
      fill += `<g clip-path="url(#${bottomClip})" fill="none"><g stroke="white" stroke-width="4">${hatch}</g><g stroke="#334155" stroke-width="2">${hatch}</g></g>`;
    }
    if (p.obesity) fill += `<circle cx="${cx}" cy="32" r="16" fill="none" stroke="white" stroke-width="6"/><circle cx="${cx}" cy="32" r="16" fill="none" stroke="#334155" stroke-width="4"/>`;
    if (p.smoking) fill += `<circle cx="${cx + 18}" cy="14" r="4" fill="#334155" stroke="white" stroke-width="1"/>`;
    marks += `<g clip-path="url(#${clipId})" fill="#334155">${fill}</g>`;
  }
  if (clinical === "recovering")
    marks += `<text x="${cx}" y="53" text-anchor="middle" font-family="sans-serif" font-size="10" fill="#334155">R</text>`;
  if (p.orientation !== "none")
    marks += `<path d="M ${cx - 12} 18 h 24 l -12 20 Z" fill="none" stroke="#334155"/>`;
  if (p.isIndexPerson)
    marks += `<g transform="translate(${cx},32) scale(1.15) translate(${-cx},-32)" fill="none" stroke="#334155">${s}</g>`;
  const death = deathMarkSpan(p);
  if (death)
    marks += `<path data-genogram-death="true" d="M ${cx - death} ${32 - death} l ${death * 2} ${death * 2} m 0 -${death * 2} l -${death * 2} ${death * 2}" stroke="#334155" stroke-width="2" fill="none"/>`;
  const texts = [[p.ageLabel, 36, "ageLabel"], ...labelRows(p, g.width)];
  return `<g fill="white" stroke="#334155" stroke-width="2">${s}</g>${marks}<g text-anchor="middle" fill="#334155" font-family="sans-serif" font-size="12" stroke="white" stroke-width="2" stroke-linejoin="round" paint-order="stroke fill">${texts.map(([v, y, field]) => `<text data-genogram-field="${field}" x="${cx}" y="${y}"${field !== "note" && Array.from(String(v ?? "")).length * 12 > g.width - 8 ? ` textLength="${Math.max(1, g.width - 8)}" lengthAdjust="spacingAndGlyphs"` : ""}>${xml(v)}</text>`).join("")}</g>`;
}
export const person = {
  id: ids.person,
  label: "인물",
  defaults: defaults.person,
  refs: { householdId: "nullify" },
  textFields: ["name", "ageLabel", "yearSpan", "note"],
  textSearchFields: ["name", "yearSpan", "note"],
  dependsOnCanonical: [ids.person, "core.transform", "core.bounds"],
  derive(p, id, v) {
    const t = v.getCanonical(id, "core.transform") ?? {},
      b = v.getCanonical(id, "core.bounds") ?? {};
    const width = b.width > 0 ? b.width : 120;
    return {
      x: finite(t.x),
      y: finite(t.y),
      rotation: finite(t.rotation),
      labelHeight: 110 + 16 * (noteLines(display(p.note), width).length - 1),
      deathMarkSpan: deathMarkSpan(p),
      width,
      height: b.height > 0 ? b.height : 120,
    };
  },
  paintOverflow: 32,
  selection,
  paintBounds(g) {
    if (!g) return;
    const h = Math.max(g.height, g.labelHeight + 8),
      a = g.rotation,
      c = Math.cos(a),
      s = Math.sin(a),
      cx = g.x + g.width / 2,
      cy = g.y + g.height / 2;
    const span = g.deathMarkSpan ?? 0,
      left = Math.min(0, span ? g.width / 2 - span - 1 : 0),
      right = Math.max(g.width, span ? g.width / 2 + span + 1 : g.width),
      top = Math.min(0, span ? 32 - span - 1 : 0),
      bottom = Math.max(h, span ? 32 + span + 1 : h);
    const points = [
      [left, top],
      [right, top],
      [right, bottom],
      [left, bottom],
    ].map(([x, y]) => ({
      x: cx + (x - g.width / 2) * c - (y - g.height / 2) * s,
      y: cy + (x - g.width / 2) * s + (y - g.height / 2) * c,
    }));
    const x = Math.min(...points.map((p) => p.x)),
      y = Math.min(...points.map((p) => p.y));
    return {
      x,
      y,
      width: Math.max(...points.map((p) => p.x)) - x,
      height: Math.max(...points.map((p) => p.y)) - y,
    };
  },
  renderSvg(p, g, id) {
    return {
      svg: g
        ? `<g transform="translate(${g.x},${g.y}) rotate(${(g.rotation * 180) / Math.PI},${g.width / 2},${g.height / 2})">${body(p, g, id)}</g>`
        : "",
    };
  },
  ui: {
    controls: [
      ...["name", "ageLabel", "yearSpan"].map((field) => ({
        kind: "text",
        field,
        label: labels[field] ?? field,
        placement: "inspector",
        section: "기본 정보",
      })),
      { ...options("symbol", symbols, "인물 기호"), section: "기호와 상태" },
      { ...options("symbol", symbols, "인물 기호"), id: "symbol-floating", placement: "selection-bar" },
      { ...options(
        "orientation",
        ["none", "gay", "lesbian", "bisexual"],
        "성적 지향 표시",
      ), section: "기호와 상태" },
      { ...options(
        "clinical",
        [
          "none",
          "physical",
          "mental",
          "substance",
          "mental_substance",
          "recovering",
          "substance_recovery",
          "illness_remission",
          "suspected_substance",
          "recovery_with_illness",
        ],
        "임상 상태",
      ), section: "기호와 상태", description: "오른쪽 음영: 신체 질환 · 아래 음영: 물질 사용 · 아래 사선: 물질 사용 의심. 왼쪽 아래 음영에 가로선은 물질 사용 회복, 세로선은 질환 관해입니다. R은 기존 회복 기록의 유형 미지정입니다." },
      ...["smoking", "obesity", "languageDifficulty"].map(field => ({ kind: "toggle", field, label: labels[field], placement: "inspector", section: "추가 임상 표시", sectionCollapsed: true })),
      { ...options("lifeStatus", ["alive", "deceased"], "생존"), section: "기호와 상태" },
      { kind: "text", field: "note", label: labels.note, placement: "inspector", section: "상담 메모", sectionCollapsed: true },
      {
        kind: "number",
        field: "birthOrderHint",
        label: "형제 순서",
        placement: "inspector",
        section: "기본 정보",
      },
      {
        kind: "toggle",
        field: "isIndexPerson",
        label: "내담자",
        placement: "inspector",
        section: "기호와 상태",
      },
    ],
  },
};
