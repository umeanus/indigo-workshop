// Each stroke records its own symmetry; old drafts used true for sixfold.
const waxUndoHistory=[],waxRedoHistory=[];
let waxHistoryGroup=null;
function editorSnapshot(){return {commands:commands.slice(),photo,photoLight,photoDetail,photoDepth,photoInverted,photoScale,photoX,photoY,seed:studioSeed};}
function trimEditorHistory(stack){
 while(stack.length>24)stack.shift();
 while(new Set(stack.map(s=>s.photo).filter(Boolean)).size>2)stack.shift();
}
function recordEditorEdit(group=null){
 if(technique!=='wax')return;
 if(group&&waxHistoryGroup===group)return;
 waxUndoHistory.push(editorSnapshot());trimEditorHistory(waxUndoHistory);waxRedoHistory.length=0;waxHistoryGroup=group;
}
function endEditorHistoryGroup(){waxHistoryGroup=null;}
function restoreEditorSnapshot(state){
 cancelPendingPhoto();commands=state.commands.slice();photo=state.photo;photoLight=state.photoLight;photoDetail=state.photoDetail;photoDepth=state.photoDepth;photoInverted=state.photoInverted;photoScale=state.photoScale;photoX=state.photoX;photoY=state.photoY;studioSeed=state.seed;photoSourcePreview=false;
 studioWaxKey=studioTextureKey='';
 for(const [id,value]of [['photoLight',photoLight*100],['photoDetail',photoDetail*100],['photoDepth',photoDepth*100],['photoZoom',photoScale*100]])$(id).value=value;
 $('invertBtn').setAttribute('aria-pressed',String(photoInverted));$('invertBtn').style.background=photoInverted?'#dce6e8':'';
 $('photoEmptyControls').hidden=!!photo;$('photoFilledControls').hidden=!photo;
 if(photo)renderPhoto();else{photoMaskCtx.clearRect(0,0,N,N);markTextileResistDirty(photoMask);}
 replay();saveDraft();soundPlay('cloth');
}
let symmetryMode=normalizeSymmetryMode(symmetrical);
function normalizeSymmetryMode(value){
 if(value===true)return 'six';
 if(value==='mirror')return 'mirror';
 if(value==='four'||value==='4fold')return 'four';
 if(value==='six'||value==='6fold')return 'six';
 if(value==='eight'||value==='8fold')return 'eight';
 return 'free';
}
function symmetryPoints(p,value){
 const kind=normalizeSymmetryMode(value);
 if(kind==='mirror')return [p,{x:N-p.x,y:p.y}];
 const count=kind==='four'?4:kind==='six'?6:kind==='eight'?8:1,c=N/2;
 return Array.from({length:count},(_,j)=>{const a=j*Math.PI*2/count,cos=Math.cos(a),sin=Math.sin(a);return {x:c+(p.x-c)*cos-(p.y-c)*sin,y:c+(p.x-c)*sin+(p.y-c)*cos};});
}
function paintPoint(c,p,q,width,erasing,sym){
 c.save();c.globalCompositeOperation=erasing?'destination-out':'source-over';c.strokeStyle='#fff';c.fillStyle='#fff';c.lineWidth=width;c.lineCap='round';c.lineJoin='round';
 const starts=symmetryPoints(p,sym),ends=q?symmetryPoints(q,sym):null;
 let x0=N,y0=N,x1=0,y1=0;
 starts.forEach((a,j)=>{const b=ends?ends[j]:a;c.beginPath();if(q){c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();}else{c.arc(a.x,a.y,width/2,0,Math.PI*2);c.fill();}x0=Math.min(x0,a.x,b.x);y0=Math.min(y0,a.y,b.y);x1=Math.max(x1,a.x,b.x);y1=Math.max(y1,a.y,b.y);});c.restore();
 if(c===maskCtx){const pad=width/2+2;markTextileResistDirty(mask,{x0:x0-pad,y0:y0-pad,x1:x1+pad,y1:y1+pad});}
}
function setSymmetryMode(value,announce=true){
 symmetryMode=normalizeSymmetryMode(value);symmetrical=symmetryMode!=='free';
 document.querySelectorAll('[data-symmetry]').forEach(button=>{const active=normalizeSymmetryMode(button.dataset.symmetry)===symmetryMode;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
 if($('symmetryBtn')){$('symmetryBtn').classList.toggle('active',symmetrical);$('symmetryBtn').setAttribute('aria-pressed',String(symmetrical));}
 renderEditor();if(announce)toast({free:'自由手绘',mirror:'左右镜像',four:'四方对称',six:'六瓣对称',eight:'八方对称'}[symmetryMode]);
}
function drawSymmetryGuide(){
 if(symmetryMode==='free')return;
 viewCtx.save();viewCtx.strokeStyle='#6a746225';viewCtx.lineWidth=1.5;viewCtx.setLineDash([4,12]);viewCtx.beginPath();
 if(symmetryMode==='mirror'){viewCtx.moveTo(N/2,0);viewCtx.lineTo(N/2,N);}
 else{const count=symmetryMode==='four'?4:symmetryMode==='eight'?8:6;for(let i=0;i<count;i++){const a=i*Math.PI*2/count;viewCtx.moveTo(N/2,N/2);viewCtx.lineTo(N/2+N*Math.cos(a),N/2+N*Math.sin(a));}}
 viewCtx.stroke();viewCtx.restore();
}
function motif(c,name){c.save();c.strokeStyle='#fff';c.fillStyle='#fff';c.lineWidth=6;c.lineCap='round';c.lineJoin='round';const path=(fn)=>{c.beginPath();fn();c.stroke();},circ=(x,y,r,fill=false)=>{c.beginPath();c.arc(x,y,r,0,Math.PI*2);fill?c.fill():c.stroke();};
if(name==='flower'){c.translate(384,384);circ(0,0,27);circ(0,0,11,true);for(let j=0;j<8;j++){c.save();c.rotate(j*Math.PI/4);path(()=>{c.moveTo(0,-38);c.bezierCurveTo(-100,-105,-68,-228,0,-235);c.bezierCurveTo(68,-228,100,-105,0,-38);});path(()=>{c.moveTo(0,-64);c.bezierCurveTo(-39,-113,-37,-162,0,-192);c.bezierCurveTo(37,-162,39,-113,0,-64);});circ(0,-148,11,true);for(let k=0;k<3;k++)circ(0,-263-k*17,k===2?4:3,true);c.restore();}c.setLineDash([2,15]);circ(0,0,324);c.setLineDash([]);circ(0,0,333);}
if(name==='fish'){c.translate(384,384);for(let j=0;j<2;j++){c.save();c.rotate(j*Math.PI);c.translate(-105,-30);c.rotate(-.3);path(()=>{c.moveTo(0,-208);c.bezierCurveTo(-131,-115,-81,62,0,127);c.bezierCurveTo(81,62,131,-115,0,-208);});path(()=>{c.moveTo(0,127);c.quadraticCurveTo(-31,159,-70,166);c.quadraticCurveTo(-70,109,-25,84);c.moveTo(0,127);c.quadraticCurveTo(31,159,70,166);c.quadraticCurveTo(70,109,25,84);});path(()=>{c.moveTo(-65,-114);c.quadraticCurveTo(0,-76,65,-114);});circ(-23,-143,8,true);circ(23,-143,8,true);for(let y=-57;y<68;y+=30)for(let x=-32;x<=32;x+=32){c.beginPath();c.arc(x+(y%2?0:4),y,14,0,Math.PI);c.stroke();}c.restore();}for(let j=0;j<14;j++){const a=j/14*Math.PI*2;circ(Math.cos(a)*290,Math.sin(a)*290,j%3===0?8:4,true);}c.setLineDash([3,14]);circ(0,0,329);}
if(name==='moon'){circ(544,211,69);circ(544,211,56);path(()=>{c.moveTo(66,532);c.lineTo(238,296);c.lineTo(353,466);c.lineTo(423,358);c.lineTo(692,537);});path(()=>{c.moveTo(164,397);c.lineTo(210,417);c.lineTo(239,372);c.lineTo(275,425);c.lineTo(300,396);});for(let j=0;j<6;j++){path(()=>{c.moveTo(79,559+j*22);c.bezierCurveTo(227,541+j*22,443,589+j*22,687,550+j*22);});}path(()=>{c.moveTo(170,170);c.quadraticCurveTo(190,148,209,170);c.quadraticCurveTo(228,148,247,170);c.moveTo(267,213);c.quadraticCurveTo(281,198,296,213);c.quadraticCurveTo(310,198,325,213);});c.lineWidth=4;c.strokeRect(39,39,690,690);c.strokeRect(51,51,666,666);}
if(name==='cloud'){for(let row=0;row<3;row++)for(let col=0;col<3;col++){c.save();c.translate(75+col*220+(row%2?28:0),144+row*214);c.scale(.72,.72);path(()=>{c.moveTo(9,84);c.bezierCurveTo(-18,80,-5,30,24,41);c.bezierCurveTo(1,-27,113,-40,118,17);c.bezierCurveTo(164,-23,204,54,158,73);c.lineTo(225,73);c.bezierCurveTo(246,73,246,108,225,108);c.lineTo(10,108);});path(()=>{c.moveTo(26,79);c.lineTo(114,79);c.bezierCurveTo(153,79,113,19,86,39);c.bezierCurveTo(58,11,33,54,58,60);c.lineTo(78,60);});for(let k=0;k<3;k++)circ(26+k*47,143,3,true);c.restore();}}
c.restore();}
function replay(){maskCtx.clearRect(0,0,N,N);markTextileResistDirty(mask);for(const cmd of commands){if(cmd.kind==='clear'){maskCtx.clearRect(0,0,N,N);}else if(cmd.kind==='motif'){motif(maskCtx,cmd.name);}else{cmd.points.forEach((p,i)=>paintPoint(maskCtx,i?cmd.points[i-1]:p,i?p:null,cmd.width,cmd.erase,cmd.sym));}}renderEditor();updateEditorButtons();}
function hasInk(){return technique==='tie'?tiePlanHasInk():studioHasWax();}
function updateEditorButtons(){
 const tie=technique==='tie';$('startBtn').disabled=!hasInk()||(tie?!!tiePlanPointer||!!tiePlanAnimation:photoBusy);
 $('startBtn').querySelector('span').textContent=tie?'完成扎制':'下一步';
 $('undoBtn').disabled=tie?!tiePlanCanUndo():!(waxUndoHistory.length||commands.length);
 if($('redoBtn'))$('redoBtn').disabled=tie?!tiePlanCanRedo():!waxRedoHistory.length;
 $('clearBtn').disabled=!commands.length;
 $('drawHint').hidden=tie||mode!=='draw'||studioHasWax();$('photoHint').hidden=tie||mode!=='photo'||!!photo;
 if(tie)syncTiePlanUI();syncStudio();
}
function renderEditor(){studioUpdateCamera();if(technique==='tie'){if($('cropReturnBtn'))$('cropReturnBtn').hidden=true;renderTiePlanEditor();$('drawHint').hidden=$('photoHint').hidden=true;return;}if($('cropReturnBtn'))$('cropReturnBtn').hidden=!(mode==='photo'&&photoSourcePreview);
 if(mode==='photo'&&photo&&photoSourcePreview){viewCtx.clearRect(0,0,N,N);viewCtx.drawImage(crop,0,0,N,N);drawSelvedge(viewCtx);}
 else{
  drawWaxOnCloth(view,studioWaxSource(),!!photo);
  shapeItem(view);if(mode==='draw'&&selectedItemId==='handkerchief')drawSymmetryGuide();
 }
 const original=mode==='photo'&&photo&&photoSourcePreview;
 $('clothLabel').textContent=mode==='draw'?'素布 · 奶黄蜡痕留白':photo?(original?'原图取景 · 拖动、双指缩放':'素布蜡稿 · 上蜡处，染后留白'):'取一张照片 · 先制成蜡稿';
 if($('sourcePhotoBtn')){$('sourcePhotoBtn').textContent=original?'返回素布蜡稿':'看原图取景';$('sourcePhotoBtn').setAttribute('aria-pressed',String(original));}
 if(mode==='photo'&&photo)$('photoCaption').textContent=original?'拖动取景':'上蜡处留白';
}
function undo(){
 cancelWorkbenchPointers();endEditorHistoryGroup();
 if(technique==='tie'){tiePlanUndo();updateEditorButtons();return;}
 if(!waxUndoHistory.length&&!commands.length)return;
 waxRedoHistory.push(editorSnapshot());trimEditorHistory(waxRedoHistory);
 if(waxUndoHistory.length)restoreEditorSnapshot(waxUndoHistory.pop());else{commands.pop();replay();saveDraft();}
}
function redo(){
 cancelWorkbenchPointers();endEditorHistoryGroup();
 if(technique==='tie'){tiePlanRedo();updateEditorButtons();return;}
 if(!waxRedoHistory.length)return;
 waxUndoHistory.push(editorSnapshot());trimEditorHistory(waxUndoHistory);restoreEditorSnapshot(waxRedoHistory.pop());
}
$('undoBtn').onclick=undo;
if($('redoBtn'))$('redoBtn').onclick=redo;
$('clearBtn').onclick=()=>ask('清除手绘？','照片蜡稿会保留，可点“撤销”恢复手绘。',()=>{recordEditorEdit();commands.push({kind:'clear'});replay();saveDraft();});
function setTool(t){tool=t;for(const [id,v] of [['brushBtn','brush'],['eraserBtn','eraser']]){$(id).classList.toggle('active',t===v);$(id).setAttribute('aria-pressed',String(t===v));}view.style.cursor=t==='eraser'?'cell':'crosshair';}
$('brushBtn').onclick=()=>setTool('brush');$('eraserBtn').onclick=()=>setTool('eraser');
if($('symmetryBtn'))$('symmetryBtn').onclick=()=>setSymmetryMode(symmetrical?'free':'six');
document.querySelectorAll('[data-symmetry]').forEach(button=>button.onclick=()=>setSymmetryMode(button.dataset.symmetry));
$('brushSize').oninput=e=>{brush=+e.target.value;$('brushDot').style.width=$('brushDot').style.height=`${3+brush*.31}px`;};
$('patternBtn').onclick=()=>{openModal('选择纹样',`<p class="sheet-copy">添加纹样后可继续绘制，已有笔迹会保留。</p><div class="pattern-grid">${[['flower','团花'],['fish','游鱼'],['moon','山月'],['cloud','流云']].map(([id,n])=>`<button class="pattern-card" data-motif="${id}"><canvas id="motif-${id}" width="300" height="300"></canvas><span>${n}</span></button>`).join('')}</div>`);document.querySelectorAll('[data-motif]').forEach(b=>{const t=make();motif(ctx(t),b.dataset.motif);const d=ctx($('motif-'+b.dataset.motif));d.fillStyle='#285782';d.fillRect(0,0,300,300);d.drawImage(t,0,0,300,300);b.onclick=()=>{recordEditorEdit();commands.push({kind:'motif',name:b.dataset.motif});replay();saveDraft();closeModal();soundPlay('cloth');};});};
function setMode(m){endEditorHistoryGroup();cancelWorkbenchPointers();mode=m==='photo'?'photo':'draw';m=mode;photoSourcePreview=false;drawingId=null;activeStroke=null;pointers.clear();$('drawTab').classList.toggle('active',m==='draw');$('photoTab').classList.toggle('active',m==='photo');$('drawTab').setAttribute('aria-selected',String(m==='draw'));$('photoTab').setAttribute('aria-selected',String(m==='photo'));$('drawControls').hidden=m!=='draw';$('photoControls').hidden=m!=='photo';$('clothLabel').textContent=m==='draw'?'素布 · 指尖作笔':photo?'素布蜡稿 · 拖动取景':'取一张照片 · 留一方记忆';view.setAttribute('aria-label',m==='draw'?'画蜡区域。按住并移动手指或鼠标绘制纹样。':'照片预览区域。拖动照片取景，双指或滑块调整缩放。');syncTechniqueUI();renderEditor();updateEditorButtons();}
$('drawTab').onclick=()=>setMode('draw');$('photoTab').onclick=()=>setMode('photo');
function point(e,canvas=view){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height};}
view.addEventListener('pointerdown',e=>{if(screen!=='editor'||photoBusy||!$('modal').hidden)return;if(technique==='tie'){tiePlanPointerDown(e);return;}e.preventDefault();view.setPointerCapture(e.pointerId);const p=point(e);if(mode==='draw'){if(drawingId!==null)return;recordEditorEdit();drawingId=e.pointerId;activeStroke={kind:'stroke',points:[p],width:brush,erase:tool==='eraser',sym:symmetryMode};commands.push(activeStroke);paintPoint(maskCtx,p,null,brush,activeStroke.erase,activeStroke.sym);renderEditor();$('drawHint').hidden=true;soundPlay('brush');}else{if(!photo){$('photoInput').click();return;}if(!pointers.size)recordEditorEdit();pointers.set(e.pointerId,p);beginPhotoDrag();}});
view.addEventListener('pointermove',e=>{if(screen!=='editor'||!$('modal').hidden)return;if(technique==='tie'){tiePlanPointerMove(e);return;}if(mode==='draw'){if(e.pointerId!==drawingId||!activeStroke)return;e.preventDefault();const points=e.getCoalescedEvents?e.getCoalescedEvents():[e];for(const item of (points.length?points:[e])){const p=point(item),q=activeStroke.points[activeStroke.points.length-1];if(Math.hypot(p.x-q.x,p.y-q.y)<.7)continue;paintPoint(maskCtx,q,p,activeStroke.width,activeStroke.erase,activeStroke.sym);activeStroke.points.push(p);}renderEditor();soundPlay('brush');}else if(photo&&pointers.has(e.pointerId)){e.preventDefault();pointers.set(e.pointerId,point(e));movePhoto();}});
function endPointer(e){endEditorHistoryGroup();if(technique==='tie'){tiePlanPointerEnd(e);return;}if(mode==='draw'&&e.pointerId===drawingId){drawingId=null;activeStroke=null;updateEditorButtons();saveDraft();}if(mode==='photo'){pointers.delete(e.pointerId);beginPhotoDrag();}try{view.releasePointerCapture(e.pointerId);}catch{}}
view.addEventListener('pointerup',endPointer);view.addEventListener('pointercancel',endPointer);view.addEventListener('lostpointercapture',e=>{if(technique==='tie'||e.pointerId===drawingId)endPointer(e);});
// A small vector draft can survive refresh; imported photos are never persisted as source images.
let draftTimer;function saveDraft(){clearTimeout(draftTimer);draftTimer=setTimeout(()=>{try{localStorage.setItem('yifanglan-draft-v1',JSON.stringify(commands));}catch{}},300);}
try{const old=JSON.parse(localStorage.getItem('yifanglan-draft-v1')||'[]');if(Array.isArray(old)&&old.length<1500)commands=old.filter(c=>c&&(['clear','motif'].includes(c.kind)||(c.kind==='stroke'&&Array.isArray(c.points)&&c.points.length<30000)));}catch{}
// Image crop and local stencil making. No photographic RGB is copied to dyed cloth.
$('uploadEmptyBtn').onclick=$('replacePhotoBtn').onclick=()=>$('photoInput').click();
$('photoInput').onchange=e=>{const file=e.target.files[0];if(file)loadPhoto(file);e.target.value='';};
function cancelPendingPhoto(){photoJob++;photoBusy=false;if(photoRaf){cancelAnimationFrame(photoRaf);photoRaf=0;}for(const id of pointers.keys())try{view.releasePointerCapture(id);}catch{}pointers.clear();photoDrag=null;}
function resetPhotoControls(){photoSourcePreview=false;photoScale=1;photoX=photoY=0;photoInverted=false;photoStyle='tonal';photoLight=.5;photoDetail=.55;photoDepth=.5;for(const [id,value]of [['photoZoom',100],['photoLight',50],['photoDetail',55],['photoDepth',50]])if($(id))$(id).value=value;if($('invertBtn')){$('invertBtn').setAttribute('aria-pressed','false');$('invertBtn').style.background='';}}
function loadPhoto(file){setTechnique('wax');if(file.size>25*1024*1024){toast('图片有点大，请选择 25MB 以内的图片。');return;}if(file.type&&!file.type.startsWith('image/')){toast('请选择 JPG、PNG 或其他图片文件。');return;}cancelPendingPhoto();photoBusy=true;updateEditorButtons();const job=photoJob,url=URL.createObjectURL(file),im=new Image();im.onload=()=>{URL.revokeObjectURL(url);if(job!==photoJob)return;try{if(!im.naturalWidth||!im.naturalHeight)throw new Error();const max=1800,ratio=Math.min(1,max/Math.max(im.naturalWidth,im.naturalHeight));const normalized=make(Math.max(1,Math.round(im.naturalWidth*ratio)),Math.max(1,Math.round(im.naturalHeight*ratio)));const nc=ctx(normalized);nc.fillStyle='#fff';nc.fillRect(0,0,normalized.width,normalized.height);nc.drawImage(im,0,0,normalized.width,normalized.height);recordEditorEdit();photo=normalized;resetPhotoControls();$('photoEmptyControls').hidden=true;$('photoFilledControls').hidden=false;photoBusy=false;setMode('photo');renderPhoto();toast('蜡稿已就绪，可继续添画。');}catch{photoBusy=false;updateEditorButtons();toast('读取失败，请换一张 JPG 或 PNG 图片。');}};im.onerror=()=>{URL.revokeObjectURL(url);if(job!==photoJob)return;photoBusy=false;updateEditorButtons();toast('无法读取这张图片，请改用 JPG、PNG 或 WebP。');};im.src=url;}
const crop=make(480),cropCtx=ctx(crop);let photoRaf=0,photoMarginSource=null,photoMarginRGB='#fff';
function photoMarginColor(){
 if(photoMarginSource===photo)return photoMarginRGB;
 const small=make(48),c=ctx(small);c.drawImage(photo,0,0,48,48);const d=c.getImageData(0,0,48,48).data,sum=[0,0,0];let count=0;
 for(let y=0;y<48;y++)for(let x=0;x<48;x++)if(x===0||y===0||x===47||y===47){const k=(y*48+x)*4;for(let ch=0;ch<3;ch++)sum[ch]+=d[k+ch];count++;}
 photoMarginSource=photo;photoMarginRGB=`rgb(${sum.map(v=>Math.round(v/count)).join(',')})`;return photoMarginRGB;
}
function photoFitScale(size){return Math.min(size/photo.width,size/photo.height)*photoScale;}
function constrainPhoto(){if(!photo)return;const scale=photoFitScale(N),w=photo.width*scale,h=photo.height*scale;photoX=clamp(photoX,-Math.abs(w-N)/2,Math.abs(w-N)/2);photoY=clamp(photoY,-Math.abs(h-N)/2,Math.abs(h-N)/2);}
function schedulePhoto(){if(photoRaf)return;photoRaf=requestAnimationFrame(()=>{photoRaf=0;renderPhoto();});}
function photoTonalResist(pix,S,amount=.5,detail=.55){
 const count=S*S,tones=new Float32Array(count),hist=new Uint32Array(256);
 for(let i=0;i<count;i++){const k=i*4,l=(.2126*pix[k]+.7152*pix[k+1]+.0722*pix[k+2])/255;tones[i]=l;hist[Math.round(l*255)]++;}
 const percentile=p=>{let n=0;for(let j=0;j<256;j++){n+=hist[j];if(n>=count*p)return j/255;}return 1;};
 const low=percentile(.02),high=percentile(.98),span=high-low;
 // Contrast is intentionally limited: flat skies and dark backdrops retain
 // their place in the original composition; no foreground mask is inferred.
 const stretch=clamp(span/.48)*.60,lo=low*stretch,range=(1-stretch)+span*stretch;
 const fine=textileBlur(tones,S,S,1),broad=textileBlur(tones,S,S,5),out=new Float32Array(count),adjust=(amount-.5)*.78;
 detail=clamp(detail);const seed=studioSeed%997;
 for(let y=0;y<S;y++)for(let x=0;x<S;x++){
  const i=y*S+x,l=fine[i],local=l-broad[i];
  const resolved=lerp(broad[i],l,.46+detail*.54)+local*(.12+detail*.94);
  let value=(resolved-lo)/Math.max(.12,range);
  const center=Math.exp(-((x/S-.5)**2/.15+(y/S-.48)**2/.23));
  // A small, broad centre weighting lifts midtones without cutting the subject
  // away from its background or changing the original silhouette.
  value+=center*.12*(1-Math.abs(clamp(value)*2-1))+adjust;
  const flow=(smoothNoise(x/47,y/63,seed)-.5)*.026;
  value+=flow*Math.max(0,1-Math.abs(clamp(value)*2-1));
  const wax=clamp((value-.12)/.70),soft= wax*wax*(3-2*wax);
  out[i]=Math.pow(soft,.91);
 }
 return out;
}
function paintPhotoComposition(S){
 const scale=photoFitScale(S),w=photo.width*scale,h=photo.height*scale,left=(S-w)/2+photoX*S/N,top=(S-h)/2+photoY*S/N;
 // A quiet, opaque margin takes the average perimeter colour. Stretching a
 // one-pixel border would turn source texture into conspicuous horizontal bands.
 // The complete image rectangle and its original background stay untouched.
 cropCtx.fillStyle=photoMarginColor();cropCtx.fillRect(0,0,S,S);cropCtx.imageSmoothingEnabled=true;cropCtx.imageSmoothingQuality='high';
 cropCtx.drawImage(photo,left,top,w,h);
}
function renderPhoto(){
 if(!photo)return;constrainPhoto();const S=480;paintPhotoComposition(S);
 const pix=cropCtx.getImageData(0,0,S,S).data,resist=photoTonalResist(pix,S,photoLight,photoDetail),tex=textilePreviewCache(),out=make(S),oc=ctx(out),im=oc.createImageData(S,S);
 for(let y=0;y<S;y++)for(let x=0;x<S;x++){
  const i=y*S+x,k=i*4,sx=x+tex.dx[i]*.64,sy=y+tex.dy[i]*.64;
  let l=textileSample(resist,sx,sy,S);if(photoInverted)l=1-l;
  im.data[k]=im.data[k+1]=im.data[k+2]=255;im.data[k+3]=Math.round(l*255);
 }
 oc.putImageData(im,0,0);photoMaskCtx.clearRect(0,0,N,N);photoMaskCtx.imageSmoothingEnabled=true;photoMaskCtx.imageSmoothingQuality='high';photoMaskCtx.drawImage(out,0,0,N,N);markTextileResistDirty(photoMask);
 renderEditor();updateEditorButtons();
}
function beginPhotoDrag(){const a=[...pointers.values()];if(!a.length){photoDrag=null;return;}photoDrag={points:a.map(p=>({...p})),x:photoX,y:photoY,scale:photoScale};}
function movePhoto(){if(!photoDrag)return;const a=[...pointers.values()];if(a.length>=2&&photoDrag.points.length>=2){const d=Math.hypot(a[1].x-a[0].x,a[1].y-a[0].y),b=photoDrag.points,d0=Math.max(1,Math.hypot(b[1].x-b[0].x,b[1].y-b[0].y));photoScale=clamp(photoDrag.scale*d/d0,1,3);const ratio=photoScale/photoDrag.scale,oldCx=(b[0].x+b[1].x)/2-N/2,oldCy=(b[0].y+b[1].y)/2-N/2,newCx=(a[0].x+a[1].x)/2-N/2,newCy=(a[0].y+a[1].y)/2-N/2;photoX=newCx-(oldCx-photoDrag.x)*ratio;photoY=newCy-(oldCy-photoDrag.y)*ratio;$('photoZoom').value=Math.round(photoScale*100);}else if(a.length){photoX=photoDrag.x+a[0].x-photoDrag.points[0].x;photoY=photoDrag.y+a[0].y-photoDrag.points[0].y;}schedulePhoto();}
$('photoLight').oninput=e=>{recordEditorEdit('photoLight');photoLight=+e.target.value/100;schedulePhoto();};
if($('photoDetail'))$('photoDetail').oninput=e=>{recordEditorEdit('photoDetail');photoDetail=clamp(+e.target.value/100);schedulePhoto();};
if($('photoDepth'))$('photoDepth').oninput=e=>{recordEditorEdit('photoDepth');photoDepth=clamp(+e.target.value/100);renderEditor();};$('photoZoom').oninput=e=>{recordEditorEdit('photoZoom');const old=photoScale;photoScale=+e.target.value/100;photoX*=photoScale/old;photoY*=photoScale/old;schedulePhoto();};
$('centerPhotoBtn').onclick=()=>{recordEditorEdit();photoX=photoY=0;photoScale=1;$('photoZoom').value=100;renderPhoto();};
$('sourcePhotoBtn').onclick=()=>{if(!photo)return;photoSourcePreview=!photoSourcePreview;renderEditor();};
$('invertBtn').onclick=()=>{recordEditorEdit();photoInverted=!photoInverted;$('invertBtn').setAttribute('aria-pressed',String(photoInverted));$('invertBtn').style.background=photoInverted?'#dce6e8':'';renderPhoto();};
// Compatibility with old local drafts: styles now use one continuous tonal wax.
function setPhotoStyle(){photoStyle='tonal';renderPhoto();}
if($('halftoneBtn'))$('halftoneBtn').onclick=setPhotoStyle;if($('cutoutBtn'))$('cutoutBtn').onclick=setPhotoStyle;
view.addEventListener('wheel',e=>{if(technique==='wax'&&mode==='photo'&&photo){e.preventDefault();recordEditorEdit('wheel');const old=photoScale;photoScale=clamp(photoScale*Math.exp(-e.deltaY*.001),1,3);photoX*=photoScale/old;photoY*=photoScale/old;$('photoZoom').value=Math.round(photoScale*100);schedulePhoto();}},{passive:false});
$('clothFrame').addEventListener('dragover',e=>{e.preventDefault();$('clothFrame').classList.add('drag-over');});$('clothFrame').addEventListener('dragleave',()=>$('clothFrame').classList.remove('drag-over'));$('clothFrame').addEventListener('drop',e=>{e.preventDefault();$('clothFrame').classList.remove('drag-over');const f=e.dataTransfer.files[0];if(f){setTechnique('wax');loadPhoto(f);}});

// Wax and binding drafts are independent, so switching a technique never erases work.
function syncTechniqueUI(){
 const tie=technique==='tie';$('workbenchTitle').textContent=tie?'扎染':'画蜡';
 $('waxModeTabs').hidden=tie;$('drawControls').hidden=tie||mode!=='draw';$('photoControls').hidden=tie||mode!=='photo';$('tieControls').hidden=true;
 if($('tiePlanControls'))$('tiePlanControls').hidden=!tie;
 $('tieModeTabs').hidden=true;$('guideBtn').setAttribute('aria-label',tie?'查看扎染提示':'查看画蜡提示');
 $('resistStepName').textContent='创作';$('releaseStepName').textContent=tie?'松绑':'脱蜡';
 view.setAttribute('aria-label',tie?'扎染布面。'+studioTieToolHint():mode==='draw'?'画蜡区域。按住并移动绘制。':'照片蜡稿，取景模式可以移动与缩放原图。');
 if(tie)syncTiePlanUI();syncStudio();scheduleLayout();
}
function setTechnique(value){
 const next=value==='tie'?'tie':'wax';cancelWorkbenchPointers();if(next!==technique)cancelPendingPhoto();startTicket++;technique=next;photoSourcePreview=false;$('clothStage').style.transform='';syncTechniqueUI();renderEditor();updateEditorButtons();
}
function syncTieControls(){
 const preparing=tieDraft.stage==='prepare',fold=tieDraft.tool==='fold',pinch=tieDraft.tool==='pinch',selected=tieDraft.knots.find(x=>x.id===tieDraft.selectedId),loose=tieDraft.knots.some(k=>!k.locked);
 $('workbenchTitle').textContent=preparing?'① 亲手理布':'② 放绳 · 拉紧';$('tieModeTabs').hidden=!preparing;$('tiePrepareTools').hidden=!preparing;$('tieBindTools').hidden=preparing;
 $('tieGatherBtn').setAttribute('aria-pressed',String(!fold));$('tieFoldBtn').setAttribute('aria-pressed',String(fold));$('tieRandomBtn').hidden=fold||pinch;$('tieLiftBtn').hidden=!pinch;$('tieLiftBtn').disabled=!!tieGesture?.auto;$('tieLiftBtn').textContent=tieGesture?.auto?'正在提布':'提起布心';$('tieFoldHorizontal').hidden=$('tieFoldVertical').hidden=!fold;
 $('tieRemoveBtn').disabled=!selected;$('tieResetBtn').disabled=$('tieUndoBtn').disabled=!tiePrepared();$('tieWrapBtn').disabled=tieDraft.knots.length>=TIE_MAX||loose;$('tieTightenBtn').disabled=!selected||selected.tension>=1;$('tieCompareBtn').disabled=!tieDraft.knots.some(k=>k.locked);
 $('tieTension').value=Math.round((selected?.tension||0)*100);$('tieTension').disabled=!selected;
 $('tieHint').textContent=preparing?(fold?'划线指定折痕，松手后沿箭头翻折':pinch?'捏住布面向上拖，提成布峰，再横划绳子围住布峰':'捏住一小块布，慢慢往里送；换一处继续收拢'):loose?'绳子还松着：按住圈出的绳头，向外拉紧':'横跨布团划线放绳，再拖住绳头拉紧';
 view.style.cursor=preparing?(fold?'crosshair':'grab'):'crosshair';scheduleLayout();
}
function saveTieDraft(){try{localStorage.setItem('yifanglan-tie-draft-v3',JSON.stringify(getTieDraftData()));}catch{}}
// Legacy folded drafts remain in storage as history and are never restored into
// the new separate tie workbench. Old physics controls have no live handlers.
$('techniqueBtn').onclick=()=>chooseTechnique();

for(const id of ['photoLight','photoDetail','photoDepth','photoZoom'])$(id).addEventListener('change',()=>{endEditorHistoryGroup();updateEditorButtons();});
