import { ids, personBounds } from '../model.js';

/** Center of the rendered person symbol, transformed with the person's authored rotation. */
export function personSymbol(view, id) {
  const props = view.getCanonical(id, ids.person), box = props && personBounds(view, id);
  if (!box) return;
  const rotation = Number.isFinite(box.rotation) ? box.rotation : 0;
  const cos = Math.cos(rotation), sin = Math.sin(rotation), dy = 32 - box.height / 2;
  return { props, cos, sin, x: box.x + box.width / 2 - dy * sin, y: box.y + box.height / 2 + dy * cos };
}

const cross = (ax, ay, bx, by) => ax * by - ay * bx;
function rayPolygon(dx, dy, vertices) {
  let closest = Infinity;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i], b = vertices[(i + 1) % vertices.length], ex = b[0] - a[0], ey = b[1] - a[1];
    const denominator = cross(dx, dy, ex, ey);
    if (Math.abs(denominator) < 1e-12) continue;
    const distance = cross(a[0], a[1], ex, ey) / denominator;
    const edge = cross(a[0], a[1], dx, dy) / denominator;
    if (distance >= 0 && edge >= -1e-12 && edge <= 1 + 1e-12) closest = Math.min(closest, distance);
  }
  return closest;
}

/** Distance from the symbol center to its outline in a unit world-space direction. */
export function symbolRadius(symbol, worldX, worldY) {
  const { props, cos, sin } = symbol, dx = worldX * cos + worldY * sin, dy = -worldX * sin + worldY * cos;
  let radius;
  switch (props.symbol) {
    case 'female': case 'trans_female': radius = 26; break;
    case 'stillbirth_female': radius = 15; break;
    case 'miscarriage': radius = 9; break;
    case 'male': case 'trans_male': radius = 26 / Math.max(Math.abs(dx), Math.abs(dy)); break;
    case 'stillbirth_male': radius = 15 / Math.max(Math.abs(dx), Math.abs(dy)); break;
    case 'abortion': radius = 9 / Math.max(Math.abs(dx), Math.abs(dy)); break;
    case 'pregnancy': radius = rayPolygon(dx, dy, [[0,-24],[25,20],[-25,20]]); break;
    case 'pet': radius = rayPolygon(dx, dy, [[-23,-22],[23,-22],[23,5],[0,25],[-23,5]]); break;
    default: radius = 26 / (Math.abs(dx) + Math.abs(dy));
  }
  radius *= props.isIndexPerson ? 1.15 : 1;
  // The death cross extends beyond small or circular symbols; keep arrow tips clear of it too.
  if (props.lifeStatus === 'deceased' || String(props.symbol).startsWith('stillbirth'))
    radius = Math.max(radius, 22 / Math.max(Math.abs(dx), Math.abs(dy)));
  return radius;
}


function outline(symbol) {
  const scale = symbol.props.isIndexPerson ? 1.15 : 1;
  let radius, vertices;
  switch (symbol.props.symbol) {
    case 'female': case 'trans_female': radius = 26; break;
    case 'stillbirth_female': radius = 15; break;
    case 'miscarriage': radius = 9; break;
    case 'male': case 'trans_male': vertices = [[-26,-26],[26,-26],[26,26],[-26,26]]; break;
    case 'stillbirth_male': vertices = [[-15,-15],[15,-15],[15,15],[-15,15]]; break;
    case 'abortion': vertices = [[-9,-9],[9,-9],[9,9],[-9,9]]; break;
    case 'pregnancy': vertices = [[0,-24],[25,20],[-25,20]]; break;
    case 'pet': vertices = [[-23,-22],[23,-22],[23,5],[0,25],[-23,5]]; break;
    default: vertices = [[0,-26],[26,0],[0,26],[-26,0]];
  }
  return radius !== undefined ? { radius: radius * scale } : { vertices: vertices.map(([x,y]) => [x * scale,y * scale]) };
}
function localPoint(symbol, point) {
  const x = point.x - symbol.x, y = point.y - symbol.y;
  return { x: x * symbol.cos + y * symbol.sin, y: -x * symbol.sin + y * symbol.cos };
}
function insidePolygon(x, y, vertices) {
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const [xi, yi] = vertices[i], [xj, yj] = vertices[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
/** Exact segment intervals occupied by the circular or polygonal person outline. */
function insideIntervals(a, b, entry) {
  const { symbol, shape } = entry;
  const start = localPoint(symbol, a), end = localPoint(symbol, b), dx = end.x - start.x, dy = end.y - start.y;
  const cuts = [0, 1];
  if (shape.radius !== undefined) {
    const aa = dx * dx + dy * dy, bb = 2 * (start.x * dx + start.y * dy), cc = start.x ** 2 + start.y ** 2 - shape.radius ** 2;
    const disc = bb * bb - 4 * aa * cc;
    if (aa > 0 && disc >= 0) for (const t of [(-bb - Math.sqrt(disc)) / (2 * aa), (-bb + Math.sqrt(disc)) / (2 * aa)]) if (t > 0 && t < 1) cuts.push(t);
  } else {
    const vertices = shape.vertices;
    for (let i = 0; i < vertices.length; i++) {
      const p = vertices[i], q = vertices[(i + 1) % vertices.length], ex = q[0] - p[0], ey = q[1] - p[1];
      const denominator = cross(dx, dy, ex, ey);
      if (Math.abs(denominator) < 1e-12) continue;
      const px = p[0] - start.x, py = p[1] - start.y;
      const t = cross(px, py, ex, ey) / denominator, u = cross(px, py, dx, dy) / denominator;
      if (t > 0 && t < 1 && u >= -1e-12 && u <= 1 + 1e-12) cuts.push(t);
    }
  }
  cuts.sort((x,y)=>x-y);
  const intervals = [];
  for (let i = 1; i < cuts.length; i++) {
    const lo = cuts[i-1], hi = cuts[i]; if (hi - lo < 1e-10) continue;
    const t = (lo + hi) / 2, x = start.x + t * dx, y = start.y + t * dy;
    if (shape.radius !== undefined ? x*x + y*y < shape.radius ** 2 - 1e-9 : insidePolygon(x,y,shape.vertices)) intervals.push([lo,hi]);
  }
  return intervals;
}

/** Remove portions inside person symbols while retaining connected outside segments. */
export function pathsOutsideSymbols(paths, symbols) {
  const result = [], entries = symbols.map(symbol => ({ symbol, shape: outline(symbol) }));
  for (const path of paths) {
    let current;
    for (let i = 1; i < path.length; i++) {
      const a=path[i-1], b=path[i], dx=b.x-a.x, dy=b.y-a.y;
      const blocked=entries.flatMap(entry=>insideIntervals(a,b,entry)).sort((x,y)=>x[0]-y[0]);
      let start=0;
      const emit=end=>{
        if(end-start<=1e-9)return;
        const from={x:a.x+dx*start,y:a.y+dy*start}, to={x:a.x+dx*end,y:a.y+dy*end};
        if(current && start===0) current.push(to); else { current=[from,to]; result.push(current); }
      };
      for(const [lo,hi] of blocked){ if(hi<=start)continue; if(lo>start)emit(lo); current=undefined;start=Math.max(start,hi); }
      if(start<1)emit(1);else current=undefined;
    }
  }
  return result;
}
