import test from 'node:test';
import assert from 'node:assert/strict';
import { lines } from '../src/aspects/lines.js';
import { ids, defaults } from '../src/model.js';

const positions = { a:{x:0,y:0,width:120,height:120,rotation:0}, b:{x:220,y:0,width:120,height:120,rotation:0}, c:{x:110,y:300,width:120,height:120,rotation:0} };
const people = Object.fromEntries(Object.keys(positions).map(id => [id,{...defaults.person}]));
let child;
const view = {
  listEntityIds: () => ['a','b','c','parentage'],
  isAlive: () => true,
  getCanonical(id, aspect) { if (aspect === ids.person) return people[id]; if (id === 'parentage' && aspect === ids.parentage) return child; },
  getComputed(id, aspect) { if (aspect === 'computed.layoutBounds') return positions[id]; },
};
const spec = kind => lines.find(line => line.id === ids[kind]);

test('each emotional relationship has a distinct selectable SVG geometry', () => {
  const relation = spec('relation');
  const options = relation.ui.controls.find(control => control.field === 'kind').options;
  const signatures = new Map();
  for (const {value} of options) {
    const props = {...defaults.relation,from:'a',to:'b',kind:value,curveOffset:28};
    const g = relation.derive(props,'r',view);
    assert.ok(g.paths.length, value);
    const signature=JSON.stringify([g.paths,g.fills]);
    assert.equal(signatures.has(signature),false,`${value} matches ${signatures.get(signature)}`);
    signatures.set(signature,value);
    const svg=relation.renderSvg(props,g,'r').svg;
    assert.ok(svg.includes('<path'), value);
    assert.ok(!svg.includes('NaN'), value);
  }
  const geometry = kind => relation.derive({...defaults.relation,from:'a',to:'b',kind,curveOffset:28},'r',view);
  assert.ok(geometry('abuse_physical').fills.includes('solid'));
  assert.ok(geometry('abuse_emotional').fills.includes('white'));
  assert.ok(geometry('abuse_sexual').fills.includes('solid'));
  assert.ok(geometry('cutoff_repaired').fills.includes('white'));
});

test('family status marks and child relationship styles remain distinct', () => {
  const union = spec('union'), status = union.ui.controls.find(control=>control.field==='status').options;
  const signatures=new Set();
  for (const {value} of status) {
    const g=union.derive({...defaults.union,partnerA:'a',partnerB:'b',status:value},'u',view);
    const signature=JSON.stringify(g.paths);
    assert.equal(signatures.has(signature),false,`duplicate union status: ${value}`);
    signatures.add(signature);
  }
  const parentage=spec('parentage'), outputs=new Set();
  for (const pedigree of ['biological','foster','adopted','surrogate']) {
    child={...defaults.parentage,parentA:'a',parentB:'b',child:'c',pedigree};
    const g=parentage.derive(child,'parentage',view);
    const svg=parentage.renderSvg(child,g,'parentage').svg;
    if(pedigree==='surrogate')assert.ok(svg.includes('대리'));
    assert.equal(outputs.has(svg),false,`duplicate child relationship: ${pedigree}`);
    outputs.add(svg);
  }
});

test('selection geometry includes separation marks and respects empty portions of dashed lines', () => {
 const union=spec('union'), p={...defaults.union,partnerA:'a',partnerB:'b',status:'separation'};
 const g=union.derive(p,'u',view), lookup={...view,getComputed(id,aspect){return aspect===`computed.${ids.union}`?g:view.getComputed(id,aspect);}};
 assert.equal(union.selection.hitTest('u',lookup,g.origin.x+5,g.origin.y-8,4),0);
 const cohab=union.derive({...p,status:'cohabitation'},'u',view), bar=cohab.paths.filter(path=>path.length===2&&path[0].y===cohab.origin.y&&path[1].y===cohab.origin.y);
 assert.ok(bar.length>3);assert.ok(bar[1][0].x-bar[0][1].x>0);
});

test('parallel relationship lines keep their separation at both endpoints', () => {
  const relation=spec('relation');
  for (const kind of ['close','fused','close_hostile','fused_hostile','abuse_sexual']) {
    const g=relation.derive({...defaults.relation,from:'a',to:'b',kind,curveOffset:28},'r',view);
    const [first,second]=g.paths;
    const yAt = (path,x) => {
      for(let i=1;i<path.length;i++) if(path[i-1].x<=x && x<=path[i].x){
        const t=(x-path[i-1].x)/(path[i].x-path[i-1].x);
        return path[i-1].y+t*(path[i].y-path[i-1].y);
      }
      throw Error(`line does not reach ${x}`);
    };
    const startX=Math.max(first[0].x,second[0].x)+1, endX=Math.min(first.at(-1).x,second.at(-1).x)-1;
    const startGap=Math.abs(yAt(first,startX)-yAt(second,startX));
    const endGap=Math.abs(yAt(first,endX)-yAt(second,endX));
    assert.ok(startGap > 7.99,`${kind}: start`);
    assert.ok(endGap > 7.99,`${kind}: end`);
    assert.ok(Math.abs(startGap-endGap)<1e-8,`${kind}: parallel spacing`);
  }
});

test('emotional lines default to red and allow a safe custom color', () => {
 const relation=spec('relation');
 const p={...defaults.relation,from:'a',to:'b',kind:'abuse_physical'}, g=relation.derive(p,'r',view);
 assert.equal(defaults.relation.color,'#dc2626');
 assert.match(relation.renderSvg(p,g,'r').svg,/stroke="#dc2626"/);
 assert.match(relation.renderSvg(p,g,'r').svg,/fill="#dc2626"/);
 assert.match(relation.renderSvg({...p,color:'#187744'},g,'r').svg,/stroke="#187744"/);
 const {color: _color,...legacy}=p;
 assert.match(relation.renderSvg(legacy,g,'r').svg,/stroke="#dc2626"/);
 assert.match(relation.renderSvg({...p,color:'red" onload="alert(1)'},g,'r').svg,/stroke="#dc2626"/);
 assert.ok(relation.ui.controls.some(control=>control.kind==='color'&&control.field==='color'));
});

test('parallel, zigzag and arrow widths are two thirds of their previous size',()=>{
 const relation=spec('relation'), make=kind=>relation.derive({...defaults.relation,from:'a',to:'b',kind,curveOffset:0},'r',view);
 const close=make('close');assert.ok(Math.abs(Math.abs(close.paths[0][1].y-close.paths[1][1].y)-8)<1e-8);
 const hostile=make('hostile'),ys=hostile.paths[0].map(point=>point.y);
 assert.ok(Math.abs(Math.max(...ys)-Math.min(...ys)-16/3)<1e-8);
 const arrow=make('focused_on').paths.at(-1);
 assert.ok(Math.abs(Math.hypot(arrow[0].x-arrow[2].x,arrow[0].y-arrow[2].y)-20/3)<1e-8);
});
