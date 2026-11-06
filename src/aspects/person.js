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
const options = (field, values, label) => ({
  kind: "segmented",
  field,
  label,
  placement: "inspector",
  options: values.map((value) => ({ value, label: labels[value] ?? value })),
});
export function body(p, g) {
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
  let marks = "";
  if (p.clinical !== "none") {
    const c = p.clinical;
    marks += `<path d="M ${cx - 18} 32 h ${c === "substance" ? 36 : 18} v 18 h -${c === "substance" ? 36 : 18} Z" fill="#64748b" opacity=".45"/>`;
    if (c === "physical" || c === "mental_substance")
      for (let i = 0; i < 6; i++)
        marks += `<path d="M ${cx + 2 + i * 3} 32 v 18" stroke="#334155"/>`;
    if (c === "recovering")
      marks += `<path d="M ${cx - 15} 40 l 10 8 20 -24" stroke="#334155" fill="none"/>`;
  }
  if (p.orientation !== "none")
    marks += `<path d="M ${cx - 12} 18 h 24 l -12 20 Z" fill="none" stroke="#334155"/>`;
  if (p.isIndexPerson)
    marks += `<g transform="translate(${cx},32) scale(1.15) translate(${-cx},-32)" fill="none" stroke="#334155">${s}</g>`;
  if (p.lifeStatus === "deceased" || p.symbol.startsWith("stillbirth"))
    marks += `<path d="M ${cx - 22} 10 l 44 44 m 0 -44 l -44 44" stroke="#334155" fill="none"/>`;
  const texts = [
    [p.ageLabel, 36],
    [display(p.name, "name"), 78],
    [display(p.yearSpan), 94],
    ...(lens.showNotes
      ? String(p.note)
          .split("\n")
          .map((x, i) => [display(x), 110 + i * 16])
      : []),
  ];
  return `<g fill="white" stroke="#334155" stroke-width="2">${s}</g>${marks}<g text-anchor="middle" fill="#334155" font-family="sans-serif" font-size="12">${texts.map(([v, y]) => `<text x="${cx}" y="${y}"${Array.from(String(v ?? "")).length * 12 > g.width - 8 ? ` textLength="${Math.max(1, g.width - 8)}" lengthAdjust="spacingAndGlyphs"` : ""}>${xml(v)}</text>`).join("")}</g>`;
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
    return {
      x: finite(t.x),
      y: finite(t.y),
      rotation: finite(t.rotation),
      labelHeight: 110 + 16 * (String(p.note ?? "").split("\n").length - 1),
      width: b.width > 0 ? b.width : 120,
      height: b.height > 0 ? b.height : 120,
    };
  },
  paintOverflow: 32,
  paintBounds(g) {
    if (!g) return;
    const h = Math.max(g.height, g.labelHeight + 8),
      a = g.rotation,
      c = Math.cos(a),
      s = Math.sin(a),
      cx = g.x + g.width / 2,
      cy = g.y + g.height / 2;
    const points = [
      [0, 0],
      [g.width, 0],
      [g.width, h],
      [0, h],
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
  renderSvg(p, g) {
    return {
      svg: g
        ? `<g transform="translate(${g.x},${g.y}) rotate(${(g.rotation * 180) / Math.PI},${g.width / 2},${g.height / 2})">${body(p, g)}</g>`
        : "",
    };
  },
  ui: {
    controls: [
      ...["name", "ageLabel", "yearSpan", "note"].map((field) => ({
        kind: "text",
        field,
        label: labels[field] ?? field,
        placement: "inspector",
      })),
      options("symbol", symbols, "인물 기호"),
      options(
        "orientation",
        ["none", "gay", "lesbian", "bisexual"],
        "성적 지향 표시",
      ),
      options(
        "clinical",
        [
          "none",
          "physical",
          "mental",
          "substance",
          "mental_substance",
          "recovering",
        ],
        "임상 상태",
      ),
      options("lifeStatus", ["alive", "deceased"], "생존"),
      {
        kind: "number",
        field: "birthOrderHint",
        label: "형제 순서",
        placement: "inspector",
      },
      {
        kind: "toggle",
        field: "isIndexPerson",
        label: "내담자",
        placement: "inspector",
      },
    ],
  },
};
