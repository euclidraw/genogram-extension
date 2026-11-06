import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import plugin from '../dist/plugin.js';
import {ids,lens} from '../src/model.js';
const manifest=JSON.parse(await readFile(new URL('../alid.extension.json',import.meta.url)));
function fixture(){const table=new Map(),commands=new Map();let selection=[],commits=0,begins=0;const world={listEntityIds:()=>[...table.keys()],isAlive:id=>table.has(id),getCanonical:(id,a)=>table.get(id)?.[a],getComputed(id,a){if(a==='computed.layoutBounds'){const t=this.getCanonical(id,'core.transform'),b=this.getCanonical(id,'core.bounds');return t&&b?{...t,...b}:undefined;}const spec=plugin.aspects.find(s=>`computed.${s.id}`===a),p=spec&&this.getCanonical(id,spec.id);return p?spec.derive(p,id,this):undefined;},applyCanonicalTransaction(_s,ops){commits++;for(const o of ops){if(o.patch===null)table.delete(o.id);else {const row=table.get(o.id)??{};row[o.aspect]={...row[o.aspect],...o.patch};table.set(o.id,row);}}},invalidateComputed(){}};const surface={selection:{getSelection:()=>selection,select:id=>{selection=id?[id]:[];}},host:{history:{begin(){begins++;},commit(){},abort(){}}}};let serial=0;const context={world,commands:{register(c){commands.set(c.id,c);return()=>commands.delete(c.id);}},services:{get(name){if(name==='canvas.active-tool-surface')return {get:()=>surface};if(name==='canvas.creation')return {create(r){const id=`person-${++serial}`;world.applyCanonicalTransaction(r.caller,[{id,aspect:ids.person,patch:r.aspects[ids.person]},{id,aspect:'core.transform',patch:{x:r.x??0,y:r.y??0,rotation:0}},{id,aspect:'core.bounds',patch:{width:r.width,height:r.height}}]);return id;}};}}};const runtime=plugin.activate(context);return {world,table,commands,runtime,select:ids=>{selection=ids;},run:n=>runtime.api.run(n),count:()=>commits,begins:()=>begins};}
test('manifest and bundle share all five aspects, commands and hash',async()=>{assert.deepEqual(manifest.aspectIds,plugin.aspects.map(s=>s.id));assert.equal(manifest.aspectIds.length,5);assert.equal(manifest.id,'diagram.genogram');assert.equal(manifest.sha256,createHash('sha256').update(await readFile(new URL('../dist/plugin.js',import.meta.url))).digest('hex'));const f=fixture();assert.deepEqual([...f.commands.keys()],manifest.capabilities.commands);assert.equal(f.count(),0);f.runtime.dispose();assert.equal(f.commands.size,0);assert.throws(()=>f.run('add-person'),/비활성화/);});
test('intake expands relatives and inserts each family operation in one transaction',()=>{const f=fixture(),a=f.run('add-person');assert.equal(f.world.getCanonical(a,ids.person).isIndexPerson,true);f.select([a]);let n=f.count();f.run('add-parents');assert.equal(f.count(),n+1);f.select([a]);f.run('older-sibling');f.select([a]);f.run('add-twin');f.select([a]);f.run('add-partner');f.select([a]);f.run('add-child');assert.ok([...f.table.values()].some(r=>r[ids.parentage]?.twinWith));assert.equal(f.begins(),5);});
test('templates produce renderable pure geometry without writing on read',()=>{for(const template of ['nuclear','three-generation','single-parent','remarried']){const f=fixture();f.run(`template-${template}`);const before=JSON.stringify([...f.table]),n=f.count();for(const [id,row]of f.table)for(const s of plugin.aspects)if(row[s.id]){const g=s.derive(row[s.id],id,f.world);assert.ok(g,`${template}: ${s.id}`);const out=s.renderSvg(row[s.id],g,id).svg;assert.ok(out);assert.ok(!out.includes('NaN'));}assert.equal(JSON.stringify([...f.table]),before);assert.equal(f.count(),n);assert.equal(n,1);}});
test('connections reject cycles and duplicate unions; directional reversal preserves metadata',()=>{const f=fixture(),a=f.run('add-person'),b=f.run('add-person');f.select([a,b]);f.run('connect-union');assert.throws(()=>f.run('connect-union'),/이미/);f.run('connect-parentage');f.select([b,a]);assert.throws(()=>f.run('connect-parentage'),/순환/);f.select([a,b]);f.run('relation-focused_on');const r=[...f.table].find(([,r])=>r[ids.relation])[0];f.select([r]);f.run('reverse');assert.equal(f.world.getCanonical(r,ids.relation).from,b);});
test('households follow membership and geometry; privacy only changes rendering',()=>{const f=fixture(),a=f.run('add-person'),b=f.run('add-person');f.world.applyCanonicalTransaction('test',[{id:a,aspect:ids.person,patch:{name:'홍길동',yearSpan:'1984',note:'비공개'}}]);f.select([a,b]);f.run('household');const h=[...f.table].find(([,r])=>r[ids.household])[0];f.select([h,b]);f.run('toggle-membership');assert.equal(f.world.getCanonical(b,ids.person).householdId,null);const before=f.count();f.run('privacy');f.run('mask-years');f.run('show-notes');const s=plugin.aspects[0],g=s.derive(s.defaults,a,f.world),svg=s.renderSvg(f.world.getCanonical(a,ids.person),g,a).svg;assert.ok(svg.includes('홍○○'));assert.ok(svg.includes('198*'));assert.ok(!svg.includes('비공개'));assert.equal(f.count(),before);f.run('privacy');f.run('privacy');f.run('privacy');f.run('mask-years');f.run('show-notes');});
test('all person symbols escape text and all reference fields declare policies',()=>{const s=plugin.aspects[0];for(const symbol of s.ui.controls.find(c=>c.field==='symbol').options){const p={...s.defaults,symbol:symbol.value,name:'<script>',note:'<img>'};const svg=s.renderSvg(p,{x:0,y:0,width:100,height:120,rotation:0},'p').svg;assert.ok(svg.includes('&lt;script&gt;'));assert.ok(!svg.includes('<img>'));}for(const spec of plugin.aspects)for(const field of Object.keys(spec.refs??{}))assert.ok(field in spec.defaults);});
test('precise segment selection avoids bounding-box false positives',()=>{const f=fixture();f.run('template-nuclear');const [id,row]=[...f.table].find(([,r])=>r[ids.union]);const s=plugin.aspects.find(s=>s.id===ids.union),g=s.derive(row[ids.union],id,f.world);assert.ok(Number.isFinite(s.selection.hitTest(id,f.world,g.origin.x,g.origin.y,1)));assert.equal(s.selection.hitTest(id,f.world,g.origin.x,g.origin.y-40,1),Infinity);assert.equal(s.selection.intersectsRect(id,f.world,g.origin.x-1,g.origin.y-1,g.origin.x+1,g.origin.y+1),true);});

