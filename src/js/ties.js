// Material coordinates are permanent. Geometry, rope contact and unfolded dye
// all use the same stored cloth mesh; no independent decorative tie patterns.
const TIE_MAX=6,TIE_MAX_FOLDS=5,TIE_MAX_GESTURES=24;
const tieDraft={format:3,seed:(sessionSeed^0x71e5b12d)>>>0,preparation:[],knots:[],stage:'prepare',tool:'gather',tension:.65,selectedId:null,revision:0,nextId:1};
let tieGesture=null,tieAnimation=null,tieAnimationFrame=0;
const tieMaskCache=new Map(),tieModelCache=new Map(),tieSurfaceCache=new Map();
function tieNextSeed(value){let s=(value>>>0)||0x71e5b12d;s^=s<<13;s^=s>>>17;s^=s<<5;return s>>>0;}
function tieClone(value){return JSON.parse(JSON.stringify(value));}
function tieSmooth(a,b,value){const p=clamp((value-a)/(b-a));return p*p*(3-2*p);}
function snapshotTieDraft(){return {format:3,seed:tieDraft.seed>>>0,preparation:tieClone(tieDraft.preparation),knots:tieClone(tieDraft.knots)};}
function getTieDraftData(){return {...snapshotTieDraft(),stage:tieDraft.stage,tool:tieDraft.tool,tension:tieDraft.tension,selectedId:tieDraft.selectedId,nextId:tieDraft.nextId};}
function tieNotify(commit=false){tieDraft.revision++;tieSurfaceCache.clear();if(typeof renderEditor==='function')renderEditor();if(typeof updateEditorButtons==='function')updateEditorButtons();if(commit&&typeof saveTieDraft==='function')saveTieDraft();}
function tiePrepared(work=tieDraft){return !!work.preparation?.length;}
function tieFormKey(work){return JSON.stringify([work.preparation,work.knots?.map(k=>[k.kind,k.a,k.b,k.height,k.center,k.tension,k.locked])]);}
function tieMaskKey(work){return JSON.stringify([work.seed,work.preparation,work.knots]);}
function tieFinitePoint(p){return p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Math.abs(p.x)<1536&&Math.abs(p.y)<1536;}
function loadTieDraft(data){
 // Incompatible drafts stay in their old storage key. Never invent a bundled
 // shape or put ropes onto a user's new, flat cloth when migrating a draft.
 if(!data||data.format!==3||!Array.isArray(data.preparation)||!Array.isArray(data.knots))return false;
 cancelTieGesture();tieDraft.seed=data.seed>>>0;tieDraft.preparation=[];tieDraft.knots=[];
 for(const op of data.preparation.slice(0,TIE_MAX_GESTURES)){
  if(op?.type==='gather'&&clothPositionsValid(op.positions))tieDraft.preparation.push(tieClone(op));
  if(op?.type==='fold'&&tieFinitePoint(op.a)&&tieFinitePoint(op.b)&&Math.hypot(op.a.x-op.b.x,op.a.y-op.b.y)>40)tieDraft.preparation.push(tieClone(op));
 }
 const ids=new Set();if(tiePrepared())for(const k of data.knots.slice(0,TIE_MAX)){
  if(!tieFinitePoint(k.a)||!tieFinitePoint(k.b)||Math.hypot(k.a.x-k.b.x,k.a.y-k.b.y)<25||!Number.isSafeInteger(k.id)||k.id<1||ids.has(k.id))continue;
  if(k.kind==='collar'&&(!Number.isFinite(k.height)||k.height<5||k.height>650||!tieFinitePoint(k.center)))continue;
  ids.add(k.id);tieDraft.knots.push({...tieClone(k),tension:clamp(Number(k.tension)||0),locked:k.locked===true});
 }
 tieDraft.nextId=Math.max(1,...tieDraft.knots.map(k=>k.id+1));tieDraft.stage=tiePrepared()&&data.stage==='bind'?'bind':'prepare';tieDraft.tool=data.tool==='fold'?'fold':data.tool==='pinch'?'pinch':'gather';tieDraft.tension=.65;tieDraft.selectedId=tieDraft.knots.at(-1)?.id??null;tieNotify();return true;
}
function resetTieDraft(seed){cancelTieGesture();tieAnimation=null;tieDraft.preparation=[];tieDraft.knots=[];tieDraft.stage='prepare';tieDraft.tool='gather';tieDraft.selectedId=null;tieDraft.nextId=1;if(Number.isFinite(seed))tieDraft.seed=seed>>>0;tieNotify(true);}
function tieSetTool(tool){cancelTieGesture();tieDraft.tool=tool==='fold'?'fold':tool==='pinch'?'pinch':'gather';tieNotify(true);}
function tieBeginBinding(){cancelTieGesture();if(!tiePrepared())return false;tieDraft.stage='bind';tieNotify(true);return true;}
function tieBackToPreparation(){cancelTieGesture();tieDraft.knots=[];tieDraft.selectedId=null;tieDraft.stage='prepare';tieNotify(true);}
function tieUndo(){cancelTieGesture();if(tieDraft.stage==='bind')return removeTieKnot();tieDraft.preparation.pop();tieAnimation=null;tieNotify(true);}
function removeTieKnot(id=tieDraft.selectedId){const index=tieDraft.knots.findIndex(k=>k.id===(id??tieDraft.knots.at(-1)?.id));if(index<0)return false;cancelTieGesture();tieDraft.knots.splice(index,1);tieDraft.selectedId=tieDraft.knots.at(-1)?.id??null;tieNotify(true);return true;}
function tieAddPreparation(op,animate=false){
 if(tieDraft.preparation.length>=TIE_MAX_GESTURES){toast('可以开始捆扎了，或撤销一步再调整。');return false;}
 const before=snapshotTieDraft();tieDraft.preparation.push(op);tieNotify(true);
 if(animate&&!reduceMotion){tieAnimation={before,after:snapshotTieDraft(),start:performance.now()};tieAnimate();}return true;
}
function tieAnimate(){if(tieAnimationFrame)return;tieAnimationFrame=requestAnimationFrame(function tick(){tieAnimationFrame=0;if(!tieAnimation||screen!=='editor'||technique!=='tie'){tieAnimation=null;return;}if(performance.now()-tieAnimation.start>=650)tieAnimation=null;renderEditor();if(tieAnimation)tieAnimate();});}
function tieCrumple(){
 // Keyboard alternative: one real edge grab per click, no instant random ball.
 if(tieDraft.stage!=='prepare')return;const points=tieModel(tieDraft).points,center=points.reduce((a,p)=>({x:a.x+p.x/points.length,y:a.y+p.y/points.length}),{x:0,y:0}),corners=[16,16*CLOTH_SIDE+32,32*CLOTH_SIDE+16,16*CLOTH_SIDE],index=corners[tieDraft.preparation.length%4],p=points[index],grab=clothStartGrab(points,index);
 clothMoveGrab(grab,{x:lerp(p.x,center.x,.62),y:lerp(p.y,center.y,.62)});tieAddPreparation({type:'gather',positions:clothPack(clothReleaseGrab(grab)),grab:index},true);
}
function tieFoldPreset(vertical=false){const b=tieBounds(tieModel(tieDraft).points),cx=(b.minX+b.maxX)/2,cy=(b.minY+b.maxY)/2;tieCommitFold(vertical?{x:cx,y:b.minY-30}:{x:b.minX-30,y:cy},vertical?{x:cx,y:b.maxY+30}:{x:b.maxX+30,y:cy});}
function tieCommitFold(a,b){
 if(tieDraft.preparation.filter(x=>x.type==='fold').length>=TIE_MAX_FOLDS)return false;
 const len=Math.hypot(b.x-a.x,b.y-a.y);if(len<60)return false;const model=tieModel(tieDraft),nx=-(b.y-a.y)/len,ny=(b.x-a.x)/len;let positive=0,negative=0;
 for(const p of model.points){const d=(p.x-a.x)*nx+(p.y-a.y)*ny;if(d>5)positive++;if(d<-5)negative++;}
 if(positive<3||negative<3){toast('折线需要穿过布料。');return false;}return tieAddPreparation({type:'fold',a:{...a},b:{...b}},true);
}
function tieBounds(points){let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;for(const p of points){minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y);}return {minX,minY,maxX,maxY};}
// Fixed oblique camera: the table and untouched fabric never zoom or recenter
// underneath the fingers. z is height above the table, always nonnegative.
function tiePresentation(){return {scale:5/6,cx:384,cy:384};}
function tieProject(p,pose=tiePresentation()){return {x:64+p.x*5/6,y:120+p.y*.69-(p.z||0)*.65,depth:p.y*.65+(p.z||0)*.69};}
function tieUnproject(p){return {x:(p.x-64)*6/5,y:(p.y-120)/.69};}
function tieFoldPoints(points,a,b,f=1){
 const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy),nx=-dy/len,ny=dx/len;
 const high=Math.max(...points.map(p=>p.z)),settle=high>40?lerp(1,.22,f):1,top=high*settle+5,angle=Math.PI*f;
 return points.map(p=>{const d=(p.x-a.x)*nx+(p.y-a.y)*ny,z=p.z*settle;
  if(d<=0)return {...p,z};
  // Round the hinge over two yarn cells. A previously gathered cloth settles
  // before turning over; there is no discontinuous tall wall at the crease.
  const hinge=tieSmooth(0,CLOTH_SPACING*2,d);
  return {...p,x:p.x+nx*d*(Math.cos(angle)-1),y:p.y+ny*d*(Math.cos(angle)-1),z:Math.max(0,z+(f===1?0:Math.sin(angle))*d+(top-2*z)*hinge*f)};
 });
}
function tieBasePoints(work){
 let points=clothFlat();
 for(const op of work.preparation||[]){
  if(op.type==='gather'&&clothPositionsValid(op.positions))points=clothUnpack(op.positions);
  else if(op.type==='fold')points=tieFoldPoints(points,op.a,op.b);
 }
 return points;
}
function tieRopeCoordinates(p,k){if(k.kind==='collar'){const angle=Math.atan2(p.y-k.center.y,p.x-k.center.x);return {along:(angle+Math.PI)*90,across:p.z-k.height,angle,tx:1,ty:0,len:Math.PI*180};}const dx=k.b.x-k.a.x,dy=k.b.y-k.a.y,len=Math.hypot(dx,dy),tx=dx/len,ty=dy/len;return {along:(p.x-k.a.x)*tx+(p.y-k.a.y)*ty,across:-(p.x-k.a.x)*ty+(p.y-k.a.y)*tx,tx,ty,len};}
function tieModel(work=tieDraft){
 const key=tieFormKey(work);if(tieModelCache.has(key))return tieModelCache.get(key);
 const points=tieBasePoints(work);
 // A tight band compresses the same material represented in the dye map.
 // Compression is modest; longitudinal fibre lengths are relaxed afterwards.
 for(const knot of work.knots||[])if(knot.tension>0){
  const center=knot.center||{x:(knot.a.x+knot.b.x)/2,y:(knot.a.y+knot.b.y)/2};
  for(const p of points){const q=tieRopeCoordinates(p,knot),f=Math.exp(-q.across*q.across/2500)*knot.tension*.16;p.x=lerp(p.x,center.x,f);p.y=lerp(p.y,center.y,f);if(knot.kind!=='collar')p.z*=1-f;}
 }
 if(work.preparation?.some(op=>op.type==='gather')&&work.knots?.some(k=>k.tension>0))clothSolve(points,[],12);
 const triangles=[];for(let j=0;j<CLOTH_STEPS;j++)for(let i=0;i<CLOTH_STEPS;i++){const k=j*CLOTH_SIDE+i;triangles.push([k,k+1,k+CLOTH_SIDE],[k+1,k+CLOTH_SIDE+1,k+CLOTH_SIDE]);}
 triangles.sort((a,b)=>a.reduce((s,i)=>s+tieProject(points[i]).depth,0)-b.reduce((s,i)=>s+tieProject(points[i]).depth,0));
 const model={points,triangles,steps:CLOTH_STEPS,pose:tiePresentation(),surface:clothRefinedSurface(points,work.preparation?.some(op=>op.type==='gather'))};tieModelCache.set(key,model);if(tieModelCache.size>5)tieModelCache.delete(tieModelCache.keys().next().value);return model;
}
function tieMapPoint(u,v,work=tieDraft){const model=tieModel(work).surface;return clothSample(model.points,u,v,model.steps);}
function tieLineInterval(a,b,model){
 const len=Math.hypot(b.x-a.x,b.y-a.y);if(len<1)return null;const tx=(b.x-a.x)/len,ty=(b.y-a.y)/len,nx=-ty,ny=tx,values=[];
 for(const ids of model.triangles){const pts=ids.map(i=>model.points[i]);for(let j=0;j<3;j++){const p=pts[j],q=pts[(j+1)%3],dp=(p.x-a.x)*nx+(p.y-a.y)*ny,dq=(q.x-a.x)*nx+(q.y-a.y)*ny;if(dp*dq<=0&&Math.abs(dp-dq)>.0001){const t=dp/(dp-dq);values.push((lerp(p.x,q.x,t)-a.x)*tx+(lerp(p.y,q.y,t)-a.y)*ty);}}}
 if(values.length<2)return null;const low=Math.min(...values),high=Math.max(...values);if(high-low<25||high<0||low>len)return null;return {a:{x:a.x+tx*low,y:a.y+ty*low},b:{x:a.x+tx*high,y:a.y+ty*high}};
}
function tieAddWrap(a,b,tension=0,notify=true){
 if(!tiePrepared()||tieDraft.knots.length>=TIE_MAX||tieDraft.knots.some(k=>!k.locked))return null;const span=tieLineInterval(a,b,tieModel(tieDraft));if(!span)return null;
 const id=tieDraft.nextId++,k={id,kind:'wrap',a:span.a,b:span.b,tension:clamp(tension),locked:tension>=.35,seed:tieNextSeed(tieDraft.seed^id)};tieDraft.knots.push(k);tieDraft.selectedId=id;if(notify)tieNotify(true);return k;
}
function tieWrapPreset(){if(tieDraft.preparation.some(op=>op.pinch)&&tieDraft.preparation.at(-1)?.type!=='fold'&&Math.max(...tieModel().points.map(p=>p.z))>50){const height=Math.max(...tieModel().points.map(p=>p.z));return tieAddCollar(height*Math.max(.2,.68-tieDraft.knots.length*.20));}const model=tieModel(tieDraft),b=tieBounds(model.points),cx=(b.minX+b.maxX)/2,cy=(b.minY+b.maxY)/2,angle=tieDraft.knots.length*Math.PI/3;return tieAddWrap({x:cx-Math.cos(angle)*N,y:cy-Math.sin(angle)*N},{x:cx+Math.cos(angle)*N,y:cy+Math.sin(angle)*N});}
async function tieLiftCenter(){
 if(tieDraft.stage!=='prepare'||tieGesture)return;
 const points=tieModel().points,index=16*CLOTH_SIDE+16,p=points[index],grab=clothStartGrab(points,index),height=Math.min(430,p.z+240);
 const job=tieGesture={id:null,kind:'pinch',grab,auto:true};updateEditorButtons();
 // Yield between constrained lifts so the fingers and cloth can move visibly.
 for(let j=1;j<=16;j++){
  await new Promise(resolve=>requestAnimationFrame(resolve));
  if(tieGesture!==job||screen!=='editor'||technique!=='tie')return;
  clothMoveGrab(grab,{x:p.x,y:p.y,z:lerp(p.z,height,j/16)});tieSurfaceCache.clear();renderEditor();
 }
 tieGesture=null;tieAddPreparation({type:'gather',pinch:true,positions:clothPack(clothReleaseGrab(grab)),grab:index});
}
function tieAddCollar(height){
 if(!tiePrepared()||tieDraft.knots.length>=TIE_MAX||tieDraft.knots.some(k=>!k.locked)||height<8)return null;
 const points=tieModel().points,top=points.reduce((a,p)=>p.z>a.z?p:a,points[0]),id=tieDraft.nextId++;
 const k={id,kind:'collar',center:{x:top.x,y:top.y},height,a:{x:top.x-100,y:top.y},b:{x:top.x+100,y:top.y},tension:0,locked:false,seed:tieNextSeed(tieDraft.seed^id)};
 tieDraft.knots.push(k);tieDraft.selectedId=id;tieNotify(true);return k;
}
function tieTightenSelected(){const k=tieDraft.knots.find(k=>k.id===tieDraft.selectedId);if(!k)return;k.tension=clamp(k.tension+.25);if(k.tension>=.5)k.locked=true;tieNotify(true);}
function addTieKnot(p,radius=116,notify=true){return tieAddWrap({x:p.x-radius,y:p.y},{x:p.x+radius,y:p.y},.65,notify);}
function randomizeTieKnots(count=3,seed){resetTieDraft(seed);tieCrumple();tieDraft.stage='bind';for(let i=0;i<Math.min(TIE_MAX,count);i++){const k=tieWrapPreset();if(k){k.tension=.65;k.locked=true;}}tieNotify(true);return snapshotTieDraft();}
function tieResistAt(p,work){
 let resist=0;
 for(const k of work.knots||[]){
  if(!k.locked)continue;
  const q=tieRopeCoordinates(p,k);if(q.along< -15||q.along>q.len+15)continue;
  const width=3.6+k.tension*6.5,dist=Math.abs(q.across);
  const s=work.seed%1009+k.id*17,tangent=q.along;
  // Thin compressed core, interrupted capillary fingers and a broad pale-blue
  // transition. Their direction follows the actual collar/rope cross-section.
  const strand=k.kind==='collar'?smoothNoise(Math.cos(q.angle)*83,Math.sin(q.angle)*83+q.across/95,s+5):smoothNoise(tangent/1.8,q.across/76,s+5);
  const group=k.kind==='collar'?smoothNoise(Math.cos(q.angle)*13,Math.sin(q.angle)*13,s+19):smoothNoise(tangent/9,q.across/85,s+19);
  const core=Math.pow(1-tieSmooth(0,width*(1.12+.16*group),dist),.48);
  const cap=k.kind==='collar'?(p.slope||.35)*(5+32*Math.pow(strand,2)):width*(.85+1.7*Math.pow(strand,2));
  const reach=Math.min(width*(.9+2*Math.pow(strand,2.5)),Math.max(3,cap));
  const envelope=Math.exp(-Math.pow(Math.max(0,dist-3)/reach,2.2));
  const veins=envelope*(.17+.70*strand),halo=Math.exp(-dist*dist/(width*width*5))*.21;
  const channels=Math.pow(smoothNoise(tangent/1.3,q.across/85,s+73),6);
  const broken=1-.47*channels;
  const edge=Math.max(core*(.97-.07*group)*broken,veins,halo);
  resist=Math.max(resist,edge);
 }
 return clamp(resist);
}
function getTieResistMask(work=tieDraft){
 const key=tieMaskKey(work);if(tieMaskCache.has(key))return tieMaskCache.get(key);
 const canvas=make(),c=ctx(canvas),im=c.createImageData(N,N),out=im.data,model=tieModel(work).surface,points=model.points;
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){
  const p=clothSample(points,x,y,model.steps);
  const resist=tieResistAt(p,work),k=(y*N+x)*4;
  out[k]=out[k+1]=out[k+2]=255;out[k+3]=Math.round(resist*255);
 }
 c.putImageData(im,0,0);tieMaskCache.set(key,canvas);if(tieMaskCache.size>3)tieMaskCache.delete(tieMaskCache.keys().next().value);return canvas;
}
// Cross-section convex hull: twine wraps around the volume instead of being a
// straight line painted onto the screen. The hidden side faces away from view.
function tieRopeLoop(k,work=tieDraft){
 if(k.kind==='collar'){
  const model=tieModel(work).surface,hits=[];
  for(const ids of model.triangles)for(let j=0;j<3;j++){const a=model.points[ids[j]],b=model.points[ids[(j+1)%3]];if((a.z-k.height)*(b.z-k.height)<=0&&Math.abs(a.z-b.z)>.001){const f=(k.height-a.z)/(b.z-a.z);hits.push({x:lerp(a.x,b.x,f),y:lerp(a.y,b.y,f)});}}
  hits.sort((a,b)=>a.x-b.x||a.y-b.y);const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x),lo=[],hi=[];
  for(const p of hits){while(lo.length>1&&cross(lo.at(-2),lo.at(-1),p)<=0)lo.pop();lo.push(p);}
  for(const p of [...hits].reverse()){while(hi.length>1&&cross(hi.at(-2),hi.at(-1),p)<=0)hi.pop();hi.push(p);}lo.pop();hi.pop();let hull=lo.concat(hi);
  if(hull.length<3)hull=Array.from({length:32},(_,i)=>({x:k.center.x+24*Math.cos(i*Math.PI/16),y:k.center.y+24*Math.sin(i*Math.PI/16)}));
  const slack=k.locked?3:18;
  return hull.map((p,i)=>{const d=Math.hypot(p.x-k.center.x,p.y-k.center.y)||1;return {x:p.x+(p.x-k.center.x)/d*slack,y:p.y+(p.y-k.center.y)/d*slack,z:k.height,s:i,tx:1,ty:0};});
 }

 const model=tieModel(work).surface,dx=k.b.x-k.a.x,dy=k.b.y-k.a.y,len=Math.hypot(dx,dy),tx=dx/len,ty=dy/len;
 let section=[];
 for(const ids of model.triangles)for(let j=0;j<3;j++){
  const a=model.points[ids[j]],b=model.points[ids[(j+1)%3]],ca=tieRopeCoordinates(a,k),cb=tieRopeCoordinates(b,k);
  if(ca.across*cb.across<=0&&Math.abs(ca.across-cb.across)>.00001){const f=ca.across/(ca.across-cb.across);section.push({s:lerp(ca.along,cb.along,f),z:lerp(a.z,b.z,f)});}
 }
 if(section.length<3)section=[{s:0,z:0},{s:len,z:0},{s:len/2,z:25}];section.sort((a,b)=>a.s-b.s||a.z-b.z);
 const cross=(a,b,c)=>(b.s-a.s)*(c.z-a.z)-(b.z-a.z)*(c.s-a.s),lower=[],upper=[];
 for(const p of section){while(lower.length>1&&cross(lower.at(-2),lower.at(-1),p)<=0)lower.pop();lower.push(p);}
 for(const p of [...section].reverse()){while(upper.length>1&&cross(upper.at(-2),upper.at(-1),p)<=0)upper.pop();upper.push(p);}lower.pop();upper.pop();const hull=lower.concat(upper),cz=section.reduce((a,p)=>a+p.z,0)/section.length,slack=k.locked?3:7+(1-k.tension)*22;
 return hull.map(p=>{const vx=p.s-len/2,vz=p.z-cz,l=Math.hypot(vx,vz)||1,s=p.s+vx/l*slack,z=p.z+vz/l*slack;return {x:k.a.x+tx*s,y:k.a.y+ty*s,z,s,tx,ty};});
}
function tieRopeAnchor(k,work=tieDraft){const loop=tieRopeLoop(k,work);return tieProject(loop.reduce((a,p)=>tieProject(p).depth>tieProject(a).depth?p:a,loop[0]));}
function tieHandlePoint(k){return tieRopeAnchor(k);}
function tieRopeStroke(c,path,width=4){c.save();c.lineCap='round';c.lineJoin='round';c.strokeStyle='#624529';c.lineWidth=width+2;c.beginPath();path(c);c.stroke();c.strokeStyle='#bd9a65';c.lineWidth=width;c.stroke();c.strokeStyle='#f4dcaa';c.lineWidth=width*.35;c.stroke();c.strokeStyle='#88623799';c.lineWidth=width*.6;c.setLineDash([1,5]);c.stroke();c.restore();}
function drawTieRopes(c,{x=0,y=0,width=N,height=width,work=tieDraft,untied=[],selectedId=null,alpha=1}={}){
 const removed=new Set(untied);c.save();c.translate(x,y);c.scale(width/N,height/N);c.globalAlpha*=alpha;
 for(const knot of work.knots||[]){if(removed.has(knot.id))continue;const loop=tieRopeLoop(knot,work),p=tieRopeAnchor(knot,work),turns=knot.locked?3:1;
  for(let turn=0;turn<turns;turn++)for(let i=0;i<loop.length;i++){
   const a=loop[i],b=loop[(i+1)%loop.length],ds=b.s-a.s,dz=b.z-a.z;
   if(knot.kind==='collar'?(a.y+b.y)/2<knot.center.y:dz*a.ty*.65-ds*.69<0)continue;
   const offset=(turn-(turns-1)/2)*5,pa=tieProject({x:a.x-a.ty*offset,y:a.y+a.tx*offset,z:a.z+(knot.kind==='collar'?offset:0)}),pb=tieProject({x:b.x-b.ty*offset,y:b.y+b.tx*offset,z:b.z+(knot.kind==='collar'?offset:0)});tieRopeStroke(c,q=>{q.moveTo(pa.x,pa.y);q.lineTo(pb.x,pb.y);},3.2);
  }
  const tail=40+(1-knot.tension)*36;
  tieRopeStroke(c,q=>{q.moveTo(p.x,p.y);q.quadraticCurveTo(p.x+25,p.y+15,p.x+tail,p.y+tail*.7);q.moveTo(p.x,p.y);q.quadraticCurveTo(p.x-3,p.y+32,p.x-20,p.y+tail);},4);
  if(knot.locked)tieRopeStroke(c,q=>{q.moveTo(p.x-8,p.y);q.bezierCurveTo(p.x-19,p.y-20,p.x+19,p.y-17,p.x+7,p.y+5);q.lineTo(p.x-8,p.y+5);},4);
  if(selectedId===knot.id&&!knot.locked){c.strokeStyle='#436e6790';c.lineWidth=2;c.setLineDash([4,6]);c.beginPath();c.arc(p.x+tail,p.y+tail*.7,20,0,Math.PI*2);c.stroke();c.setLineDash([]);}
 }c.restore();
}
function tieDrawTriangle(c,texture,a,b,d){
 const det=(b.u-a.u)*(d.v-a.v)-(d.u-a.u)*(b.v-a.v);if(Math.abs(det)<.001)return;
 const aa=((b.x-a.x)*(d.v-a.v)-(d.x-a.x)*(b.v-a.v))/det,bb=((b.y-a.y)*(d.v-a.v)-(d.y-a.y)*(b.v-a.v))/det,cc=((d.x-a.x)*(b.u-a.u)-(b.x-a.x)*(d.u-a.u))/det,dd=((d.y-a.y)*(b.u-a.u)-(b.y-a.y)*(d.u-a.u))/det;
 const cx=(a.x+b.x+d.x)/3,cy=(a.y+b.y+d.y)/3;const edge=p=>{const len=Math.max(1,Math.hypot(p.x-cx,p.y-cy));return {x:p.x+(p.x-cx)/len*.45,y:p.y+(p.y-cy)/len*.45};};const pa=edge(a),pb=edge(b),pd=edge(d);c.save();c.beginPath();c.moveTo(pa.x,pa.y);c.lineTo(pb.x,pb.y);c.lineTo(pd.x,pd.y);c.closePath();c.clip();c.transform(aa,bb,cc,dd,a.x-aa*a.u-cc*a.v,a.y-bb*a.u-dd*a.v);c.drawImage(texture,0,0);c.restore();
}

