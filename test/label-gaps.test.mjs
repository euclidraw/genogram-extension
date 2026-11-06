import test from "node:test";
import assert from "node:assert/strict";
import { pathsAroundLabels } from "../src/geometry/label-gaps.js";
import { distance, intersects } from "../src/geometry/paths.js";
import { ids, lens } from "../src/model.js";

function fixture(person, box = { x: 0, y: 0, width: 120, height: 120, rotation: 0 }) {
  return { listEntityIds: () => ["p"], isAlive: () => true,
    getCanonical: (_id, aspect) => aspect === ids.person ? person : undefined,
    getComputed: (_id, aspect) => aspect === "computed.layoutBounds" ? box : undefined };
}
test("splits a line around each visible label, preserving endpoints and hit geometry", () => {
  const view = fixture({name:"가나다",yearSpan:"1990",note:""});
  const original = [[{x:60,y:58},{x:60,y:130}]];
  const paths = pathsAroundLabels(original, view);
  assert.deepEqual(paths.map(path => path.map(p => p.y)), [[58,64],[100,130]]);
  assert.equal(distance(paths,60,78), 14);
  assert.equal(intersects(paths,59,76,61,80), false);
  assert.deepEqual(original, [[{x:60,y:58},{x:60,y:130}]]);
});

test("hidden labels do not interrupt lines, and rotated text gaps follow the object", () => {
  const old = { ...lens };
  try {
    lens.privacy = "hidden"; lens.showNotes = false;
    const view = fixture({name:"가",yearSpan:"",note:"memo"});
    const original = [[{x:60,y:58},{x:60,y:130}]];
    assert.equal(pathsAroundLabels(original, view), original);
    lens.privacy = "full";
    const rotated = fixture({name:"가",yearSpan:"",note:""}, { x:0,y:0,width:120,height:120,rotation:Math.PI/2 });
    const paths = pathsAroundLabels([[{x:62,y:60},{x:-10,y:60}]], rotated);
    assert.deepEqual(paths.map(p => p.map(q => Math.round(q.x))), [[62,56],[36,-10]]);
    assert.equal(intersects(paths,42,59,46,61), false);
  } finally { Object.assign(lens, old); }
});
