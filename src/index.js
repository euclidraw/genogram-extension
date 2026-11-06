import { icons } from "./icons.js";
import { bindPreferences } from "./preferences.js";
import { mountInlineEditor } from "./inline-editor.js";
import { mountInteractions } from "./interactions.js";
import metadata from "../extension.json";
import { createPackageManifest } from "./manifest.js";
import { prefix, commandNames, ids } from "./model.js";
import { person } from "./aspects/person.js";
import { lines } from "./aspects/lines.js";
import { familyCommands } from "./commands/family.js";
const labels = {
  "edit-person": "인물 바로 편집",
  "add-person": "내담자·인물 추가",
  "older-sibling": "손위 형제",
  "younger-sibling": "손아래 동생",
  "add-partner": "배우자 추가",
  "add-child": "자녀 추가",
  "add-parents": "부모 추가",
  "add-twin": "쌍둥이 추가",
  "connect-relation": "정서 관계 연결",
  "connect-union": "부부로 연결",
  "connect-parentage": "첫 선택 부모 → 자녀 연결",
  "connect-twins": "쌍둥이로 묶기",
  reverse: "방향 반전",
  household: "동거 가구로 묶기",
  "toggle-membership": "가구 편입·제외",
  "tidy-layout": "가족 정돈",
  privacy: "이름 표시 방식 전환",
  "mask-years": "연도 마스킹",
  "show-relations": "정서선 표시 전환",
  "show-households": "가구 표시 전환",
  "show-notes": "메모 표시 전환",
  "template-nuclear": "핵가족 템플릿",
  "template-three-generation": "3세대 템플릿",
  "template-single-parent": "한부모 템플릿",
  "template-remarried": "재혼 가족 템플릿",
  "relation-close": "친밀",
  "relation-fused": "융합",
  "relation-hostile": "갈등",
  "relation-cutoff": "단절",
  "relation-focused_on": "집중",
};
export default {
  ...createPackageManifest(metadata),
  summary: metadata.summary,
  aspects: [person, ...lines],
  ui: {
    controls: commandNames.map((name) => {
      const global =
        name === "add-person" ||
        name.startsWith("template-") ||
        [
          "privacy",
          "mask-years",
          "show-relations",
          "show-households",
          "show-notes",
        ].includes(name);
      const floating = [
        "connect-union",
        "connect-parentage",
        "connect-relation",
        "household",
      ].includes(name);
      const aspectId = global
        ? undefined
        : name === "reverse"
          ? ids.relation
          : name === "toggle-membership"
            ? ids.household
            : ids.person;
      return {
        id: name,
        kind: "action",
        label: labels[name],
        icon: icons[name],
        commandSymbol: `${prefix}:${name}`,
        placement:
          name === "add-person"
            ? "tool-shelf"
            : [
                  "privacy",
                  "mask-years",
                  "show-relations",
                  "show-households",
                  "show-notes",
                ].includes(name) || name.startsWith("template-")
              ? "settings"
              : floating
                ? "selection-bar"
                : "inspector",
        ...(aspectId ? { aspectId } : {}),
        ...(!global && !floating ? { section: name.startsWith("relation-") ? "정서 관계 만들기" : name === "reverse" ? "관계 편집" : name === "toggle-membership" ? "가구 편집" : "가족 구성", sectionCollapsed: true } : {}),
        requiresSelection: !global,
        minSelectionCount: floating || name.startsWith("relation-") || name === "connect-twins" || name === "toggle-membership" ? 2 : global ? 0 : 1,
        ...(name.startsWith("connect-") || name.startsWith("relation-") ? { maxSelectionCount: 2 } : {}),
      };
    }),
  },
  activate(context) {
    const preferences = bindPreferences(context),
      family = familyCommands(context, preferences),
      editor = mountInlineEditor(context),
      off = [() => preferences.dispose(), () => editor.dispose()];
    const execute = (name) => {
      if (name === "edit-person") {
        const selected = context.services
          .get("canvas.active-tool-surface")
          ?.get()
          ?.selection.getSelection();
        if (selected?.length === 1) editor.open(selected[0]);
        return;
      }
      const result = family.run(
        name === "connect-relation" ? "relation-close" : name,
      );
      if (name === "add-person" && result) editor.open(result);
      return result;
    };
    try {
      for (const name of commandNames)
        off.push(
          context.commands.register({
            id: `${prefix}:${name}`,
            title: labels[name],
            summary: labels[name],
            shortcutScope: "canvas",
            ...(name === "edit-person"
              ? { shortcutSelectionAspect: ids.person }
              : {}),
            ...({
              "edit-person": "Enter",
              "older-sibling": "M-[",
              "younger-sibling": "M-]",
              "add-partner": "M-s",
              "add-child": "M-c",
              "add-parents": "M-p",
              "add-twin": "M-t",
              household: "C-c g",
            }[name]
              ? {
                  keys: [
                    {
                      "edit-person": "Enter",
                      "older-sibling": "M-[",
                      "younger-sibling": "M-]",
                      "add-partner": "M-s",
                      "add-child": "M-c",
                      "add-parents": "M-p",
                      "add-twin": "M-t",
                      household: "C-c g",
                    }[name],
                  ],
                }
              : {}),
            run: () => execute(name),
          }),
        );
      off.push(mountInteractions(context, execute));
      if (context.world.registerSelectionExpander)
        off.push(
          context.world.registerSelectionExpander((selected) => {
            const expanded = new Set(selected);
            for (const id of selected) {
              const u = context.world.getCanonical(id, ids.union);
              if (u) {
                if (u.partnerA) expanded.add(u.partnerA);
                if (u.partnerB) expanded.add(u.partnerB);
              }
              if (context.world.getCanonical(id, ids.household))
                for (const p of context.world.listEntityIds())
                  if (
                    context.world.getCanonical(p, ids.person)?.householdId ===
                    id
                  )
                    expanded.add(p);
            }
            return [...expanded];
          }),
        );
    } catch (e) {
      for (const f of off.reverse()) f();
      family.dispose();
      throw e;
    }
    return {
      api: Object.freeze({ run: execute }),
      dispose() {
        family.dispose();
        for (const f of off.splice(0).reverse()) f();
      },
    };
  },
};
