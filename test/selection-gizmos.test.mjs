import test from "node:test";
import assert from "node:assert/strict";
import { lines } from "../src/aspects/lines.js";
import { ids, defaults, lens } from "../src/model.js";
function fixture() {
  const rows = {
    a: { [ids.person]: { ...defaults.person, symbol: "male" } },
    b: { [ids.person]: { ...defaults.person, symbol: "female" } },
    c: { [ids.person]: { ...defaults.person } },
    d: { [ids.person]: { ...defaults.person } },
    u: {
      [ids.union]: {
        ...defaults.union,
        partnerA: "a",
        partnerB: "b",
        status: "divorce",
      },
    },
    p: {
      [ids.parentage]: {
        ...defaults.parentage,
        parentA: "a",
        parentB: "b",
        union: "u",
        child: "c",
      },
    },
    q: {
      [ids.parentage]: {
        ...defaults.parentage,
        parentA: "a",
        parentB: "b",
        union: "u",
        child: "d",
      },
    },
    r: {
      [ids.relation]: {
        ...defaults.relation,
        from: "a",
        to: "b",
        kind: "distant",
        curveOffset: 25,
      },
    },
  };
  const boxes = {
    a: { x: 0, y: 0, width: 100, height: 120 },
    b: { x: 220, y: 0, width: 100, height: 120 },
    c: { x: 40, y: 300, width: 100, height: 120 },
    d: { x: 180, y: 300, width: 100, height: 120 },
  };
  const v = {
    listEntityIds: () => Object.keys(rows),
    isAlive: (id) => !!rows[id],
    getCanonical: (id, a) => rows[id]?.[a],
    getComputed(id, a) {
      if (a === "computed.layoutBounds") return boxes[id];
      const s = lines.find((s) => `computed.${s.id}` === a);
      return s && rows[id]?.[s.id]
        ? s.derive(rows[id][s.id], id, v)
        : undefined;
    },
  };
  return { v, rows, boxes };
}
test("selected and hovered relationships follow separate visible strokes at any zoom", () => {
  const { v } = fixture();
  for (const [id, kind] of [
    ["u", "union"],
    ["p", "parentage"],
    ["q", "parentage"],
    ["r", "relation"],
  ]) {
    const s = lines.find((s) => s.id === ids[kind]),
      g = v.getComputed(id, `computed.${s.id}`);
    for (const zoom of [0.25, 1, 3]) {
      const path = s.selection.getOutlinePath(id, v, {
        worldToScreen(x, y, out) {
          out.x = (x - 10) * zoom + 13;
          out.y = (y + 20) * zoom + 7;
        },
      });
      assert.ok(path);
      assert.equal(
        (path.match(/M/g) ?? []).length,
        g.paths.filter((p) => p.length >= 2).length,
      );
      assert.ok(!path.includes("Z"));
      const first = g.paths.find((p) => p.length >= 2)[0];
      assert.ok(
        path.startsWith(
          `M${(first.x - 10) * zoom + 13},${(first.y + 20) * zoom + 7}`,
        ),
      );
    }
    assert.equal(s.selection.canTransform(), false);
  }
});
test("union grip is on a clear bar segment and siblings share a proportional bar control", () => {
  const { v } = fixture(),
    u = v.getComputed("u", `computed.${ids.union}`),
    p = v.getComputed("p", `computed.${ids.parentage}`),
    q = v.getComputed("q", `computed.${ids.parentage}`);
  assert.ok(
    Math.abs(u.adjustment.x - u.origin.x) > 8,
    "grip must clear the central divorce marks",
  );
  assert.equal(u.adjustment.y, u.origin.y);
  assert.deepEqual(p.adjustmentIds, ["p", "q"]);
  assert.equal(p.adjustment.y, q.adjustment.y);
  assert.equal(p.adjustment.x, q.adjustment.x);
  assert.ok(p.adjustment.units > 0);
});
test("vertical emotional relationships bend horizontally and hidden lines have no selection outline", () => {
  const { v, boxes } = fixture();
  boxes.b = { ...boxes.b, x: 0, y: 240 };
  const g = v.getComputed("r", `computed.${ids.relation}`);
  assert.equal(g.adjustment.axisX, -1);
  assert.equal(g.adjustment.axisY, 0);
  const s = lines.find((s) => s.id === ids.relation);
  try {
    lens.showRelations = false;
    assert.equal(
      s.selection.getOutlinePath("r", v, {
        worldToScreen() {
          throw Error("hidden");
        },
      }),
      "",
    );
  } finally {
    lens.showRelations = true;
  }
});
