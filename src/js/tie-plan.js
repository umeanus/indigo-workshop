// One continuous material sheet. Gesture geometry and every rope contact keep
// the same original UV coordinates from the first flat cloth to the final dye.
const TIE_PLAN_KEY='lanran-cloth-v3',TIE_PLAN_GRID=24,TIE_PLAN_HISTORY_LIMIT=24,TIE_PLAN_LIMIT=16;
const tiePlanFaces=[],tiePlanEdges=[];
for(let j=0;j<TIE_PLAN_GRID;j++)for(let i=0;i<TIE_PLAN_GRID;i++){const a=j*(TIE_PLAN_GRID+1)+i;tiePlanFaces.push([a,a+1,a+TIE_PLAN_GRID+2],[a,a+TIE_PLAN_GRID+2,a+TIE_PLAN_GRID+1]);}
for(let j=0;j<=TIE_PLAN_GRID;j++)for(let i=0;i<=TIE_PLAN_GRID;i++){const a=j*(TIE_PLAN_GRID+1)+i;if(i<TIE_PLAN_GRID)tiePlanEdges.push([a,a+1]);if(j<TIE_PLAN_GRID)tiePlanEdges.push([a,a+TIE_PLAN_GRID+1]);}
function tiePlanFlatVertices(){return Array.from({length:(TIE_PLAN_GRID+1)**2},(_,i)=>[56+i%(TIE_PLAN_GRID+1)*656/TIE_PLAN_GRID,56+Math.floor(i/(TIE_PLAN_GRID+1))*656/TIE_PLAN_GRID,0]);}
function tiePlanUV(index){return [index%(TIE_PLAN_GRID+1)*N/TIE_PLAN_GRID,Math.floor(index/(TIE_PLAN_GRID+1))*N/TIE_PLAN_GRID];}
const tiePlan={kind:'plan',version:3,grid:TIE_PLAN_GRID,seed:(Date.now()^0x6d231117)>>>0,vertices:tiePlanFlatVertices(),bindings:[],tool:'pinch'};
let tiePlanPointer=null,tiePlanFrame=0,tiePlanAnimation=null,tiePlanMounted=false,tiePlanSaveTimer=0,tiePlanRestKey='',tiePlanInputType='';
const tiePlanUndoStack=[],tiePlanRedoStack=[],tiePlanMaskCache=new Map();
const tiePlanRest=make(),tiePlanFabric=make();let tiePlanFabricReady=false;
function tiePlanValid(data){
 if(!data||data.kind!=='plan'||data.version!==3||data.grid!==TIE_PLAN_GRID||!Array.isArray(data.vertices)||data.vertices.length!==(TIE_PLAN_GRID+1)**2||!Array.isArray(data.bindings))return null;
 if(data.vertices.some(p=>!Array.isArray(p)||p.length!==3||p.some(v=>!Number.isFinite(v)||Math.abs(v)>4096)))return null;
 const bindings=[],ids=new Set(),validUV=p=>Array.isArray(p)&&p.length===2&&p.every(v=>Number.isFinite(v)&&v>=0&&v<=N);
 for(const b of data.bindings.slice(0,TIE_PLAN_LIMIT)){
  if(!b||!Number.isSafeInteger(b.id)||b.id<1||ids.has(b.id)||!validUV(b.anchorUV)||!Array.isArray(b.segments)||!Array.isArray(b.trace))continue;
  const segments=b.segments.filter(s=>Array.isArray(s)&&s.length===4&&s.every(v=>Number.isFinite(v)&&v>=0&&v<=N)).slice(0,2400),trace=b.trace.filter(validUV).slice(0,180);if(!segments.length||trace.length<2)continue;
  ids.add(b.id);bindings.push({id:b.id,segments:segments.map(s=>s.slice()),trace:trace.map(p=>p.slice()),anchorUV:b.anchorUV.slice(),turns:clamp(Math.round(b.turns||2),2,3)});
 }
 return {kind:'plan',version:3,grid:TIE_PLAN_GRID,seed:Number.isFinite(data.seed)?data.seed>>>0:tiePlan.seed,vertices:data.vertices.map(p=>p.slice()),bindings};
}
function tiePlanSnapshot(){return {kind:'plan',version:3,grid:TIE_PLAN_GRID,seed:tiePlan.seed,vertices:tiePlan.vertices.map(p=>p.map(v=>Math.round(v*1000)/1000)),bindings:tiePlan.bindings.map(b=>({...b,segments:b.segments.map(s=>s.slice()),trace:b.trace.map(p=>p.slice()),anchorUV:b.anchorUV.slice()}))};}
try{const stored=JSON.parse(localStorage.getItem(TIE_PLAN_KEY)||'null'),data=tiePlanValid(stored?.snapshot||stored);if(data){Object.assign(tiePlan,data);if(['pinch','gather','fold','bind'].includes(stored.tool))tiePlan.tool=stored.tool;for(const item of (stored.undo||[]).slice(-12)){const valid=tiePlanValid(item);if(valid)tiePlanUndoStack.push(valid);}for(const item of (stored.redo||[]).slice(-12)){const valid=tiePlanValid(item);if(valid)tiePlanRedoStack.push(valid);}}}catch{}
function tiePlanHasInk(){return tiePlan.bindings.length>0;}
function tiePlanSelected(){return tiePlan.bindings.at(-1)||null;}
function tiePlanGetTool(){return tiePlan.tool;}
function tiePlanSetTool(tool){if(!['pinch','gather','fold','bind'].includes(tool))return false;cancelTiePlanPointer();tiePlan.tool=tool;syncTiePlanUI();if(typeof syncStudio==='function')syncStudio();tiePlanQueueFrame();return true;}
function tiePlanCanUndo(){return tiePlanUndoStack.length>0;}
function tiePlanCanRedo(){return tiePlanRedoStack.length>0;}
function tiePlanSave(){clearTimeout(tiePlanSaveTimer);try{localStorage.setItem(TIE_PLAN_KEY,JSON.stringify({snapshot:tiePlanSnapshot(),tool:tiePlan.tool,undo:tiePlanUndoStack.slice(-12),redo:tiePlanRedoStack.slice(-12)}));}catch{try{localStorage.setItem(TIE_PLAN_KEY,JSON.stringify({snapshot:tiePlanSnapshot(),tool:tiePlan.tool}));}catch{}}}
function tiePlanRecord(){tiePlanUndoStack.push(tiePlanSnapshot());if(tiePlanUndoStack.length>TIE_PLAN_HISTORY_LIMIT)tiePlanUndoStack.shift();tiePlanRedoStack.length=0;}
function tiePlanApply(snapshot){const valid=tiePlanValid(snapshot);if(!valid)return false;Object.assign(tiePlan,valid);tiePlanChanged();return true;}
function tiePlanUndo(){if(!tiePlanCanUndo())return false;cancelTiePlanPointer();tiePlanRedoStack.push(tiePlanSnapshot());return tiePlanApply(tiePlanUndoStack.pop());}
function tiePlanRedo(){if(!tiePlanCanRedo())return false;cancelTiePlanPointer();tiePlanUndoStack.push(tiePlanSnapshot());return tiePlanApply(tiePlanRedoStack.pop());}
function tiePlanReset(){cancelTiePlanPointer();tiePlanRecord();tiePlan.vertices=tiePlanFlatVertices();tiePlan.bindings=[];tiePlan.seed=(Date.now()^Math.floor(Math.random()*0xffffffff))>>>0;tiePlanChanged();}
function tiePlanChanged(){tiePlanRestKey='';tiePlanMaskCache.clear();syncTiePlanUI();if(typeof updateEditorButtons==='function')updateEditorButtons();tiePlanQueueFrame();clearTimeout(tiePlanSaveTimer);tiePlanSaveTimer=setTimeout(tiePlanSave,180);}
function tiePlanProject(p){return {x:p[0]+p[2]*.10,y:p[1]-p[2]*.62,z:p[2]};}
function tiePlanVertices(snapshot,flatten=0){const vertices=snapshot.vertices;if(!flatten)return vertices;const flat=tiePlanFlatVertices(),f=clamp(flatten);return vertices.map((p,i)=>p.map((v,k)=>v+(flat[i][k]-v)*f));}
function tiePlanBarycentric(p,a,b,c){const d=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);if(Math.abs(d)<.00001)return null;const x=((b.y-c.y)*(p.x-c.x)+(c.x-b.x)*(p.y-c.y))/d,y=((c.y-a.y)*(p.x-c.x)+(a.x-c.x)*(p.y-c.y))/d;return [x,y,1-x-y];}
function tiePlanHit(snapshot,x,y){
 const positions=snapshot.vertices.map(tiePlanProject);let best=null;
 for(const face of tiePlanFaces){const w=tiePlanBarycentric({x,y},...face.map(i=>positions[i]));if(!w||w.some(v=>v<-.001||v>1.001))continue;const z=face.reduce((s,i,k)=>s+snapshot.vertices[i][2]*w[k],0);if(best&&z<best.z)continue;const uv=face.map(tiePlanUV);best={x,y,z,u:clamp(uv.reduce((s,p,k)=>s+p[0]*w[k],0),0,N),v:clamp(uv.reduce((s,p,k)=>s+p[1]*w[k],0),0,N),face:face.slice(),weights:w};}
 return best;
}
function tiePlanMaterialPoint(vertices,u,v){const gx=clamp(u/N*TIE_PLAN_GRID,0,TIE_PLAN_GRID-.000001),gy=clamp(v/N*TIE_PLAN_GRID,0,TIE_PLAN_GRID-.000001),i=Math.floor(gx),j=Math.floor(gy),a=j*(TIE_PLAN_GRID+1)+i,fx=gx-i,fy=gy-j,face=fy<=fx?[a,a+1,a+TIE_PLAN_GRID+2]:[a,a+TIE_PLAN_GRID+2,a+TIE_PLAN_GRID+1],w=fy<=fx?[1-fx,fx-fy,fy]:[1-fy,fx,fy-fx];return [0,1,2].map(k=>face.reduce((s,index,n)=>s+vertices[index][k]*w[n],0));}
function tiePlanRopeAnchors(snapshot=tiePlanSnapshot(),options={}){if(!snapshot?.vertices||!snapshot.bindings)return [];const vertices=tiePlanVertices(snapshot,options.flatten||0);return snapshot.bindings.map(b=>{const p=tiePlanProject(tiePlanMaterialPoint(vertices,...b.anchorUV));return {id:b.id,x:p.x,y:p.y,u:b.anchorUV[0],v:b.anchorUV[1]};});}
function tiePlanConstrain(vertices){
 // Two bounded stretch passes preserve the sheet's connectedness; compression
 // becomes visible folds instead of the old expensive iterative cloth solver.
 const maxLength=656/TIE_PLAN_GRID*1.7;for(let pass=0;pass<2;pass++)for(const [a,b] of tiePlanEdges){const p=vertices[a],q=vertices[b],dx=q[0]-p[0],dy=q[1]-p[1],dz=q[2]-p[2],d=Math.hypot(dx,dy,dz);if(d<=maxLength)continue;const f=(d-maxLength)/d*.42;for(let k=0;k<3;k++){const shift=(q[k]-p[k])*f;p[k]+=shift;q[k]-=shift;}}
 const projected=vertices.map(tiePlanProject),minX=Math.min(...projected.map(p=>p.x)),maxX=Math.max(...projected.map(p=>p.x)),minY=Math.min(...projected.map(p=>p.y)),maxY=Math.max(...projected.map(p=>p.y)),cx=(minX+maxX)/2,cy=(minY+maxY)/2,scale=Math.min(1,728/Math.max(maxX-minX,maxY-minY)),tx=clamp(cx,20+(maxX-minX)*scale/2,748-(maxX-minX)*scale/2)-cx,ty=clamp(cy,20+(maxY-minY)*scale/2,748-(maxY-minY)*scale/2)-cy;
 if(scale<1||tx||ty)for(const p of vertices){p[0]=cx+(p[0]-cx)*scale+tx;p[1]=cy+(p[1]-cy)*scale+ty;p[2]*=scale;}return vertices;
}
function tiePlanDeform(g){
 const shape=tiePlanFingerShape(g.fingers),dx=clamp(shape.center.x-g.origin.x,-250,250),dy=clamp(shape.center.y-g.origin.y,-250,250),distance=Math.hypot(dx,dy),contraction=g.fingers.size>1?clamp(1-shape.spread/(g.initialSpread||shape.spread),0,.85):0,turn=clamp(g.twist||0,-Math.PI,Math.PI),amount=clamp(distance/200+contraction*1.15+Math.abs(turn)*.08),source=g.base.vertices,anchor=tiePlanMaterialPoint(source,g.anchor.u,g.anchor.v),gather=g.tool==='gather',lift=gather?amount*62:clamp(-dy*.64+distance*.16+contraction*80,0,165),radius=gather?N*.90:N*.72;
 const out=source.map((p,i)=>{const [u,v]=tiePlanUV(i),du=u-g.anchor.u,dv=v-g.anchor.v,d=Math.hypot(du,dv),q=d/radius,w=Math.exp(-q*q*2.15),angle=Math.atan2(dv,du),compression=(gather?.36:.075)*amount*w,rx=p[0]-anchor[0],ry=p[1]-anchor[1],rotate=turn*.22*w,xx=rx*(1-compression),yy=ry*(1-compression),pleat=gather?Math.sin(d/29+angle*3+g.base.seed%11)*20*Math.sin(angle*5+.7)*amount*w:Math.sin(angle*8+d/70+turn)*Math.min(17,lift*.13)*Math.min(1,q*3)*w;
  return [anchor[0]+Math.cos(rotate)*xx-Math.sin(rotate)*yy+dx*(gather?.72:.60)*w,anchor[1]+Math.sin(rotate)*xx+Math.cos(rotate)*yy+dy*(gather?.63:.22)*w,clamp(p[2]+lift*w+pleat,0,300)];});const floor=Math.min(...out.map(p=>p[2]));if(floor>0)for(const p of out)p[2]-=floor;g.preview=tiePlanConstrain(out);g.distance=distance+contraction*180+Math.abs(turn)*25;g.dirty=false;
}
function tiePlanFoldVertices(base,a,b,progress){
 const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy),ux=dx/length,uy=dy/length,points=base.vertices.map(tiePlanProject),near=points.map((p,i)=>({i,d:Math.abs((p.x-a.x)*uy-(p.y-a.y)*ux)})).sort((p,q)=>p.d-q.d).slice(0,25),axisZ=near.reduce((sum,p)=>sum+base.vertices[p.i][2],0)/near.length,origin=[a.x-axisZ*.10,a.y+axisZ*.62,axisZ];
 return base.vertices.map((p,i)=>{const screen=points[i],signed=(screen.x-a.x)*(-uy)+(screen.y-a.y)*ux;if(signed<=0)return p.slice();const hinge=clamp(signed/14),angle=Math.PI*progress*hinge,cos=Math.cos(angle),sin=Math.sin(angle),x=p[0]-origin[0],y=p[1]-origin[1],z=p[2]-origin[2],dot=x*ux+y*uy;return [origin[0]+x*cos+uy*z*sin+ux*dot*(1-cos),origin[1]+y*cos-ux*z*sin+uy*dot*(1-cos),origin[2]+z*cos+(ux*y-uy*x)*sin+4*Math.sin(angle/2)**2];});
}
function tiePlanLineContacts(snapshot,a,b){
 const positions=snapshot.vertices.map(tiePlanProject),contacts=[],dx=b.x-a.x,dy=b.y-a.y,cross=(x,y,u,v)=>x*v-y*u;
 for(const face of tiePlanFaces){const p=face.map(i=>positions[i]),uv=face.map(tiePlanUV),ts=[],wa=tiePlanBarycentric(a,...p),wb=tiePlanBarycentric(b,...p);if(!wa||!wb)continue;if(wa.every(v=>v>=0&&v<=1))ts.push(0);if(wb.every(v=>v>=0&&v<=1))ts.push(1);
  for(let i=0;i<3;i++){const q=p[i],r=p[(i+1)%3],ex=r.x-q.x,ey=r.y-q.y,den=cross(dx,dy,ex,ey);if(Math.abs(den)<.000001)continue;const qx=q.x-a.x,qy=q.y-a.y,t=cross(qx,qy,ex,ey)/den,s=cross(qx,qy,dx,dy)/den;if(t>=0&&t<=1&&s>=0&&s<=1)ts.push(t);}
  if(ts.length<2)continue;const t0=Math.min(...ts),t1=Math.max(...ts);if(t1-t0<.00001)continue;const at=t=>{const w=tiePlanBarycentric({x:a.x+dx*t,y:a.y+dy*t},...p);return {u:clamp(uv.reduce((s,p,k)=>s+p[0]*w[k],0),0,N),v:clamp(uv.reduce((s,p,k)=>s+p[1]*w[k],0),0,N),z:face.reduce((s,i,k)=>s+snapshot.vertices[i][2]*w[k],0)};};contacts.push({t0,t1,a:at(t0),b:at(t1)});
 }return contacts;
}
function tiePlanBind(g){
 const contacts=tiePlanLineContacts(g.base,g.start,g.end);if(!contacts.length)return false;const min=Math.min(...contacts.map(s=>s.t0)),max=Math.max(...contacts.map(s=>s.t1)),trace=[];
 for(let i=0;i<=72;i++){const t=min+(max-min)*i/72,candidates=contacts.filter(c=>t>=c.t0-.000001&&t<=c.t1+.000001);if(!candidates.length)continue;let best=null;for(const c of candidates){const f=clamp((t-c.t0)/(c.t1-c.t0)),point={u:c.a.u+(c.b.u-c.a.u)*f,v:c.a.v+(c.b.v-c.a.v)*f,z:c.a.z+(c.b.z-c.a.z)*f};if(!best||point.z>best.z)best=point;}trace.push([best.u,best.v]);}
 if(trace.length<2)return false;const id=Math.max(0,...tiePlan.bindings.map(b=>b.id))+1,round=v=>Math.round(v*1000)/1000,binding={id,segments:contacts.map(c=>[c.a.u,c.a.v,c.b.u,c.b.v].map(round)),trace:trace.map(p=>p.map(round)),anchorUV:trace[Math.floor(trace.length/2)].map(round),turns:2};tiePlanRecord();tiePlan.bindings.push(binding);tiePlanAnimation={type:'bind',id,started:performance.now(),duration:620};tiePlanChanged();return true;
}
function tiePlanEventPoint(e){const rect=view.getBoundingClientRect();return {x:clamp((e.clientX-rect.left)*N/Math.max(1,rect.width),0,N),y:clamp((e.clientY-rect.top)*N/Math.max(1,rect.height),0,N)};}
function tiePlanFingerShape(fingers){const points=[...fingers.values()],center=points.reduce((s,p)=>({x:s.x+p.x/points.length,y:s.y+p.y/points.length}),{x:0,y:0});return {center,spread:Math.max(1,...points.map(p=>Math.hypot(p.x-center.x,p.y-center.y))),angle:points.length>1?Math.atan2(points[1].y-points[0].y,points[1].x-points[0].x):0};}
function tiePlanPointerDown(e){
 if(screen!=='editor'||technique!=='tie'||document.hidden||!$('modal')?.hidden||tiePlanAnimation||(e.button!==undefined&&e.button!==0&&e.pointerType!=='touch'))return;const at=tiePlanEventPoint(e),id=e.pointerId??1;e.preventDefault?.();tiePlanInputType=e.pointerType||'mouse';
 if(!tiePlanPointer){const base=tiePlanSnapshot(),anchor=tiePlanHit(base,at.x,at.y);if((tiePlan.tool==='pinch'||tiePlan.tool==='gather')&&!anchor)return;if(tiePlan.tool==='bind'&&tiePlan.bindings.length>=TIE_PLAN_LIMIT){toast('绳结已满，可以撤销后再试。');return;}tiePlanPointer={tool:tiePlan.tool,base,anchor,start:at,end:at,origin:at,fingers:new Map(),twist:0,lastAngle:0,dirty:false,preview:null,distance:0,finishing:false};}
 const g=tiePlanPointer;if(g.finishing||g.fingers.has(id)||g.fingers.size>=3)return;g.fingers.set(id,at);const shape=tiePlanFingerShape(g.fingers);if(g.fingers.size>1){if(g.preview){g.base={...g.base,vertices:g.preview};g.preview=null;}g.origin=shape.center;g.lastAngle=shape.angle;g.initialSpread=shape.spread;const anchor=tiePlanHit(g.base,shape.center.x,shape.center.y);if(anchor)g.anchor=anchor;}try{view.setPointerCapture(id);}catch{}syncTiePlanUI();tiePlanQueueFrame();
}
function tiePlanPointerMove(e){const g=tiePlanPointer,id=e.pointerId??1;if(!g||!g.fingers.has(id))return;if(screen!=='editor'||technique!=='tie'||document.hidden||!$('modal')?.hidden){cancelTiePlanPointer();return;}if(g.finishing)return;e.preventDefault?.();g.fingers.set(id,tiePlanEventPoint(e));const shape=tiePlanFingerShape(g.fingers);if(g.fingers.size>1){let delta=shape.angle-g.lastAngle;while(delta>Math.PI)delta-=Math.PI*2;while(delta<-Math.PI)delta+=Math.PI*2;g.twist+=delta;g.lastAngle=shape.angle;}g.end=shape.center;g.dirty=true;tiePlanQueueFrame();}
function tiePlanPointerEnd(e){
 const g=tiePlanPointer,id=e.pointerId??1;if(!g||!g.fingers.has(id))return;if(e.type==='pointercancel'||e.type==='lostpointercapture'||screen!=='editor'||technique!=='tie'||document.hidden||!$('modal')?.hidden){cancelTiePlanPointer();return;}e.preventDefault?.();if(g.dirty&&(g.tool==='pinch'||g.tool==='gather'))tiePlanDeform(g);g.fingers.delete(id);try{view.releasePointerCapture(id);}catch{}if(g.fingers.size){g.finishing=true;return;}tiePlanPointer=null;
 const distance=Math.hypot(g.end.x-g.start.x,g.end.y-g.start.y);
 if(g.tool==='pinch'||g.tool==='gather'){if(g.preview&&g.distance>6){tiePlanRecord();tiePlan.vertices=g.preview;tiePlanChanged();if(typeof soundPlay==='function')soundPlay('cloth');}else tiePlanQueueFrame();}
 else if(g.tool==='fold'&&distance>70){const dx=g.end.x-g.start.x,dy=g.end.y-g.start.y,signs=g.base.vertices.map(tiePlanProject).map(p=>(p.x-g.start.x)*(-dy)+(p.y-g.start.y)*dx),positive=signs.filter(v=>v>100).length,negative=signs.filter(v=>v<-100).length;if(positive>20&&negative>20){tiePlanAnimation={type:'fold',base:g.base,a:g.start,b:g.end,started:performance.now(),duration:820};tiePlanQueueFrame();}else{toast('把折线划过布面。');tiePlanQueueFrame();}}
 else if(g.tool==='bind'&&distance>35){if(!tiePlanBind(g)){toast('绳子需要划过布面。');tiePlanQueueFrame();}}else tiePlanQueueFrame();syncTiePlanUI();
}
function cancelTiePlanPointer(){const g=tiePlanPointer;tiePlanPointer=null;if(g)for(const id of g.fingers.keys())try{view.releasePointerCapture(id);}catch{}const animation=tiePlanAnimation;tiePlanAnimation=null;if(tiePlanFrame){cancelAnimationFrame(tiePlanFrame);tiePlanFrame=0;}if(g||animation){tiePlanRestKey='';if(screen==='editor'&&technique==='tie'&&!document.hidden)tiePlanQueueFrame();}syncTiePlanUI();}
function tiePlanVisualSnapshot(){
 if(tiePlanPointer?.preview)return {...tiePlanPointer.base,vertices:tiePlanPointer.preview};if(tiePlanAnimation?.type==='fold'){const a=tiePlanAnimation,t=clamp((performance.now()-a.started)/a.duration),smooth=t*t*(3-2*t);return {...a.base,vertices:tiePlanFoldVertices(a.base,a.a,a.b,smooth)};}return tiePlan;
}
function tiePlanQueueFrame(){if(tiePlanFrame)return;tiePlanFrame=requestAnimationFrame(()=>{tiePlanFrame=0;if(screen!=='editor'||technique!=='tie'||document.hidden)return;if(tiePlanPointer?.dirty&&(tiePlanPointer.tool==='pinch'||tiePlanPointer.tool==='gather'))tiePlanDeform(tiePlanPointer);if(tiePlanAnimation&&performance.now()-tiePlanAnimation.started>=tiePlanAnimation.duration){const a=tiePlanAnimation;tiePlanAnimation=null;if(a.type==='fold'){tiePlanRecord();tiePlan.vertices=tiePlanFoldVertices(a.base,a.a,a.b,1);const low=Math.min(...tiePlan.vertices.map(p=>p[2]));if(low<0)for(const p of tiePlan.vertices)p[2]-=low;tiePlanChanged();}else syncTiePlanUI();}renderTiePlanEditor();if(typeof updateEditorButtons==='function')updateEditorButtons();if(tiePlanAnimation)tiePlanQueueFrame();});}
function tiePlanDrawRopes(c,snapshot,vertices,options){
 const released=new Set(options.releasedIds||[]),anchors=new Map(tiePlanRopeAnchors({...snapshot,vertices}).map(p=>[p.id,p]));
 for(const binding of snapshot.bindings){if(released.has(binding.id))continue;const progress=options.bindingId===binding.id?clamp(options.bindingProgress??1):1,trace=binding.trace.map(uv=>tiePlanProject(tiePlanMaterialPoint(vertices,...uv)));if(trace.length<2)continue;const count=Math.max(1,Math.round((trace.length-1)*progress)),dx=trace.at(-1).x-trace[0].x,dy=trace.at(-1).y-trace[0].y,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len;
  for(let turn=0;turn<binding.turns;turn++){const offset=(turn-(binding.turns-1)/2)*5;for(const [color,width,shift] of [['#aa8e60',3.8,0],['#f6e8c5',1.05,-.7]]){c.strokeStyle=color;c.lineWidth=width;c.lineJoin='round';c.lineCap='round';c.beginPath();trace.slice(0,count+1).forEach((p,i)=>{const x=p.x+nx*offset,y=p.y+ny*offset+shift;i?c.lineTo(x,y):c.moveTo(x,y);});c.stroke();}}
  if(progress>.8){const p=anchors.get(binding.id);c.save();c.translate(p.x,p.y);c.globalAlpha=clamp((progress-.8)/.2);c.strokeStyle='#a48759';c.lineWidth=2.8;c.lineCap='round';c.beginPath();c.moveTo(0,1);c.bezierCurveTo(-17,-18,-30,-2,-1,3);c.bezierCurveTo(23,-17,30,4,2,4);c.moveTo(0,3);c.quadraticCurveTo(-7,19,-20,23);c.moveTo(2,4);c.quadraticCurveTo(9,18,22,17);c.stroke();c.restore();}
 }
}
function tiePlanDrawSurface(c,texture,snapshot=tiePlanSnapshot(),options={}){
 if(!snapshot?.vertices||snapshot.grid!==TIE_PLAN_GRID)return false;const x=options.x||0,y=options.y||0,width=options.width??N,height=options.height??N,vertices=tiePlanVertices(snapshot,options.flatten||0),positions=vertices.map(tiePlanProject);c.save();c.translate(x,y);c.scale(width/N,height/N);
 if(options.shadow!==false){const xs=positions.map(p=>p.x),ys=positions.map(p=>p.y),left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys),shadow=c.createRadialGradient((left+right)/2,(top+bottom)/2,5,(left+right)/2,(top+bottom)/2,Math.max(right-left,bottom-top)*.59);shadow.addColorStop(0,'rgba(86,109,104,.12)');shadow.addColorStop(1,'rgba(86,109,104,0)');c.fillStyle=shadow;c.beginPath();c.ellipse((left+right)/2,(top+bottom)/2+15,(right-left)*.54,(bottom-top)*.53,0,0,Math.PI*2);c.fill();}
 const gpuRendered=typeof drawWholeClothGPU==='function'&&drawWholeClothGPU(c,texture,vertices,tiePlanFaces);
 const ordered=gpuRendered?[]:tiePlanFaces.map(face=>({face,depth:face.reduce((s,i)=>s+vertices[i][2],0)/3})).sort((a,b)=>a.depth-b.depth);
 for(const {face} of ordered){const a=positions[face[0]],b=positions[face[1]],d=positions[face[2]],uv=face.map(tiePlanUV),[s,t,q]=uv,den=(t[0]-s[0])*(q[1]-s[1])-(q[0]-s[0])*(t[1]-s[1]),area=(b.x-a.x)*(d.y-a.y)-(d.x-a.x)*(b.y-a.y);if(Math.abs(area)<.04)continue;const aa=((b.x-a.x)*(q[1]-s[1])-(d.x-a.x)*(t[1]-s[1]))/den,bb=((b.y-a.y)*(q[1]-s[1])-(d.y-a.y)*(t[1]-s[1]))/den,cc=((d.x-a.x)*(t[0]-s[0])-(b.x-a.x)*(q[0]-s[0]))/den,dd=((d.y-a.y)*(t[0]-s[0])-(b.y-a.y)*(q[0]-s[0]))/den,mx=(a.x+b.x+d.x)/3,my=(a.y+b.y+d.y)/3;
  c.save();c.beginPath();[a,b,d].forEach((p,i)=>{const vx=p.x-mx,vy=p.y-my,l=Math.hypot(vx,vy)||1,px=p.x+vx/l*.45,py=p.y+vy/l*.45;i?c.lineTo(px,py):c.moveTo(px,py);});c.closePath();c.clip();c.transform(aa,bb,cc,dd,a.x-aa*s[0]-cc*s[1],a.y-bb*s[0]-dd*s[1]);c.drawImage(texture,0,0,N,N);
  if(options.lighting!==false){const p=vertices[face[0]],q=vertices[face[1]],r=vertices[face[2]],ux=q[0]-p[0],uy=q[1]-p[1],uz=q[2]-p[2],vx=r[0]-p[0],vy=r[1]-p[1],vz=r[2]-p[2],nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,l=Math.hypot(nx,ny,nz)||1,orientation=nz<0?-1:1,light=(nx*.30-ny*.46)*orientation/l+Math.abs(nz)/l*.83,shade=clamp((.80-light)*.29,0,.20);if(shade>.005){if(typeof selectedItemId!=='undefined'&&selectedItemId!=='handkerchief'){itemBodyPath(c,selectedItemId);c.clip();}c.fillStyle=`rgba(93,117,108,${shade})`;c.fillRect(0,0,N,N);}}
  c.restore();
 }
 if(options.ropes!==false)tiePlanDrawRopes(c,snapshot,vertices,options);c.restore();return {positions,anchors:tiePlanRopeAnchors({...snapshot,vertices})};
}
function renderTiePlanEditor(target=view){
 if(!tiePlanFabricReady){const fabric=ctx(tiePlanFabric);if(typeof textile!=='undefined'&&textile.paper?.length===N*N*4){const pixels=fabric.createImageData(N,N);pixels.data.set(textile.paper);fabric.putImageData(pixels,0,0);}else fabric.drawImage(paper,0,0);if(typeof drawSelvedge==='function')drawSelvedge(fabric);shapeItem(tiePlanFabric);if(typeof drawWholeClothGPU==='function')drawWholeClothGPU.invalidateTexture?.(tiePlanFabric);tiePlanFabricReady=true;}
 const c=ctx(target),dynamic=!!tiePlanPointer||!!tiePlanAnimation,snapshot=tiePlanVisualSnapshot(),key=dynamic?'':JSON.stringify(tiePlanSnapshot());c.clearRect(0,0,N,N);
 if(!dynamic&&key===tiePlanRestKey)c.drawImage(tiePlanRest,0,0);else{const draw=dynamic?c:ctx(tiePlanRest);if(!dynamic)draw.clearRect(0,0,N,N);tiePlanDrawSurface(draw,tiePlanFabric,snapshot,{bindingId:tiePlanAnimation?.type==='bind'?tiePlanAnimation.id:null,bindingProgress:tiePlanAnimation?clamp((performance.now()-tiePlanAnimation.started)/tiePlanAnimation.duration):1});if(!dynamic){tiePlanRestKey=key;c.drawImage(tiePlanRest,0,0);}}
 const g=tiePlanPointer;if(g&&(g.tool==='fold'||g.tool==='bind')){c.save();c.strokeStyle=g.tool==='fold'?'#7c9aa4':'#b79b70';c.lineWidth=g.tool==='fold'?2:3.5;if(g.tool==='fold')c.setLineDash([8,7]);c.lineCap='round';c.beginPath();c.moveTo(g.start.x,g.start.y);c.lineTo(g.end.x,g.end.y);c.stroke();c.restore();}if(target.style)target.style.cursor=tiePlan.tool==='fold'||tiePlan.tool==='bind'?'crosshair':g?'grabbing':'grab';
}
function tiePlanResist(snapshot=tiePlanSnapshot()){
 const plan=tiePlanValid(snapshot),key=plan?JSON.stringify({seed:plan.seed,bindings:plan.bindings}):'empty';if(tiePlanMaskCache.has(key))return tiePlanMaskCache.get(key);const canvas=make(),c=ctx(canvas),image=c.createImageData(N,N),data=image.data;
 if(plan)for(const binding of plan.bindings){const seed=(plan.seed%65521)+binding.id*137;for(const segment of binding.segments){const [ax,ay,bx,by]=segment,dx=bx-ax,dy=by-ay,len2=dx*dx+dy*dy;if(len2<.0001)continue;const left=Math.max(0,Math.floor(Math.min(ax,bx)-31)),right=Math.min(N,Math.ceil(Math.max(ax,bx)+31)),top=Math.max(0,Math.floor(Math.min(ay,by)-31)),bottom=Math.min(N,Math.ceil(Math.max(ay,by)+31));for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){const t=clamp(((x-ax)*dx+(y-ay)*dy)/len2),px=ax+dx*t,py=ay+dy*t,distance=Math.hypot(x-px,y-py),fiber=smoothNoise(x/2.5,y/2.5,seed),bloom=smoothNoise(x/15,y/15,seed+7),width=6.5+bloom*4+(fiber-.5)*3,core=Math.exp(-Math.pow(distance/width,2.35))*.97,fringe=Math.pow(fiber,2.2)*Math.exp(-Math.pow(distance/(width+13*fiber),1.7))*.60,value=Math.round(Math.max(core,fringe)*255),i=(y*N+x)*4+3;data[i]=Math.max(data[i],value);}}}
 for(let i=0;i<data.length;i+=4)data[i]=data[i+1]=data[i+2]=255;c.putImageData(image,0,0);tiePlanMaskCache.set(key,canvas);if(tiePlanMaskCache.size>3)tiePlanMaskCache.delete(tiePlanMaskCache.keys().next().value);return canvas;
}
function syncTiePlanUI(){const status=$('tiePlanStatus');if(!status)return;const g=tiePlanPointer;let text=tiePlan.tool==='pinch'?'按住布面拖动，捏起整块布':tiePlan.tool==='gather'?'推拢布面，让它慢慢揉起来':tiePlan.tool==='fold'?'划一条折线，翻过半幅布':'横划布面，让绳子绕过布层';if(g?.finishing)text='松开剩下的手指';if(tiePlanAnimation?.type==='fold')text='正在翻折';if(tiePlanAnimation?.type==='bind')text='正在绕绳';if(status.textContent!==text)status.textContent=text;}
function initTiePlanUI(){const panel=$('tiePlanControls');if(panel&&!$('tiePlanStatus'))panel.innerHTML='<p id="tiePlanStatus" class="tie-gesture-hint" role="status" aria-live="polite"></p>';tiePlanMounted=true;syncTiePlanUI();}
function tiePlanRestoreFabric(){tiePlanFabricReady=false;tiePlanRestKey='';if(typeof drawWholeClothGPU==='function')drawWholeClothGPU.invalidateTexture?.(tiePlanFabric);if(screen==='editor'&&technique==='tie'&&!document.hidden)tiePlanQueueFrame();}
document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelTiePlanPointer();else tiePlanRestoreFabric();});
tiePlanFabric.addEventListener?.('contextrestored',tiePlanRestoreFabric);tiePlanRest.addEventListener?.('contextrestored',tiePlanRestoreFabric);view.addEventListener?.('contextrestored',tiePlanRestoreFabric);
const tiePlanWindow=typeof window==='undefined'?document.defaultView:window;
tiePlanWindow?.addEventListener('pagehide',cancelTiePlanPointer);tiePlanWindow?.addEventListener('blur',cancelTiePlanPointer);
