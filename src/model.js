export const prefix = "diagram.genogram";
export const ids = Object.fromEntries(
  ["person", "union", "parentage", "relation", "household"].map((k) => [
    k,
    `${prefix}.${k}`,
  ]),
);
export const defaults = {
  person: {
    symbol: "unknown",
    orientation: "none",
    lifeStatus: "alive",
    isIndexPerson: false,
    clinical: "none",
    name: "",
    ageLabel: "",
    yearSpan: "",
    note: "",
    birthOrderHint: 0,
    householdId: null,
  },
  union: {
    partnerA: null,
    partnerB: null,
    status: "marriage",
    barOffset: 44,
    label: "",
  },
  parentage: {
    parentA: null,
    parentB: null,
    union: null,
    child: null,
    pedigree: "biological",
    twinWith: null,
    twinType: "none",
    barRatio: 0.5,
  },
  relation: { from: null, to: null, kind: "close", curveOffset: 0, label: "" },
  household: {
    label: "동거 가구",
    padding: 28,
    strokeStyle: "dashed",
    color: "#475569",
    fallbackX: 0,
    fallbackY: 0,
  },
};
export const commandNames = [
  "edit-person",
  "add-person",
  "older-sibling",
  "younger-sibling",
  "add-partner",
  "add-child",
  "add-parents",
  "add-twin",
  "connect-union",
  "connect-parentage",
  "connect-twins",
  "relation-close",
  "relation-fused",
  "relation-hostile",
  "relation-cutoff",
  "relation-focused_on",
  "reverse",
  "household",
  "toggle-membership",
  "template-nuclear",
  "template-three-generation",
  "template-single-parent",
  "template-remarried",
  "tidy-layout",
  "privacy",
  "mask-years",
  "show-relations",
  "show-households",
  "show-notes",
];
export const escapeXml = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c],
  );
export const finite = (v, d = 0) => (Number.isFinite(v) ? v : d);
export const lens = {
  privacy: "full",
  maskYears: false,
  showRelations: true,
  showHouseholds: true,
  showNotes: true,
};
export function display(v, type) {
  v = String(v ?? "");
  if (type === "name") {
    if (lens.privacy === "hidden") return "";
    if (lens.privacy === "surname_masked") return v ? `${v[0]}○○` : "";
    if (lens.privacy === "initials")
      return Array.from(v)
        .map((c) => {
          const n = c.charCodeAt(0) - 44032;
          return n >= 0 && n < 11172
            ? "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ"[Math.floor(n / 588)]
            : c[0];
        })
        .join("");
  }
  return lens.maskYears ? v.replace(/\b(\d{3})\d\b/g, "$1*") : v;
}
export function personBounds(view, id) {
  if (!id || !view.isAlive(id) || !view.getCanonical(id, ids.person)) return;
  return view.getComputed(id, "computed.layoutBounds");
}