// Per-pixel depth resolves intersecting folds. Sorting whole triangles by their
// centres shows back faces through front faces and produces the old torn shards.
const tieRaster=make();
function tieRenderSurface(c,texture,work,unfold=0,animation=null){
 const model=tieModel(work).surface,before=animation?tieModel(animation.before).surface:null,f=animation?clamp((performance.now()-animation.start)/650):1;
 const op=work.preparation.at(-1);
 const world=before?(op?.type==='fold'?tieFoldPoints(before.points,op.a,op.b,ease(f)):model.points.map((p,i)=>({...p,x:lerp(before.points[i].x,p.x,ease(f)),y:lerp(before.points[i].y,p.y,ease(f)),z:lerp(before.points[i].z,p.z,ease(f))}))):model.points;
 const pts=world.map(p=>{const q=tieProject(p);return {...p,...q,x:lerp(q.x,64+p.u*640/N,unfold),y:lerp(q.y,64+p.v*640/N,unfold)};});
 const normals=world.map(()=>({x:0,y:0,z:0}));
 for(const ids of model.triangles){const [a,b,d]=ids.map(i=>world[i]),ux=b.x-a.x,uy=b.y-a.y,uz=b.z-a.z,vx=d.x-a.x,vy=d.y-a.y,vz=d.z-a.z;let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
  if(ny*.65+nz*.69<0){nx=-nx;ny=-ny;nz=-nz;}for(const id of ids){normals[id].x+=nx;normals[id].y+=ny;normals[id].z+=nz;}
 }
 const lighting=normals.map(n=>{const len=Math.hypot(n.x,n.y,n.z)||1,dot=Math.abs((-.26*n.x-.20*n.y+.945*n.z)/len);return (.02+.15*(1-dot))*(1-unfold);});
 const tc=ctx(tieRaster),im=tc.createImageData(N,N),out=im.data,source=ctx(texture).getImageData(0,0,N,N).data,depth=new Float32Array(N*N);depth.fill(-Infinity);
 for(const ids of model.triangles){const [ia,ib,ic]=ids,a=pts[ia],b=pts[ib],d=pts[ic],den=(b.y-d.y)*(a.x-d.x)+(d.x-b.x)*(a.y-d.y);if(Math.abs(den)<.01)continue;
  const x0=Math.max(0,Math.floor(Math.min(a.x,b.x,d.x))),x1=Math.min(N-1,Math.ceil(Math.max(a.x,b.x,d.x))),y0=Math.max(0,Math.floor(Math.min(a.y,b.y,d.y))),y1=Math.min(N-1,Math.ceil(Math.max(a.y,b.y,d.y)));
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
   const wa=((b.y-d.y)*(x+.5-d.x)+(d.x-b.x)*(y+.5-d.y))/den,wb=((d.y-a.y)*(x+.5-d.x)+(a.x-d.x)*(y+.5-d.y))/den,wc=1-wa-wb;if(wa<-.0001||wb<-.0001||wc<-.0001)continue;
   const i=y*N+x,z=wa*a.depth+wb*b.depth+wc*d.depth;if(z<depth[i])continue;depth[i]=z;
   const u=clamp(wa*a.u+wb*b.u+wc*d.u,0,N-1),v=clamp(wa*a.v+wb*b.v+wc*d.v,0,N-1),ux=u|0,vy=v|0,fx=u-ux,fy=v-vy,j=(vy*N+ux)*4,jx=(vy*N+Math.min(N-1,ux+1))*4,jy=(Math.min(N-1,vy+1)*N+ux)*4,jxy=(Math.min(N-1,vy+1)*N+Math.min(N-1,ux+1))*4,k=i*4;
   const shade=wa*lighting[ia]+wb*lighting[ib]+wc*lighting[ic];
   for(let ch=0;ch<3;ch++){const col=lerp(lerp(source[j+ch],source[jx+ch],fx),lerp(source[jy+ch],source[jxy+ch],fx),fy);out[k+ch]=col*(1-shade);}
   out[k+3]=255;
  }
 }
 tc.putImageData(im,0,0);c.save();c.shadowColor='#52708924';c.shadowBlur=15;c.shadowOffsetY=9;c.drawImage(tieRaster,0,0);c.restore();
}
function drawPreparedTieCloth(c,texture,{x=0,y=0,width=N,height=width,work=tieDraft,unfold=0,alpha=1,animation=null}={}){
 c.save();c.globalAlpha*=alpha;
 if(unfold>=1){c.shadowColor='#413c3022';c.shadowBlur=14;c.shadowOffsetY=8;c.drawImage(texture,x+width/12,y+height/12,width*5/6,height*5/6);c.restore();return;}
 if(unfold===0&&!animation){let entry=tieSurfaceCache.get(texture),key=tieFormKey(work);if(!entry||entry.key!==key){const canvas=entry?.canvas||make();ctx(canvas).clearRect(0,0,N,N);tieRenderSurface(ctx(canvas),texture,work);entry={key,canvas};tieSurfaceCache.set(texture,entry);if(tieSurfaceCache.size>8)tieSurfaceCache.delete(tieSurfaceCache.keys().next().value);}c.drawImage(entry.canvas,x,y,width,height);}
 else{c.translate(x,y);c.scale(width/N,height/N);tieRenderSurface(c,texture,work,unfold,animation);}c.restore();
}
function tieWorkingDraft(){if(tieGesture?.grab)return {...tieDraft,preparation:[...tieDraft.preparation,{type:'gather',positions:clothPack(tieGesture.grab.points)}]};return tieDraft;}
function drawTieEditor(canvas=view){
 const c=ctx(canvas);c.clearRect(0,0,canvas.width,canvas.height);c.save();c.scale(canvas.width/N,canvas.height/N);
 const work=tieWorkingDraft();drawPreparedTieCloth(c,studioClothTexture(),{work,animation:tieAnimation});drawTieRopes(c,{work,selectedId:tieDraft.selectedId});
 const g=tieGesture;if(g&&(g.kind==='fold'||g.kind==='wrap')){
  c.strokeStyle=g.kind==='fold'?'#477d76':'#b08649';c.lineWidth=3;c.setLineDash([9,7]);c.beginPath();c.moveTo(g.startScreen.x,g.startScreen.y);c.lineTo(g.currentScreen.x,g.currentScreen.y);c.stroke();c.setLineDash([]);
  if(g.kind==='fold'){const dx=g.currentScreen.x-g.startScreen.x,dy=g.currentScreen.y-g.startScreen.y,l=Math.hypot(dx,dy);if(l>40){const mx=(g.startScreen.x+g.currentScreen.x)/2,my=(g.startScreen.y+g.currentScreen.y)/2,nx=-dy/l,ny=dx/l;c.beginPath();c.moveTo(mx+nx*40,my+ny*40);c.quadraticCurveTo(mx-dx/l*22,my-dy/l*22,mx-nx*30,my-ny*30);c.lineTo(mx-nx*15-dx/l*9,my-ny*15-dy/l*9);c.stroke();}}
 }else if(g?.grab){const p=tieProject(g.grab.points[g.grab.index]);c.strokeStyle='#436d6380';c.lineWidth=2;c.beginPath();c.arc(p.x,p.y,18,0,Math.PI*2);c.stroke();}c.restore();
}
function tiePickMaterial(screenPoint,model=tieModel(tieDraft)){
 const surface=model.surface||model;let hit=null,front=-Infinity;
 for(const ids of surface.triangles){const [a,b,d]=ids.map(i=>tieProject(surface.points[i])),den=(b.y-d.y)*(a.x-d.x)+(d.x-b.x)*(a.y-d.y);if(Math.abs(den)<.001)continue;
  const u=((b.y-d.y)*(screenPoint.x-d.x)+(d.x-b.x)*(screenPoint.y-d.y))/den,v=((d.y-a.y)*(screenPoint.x-d.x)+(a.x-d.x)*(screenPoint.y-d.y))/den,w=1-u-v;if(Math.min(u,v,w)<-.002)continue;
  const depth=u*a.depth+v*b.depth+w*d.depth;if(depth<front)continue;front=depth;
  const weights=[u,v,w],mu=ids.reduce((sum,id,j)=>sum+surface.points[id].u*weights[j],0),mv=ids.reduce((sum,id,j)=>sum+surface.points[id].v*weights[j],0);
  hit={index:clamp(Math.round(mv/CLOTH_SPACING),0,CLOTH_STEPS)*CLOTH_SIDE+clamp(Math.round(mu/CLOTH_SPACING),0,CLOTH_STEPS),u:mu,v:mv};
 }return hit;
}
function tieEventPoint(e){const box=view.getBoundingClientRect();return {x:clamp((e.clientX-box.left)*N/box.width,-96,N+96),y:clamp((e.clientY-box.top)*N/box.height,-96,N+96)};}
function tieReleasePointer(id){try{view.releasePointerCapture(id);}catch{}}
function tieCommitGrab(g){if(g.grab&&g.grab.travel>5)tieAddPreparation({type:'gather',positions:clothPack(clothReleaseGrab(g.grab)),grab:g.grab.index,pinch:g.kind==='pinch'});}
function cancelTieGesture(){if(!tieGesture)return;const g=tieGesture;tieGesture=null;tieReleasePointer(g.id);tieCommitGrab(g);if(g.kind==='tighten')g.knot.tension=g.startTension;}
function tiePointerDown(e){
 if(tieGesture||e.button>0)return false;tieAnimation=null;const p=tieEventPoint(e);if(p.x<0||p.x>N||p.y<0||p.y>N)return false;const model=tieModel(tieDraft),world=tieUnproject(p),kind=tieDraft.stage==='bind'?'wrap':tieDraft.tool;
 let grab=null,knot=null;if(kind==='gather'||kind==='pinch'){const hit=tiePickMaterial(p,model);if(!hit)return false;grab=clothStartGrab(model.points,hit.index);}
 if(kind==='wrap'){
  knot=[...tieDraft.knots].reverse().find(k=>{const h=tieRopeAnchor(k),tail=40+(1-k.tension)*36;return Math.min(Math.hypot(p.x-h.x,p.y-h.y),Math.hypot(p.x-h.x-tail,p.y-h.y-tail*.7))<58;});
  if(knot){tieDraft.selectedId=knot.id;tieNotify();}
  else if(tieDraft.knots.some(k=>!k.locked)){toast('先按住圈出的绳头向外拉紧。');return false;}
  else if(tieDraft.knots.length>=TIE_MAX){toast('最多六根绳，可以先拆掉一根。');return false;}
 }
 e.preventDefault();try{view.setPointerCapture(e.pointerId);}catch{}tieGesture={id:e.pointerId,kind:knot?'tighten':kind,knot,grab,start:world,current:world,startScreen:p,currentScreen:p,startTension:knot?.tension||0,points:[world]};renderEditor();return true;
}
function tiePointerMove(e){
 const g=tieGesture;if(!g||g.id!==e.pointerId)return false;e.preventDefault();const p=tieEventPoint(e),world=tieUnproject(p);g.current=world;g.currentScreen=p;
 if(g.grab){if(Math.hypot(p.x-g.startScreen.x,p.y-g.startScreen.y)<3&&!g.grab.travel)return true;const dx=(p.x-g.startScreen.x)*6/5,dy=(p.y-g.startScreen.y)/.69,d=Math.hypot(dx,dy),lift=Math.min(125,18+d*.35);clothMoveGrab(g.grab,g.kind==='pinch'?{x:g.grab.origin.x,y:g.grab.origin.y,z:clamp(g.grab.origin.z+(g.startScreen.y-p.y)/.65,0,430)}:{x:g.grab.origin.x+dx,y:g.grab.origin.y+dy+lift*.65/.69,z:g.grab.origin.z+lift});g.points.push(world);tieSurfaceCache.clear();}
 if(g.kind==='tighten'){g.knot.tension=clamp(g.startTension+Math.hypot(p.x-g.startScreen.x,p.y-g.startScreen.y)/180);tieSurfaceCache.clear();}
 renderEditor();return true;
}
function tiePlaceScreenWrap(a,b){
 const model=tieModel(tieDraft),hits=[];
 for(let i=1;i<20;i++){const hit=tiePickMaterial({x:lerp(a.x,b.x,i/20),y:lerp(a.y,b.y,i/20)},model);if(hit)hits.push(tieMapPoint(hit.u,hit.v));}
 if(!hits.length)return null;const center=hits[Math.floor(hits.length/2)],dx=(b.x-a.x)*6/5,dy=(b.y-a.y)/.69,len=Math.hypot(dx,dy);
 if(len<35)return null;if(tieDraft.preparation.some(op=>op.pinch)&&tieDraft.preparation.at(-1)?.type!=='fold'&&center.z>12)return tieAddCollar(center.z);return tieAddWrap({x:center.x-dx/len*N,y:center.y-dy/len*N},{x:center.x+dx/len*N,y:center.y+dy/len*N});
}
function tiePointerEnd(e){
 const g=tieGesture;if(!g||g.id!==e.pointerId)return false;tieGesture=null;tieReleasePointer(g.id);tieCommitGrab(g);
 if(e.type==='pointerup'&&g.kind==='fold')tieCommitFold(g.start,g.current);
 if(e.type==='pointerup'&&g.kind==='wrap'&&Math.hypot(g.current.x-g.start.x,g.current.y-g.start.y)>35){if(!tiePlaceScreenWrap(g.startScreen,g.currentScreen))toast('从布团的一侧划到另一侧放上绳子。');}
 if(g.kind==='tighten'){if(e.type==='pointerup'&&g.knot.tension>=.35){g.knot.locked=true;toast('绳结已收紧，可以继续绕绳或入染。');}else if(!g.knot.locked)g.knot.tension=0;}
 tieNotify(true);return true;
}
function openTieCorrespondence(){
 const work=snapshotTieDraft(),mask=getTieResistMask(work),texture=make(),tc=ctx(texture);tc.drawImage(paper,0,0);tc.globalCompositeOperation='multiply';tc.fillStyle='#305b77';tc.fillRect(0,0,N,N);tc.globalCompositeOperation='source-over';tc.drawImage(mask,0,0);
 openModal('绳下的布，展开在哪里',`<p class="sheet-copy">左侧是捆扎的布，右侧是同一块布展开。点一下任一布面，红点会标出另一侧的对应位置。</p><div class="tie-compare"><figure><canvas id="tieCompareBound" width="768" height="768"></canvas><figcaption>捆扎状态</figcaption></figure><figure><canvas id="tieCompareFlat" width="768" height="768"></canvas><figcaption>展开后的留白</figcaption></figure></div><p class="sheet-copy">白色来自已拉紧的绳带；松绳不防染。这里可核对位置，实际渗染深浅仍是数字近似。</p>`);
 const left=$('tieCompareBound'),right=$('tieCompareFlat'),draw=uv=>{for(const el of [left,right]){ctx(el).clearRect(0,0,N,N);ctx(el).fillStyle='#e5dfcd';ctx(el).fillRect(0,0,N,N);}drawPreparedTieCloth(ctx(left),texture,{work});drawTieRopes(ctx(left),{work});ctx(right).drawImage(texture,64,64,640,640);if(uv){for(const [el,p]of [[left,tieProject(tieMapPoint(uv.u,uv.v,work))],[right,{x:64+uv.u*5/6,y:64+uv.v*5/6}]]){const c=ctx(el);c.strokeStyle='#fff';c.lineWidth=4;c.fillStyle='#ba4637';c.beginPath();c.arc(p.x,p.y,9,0,Math.PI*2);c.fill();c.stroke();}}};draw();
 for(const el of [left,right])el.onpointerdown=e=>{const r=el.getBoundingClientRect(),p={x:(e.clientX-r.left)*N/r.width,y:(e.clientY-r.top)*N/r.height},uv=el===left?tiePickMaterial(p,tieModel(work)):{u:(p.x-64)*6/5,v:(p.y-64)*6/5};if(uv&&uv.u>=0&&uv.v>=0&&uv.u<=N&&uv.v<=N)draw(uv);};
}
