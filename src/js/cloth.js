// Quasi-static cloth: material UVs never change. Distance constraints resist
// stretching; the table has friction, a grabbed patch lifts, and layers collide.
// This is a coarse interactive model, not a calibrated textile/chemical solver.
const CLOTH_STEPS=32,CLOTH_SIDE=CLOTH_STEPS+1,CLOTH_SPACING=768/CLOTH_STEPS;
const clothLinks=[];
for(let j=0;j<CLOTH_SIDE;j++)for(let i=0;i<CLOTH_SIDE;i++){
 const a=j*CLOTH_SIDE+i;
 for(const [dx,dy,stiffness] of [[1,0,1],[0,1,1],[1,1,.75],[-1,1,.75],[2,0,.20],[0,2,.20]]){
  if(i+dx>=0&&i+dx<CLOTH_SIDE&&j+dy<CLOTH_SIDE)clothLinks.push([a,(j+dy)*CLOTH_SIDE+i+dx,CLOTH_SPACING*Math.hypot(dx,dy),stiffness]);
 }
}
function clothFlat(){return Array.from({length:CLOTH_SIDE*CLOTH_SIDE},(_,i)=>({x:(i%CLOTH_SIDE)*CLOTH_SPACING,y:Math.floor(i/CLOTH_SIDE)*CLOTH_SPACING,z:0,u:(i%CLOTH_SIDE)*CLOTH_SPACING,v:Math.floor(i/CLOTH_SIDE)*CLOTH_SPACING}));}
function clothPack(points){return points.flatMap(p=>[+p.x.toFixed(3),+p.y.toFixed(3),+p.z.toFixed(3)]);}
function clothUnpack(values){return clothFlat().map((p,i)=>({...p,x:values[i*3],y:values[i*3+1],z:values[i*3+2]}));}
function clothPositionsValid(v){return Array.isArray(v)&&v.length===CLOTH_SIDE*CLOTH_SIDE*3&&v.every(x=>Number.isFinite(x)&&Math.abs(x)<3072);}
function clothCollide(points){
 const cells=new Map(),cell=12;
 for(let i=0;i<points.length;i++){
  const p=points[i],cx=Math.floor(p.x/cell),cy=Math.floor(p.y/cell),cz=Math.floor(p.z/cell);
  for(let dz=-1;dz<=1;dz++)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
   const list=cells.get((cx+dx)+','+(cy+dy)+','+(cz+dz));if(!list)continue;
   for(const j of list){const q=points[j];if(Math.abs(p.u-q.u)<=CLOTH_SPACING*1.1&&Math.abs(p.v-q.v)<=CLOTH_SPACING*1.1)continue;
    let vx=p.x-q.x,vy=p.y-q.y,vz=p.z-q.z,d=Math.hypot(vx,vy,vz);if(d>=9)continue;if(d<.001){vz=i>j?1:-1;d=1;}
    const f=(9-d)/d*.45;p.x+=vx*f;p.y+=vy*f;p.z+=vz*f;q.x-=vx*f;q.y-=vy*f;q.z-=vz*f;
   }
  }
  const key=cx+','+cy+','+cz;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(i);
 }
}
function clothSolve(points,pins=[],iterations=28){
 const pinned=new Map(pins.map(p=>[p.i,p]));
 for(let n=0;n<iterations;n++){
  // Alternating constraint order avoids a permanent directional solver bias.
  for(let k=0;k<clothLinks.length;k++){
   const [ia,ib,rest,stiff]=clothLinks[n%2?k:clothLinks.length-1-k],a=points[ia],b=points[ib],dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,len=Math.hypot(dx,dy,dz)||.0001;
   const wa=pinned.has(ia)?0:1,wb=pinned.has(ib)?0:1;if(!wa&&!wb)continue;
   const f=(len-rest)/len*stiff/(wa+wb);a.x+=dx*f*wa;a.y+=dy*f*wa;a.z+=dz*f*wa;b.x-=dx*f*wb;b.y-=dy*f*wb;b.z-=dz*f*wb;
  }
  if(n%7===0)clothCollide(points);
  for(const p of points)p.z=Math.max(0,p.z);
  for(const pin of pins)Object.assign(points[pin.i],{x:pin.x,y:pin.y,z:pin.z});
 }
}
function clothStartGrab(points,index){
 const origin=points[index],patch=[];for(let i=0;i<points.length;i++)if(Math.hypot(points[i].u-origin.u,points[i].v-origin.v)<49)patch.push({i,dx:points[i].x-origin.x,dy:points[i].y-origin.y,dz:points[i].z-origin.z});
 return {points:points.map(p=>({...p})),patch,index,origin:{...origin},last:{...origin},travel:0};
}
function clothMoveGrab(grab,target){
 // A broad fingertip lifts a patch. Bound each grab before solving: a fast
 // screen swipe must not stretch the mesh into needles or flip tiny faces.
 const dx=target.x-grab.origin.x,dy=target.y-grab.origin.y,travel=Math.hypot(dx,dy),limit=205;
 target={...target,x:grab.origin.x+dx*Math.min(1,limit/(travel||1)),y:grab.origin.y+dy*Math.min(1,limit/(travel||1))};
 if(Number.isFinite(target.z))target.z=clamp(target.z,0,Math.min(340,grab.origin.z+245));
 const points=grab.points,start={...grab.last},distance=Math.hypot(target.x-start.x,target.y-start.y,Number.isFinite(target.z)?target.z-start.z:0),steps=Math.max(1,Math.ceil(distance/12));
 for(let s=1;s<=steps;s++){
  const x=start.x+(target.x-start.x)*s/steps,y=start.y+(target.y-start.y)*s/steps;grab.travel+=distance/steps;
  const z=Number.isFinite(target.z)?start.z+(target.z-start.z)*s/steps:Math.min(215,grab.origin.z+Math.min(85,12+grab.travel*.22)),previous=points.map(p=>({x:p.x,y:p.y,z:p.z}));
  // The fingers carry a small patch up off the table. The rest is pulled through
  // actual mesh links instead of moving a Gaussian image-displacement field.
  for(const p of points)p.z=Math.max(0,p.z-.24);
  const pins=grab.patch.map(p=>({i:p.i,x:x+p.dx,y:y+p.dy,z:z+p.dz}));
  clothSolve(points,pins,24);
  // Dry cotton sliding on the table retains most of its contact position.
  for(let i=0;i<points.length;i++){const p=points[i],old=previous[i];if(p.z<3&&!pins.some(q=>q.i===i)){p.x=old.x+(p.x-old.x)*.28;p.y=old.y+(p.y-old.y)*.28;}}
  clothSolve(points,pins,10);
 }
 grab.last={x:target.x,y:target.y,z:points[grab.index].z};
}
function clothReleaseGrab(grab){
 // Quasi-static settling preserves frictional folds; no sine-wave creases.
 for(let n=0;n<16;n++){for(const p of grab.points)p.z=Math.max(0,p.z-.65);clothSolve(grab.points,[],7);}
 return grab.points;
}
function clothSample(points,u,v,steps=CLOTH_STEPS){
 const side=steps+1;
 const x=Math.min(steps-.000001,Math.max(0,u/768*steps)),y=Math.min(steps-.000001,Math.max(0,v/768*steps)),i=Math.floor(x),j=Math.floor(y),fx=x-i,fy=y-j,k=j*side+i;
 // Same diagonal and barycentric interpolation as the rendered mesh triangles.
 const ids=fx+fy<=1?[k,k+1,k+side]:[k+side+1,k+side,k+1],weights=fx+fy<=1?[1-fx-fy,fx,fy]:[fx+fy-1,1-fx,1-fy],result={u,v};
 for(const key of ['x','y','z'])result[key]=ids.reduce((sum,id,n)=>sum+points[id][key]*weights[n],0);
 result.slope=Math.max(.12,Math.hypot(points[ids[1]].z-points[ids[0]].z,points[ids[2]].z-points[ids[0]].z)*steps/N);return result;
}

