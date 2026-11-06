import test from 'node:test';
import assert from 'node:assert/strict';
import { personSymbol, symbolRadius } from '../src/geometry/person-anchors.js';
import { lines } from '../src/aspects/lines.js';
import { defaults, ids } from '../src/model.js';

function fixture(aProps, bProps, aBox, bBox) {
  const props = { a: {...defaults.person,...aProps}, b: {...defaults.person,...bProps} }, boxes = {a:aBox,b:bBox};
  return { listEntityIds:()=>['a','b'], isAlive:()=>true,
    getCanonical:(id,aspect)=>aspect===ids.person?props[id]:undefined,
    getComputed:(id,aspect)=>aspect==='computed.layoutBounds'?boxes[id]:undefined };
}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('center-aligned lines touch circle and square outlines',()=>{
  const a={x:0,y:0,width:120,height:120,rotation:0}, b={x:200,y:0,width:120,height:120,rotation:0};
  const view=fixture({symbol:'male'},{symbol:'female'},a,b), relation=lines.find(item=>item.id===ids.relation);
  const geometry=relation.derive({...defaults.relation,kind:'focused_on',from:'a',to:'b',curveOffset:0},'r',view);
  near(geometry.paths[0][0].x,86);near(geometry.paths[0][0].y,32);
  near(geometry.paths[0].at(-1).x,234);near(geometry.paths[0].at(-1).y,32);
  assert.ok(geometry.paths.some(path=>path.some(point=>Math.hypot(point.x-234,point.y-32)<1e-8)));
});
test('rotated symbols use transformed centers and exact outline intersections',()=>{
  const a={x:0,y:0,width:120,height:120,rotation:Math.PI/2},b={x:240,y:180,width:120,height:120,rotation:Math.PI/4};
  const view=fixture({symbol:'pregnancy'},{symbol:'unknown',isIndexPerson:true},a,b);
  const first=personSymbol(view,'a'),second=personSymbol(view,'b');
  const relation=lines.find(item=>item.id===ids.relation),geometry=relation.derive({...defaults.relation,kind:'focused_on',from:'a',to:'b',curveOffset:0},'r',view);
  const start=geometry.paths[0][0],end=geometry.paths[0].at(-1);
  near(first.x,88);near(first.y,60);
  const dx=second.x-first.x,dy=second.y-first.y,length=Math.hypot(dx,dy),ux=dx/length,uy=dy/length;
  near((start.x-first.x)*uy-(start.y-first.y)*ux,0);
  near(Math.hypot(start.x-first.x,start.y-first.y),symbolRadius(first,ux,uy));
  near(Math.hypot(end.x-second.x,end.y-second.y),symbolRadius(second,-ux,-uy));
});
test('symbol outlines and overlapping nodes are handled without invalid geometry',()=>{
  const box={x:0,y:0,width:120,height:120,rotation:0},far={...box,x:300},relation=lines.find(item=>item.id===ids.relation);
  for(const symbol of ['male','female','unknown','trans_male','trans_female','nonbinary','pregnancy','miscarriage','abortion','stillbirth_male','stillbirth_female','pet']){
    const v=fixture({symbol},{symbol},box,far),g=relation.derive({...defaults.relation,from:'a',to:'b',curveOffset:0},'r',v);
    assert.ok(g, symbol);assert.ok(g.paths.flat().every(point=>Number.isFinite(point.x)&&Number.isFinite(point.y)),symbol);
  }
  assert.equal(relation.derive({...defaults.relation,from:'a',to:'b'},'r',fixture({symbol:'male'},{symbol:'female'},box,box)),undefined);
});

test('parallel line endpoints stay outside rotated person symbols in every direction',()=>{
  const relation=lines.find(item=>item.id===ids.relation);
  for(const shape of ['male','female','unknown','pregnancy','pet']) for(let angle=0;angle<360;angle+=15){
    const radians=angle*Math.PI/180, first={x:0,y:0,width:120,height:120,rotation:0}, second={...first,x:300*Math.cos(radians),y:300*Math.sin(radians)};
    const view=fixture({symbol:shape},{symbol:shape},first,second);
    const geometry=relation.derive({...defaults.relation,kind:'close',from:'a',to:'b',curveOffset:0},'r',view);
    for(const path of geometry.paths.slice(0,2)) for(const [point,id] of [[path[0],'a'],[path.at(-1),'b']]){
      const node=personSymbol(view,id),dx=point.x-node.x,dy=point.y-node.y,distance=Math.hypot(dx,dy);
      assert.ok(Math.abs(distance - symbolRadius(node,dx/distance,dy/distance)) < 1e-6,`${shape}, ${angle}°, ${id}`);
    }
  }
});

test('directed arrowheads follow the tangent of the relationship curve',()=>{
  const a={x:0,y:0,width:120,height:120,rotation:0},b={x:260,y:80,width:120,height:120,rotation:0};
  const v=fixture({symbol:'male'},{symbol:'female'},a,b), relation=lines.find(item=>item.id===ids.relation);
  for(const kind of ['focused_on','negative_focused','caregiving','abuse_physical','abuse_emotional','abuse_sexual']) for(const curveOffset of [-70,0,70]){
    const first=personSymbol(v,'a'),second=personSymbol(v,'b');
    const dx=second.x-first.x,dy=second.y-first.y,len=Math.hypot(dx,dy),nx=-dy/len,ny=dx/len;
    const g=relation.derive({...defaults.relation,kind,from:'a',to:'b',curveOffset},'r',v);
    const head=g.paths.at(kind==='caregiving'?-2:-1);
    assert.ok(head && head.length >= 3,`${kind} ${curveOffset}`);
    const [left,tip,right]=head,ux=tip.x-(left.x+right.x)/2,uy=tip.y-(left.y+right.y)/2;
    const t=((tip.x-first.x)*dx+(tip.y-first.y)*dy)/(len*len);
    const tx=dx+4*curveOffset*(1-2*t)*nx,ty=dy+4*curveOffset*(1-2*t)*ny;
    near((ux*ty-uy*tx)/(Math.hypot(ux,uy)*Math.hypot(tx,ty)),0);
    assert.ok(ux*tx+uy*ty>0);
  }
});