test('genogram floating actions are icon-only declarations scoped to relevant people',()=>{
 const floating=plugin.ui.controls.filter(c=>c.placement==='selection-bar');
 assert.deepEqual(floating.map(c=>c.id),['connect-relation','connect-union','connect-parentage','household']);
 for(const c of floating){assert.equal(c.aspectId,ids.person);assert.ok(c.icon?.paths?.length);assert.equal(c.minSelectionCount,2);}
 for(const c of plugin.ui.controls)assert.ok(c.icon?.paths?.length,`Missing icon: ${c.id}`);
 const person=plugin.aspects.find(aspect=>aspect.id===ids.person);
 const symbol=person.ui.controls.find(c=>c.id==='symbol-floating');
 assert.equal(symbol.placement,'selection-bar');assert.equal(symbol.field,'symbol');assert.equal(symbol.options.length,12);
 assert.equal(plugin.ui.controls.filter(c=>c.placement==='tool-shelf').length,1);
});

test('inspector actions follow selection type and global templates stay in settings',()=>{
 const controls=plugin.ui.controls;
 for(const c of controls.filter(c=>c.id.startsWith('template-')))assert.equal(c.placement,'settings');
 for(const c of controls.filter(c=>c.placement==='inspector'))assert.ok(c.aspectId,`${c.id} must be scoped to a selected aspect`);
 for(const c of controls.filter(c=>c.id.startsWith('relation-'))){assert.equal(c.aspectId,ids.person);assert.equal(c.minSelectionCount,2);assert.equal(c.maxSelectionCount,2);}
 assert.equal(controls.find(c=>c.id==='reverse').aspectId,ids.relation);
 assert.equal(controls.find(c=>c.id==='toggle-membership').aspectId,ids.household);
});

test('person inspector groups identity, status, notes and family actions',()=>{
 const person=plugin.aspects.find(aspect=>aspect.id===ids.person);
 const sections=new Map(person.ui.controls.filter(c=>c.placement==='inspector').map(c=>[c.field,c]));
 assert.equal(sections.get('name').section,'기본 정보');
 assert.equal(sections.get('symbol').section,'기호와 상태');
 assert.equal(sections.get('note').section,'상담 메모');
 assert.equal(sections.get('note').sectionCollapsed,true);
 const family=plugin.ui.controls.find(c=>c.id==='add-parents');
 assert.equal(family.section,'가족 구성');assert.equal(family.sectionCollapsed,true);
});