function clothRefinedSurface(points,smooth=true){
 const steps=CLOTH_STEPS*2,side=steps+1,out=[],triangles=[];
 const cubic=(a,b,c,d,t)=>b+.5*t*(c-a+t*(2*a-5*b+4*c-d+t*(3*(b-c)+d-a)));
 for(let j=0;j<=steps;j++)for(let i=0;i<=steps;i++){
  const u=i*N/steps,v=j*N/steps,x=i/2,y=j/2,ix=Math.min(CLOTH_STEPS-1,Math.floor(x)),iy=Math.min(CLOTH_STEPS-1,Math.floor(y)),fx=x-ix,fy=y-iy,k=iy*CLOTH_SIDE+ix,p={u,v};
  for(const key of ['x','y','z'])p[key]=lerp(lerp(points[k][key],points[k+1][key],fx),lerp(points[k+CLOTH_SIDE][key],points[k+CLOTH_SIDE+1][key],fx),fy);
  if(smooth){
   for(const key of ['x','y','z']){const rows=[];for(let row=-1;row<=2;row++){const values=[];for(let col=-1;col<=2;col++)values.push(points[clamp(iy+row,0,CLOTH_STEPS)*CLOTH_SIDE+clamp(ix+col,0,CLOTH_STEPS)][key]);rows.push(cubic(...values,fx));}p[key]=lerp(p[key],cubic(...rows,fy),.8);}p.z=Math.max(0,p.z);
  }out.push(p);
 }
 for(let j=0;j<steps;j++)for(let i=0;i<steps;i++){const k=j*side+i;triangles.push([k,k+1,k+side],[k+1,k+side+1,k+side]);}
 return {points:out,triangles,steps};
}
