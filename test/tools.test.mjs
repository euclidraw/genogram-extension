import test from 'node:test';
import assert from 'node:assert/strict';
import { planGenogramChanges, registerGenogramTools } from '../src/tools.js';
import { ids, defaults } from '../src/model.js';

const fixture = (snapshot = {}) => ({ exportCanonicalSnapshot: () => structuredClone(snapshot), isAlive: id => !!snapshot[id], getCanonical: (id, aspect) => snapshot[id]?.[aspect], listEntityIds: () => Object.keys(snapshot) });
const create = (kind, id, patch = {}, rest = {}) => ({ action: 'create', kind, id, patch, ...rest });
test('plans people, family structure, emotional relations and positions without writes', () => {
  const world = fixture();
  const ops = planGenogramChanges(world, [create('person', 'a', { name: 'A' }), create('person', 'b'), create('person', 'c', {}, { x: 90, y: 240 }), create('union', 'u', { partnerA: 'a', partnerB: 'b' }), create('parentage', 'p', { parentA: 'a', parentB: 'b', child: 'c', union: 'u' }), create('relation', 'r', { from: 'a', to: 'b', kind: 'hostile' })]);
  assert.equal(ops.length, 12);
  assert.equal(ops.find(op => op.aspect === ids.union).patch.partnerA, ops[0].id);
  assert.deepEqual(world.exportCanonicalSnapshot(), {});
});
test('plans the reported single person payload on an empty document', () => {
  const ops = planGenogramChanges(fixture(), JSON.parse('[{"action":"create","kind":"person","id":"p1","patch":{"name":"이재명","symbol":"male","isIndexPerson":true},"x":120,"y":120}]'));
  assert.equal(ops.length, 3);
  assert.equal(ops[0].patch.name, '이재명');
  assert.equal(ops[0].patch.isIndexPerson, true);
});
test('unrelated creation ignores cascade-hidden canonical relationships without removing them', () => {
  const snapshot = { orphan: { [ids.parentage]: { ...defaults.parentage, parentA: 'deleted-parent', child: 'deleted-child' } } };
  const world = { ...fixture(snapshot), isAlive: () => false };
  const ops = planGenogramChanges(world, [create('person', 'p1', { name: '이재명', symbol: 'male', isIndexPerson: true }, { x: 120, y: 120 })]);
  assert.equal(ops.length, 3);
  assert.ok(ops.every(op => op.id !== 'orphan'));
  assert.deepEqual(world.exportCanonicalSnapshot(), snapshot);
  assert.throws(() => planGenogramChanges(world, [{ action: 'update', id: 'orphan', kind: 'parentage', patch: { child: 'p1' } }]), /missing genogram/);
});
test('graph checks use nullified references from the live projection', () => {
  const snapshot = { a: { [ids.person]: { ...defaults.person } }, child: { [ids.person]: { ...defaults.person } }, link: { [ids.parentage]: { ...defaults.parentage, parentA: 'a', parentB: 'deleted', child: 'child' } } };
  const world = fixture(snapshot), read = world.getCanonical;
  world.getCanonical = (id, aspect) => id === 'link' && aspect === ids.parentage ? { ...snapshot.link[aspect], parentB: null } : read(id, aspect);
  assert.equal(planGenogramChanges(world, [create('person', 'new')]).length, 3);
  assert.equal(snapshot.link[ids.parentage].parentB, 'deleted');
  assert.throws(() => planGenogramChanges(world, [create('parentage', 'bad', { parentA: 'deleted', child: 'child' })]), /parentage/);
});
test('deletion cascades relationships and clears household and twin links', () => {
  const snapshot = { a: { [ids.person]: { ...defaults.person } }, b: { [ids.person]: { ...defaults.person } }, u: { [ids.union]: { ...defaults.union, partnerA: 'a', partnerB: 'b' } }, r: { [ids.relation]: { ...defaults.relation, from: 'a', to: 'b' } } };
  const ops = planGenogramChanges(fixture(snapshot), [{ action: 'delete', id: 'a' }]);
  assert.deepEqual(ops.map(op => op.id).sort(), ['a', 'r', 'u']);
  assert.ok(ops.every(op => op.patch === null));
});
test('rejects cycles, dangling references, self relations, invalid enums and foreign targets', () => {
  const people = [create('person', 'a'), create('person', 'b')];
  assert.throws(() => planGenogramChanges(fixture(), [...people, create('parentage', 'p', { parentA: 'a', child: 'b' }), create('parentage', 'q', { parentA: 'b', child: 'a' })]), /cycle/);
  assert.throws(() => planGenogramChanges(fixture(), [create('union', 'u', { partnerA: 'missing', partnerB: 'other' })]), /partners/);
  assert.throws(() => planGenogramChanges(fixture(), [...people, create('relation', 'r', { from: 'a', to: 'a' })]), /endpoints/);
  assert.throws(() => planGenogramChanges(fixture(), [create('person', 'a', { symbol: 'bad' })]), /enum/);
  assert.throws(() => planGenogramChanges(fixture({ foreign: { 'test.note': {} } }), [{ action: 'delete', id: 'foreign' }]), /missing genogram/);
});
test('registers discovery, planning tools and descriptors and disposes every registration', async () => {
  const registered = new Map(), descriptors = new Map();
  const tools = { register(tool) { registered.set(tool.id, tool); return () => registered.delete(tool.id); }, registerDescriptor(d) { descriptors.set(d.aspect, d); return () => descriptors.delete(d.aspect); }, prepareChange(operations) { return { changeProposalId: 'approved-later', operations }; } };
  const off = registerGenogramTools({ world: fixture(), services: { get: () => tools } });
  assert.equal(descriptors.size, 5);
  const result = await registered.get('diagram.genogram:plan-changes').execute({ actions: JSON.stringify([create('person', 'a')]) }, { signal: new AbortController().signal });
  assert.equal(result.changeProposalId, 'approved-later');
  off(); assert.equal(registered.size, 0); assert.equal(descriptors.size, 0);
  assert.doesNotThrow(() => registerGenogramTools({ services: { get: () => undefined } })());
});
