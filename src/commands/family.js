import { ids, defaults, prefix, lens } from "../model.js";
export function familyCommands(context, preferences) {
  const { world } = context,
    provider = context.services.get("canvas.active-tool-surface"),
    creation = context.services.get("canvas.creation");
  let active = true;
  const all = (k) =>
    world
      .listEntityIds()
      .filter((id) => world.isAlive(id) && world.getCanonical(id, ids[k]));
  const prop = (id, k) => world.getCanonical(id, ids[k]);
  const selected = () => provider?.get()?.selection.getSelection() ?? [];
  const persons = () => selected().filter((id) => prop(id, "person"));
  const id = () => `genogram-${crypto.randomUUID()}`;
  const op = (id, k, patch) => ({ id, aspect: ids[k] ?? k, patch });
  const pos = (id) =>
    world.getCanonical(id, "core.transform") ?? { x: 0, y: 0 };
  function commit(name, ops, focus) {
    if (!active) throw Error("확장이 비활성화되었습니다.");
    const s = provider?.get();
    if (!s) throw Error("활성 캔버스가 필요합니다.");
    s.host.history.begin();
    try {
      world.applyCanonicalTransaction(`${prefix}:${name}`, ops);
      s.host.history.commit();
    } catch (e) {
      s.host.history.abort();
      throw e;
    }
    if (focus) s.selection.select(focus);
  }
  function entity(ops, k, p = {}) {
    const n = id();
    ops.push(op(n, k, { ...defaults[k], ...p }));
    return n;
  }
  function person(ops, x, y, p = {}) {
    const n = entity(ops, "person", p);
    ops.push(
      op(n, "core.transform", { x, y, rotation: 0 }),
      op(n, "core.bounds", { width: 100, height: 120 }),
    );
    return n;
  }
  const union = (ops, a, b, n = 0) =>
    entity(ops, "union", { partnerA: a, partnerB: b, barOffset: 44 + n * 20 });
  function parent(ops, a, b, c, u = null) {
    return entity(ops, "parentage", {
      parentA: a,
      parentB: b,
      child: c,
      union: u,
    });
  }
  function requirePeople(n) {
    const p = persons();
    if (p.length !== n) throw Error(`인물 ${n}명을 선택하세요.`);
    return p;
  }
  function hasAncestor(ancestor, child) {
    const seen = new Set(),
      pending = [child];
    while (pending.length) {
      const c = pending.pop();
      if (c === ancestor) return true;
      if (seen.has(c)) continue;
      seen.add(c);
      for (const e of all("parentage")) {
        const p = prop(e, "parentage");
        if (p.child === c) {
          if (p.parentA) pending.push(p.parentA);
          if (p.parentB) pending.push(p.parentB);
        }
      }
    }
    return false;
  }
  function run(name) {
    if (!active) throw Error("확장이 비활성화되었습니다.");
    if (name === "add-person") {
      return creation.create({
        caller: `${prefix}:${name}`,
        aspects: {
          [ids.person]: {
            ...defaults.person,
            isIndexPerson: all("person").length === 0,
          },
        },
        width: 100,
        height: 120,
      });
    }
    if (
      [
        "privacy",
        "mask-years",
        "show-relations",
        "show-households",
        "show-notes",
      ].includes(name)
    ) {
      const key = {
        "mask-years": "maskYears",
        "show-relations": "showRelations",
        "show-households": "showHouseholds",
        "show-notes": "showNotes",
      }[name];
      if (name === "privacy") {
        const modes = ["full", "surname_masked", "initials", "hidden"];
        preferences.change(
          "privacy",
          modes[(modes.indexOf(lens.privacy) + 1) % 4],
        );
      } else preferences.change(key, !lens[key]);
      return;
    }
    const ops = [];
    let focus;
    if (name.startsWith("template-")) {
      const a = person(ops, 0, 0, { symbol: "unknown" });
      focus = a;
      if (name === "template-single-parent") {
        for (let i = 0; i < 2; i++)
          parent(
            ops,
            a,
            null,
            person(ops, i * 110, 220, { isIndexPerson: i === 0 }),
          );
      } else {
        const b = person(ops, 180, 0),
          u = union(ops, a, b);
        for (let i = 0; i < 2; i++)
          parent(
            ops,
            a,
            b,
            person(ops, i * 110 + 40, 220, { isIndexPerson: i === 0 }),
            u,
          );
        if (name === "template-three-generation") {
          const g = person(ops, -80, -220),
            h = person(ops, 100, -220),
            v = union(ops, g, h);
          parent(ops, g, h, a, v);
        }
        if (name === "template-remarried") {
          ops.push(op(u, "union", { status: "divorce" }));
          const c = person(ops, -180, 0),
            v = union(ops, a, c, 1);
          parent(ops, a, c, person(ops, -100, 220), v);
        }
      }
    } else if (name === "connect-union") {
      const [a, b] = requirePeople(2);
      if (
        all("union").some((e) => {
          const p = prop(e, "union");
          return (
            (p.partnerA === a && p.partnerB === b) ||
            (p.partnerA === b && p.partnerB === a)
          );
        })
      )
        throw Error("이미 연결된 부부입니다.");
      union(ops, a, b);
    } else if (name === "connect-parentage") {
      const [a, b] = requirePeople(2);
      if (hasAncestor(b, a))
        throw Error("부모·자녀 순환 관계는 만들 수 없습니다.");
      if (
        all("parentage").some((e) => {
          const p = prop(e, "parentage");
          return p.child === b && (p.parentA === a || p.parentB === a);
        })
      )
        throw Error("이미 연결된 부모·자녀입니다.");
      parent(ops, a, null, b);
    } else if (name === "connect-twins") {
      const [a, b] = requirePeople(2),
        pa = all("parentage").find((e) => prop(e, "parentage").child === a),
        pb = all("parentage").find((e) => prop(e, "parentage").child === b);
      if (
        !pa ||
        !pb ||
        prop(pa, "parentage").parentA !== prop(pb, "parentage").parentA ||
        prop(pa, "parentage").union !== prop(pb, "parentage").union
      )
        throw Error("같은 부모에 연결된 자녀 두 명을 선택하세요.");
      ops.push(
        op(pa, "parentage", { twinWith: b, twinType: "fraternal" }),
        op(pb, "parentage", { twinWith: a, twinType: "fraternal" }),
      );
    } else if (name.startsWith("relation-")) {
      const [a, b] = requirePeople(2),
        count = all("relation").filter((e) => {
          const p = prop(e, "relation");
          return (p.from === a && p.to === b) || (p.from === b && p.to === a);
        }).length;
      entity(ops, "relation", {
        from: a,
        to: b,
        kind: name.slice(9),
        curveOffset: 28 * (count + 1),
      });
    } else if (name === "reverse") {
      for (const e of selected()) {
        const p = prop(e, "relation");
        if (p) ops.push(op(e, "relation", { from: p.to, to: p.from }));
      }
    } else if (name === "household") {
      const ps = persons();
      if (!ps.length) throw Error("동거 인물을 선택하세요.");
      const h = entity(ops, "household");
      for (const p of ps) ops.push(op(p, "person", { householdId: h }));
    } else if (name === "toggle-membership") {
      const h = selected().find((e) => prop(e, "household"));
      if (!h) throw Error("가구 테두리와 인물을 함께 선택하세요.");
      for (const p of persons())
        ops.push(
          op(p, "person", {
            householdId: prop(p, "person").householdId === h ? null : h,
          }),
        );
    } else if (name === "tidy-layout") {
      const ps = persons().length ? persons() : all("person"),
        depth = new Map(),
        visiting = new Set();
      function level(p) {
        if (depth.has(p)) return depth.get(p);
        if (visiting.has(p)) throw Error("순환 부모 관계를 먼저 수정하세요.");
        visiting.add(p);
        let n = 0;
        for (const e of all("parentage")) {
          const q = prop(e, "parentage");
          if (q.child === p)
            for (const a of [q.parentA, q.parentB])
              if (a && ps.includes(a)) n = Math.max(n, level(a) + 1);
        }
        visiting.delete(p);
        depth.set(p, n);
        return n;
      }
      for (const p of ps) level(p);
      const rows = new Map();
      for (const p of ps) {
        const n = depth.get(p);
        if (!rows.has(n)) rows.set(n, []);
        rows.get(n).push(p);
      }
      for (const [n, row] of rows) {
        row.sort(
          (a, b) =>
            prop(a, "person").birthOrderHint -
              prop(b, "person").birthOrderHint ||
            pos(a).x - pos(b).x ||
            a.localeCompare(b),
        );
        row.forEach((p, i) =>
          ops.push(op(p, "core.transform", { x: i * 180, y: n * 240 })),
        );
      }
    } else {
      const chosenUnion =
        name === "add-child" &&
        selected().length === 1 &&
        prop(selected()[0], "union");
      const a = chosenUnion ? chosenUnion.partnerA : requirePeople(1)[0],
        p = pos(a),
        parents = all("parentage").find(
          (e) => prop(e, "parentage").child === a,
        ),
        q = parents && prop(parents, "parentage");
      if (name === "add-partner") {
        const n = all("union").filter((e) => {
          const u = prop(e, "union");
          return u.partnerA === a || u.partnerB === a;
        }).length;
        focus = person(
          ops,
          p.x + (n % 2 ? -1 : 1) * 180 * (1 + Math.floor(n / 2)),
          p.y,
        );
        union(ops, a, focus, n);
      } else if (name === "add-child") {
        let u = selected().find((e) => prop(e, "union"));
        const unions = all("union").filter((e) => {
          const q = prop(e, "union");
          return q.partnerA === a || q.partnerB === a;
        });
        if (!u && unions.length > 1)
          throw Error("자녀를 연결할 부부 관계선을 선택하세요.");
        u = u ?? unions[0];
        const partner = u
          ? prop(u, "union").partnerA === a
            ? prop(u, "union").partnerB
            : prop(u, "union").partnerA
          : null;
        const n = all("parentage").filter(
          (e) => prop(e, "parentage").parentA === a,
        ).length;
        focus = person(ops, p.x + n * 110, p.y + 240);
        parent(ops, a, partner, focus, u);
      } else if (name === "add-parents") {
        if (q) throw Error("이미 부모가 연결되어 있습니다.");
        const b = person(ops, p.x - 90, p.y - 240),
          c = person(ops, p.x + 90, p.y - 240),
          u = union(ops, b, c);
        parent(ops, b, c, a, u);
      } else if (
        ["older-sibling", "younger-sibling", "add-twin"].includes(name)
      ) {
        if (!q)
          throw Error(
            "먼저 부모를 연결하세요. 부모를 모르면 미상 인물로 추가할 수 있습니다.",
          );
        const delta = name === "older-sibling" ? -110 : 110;
        for (const e of all("person")) {
          const t = pos(e);
          if (
            e !== a &&
            Math.abs(t.y - p.y) < 50 &&
            (delta < 0 ? t.x < p.x : t.x > p.x)
          )
            ops.push(op(e, "core.transform", { x: t.x + delta }));
        }
        focus = person(ops, p.x + delta, p.y, {
          birthOrderHint:
            prop(a, "person").birthOrderHint + (delta < 0 ? -1 : 1),
        });
        const r = parent(ops, q.parentA, q.parentB, focus, q.union);
        if (name === "add-twin")
          ops.push(
            op(r, "parentage", { twinWith: a, twinType: "fraternal" }),
            op(parents, "parentage", {
              twinWith: focus,
              twinType: "fraternal",
            }),
          );
      }
    }
    if (ops.length) commit(name, ops, focus);
    return focus;
  }
  return {
    run,
    dispose() {
      active = false;
    },
    all,
    prop,
  };
}
