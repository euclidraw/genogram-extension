import test from 'node:test';
import assert from 'node:assert/strict';
import { person, selectionBox, deathMarkSpan } from '../src/aspects/person.js';
import { defaults } from '../src/model.js';

test('death cross extends beyond normal and index person symbols without clipping',()=>{
 for(const isIndexPerson of [false,true]) {
  const p={...defaults.person,symbol:'male',lifeStatus:'deceased',isIndexPerson};
  const geometry=person.derive(p,'p',{getCanonical:(_id,aspect)=>aspect==='core.transform'?{x:0,y:0,rotation:0}:{width:100,height:120}});
  const span=deathMarkSpan(p),svg=person.renderSvg(p,geometry,'p').svg;
  assert.ok(span>26*(isIndexPerson?1.15:1));
  assert.ok(svg.includes(`M ${50-span} ${32-span} l ${span*2} ${span*2}`));
  const paint=person.paintBounds(geometry),selection={};selectionBox(p,geometry,selection);
  assert.ok(paint.y<=32-span-1);assert.ok(paint.x<=50-span-1);
  assert.ok(selection.y<32-span);assert.ok(selection.x<50-span);
 }
});

test('stillbirth cross remains outside the smaller symbol and lives have no cross',()=>{
 const still={...defaults.person,symbol:'stillbirth_female'};
 assert.equal(deathMarkSpan(still),22);
 assert.equal(deathMarkSpan({...defaults.person,symbol:'female'}),0);
 assert.ok(person.renderSvg(still,{x:0,y:0,width:100,height:120,rotation:0},'p').svg.includes('data-genogram-death="true"'));
});