test('clinical shading follows the legend, clips to each symbol and retains legacy recovery',()=>{
 const spec=plugin.aspects.find(aspect=>aspect.id===ids.person),geometry={x:0,y:0,width:120,height:120,rotation:0};
 const svg=(clinical,symbol='female',id='person-a')=>spec.renderSvg({...spec.defaults,clinical,symbol},geometry,id).svg;
 for(const symbol of ['male','female','unknown','nonbinary','trans_male','trans_female']) {
  const illness=svg('mental',symbol), physical=svg('physical',symbol), substance=svg('substance',symbol), combined=svg('mental_substance',symbol);
  assert.notEqual(illness,physical);
  assert.match(physical,/<rect x="60" y="6" width="26" height="52"\/>/);
  assert.match(illness,/<clipPath id="genogram-clinical-/);
  assert.match(illness,/<rect x="34" y="6" width="26" height="52"\/>/);
  assert.match(substance,/<rect x="34" y="32" width="52" height="26"\/>/);
  assert.match(combined,/M 34 6 h 26 v 26 h 26 v 26 h -52 Z/);
 }
 assert.match(svg('substance_recovery'),/M 60 32 h 26/);
 assert.match(svg('illness_remission'),/M 60 6 v 26/);
 assert.match(svg('recovering'),/>R<\/text>/);
 assert.doesNotMatch(svg('recovering'),/<clipPath/);
 assert.notEqual(svg('mental','female','person-a').match(/<clipPath id="([^"]+)/)[1],svg('mental','female','person-b').match(/<clipPath id="([^"]+)/)[1]);
 const options=spec.ui.controls.find(c=>c.field==='clinical').options;
 for(const value of ['recovering','substance_recovery','illness_remission','suspected_substance','recovery_with_illness']) assert.ok(options.some(option=>option.value===value));
});

test('additional clinical markers coexist with illness and remain independently selectable',()=>{
 const spec=plugin.aspects.find(aspect=>aspect.id===ids.person),g={x:0,y:0,width:120,height:120,rotation:0};
 const svg=spec.renderSvg({...spec.defaults,symbol:'male',clinical:'physical',smoking:true,obesity:true,languageDifficulty:true},g,'p').svg;
 assert.match(svg,/<rect x="60" y="6" width="26" height="52"\/>/);
 assert.match(svg,/<circle cx="78" cy="14" r="4"/);
 assert.match(svg,/<circle cx="60" cy="32" r="16"/);
 assert.match(svg,/l 26 -26/);
 assert.match(spec.renderSvg({...spec.defaults,clinical:'suspected_substance'},g,'p').svg,/l 26 -26/);
 assert.match(spec.renderSvg({...spec.defaults,clinical:'recovery_with_illness'},g,'p').svg,/fill="#cbd5e1"/);
 for(const field of ['smoking','obesity','languageDifficulty'])assert.equal(spec.defaults[field],false);
});

test('relationship choices expose preview symbols in both inspector and floating toolbar',()=>{
 const relation=plugin.aspects.find(aspect=>aspect.id===ids.relation);
 const controls=relation.ui.controls.filter(control=>control.field==='kind');
 assert.deepEqual(controls.map(control=>control.placement),['inspector','selection-bar']);
 for(const control of controls) {
  assert.ok(control.options.length>=14);
  for(const option of control.options) assert.ok(option.icon?.paths?.length,`missing preview: ${option.value}`);
 }
 assert.deepEqual(controls[0].options,controls[1].options);
});

test('new emotional relationships are straight even when other relationships already exist',()=>{
 const f=fixture(),a=f.run('add-person'),b=f.run('add-person');
 f.select([a,b]);f.run('relation-close');
 const first=[...f.table].find(([,row])=>row[ids.relation])[0];
 assert.equal(f.world.getCanonical(first,ids.relation).curveOffset,0);
 f.world.applyCanonicalTransaction('test:curve',[{id:first,aspect:ids.relation,patch:{curveOffset:42}}]);
 f.select([a,b]);f.run('relation-hostile');
 const second=[...f.table].find(([id,row])=>id!==first&&row[ids.relation])[0];
 assert.equal(f.world.getCanonical(second,ids.relation).curveOffset,0);
 assert.equal(f.world.getCanonical(first,ids.relation).curveOffset,42);
 f.runtime.dispose();
});
