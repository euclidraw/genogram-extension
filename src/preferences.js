import { lens, prefix } from "./model.js";
export const settingsSchema = [
  {
    key: "privacy",
    label: "이름 표시",
    kind: "select",
    defaultValue: "full",
    options: [
      { value: "full", label: "전체" },
      { value: "surname_masked", label: "성씨만" },
      { value: "initials", label: "이니셜" },
      { value: "hidden", label: "숨김" },
    ],
  },
  ...Object.entries({
    maskYears: ["연도 마스킹", false],
    showRelations: ["정서 관계선", true],
    showHouseholds: ["동거 가구", true],
    showNotes: ["임상 메모", true],
  }).map(([key, [label, defaultValue]]) => ({
    key,
    label,
    kind: "boolean",
    defaultValue,
  })),
];
export function bindPreferences(context) {
  const control = context.services.get("extensions.preferences");
  function refresh() {
    if (!control) return;
    for (const field of settingsSchema)
      lens[field.key] = control.get(field.key);
    context.world.invalidateComputed();
  }
  refresh();
  const off = control?.subscribe(refresh);
  return {
    change(key, value) {
      if (control) control.set(key, value);
      else {
        lens[key] = value;
        context.world.invalidateComputed();
      }
    },
    dispose() {
      off?.();
    },
  };
}
