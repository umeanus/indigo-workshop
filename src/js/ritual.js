// --- Ritual state machine. Timers are invalidated on exit so abandoned work cannot finish itself. ---
const r={soakSeconds:0,soakTotal:0,soakLast:0,phase:'idle',untied:[],untieDrag:null,untieAuto:false,untieToken:0,tieUnfold:0,released:[],scrape:0,scraper:{x:580,y:570},cycle:1,dip:0,ox:0,wash:0,dry:0,wind:0,fanUntil:0,fanStartedAt:0,progress:0,token:0,drag:null,base:'raw'};
let sceneRaf=0, reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const ritualCanvas=$('ritualCanvas'),rc=ritualCanvas.getContext('2d'),stages=['第一浸','第二浸','第三浸'];
// Lift softened resist with a wooden scraper. The original design stays in the textile.
const waxSurface=make(),waxCtx=ctx(waxSurface),scrapeGridSize=96;
let scrapeCells=null,scrapeTotal=0,scrapeRemoved=0,scrapeDrag=null,scrapeAuto=false,waxFlakes=[];
function drawSelvedge(c){
 c.save();c.lineJoin='round';c.lineCap='round';
 for(let side=0;side<4;side++){
  c.save();c.translate(N/2,N/2);c.rotate(side*Math.PI/2);c.translate(-N/2,-N/2);
  c.strokeStyle='#52675844';c.lineWidth=2.1;c.beginPath();for(let x=10,i=0;x<=N-10;x+=6.5,i++){const y=(i%2?14:5)+Math.sin(x*.09)*.55;i?c.lineTo(x,y):c.moveTo(x,y);}c.stroke();
  c.strokeStyle='#f2edd8d9';c.lineWidth=1.25;c.beginPath();for(let x=10,i=0;x<=N-10;x+=6.5,i++){const y=(i%2?13:4)+Math.sin(x*.09)*.55;i?c.lineTo(x,y):c.moveTo(x,y);}c.stroke();
  c.strokeStyle='#dedac4b0';c.lineWidth=.8;c.beginPath();c.moveTo(9,11);c.lineTo(N-9,11);c.stroke();c.restore();
 }c.restore();
}
function prepareScrape(){
 const im=waxCtx.createImageData(N,N);scrapeCells=new Float32Array(scrapeGridSize*scrapeGridSize);scrapeTotal=scrapeRemoved=0;waxFlakes=[];scrapeAuto=false;scrapeDrag=null;r.scrape=0;r.scraper={x:585,y:588};
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){const k=(y*N+x)*4,a=craftWaxMask[k+3]/255,grain=(noise(x,y,53)-.5)*14;im.data[k]=223+grain;im.data[k+1]=209+grain;im.data[k+2]=159+grain;im.data[k+3]=Math.round(a*245);}
 waxCtx.putImageData(im,0,0);
 for(let y=0;y<scrapeGridSize;y++)for(let x=0;x<scrapeGridSize;x++){let a=0;for(let yy=0;yy<8;yy++)for(let xx=0;xx<8;xx++)a+=craftWaxMask[((y*8+yy)*N+x*8+xx)*4+3]/255;const v=a/64;scrapeCells[y*scrapeGridSize+x]=v;scrapeTotal+=v;}
 if(scrapeTotal<.005){waxCtx.clearRect(0,0,N,N);r.scrape=1;}
}
async function softenWax(){if(craftTechnique==='tie'||r.phase!=='airReady')return;const token=r.token;prepareScrape();phase('softening');if(!await tween('progress',1,1600,token))return;phase('scraping');}
function scrapeAt(p,q=p){
 if(r.phase!=='scraping'||!scrapeCells)return;
 const toTex=a=>({x:(a.x-105)/558*N,y:(a.y-110)/558*N}),a=toTex(q),b=toTex(p),rad=49;
 waxCtx.save();waxCtx.globalCompositeOperation='destination-out';waxCtx.lineWidth=rad*2;waxCtx.lineCap='round';waxCtx.beginPath();waxCtx.moveTo(a.x,a.y);waxCtx.lineTo(b.x,b.y);waxCtx.stroke();waxCtx.beginPath();waxCtx.arc(b.x,b.y,rad,0,Math.PI*2);waxCtx.fill();waxCtx.restore();
 const dx=b.x-a.x,dy=b.y-a.y,len=dx*dx+dy*dy;
 for(let y=0;y<scrapeGridSize;y++)for(let x=0;x<scrapeGridSize;x++){const i=y*scrapeGridSize+x,value=scrapeCells[i];if(!value)continue;const px=x*8+4,py=y*8+4,t=len?clamp(((px-a.x)*dx+(py-a.y)*dy)/len):0;if(Math.hypot(px-a.x-dx*t,py-a.y-dy*t)<rad){scrapeRemoved+=value;scrapeCells[i]=0;}}
 r.scrape=clamp(scrapeRemoved/Math.max(.001,scrapeTotal));r.scraper={x:clamp(p.x,102,665),y:clamp(p.y,109,678)};
 if(Math.random()<.5)for(let i=0;i<3;i++)waxFlakes.push({x:r.scraper.x+(Math.random()-.5)*45,y:r.scraper.y+14,vx:(Math.random()-.5)*1.4,vy:.3+Math.random(),age:0,size:2+Math.random()*3});waxFlakes=waxFlakes.slice(-44);
 $('ritualProgress').style.width=`${r.scrape*100}%`;$('scrapePercent').textContent=Math.floor(r.scrape*100)+'%';
 if(r.scrape>=.96){waxCtx.clearRect(0,0,N,N);r.scrape=1;$('scrapePercent').textContent='100%';$('ritualPrimary').disabled=false;$('ritualPrimary').textContent='清水漂洗';$('ritualDesc').textContent='蜡层已去，留白显现';$('ritualSecondary').hidden=true;}
}
async function autoScrape(){if(r.phase!=='scraping'||scrapeAuto||r.scrape>=1)return;scrapeAuto=true;const token=r.token;$('ritualSecondary').disabled=true;
 for(let row=0;row<9;row++){
  if(token!==r.token||r.phase!=='scraping')break;
  const y=116+row*66,from={x:row%2?660:107,y},to={x:row%2?107:660,y};let last=from;
  const ok=await new Promise(resolve=>{let start;function frame(t){if(token!==r.token||r.phase!=='scraping'||screen!=='ritual'){resolve(false);return;}start??=t;const p=clamp((t-start)/(reduceMotion?120:360)),next={x:lerp(from.x,to.x,p),y};scrapeAt(next,last);last=next;if(p<1&&r.scrape<1)requestAnimationFrame(frame);else resolve(true);}requestAnimationFrame(frame);});if(!ok||r.scrape>=1)break;
 }scrapeAuto=false;$('ritualSecondary').disabled=false;
}
function drawScraping(c,t){
 const x=105,y=110,w=558;ellipse(c,384,722,265,16,'#183a4b0d');c.save();c.shadowColor='#273d4422';c.shadowBlur=18;c.shadowOffsetY=10;c.drawImage(unwaxedWetCloth,x,y,w,w);c.shadowColor='transparent';c.drawImage(waxSurface,x,y,w,w);c.restore();
 if(r.phase==='softening'){c.save();c.strokeStyle='#fefbedb0';c.lineWidth=3;for(let j=0;j<4;j++){const xx=202+j*118,yy=94-Math.sin(t*.7+j)*8;c.beginPath();c.moveTo(xx,yy);c.bezierCurveTo(xx-14,yy-16,xx+15,yy-30,xx,yy-49);c.stroke();}c.restore();}
 for(const f of waxFlakes){if(!reduceMotion){f.age++;f.x+=f.vx;f.y+=f.vy;f.vy+=.017;}c.save();c.globalAlpha=Math.max(0,1-f.age/65);c.translate(f.x,f.y);c.rotate(f.age*.018);c.fillStyle='#e1d29b';c.fillRect(-f.size,-f.size/2,f.size*2,f.size);c.restore();}waxFlakes=waxFlakes.filter(f=>f.age<65);
 if(r.phase==='scraping'&&r.scrape<1){const p=r.scraper;c.save();c.translate(p.x,p.y);c.rotate(-.14);c.shadowColor='#27352244';c.shadowBlur=6;c.shadowOffsetY=5;const wood=c.createLinearGradient(-42,0,42,0);wood.addColorStop(0,'#8d6b3e');wood.addColorStop(.25,'#cfb680');wood.addColorStop(.75,'#b99a65');wood.addColorStop(1,'#907349');c.fillStyle=wood;c.beginPath();c.roundRect(-43,-24,86,42,5);c.fill();c.fillStyle='#ddd4b7';c.fillRect(-43,12,86,7);c.shadowColor='transparent';c.strokeStyle='#79634344';c.lineWidth=1;for(let i=0;i<4;i++){c.beginPath();c.moveTo(-34,-16+i*7);c.lineTo(34,-15+i*7);c.stroke();}c.restore();}
}
ritualCanvas.addEventListener('pointerdown',e=>{if(r.phase!=='scraping'||scrapeAuto||!$('modal').hidden)return;e.preventDefault();ritualCanvas.setPointerCapture(e.pointerId);scrapeDrag={id:e.pointerId,point:point(e,ritualCanvas)};scrapeAt(scrapeDrag.point);});
ritualCanvas.addEventListener('pointermove',e=>{if(!scrapeDrag||scrapeDrag.id!==e.pointerId||r.phase!=='scraping'||!$('modal').hidden)return;e.preventDefault();const p=point(e,ritualCanvas);scrapeAt(p,scrapeDrag.point);scrapeDrag.point=p;});
for(const name of ['pointerup','pointercancel','lostpointercapture'])ritualCanvas.addEventListener(name,e=>{if(scrapeDrag?.id===e.pointerId){scrapeDrag=null;try{ritualCanvas.releasePointerCapture(e.pointerId);}catch{}}});

function phase(p){
 scheduleLayout();if(p!=='untying'){r.untieDrag=null;r.untieAuto=false;r.untieToken++;}if(p!=='scraping')scrapeDrag=null;if(p!=='drying'){stopMic();stopFan();$('fanBtn').setAttribute('aria-pressed','false');}
 r.phase=p;$('ritualPrimary').hidden=p==='drying';$('redipBtn').hidden=p!=='airReady'||r.soakTotal>=SOAK_LIMIT;syncWorkshopChrome();$('soakClock').hidden=!['dipReady','immersing','soaking','lifting','oxidizing','airReady'].includes(p);$('dryTools').hidden=p!=='drying';r.progress=0;$('ritualProgress').style.width='0%';$('ritualSecondary').hidden=true;$('ritualPrimary').disabled=false;$('ritualFootnote').textContent='';$('ritualSide').textContent='';$('stageCount').textContent=stages[r.cycle-1];
 const indigo=isIndigoRecipe(),ui={
  dipReady:['浸染','向下拖动布料，浸入染液','down','浸入染液'],
  immersing:['浸染','布料正在吸收染液','down','正在浸染'],
  soaking:['浸染','最久 20 秒，随时捞出','up','现在捞出'],
  liftReady:['提布','向上提起布料','up','提起布料'],
  lifting:['提布','沥去多余染液','up','正在提布'],
  oxidizing:[indigo?'氧化显蓝':'显色',indigo?'青绿 → 蓝色':'颜色逐渐均匀','flower','显色中'],
  airReady:['提布完成',craftTechnique==='tie'?'解开线结，看看留白':'刮去蜡层，留下纹样','flower',craftTechnique==='tie'?'拆线':'脱蜡'],
  untying:['拆线','轻点线结，逐处解开','flower','先解开线结'],
  softening:['软化蜡层','温热处理后，开始刮蜡','flower','软蜡中'],
  scraping:['脱蜡','拖动刮板，露出留白','brush','先刮去蜡层'],
  washing:['清水漂洗',craftTechnique==='tie'?'洗去浮色':'洗去浮色与残蜡','down','漂洗中'],
  drying:['晾晒','让风慢慢显出蓝色','flower','扇风'],
  finishing:['晾干完成','正在保存作品','flower','保存中']
 };
 const a=ui[p];if(!a)return;$('ritualEyebrow').textContent='';$('ritualTitle').textContent=a[0];$('ritualDesc').textContent=a[1];$('gestureHint').innerHTML=icon(a[2])+`<span>${a[1]}</span>`;$('ritualPrimary').textContent=a[3];
 setStep(p==='drying'||p==='finishing'?4:['untying','softening','scraping','washing'].includes(p)?3:2);
 if(['immersing','lifting','oxidizing','softening','washing','finishing'].includes(p))$('ritualPrimary').disabled=true;
 if(['liftReady','airReady','finishing'].includes(p))$('ritualProgress').style.width='100%';
 if(p==='scraping'){
  $('ritualPrimary').disabled=r.scrape<.96;$('ritualSecondary').hidden=r.scrape>=.96;$('ritualSecondary').disabled=false;$('ritualSecondary').textContent='自动刮蜡';
  $('ritualFootnote').innerHTML='已刮去 <span id="scrapePercent">'+Math.floor(r.scrape*100)+'%</span>';
  if(r.scrape>=.96){$('ritualPrimary').disabled=false;$('ritualPrimary').textContent='清水漂洗';$('ritualDesc').textContent='蜡层已清除，可以漂洗';}
 }
 if(p==='airReady'&&r.soakTotal<SOAK_LIMIT)$('ritualFootnote').textContent='浸泡时间较短，颜色可能偏浅';
 if(p==='untying')updateUntieUI();
 if(p==='drying'){updateDryUI();$('stageCount').textContent='';}
}
function stopFan(){r.fanUntil=0;r.fanStartedAt=0;}
function toggleFan(){if(screen!=='ritual'||r.phase!=='drying')return;const now=performance.now();if(now<r.fanUntil)stopFan();else{r.fanStartedAt=now;r.fanUntil=now+6000;}updateDryUI();}
function tween(key,to,duration,token=r.token){const from=r[key];const dur=reduceMotion?Math.max(350,duration*.6):duration;return new Promise(resolve=>{let begin=null;function tick(t){if(token!==r.token||screen!=='ritual'){resolve(false);return;}if(begin===null)begin=t;const f=clamp((t-begin)/dur);r[key]=lerp(from,to,key==='ox'||key==='wash'||key==='progress'?f:ease(f));if(['ox','wash','progress'].includes(key))$('ritualProgress').style.width=`${Math.round(r[key]*100)}%`;if(f<1)requestAnimationFrame(tick);else resolve(true);}requestAnimationFrame(tick);});}
async function startRitual(){if(screen!=='editor'||!hasInk()||photoBusy||!$('modal').hidden)return;const ticket=++startTicket;$('startBtn').disabled=true;try{$('startBtn').querySelector('span').textContent='正在备布…';await sleep(35);if(ticket!==startTicket||screen!=='editor'||!$('modal').hidden)return;prepareMaterial();r.untied=[];r.released=[];r.untieDrag=null;r.untieAuto=false;r.token++;r.cycle=1;r.soakSeconds=0;r.soakTotal=0;updateSoakClock();r.dip=0;r.ox=0;r.wash=0;r.dry=0;r.wind=0;r.scrape=0;r.base='raw';r.drag=null;scrapeDrag=null;scrapeAuto=false;scrapeCells=null;waxFlakes=[];waxCtx.clearRect(0,0,N,N);setScreen('ritual');phase('dipReady');runScene();soundPlay('cloth');}catch(err){console.error(err);toast('这次备布没有完成，请重新试一下。');}finally{updateEditorButtons();}}
$('startBtn').onclick=()=>{r.tieUnfold=0;startRitual();};
const SOAK_LIMIT=20;
function updateSoakClock(){
 const total=Math.min(SOAK_LIMIT,r.soakTotal+r.soakSeconds);
 $('soakTime').textContent=total.toFixed(1).padStart(4,'0');
 $('soakDepth').textContent=total<5.3?'浅蓝':total<13.3?'靛蓝':'深蓝';
 $('soakClock').style.setProperty('--soak-progress',(total/SOAK_LIMIT*100)+'%');
}
async function immerse(){
 if(r.phase!=='dipReady')return;const token=r.token;
 r.soakSeconds=0;updateSoakClock();phase('immersing');soundPlay('water');
 if(!await tween('dip',1,1100,token))return;
 phase('soaking');r.soakLast=performance.now();
 function tick(t){
  if(token!==r.token||screen!=='ritual'||r.phase!=='soaking')return;
  const dt=Math.max(0,(t-r.soakLast)/1000);r.soakLast=t;
  if(!document.hidden&&$('modal').hidden)r.soakSeconds=Math.min(SOAK_LIMIT-r.soakTotal,r.soakSeconds+dt);
  updateSoakClock();r.progress=(r.soakTotal+r.soakSeconds)/SOAK_LIMIT;$('ritualProgress').style.width=(r.progress*100)+'%';
  if(r.soakTotal+r.soakSeconds>=SOAK_LIMIT){lift();return;}requestAnimationFrame(tick);
 }
 requestAnimationFrame(tick);
}
async function lift(){
 if(!['soaking','liftReady'].includes(r.phase))return;
 const token=r.token;phase('lifting');r.drag=null;
 r.soakTotal=Math.min(SOAK_LIMIT,r.soakTotal+r.soakSeconds);r.soakSeconds=0;updateSoakClock();craftExposure=r.soakTotal;generateDye(r.cycle);soundPlay('water');
 if(!await tween('dip',0,1350,token))return;
 r.ox=0;
 phase('airReady');soundPlay('tap');
}
async function redip(){
 if(r.phase!=='airReady'||r.soakTotal>=SOAK_LIMIT||!$('modal').hidden)return false;
 const c=ctx(previousCloth);c.clearRect(0,0,N,N);c.drawImage(craftTechnique==='tie'?tieBoundGreen:wetGreen,0,0);r.base='wet';r.dip=0;r.drag=null;phase('dipReady');await immerse();return true;
}
$('redipBtn').onclick=redip;
$('fanBtn').onclick=toggleFan;
function ritualTiePoints(){return craftTies?.kind==='plan'?(craftTies.version===3?craftTies.bindings||[]:craftTies.points||[]):[];}
function ritualWholeCloth(){return craftTechnique==='tie'&&craftTies?.version===3;}
function ritualUnfoldProgress(now=performance.now()){
 if(!ritualWholeCloth()||!resistRemovalComplete())return 0;
 const last=r.released.at(-1);return last?ease(clamp((now-last.time-220)/(reduceMotion?650:1500))):0;
}
function resistRemovalComplete(){const points=ritualTiePoints();return craftTechnique==='tie'?points.length>0&&points.every(p=>r.untied.includes(p.id)):r.scrape>=.96;}
async function wash(){if(!resistRemovalComplete()||(ritualWholeCloth()&&ritualUnfoldProgress()<1)||!(craftTechnique==='tie'?r.phase==='untying':r.phase==='scraping'))return;const token=r.token;phase('washing');r.wash=0;r.ox=0;soundPlay('water');if(!await tween('wash',1,5600,token))return;beginDrying();}
async function finishRitual(){if(r.phase==='finishing'||screen!=='ritual')return;const token=r.token;r.dry=1;stopMic();phase('finishing');soundPlay('finish');await sleep(800);if(token!==r.token||screen!=='ritual')return;commitResult();}
$('ritualPrimary').onclick=()=>{if(r.phase==='dipReady')immerse();else if(['soaking','liftReady'].includes(r.phase))lift();else if(r.phase==='airReady'){if(craftTechnique==='tie')phase('untying');else softenWax();}else if(r.phase==='untying'||r.phase==='scraping')wash();else if(r.phase==='drying')toggleFan();};$('ritualSecondary').onclick=()=>{if(r.phase==='scraping')autoScrape();else if(r.phase==='untying')autoUntie();else redip();};
$('backEditorBtn').onclick=()=>ask('先回到画布？',craftTechnique==='tie'?'这一轮染色会重新开始，布形和绳结会保留。':'这一轮染色会重新开始，蜡稿会保留。',()=>{r.token++;r.drag=null;scrapeDrag=null;scrapeAuto=false;waxFlakes=[];r.dip=r.ox=r.wash=r.dry=r.scrape=0;phase('idle');setScreen('editor');});
ritualCanvas.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('ritualPrimary').click();}});
ritualCanvas.addEventListener('pointerdown',e=>{if(screen!=='ritual'||!$('modal').hidden||r.drag||!['dipReady','soaking','liftReady'].includes(r.phase))return;e.preventDefault();ritualCanvas.setPointerCapture(e.pointerId);r.drag={id:e.pointerId,start:point(e,ritualCanvas),dip:r.dip,phase:r.phase};soundPlay('cloth');});
ritualCanvas.addEventListener('pointermove',e=>{if(!r.drag||r.drag.id!==e.pointerId||!$('modal').hidden)return;e.preventDefault();const p=point(e,ritualCanvas),d=r.drag;if(d.phase==='dipReady'&&r.phase==='dipReady'){r.dip=clamp(d.dip+(p.y-d.start.y)/340);if(r.dip>.87)immerse();}else if(['soaking','liftReady'].includes(d.phase)&&['soaking','liftReady'].includes(r.phase)){r.dip=clamp(d.dip+(p.y-d.start.y)/340);if(r.dip<.13)lift();}});
function endRitualPointer(e){if(!r.drag||r.drag.id!==e.pointerId)return;const d=r.drag;r.drag=null;try{ritualCanvas.releasePointerCapture(e.pointerId);}catch{}if(r.phase==='dipReady'&&r.dip>.02)tween('dip',0,450);if(['soaking','liftReady'].includes(r.phase)&&r.dip<.98)tween('dip',1,450);}
ritualCanvas.addEventListener('pointerup',endRitualPointer);ritualCanvas.addEventListener('pointercancel',endRitualPointer);ritualCanvas.addEventListener('lostpointercapture',endRitualPointer);
function ellipse(c,x,y,rx,ry,fill,stroke){c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.stroke();}}
function drawFabric(c,texture,x,y,w,h,time=0,bend=0,alpha=1){c.save();c.globalAlpha=alpha;c.shadowColor='#183e5124';c.shadowBlur=13;c.shadowOffsetY=7;c.fillStyle='#eeeddf';if(alpha>.99&&craftItemType==='handkerchief')c.fillRect(x+3,y+3,w-6,h-6);c.shadowColor='transparent';const rows=64;for(let j=0;j<rows;j++){const sy=j*N/rows,dy=j*h/rows,off=Math.sin(j*.115+time*1.8)*bend*(j/rows);c.drawImage(texture,0,sy,N,N/rows,x+off,y+dy,w,h/rows+.4);}c.restore();}
function basinBack(c,t,clear){c.save();ellipse(c,384,771,261,28,'#234e7910');const rim=c.createLinearGradient(0,493,0,645);rim.addColorStop(0,'#3c6987');rim.addColorStop(.45,'#dce5e3');rim.addColorStop(1,'#7895a7');ellipse(c,384,574,320,103,rim,'#4e718b');c.lineWidth=2;ellipse(c,384,570,303,83,'#a4bbbc','#2c5873');const water=c.createRadialGradient(331,537,1,390,574,288);const bath=getDyeTone(),waterTone=f=>'rgb('+bath.map(v=>Math.round(v*f)).join(',')+')';water.addColorStop(0,clear?'#b1cfd0':isIndigoRecipe()?'#404c30':waterTone(.85));water.addColorStop(.5,clear?'#699299':isIndigoRecipe()?'#263c27':waterTone(.58));water.addColorStop(1,clear?'#406b7e':isIndigoRecipe()?'#142b21':waterTone(.32));ellipse(c,384,570,292,74,water,'#234b66');for(let i=0;i<7;i++){const cycle=(t*.24+i/7)%1;const opacity=(1-cycle)*.11;c.lineWidth=1;ellipse(c,384+Math.sin(i*5.1)*61,569+Math.cos(i*2)*11,36+cycle*242,9+cycle*54,null,`rgba(225,238,222,${opacity})`);}c.restore();}
function basinFront(c,t){c.save();const glaze=c.createLinearGradient(67,0,701,0);glaze.addColorStop(0,'#c3d3d8');glaze.addColorStop(.2,'#edf0e9');glaze.addColorStop(.52,'#f4f4e8');glaze.addColorStop(.85,'#b8cbd2');glaze.addColorStop(1,'#597e98');c.beginPath();c.moveTo(65,574);c.bezierCurveTo(82,730,143,794,256,804);c.bezierCurveTo(323,815,449,815,514,804);c.bezierCurveTo(634,793,687,723,703,574);c.bezierCurveTo(681,690,96,690,65,574);c.fillStyle=glaze;c.fill();c.strokeStyle='#567991';c.lineWidth=2;c.stroke();
// Two indigo bands and a hand-drawn wave motif on the porcelain bowl.
c.save();c.clip();c.strokeStyle='#315e82';c.lineWidth=7;c.beginPath();c.ellipse(384,554,315,119,0,.03,Math.PI-.03);c.stroke();c.lineWidth=2;c.beginPath();c.ellipse(384,564,318,126,0,.03,Math.PI-.03);c.stroke();c.lineWidth=2;for(let j=-4;j<=4;j++){const x=384+j*66,y=725-Math.pow(j,2)*2.6;for(let k=0;k<3;k++){c.beginPath();c.arc(x,y,21-k*6,Math.PI,Math.PI*2);c.stroke();}c.beginPath();c.moveTo(x-24,y+8);c.quadraticCurveTo(x,y+19,x+24,y+8);c.stroke();}c.lineWidth=5;c.beginPath();c.ellipse(384,702,244,87,0,.24,Math.PI-.24);c.stroke();c.restore();
c.lineWidth=4;c.strokeStyle='#d2dfdf';c.beginPath();c.ellipse(384,574,314,102,0,0,Math.PI);c.stroke();c.lineWidth=1.5;c.strokeStyle='#416b8a';c.beginPath();c.ellipse(384,574,322,105,0,0,Math.PI);c.stroke();c.restore();}
function drawRod(c,x,y,w,opacity=1){c.save();c.globalAlpha=opacity;const g=c.createLinearGradient(0,y,0,y+12);g.addColorStop(0,'#c7c1a6');g.addColorStop(.5,'#aaa386');g.addColorStop(1,'#726e60');c.fillStyle=g;c.fillRect(x-18,y,w+36,9);c.strokeStyle='#696f6544';c.strokeRect(x-18,y,w+36,9);c.restore();}
// A continuous deforming textile mesh, rather than hinged rigid panels.
const meshTexture=make(),meshTextureCtx=ctx(meshTexture),meshLight=make(13,17),meshLightCtx=ctx(meshLight);
function clothMesh(c,texture,position,cols=12,rows=16){
  const pts=[];for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){const p=position(i/cols,j/rows);p.u=i/cols*N;p.v=j/rows*N;pts.push(p);}
  const lighting=meshLightCtx.createImageData(cols+1,rows+1);for(let k=0;k<pts.length;k++){const light=pts[k].light,rgba=light<0?[10,28,43]:[255,251,226];for(let ch=0;ch<3;ch++)lighting.data[k*4+ch]=rgba[ch];lighting.data[k*4+3]=Math.abs(light)*255;}meshLightCtx.putImageData(lighting,0,0);meshTextureCtx.clearRect(0,0,N,N);meshTextureCtx.drawImage(texture,0,0);meshTextureCtx.globalCompositeOperation='source-atop';meshTextureCtx.imageSmoothingEnabled=true;meshTextureCtx.drawImage(meshLight,0,0,N,N);meshTextureCtx.globalCompositeOperation='source-over';
  if(craftItemType==='handkerchief'){c.save();c.beginPath();for(let i=0;i<=cols;i++){const p=pts[i];i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y);}for(let j=1;j<=rows;j++){const p=pts[j*(cols+1)+cols];c.lineTo(p.x,p.y);}for(let i=cols-1;i>=0;i--){const p=pts[rows*(cols+1)+i];c.lineTo(p.x,p.y);}for(let j=rows-1;j>0;j--){const p=pts[j*(cols+1)];c.lineTo(p.x,p.y);}c.closePath();c.shadowColor='#162f3e35';c.shadowBlur=19;c.shadowOffsetX=5;c.shadowOffsetY=12;c.fillStyle='#c8c4b3';c.fill();c.restore();}
  function tri(a,b,d){
    const det=(b.u-a.u)*(d.v-a.v)-(d.u-a.u)*(b.v-a.v);if(!det)return;
    const aa=((b.x-a.x)*(d.v-a.v)-(d.x-a.x)*(b.v-a.v))/det;
    const bb=((b.y-a.y)*(d.v-a.v)-(d.y-a.y)*(b.v-a.v))/det;
    const cc=((d.x-a.x)*(b.u-a.u)-(b.x-a.x)*(d.u-a.u))/det;
    const dd=((d.y-a.y)*(b.u-a.u)-(b.y-a.y)*(d.u-a.u))/det;
    const cx=(a.x+b.x+d.x)/3,cy=(a.y+b.y+d.y)/3;
    c.save();c.beginPath();for(let k=0;k<3;k++){const p=[a,b,d][k],dx=p.x-cx,dy=p.y-cy,len=Math.hypot(dx,dy)||1;const x=p.x+dx/len*1.25,y=p.y+dy/len*1.25;k?c.lineTo(x,y):c.moveTo(x,y);}c.closePath();c.clip();c.setTransform(aa,bb,cc,dd,a.x-aa*a.u-cc*a.v,a.y-bb*a.u-dd*a.v);c.drawImage(meshTexture,0,0);c.setTransform(1,0,0,1,0,0);
    c.restore();
  }
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const n=j*(cols+1)+i;tri(pts[n],pts[n+1],pts[n+cols+2]);tri(pts[n],pts[n+cols+2],pts[n+cols+1]);}
  // Softly irregular selvedges follow the fabric, not a bounding rectangle.
  if(craftItemType==='handkerchief'){c.save();c.strokeStyle='#e6dfc65c';c.lineWidth=1.2;for(const edge of [0,1]){c.beginPath();for(let j=0;j<=rows;j++){const p=position(edge,j/rows);j?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y);}c.stroke();}c.restore();}
}
function dryPoint(u,v,t){
  const wind=r.wind,amplitude=reduceMotion?10+wind*26:18+wind*42;
  // Cloth motion communicates airflow, so reduced motion makes that essential
  // feedback gentler and slower rather than turning the process into a still.
  if(reduceMotion)t*=.6;
  // Two broad travelling waves deform the fabric below its fixed top edge.
  // A resting breeze is visible; stronger wind increases the drape's sweep.
  const sway=Math.sin(t*1.35-v*1.7)*amplitude*Math.pow(v,1.6);
  const ripple=Math.sin(u*5.3-v*3.1+t*(1.55+wind*.8))*amplitude*.48*Math.sin(v*Math.PI/2);
  const sag=Math.sin(Math.PI*u)*17;
  return {x:116+u*536+sway+ripple+Math.sin(v*14+u*3)*1.3,
    y:166+sag+v*532+Math.sin(u*4.6-v*3+t*1.7)*amplitude*.38*v*v+Math.sin(u*17+v*2.5)*2*v,
    light:Math.sin(u*7.1-v*3+t*1.4)*(.04+.05*wind)*v};
}
function drawClip(c,x,y,angle){c.save();c.translate(x,y);c.rotate(angle);c.shadowColor='#3b392b35';c.shadowBlur=5;c.shadowOffsetY=3;const wood=c.createLinearGradient(-9,0,9,0);wood.addColorStop(0,'#8d7656');wood.addColorStop(.2,'#ceb98c');wood.addColorStop(.6,'#c2a575');wood.addColorStop(1,'#91724e');c.fillStyle=wood;c.beginPath();c.roundRect(-8,-25,16,53,3);c.fill();c.shadowColor='transparent';c.strokeStyle='#715f4466';c.lineWidth=1;c.beginPath();c.moveTo(-3,-20);c.lineTo(-3,20);c.moveTo(3,-18);c.lineTo(3,23);c.stroke();c.strokeStyle='#6d716b';c.lineWidth=2;c.strokeRect(-10,-3,20,6);c.restore();}
function fanPose(now=performance.now()){
 if(r.phase!=='drying'||now>=r.fanUntil||now<r.fanStartedAt)return null;
 const elapsed=(now-r.fanStartedAt)/1000;
 const beat=Math.sin(elapsed*(reduceMotion?2.8:7.2));
 return {x:637+beat*(reduceMotion?4:10),y:720,angle:-.43+beat*(reduceMotion?.32:.52),opacity:Math.min(clamp(elapsed/.14),clamp((r.fanUntil-now)/230)),elapsed};
}
function drawHandFan(c,t){
 const pose=fanPose();if(!pose)return;
 const {elapsed}=pose;
 if(!reduceMotion){c.save();for(let j=0;j<3;j++){const flow=(elapsed*1.6+j/3)%1;c.globalAlpha=(1-flow)*.26*pose.opacity;c.strokeStyle='#c7e3ec';c.lineWidth=2;c.beginPath();c.moveTo(590-flow*55,605+j*17-flow*45);c.bezierCurveTo(570-flow*70,562+j*17-flow*30,536-flow*78,574+j*17-flow*42,520-flow*95,551+j*17-flow*42);c.stroke();}c.restore();}
 c.save();c.globalAlpha=pose.opacity;c.translate(pose.x,pose.y);c.rotate(pose.angle);c.scale(1.12,1.12);c.shadowColor='#263d3933';c.shadowBlur=12;c.shadowOffsetY=5;
 const straw=c.createLinearGradient(-57,-194,55,-37);straw.addColorStop(0,'#e3d6ad');straw.addColorStop(.5,'#c9b57f');straw.addColorStop(1,'#ac915b');
 c.fillStyle=straw;c.beginPath();c.ellipse(0,-123,63,89,0,0,Math.PI*2);c.fill();c.shadowColor='transparent';
 c.save();c.beginPath();c.ellipse(0,-123,60,85,0,0,Math.PI*2);c.clip();
 for(let j=0;j<23;j++){const yy=-207+j*7;c.strokeStyle=j%2?'#866c3848':'#fff1c060';c.lineWidth=1.8;c.beginPath();c.moveTo(-68,yy);c.quadraticCurveTo(0,yy+12,68,yy);c.stroke();}
 for(let j=-5;j<=5;j++){c.strokeStyle='#947a4559';c.lineWidth=1.3;c.beginPath();c.moveTo(0,-37);c.quadraticCurveTo(j*8,-119,j*12,-210);c.stroke();}
 c.restore();c.strokeStyle='#8e764d';c.lineWidth=3;c.beginPath();c.ellipse(0,-123,63,89,0,0,Math.PI*2);c.stroke();
 const handle=c.createLinearGradient(-6,0,6,0);handle.addColorStop(0,'#876a42');handle.addColorStop(.5,'#c8ae72');handle.addColorStop(1,'#9c7c4d');c.fillStyle=handle;c.beginPath();c.roundRect(-6,-70,12,118,5);c.fill();c.strokeStyle='#765e3944';c.lineWidth=1;c.beginPath();c.moveTo(-2,-62);c.lineTo(-2,38);c.stroke();
 // A small hand holds the handle. The full paddle rotates around this grip.
 c.fillStyle='#cba88b';c.beginPath();c.roundRect(-13,31,27,70,12);c.fill();c.fillStyle='#cba88b';c.beginPath();c.roundRect(-15,8,30,39,11);c.fill();c.fillStyle='#ddbba0';c.beginPath();c.ellipse(-10,11,9,15,-.3,0,Math.PI*2);c.fill();c.strokeStyle='#a9846d66';c.lineWidth=1.2;for(let j=0;j<3;j++){c.beginPath();c.moveTo(-9,22+j*7);c.lineTo(9,22+j*7);c.stroke();}c.restore();
}
function dryItemPoint(u,v,t){
 const top={handkerchief:0,tote:.09,scarf:.036,tshirt:.116}[craftItemType]||0;
 return dryPoint(u,Math.max(0,(v-top)/(1-top)),t);
}
function drawDrying(c,t){
  c.save();const sun=c.createRadialGradient(650,70,8,650,70,500);sun.addColorStop(0,'#faf4da82');sun.addColorStop(1,'#f9efda00');c.fillStyle=sun;c.fillRect(0,0,768,840);c.restore();
  // The rope is fixed; only the free cloth below its two clips catches the breeze.
  c.save();c.strokeStyle='#706c5760';c.lineWidth=3;c.beginPath();c.moveTo(-30,133);c.quadraticCurveTo(384,194,798,133);c.stroke();c.strokeStyle='#ded4b7';c.lineWidth=1;c.beginPath();c.moveTo(-30,132);c.quadraticCurveTo(384,192,798,132);c.stroke();c.restore();
  ellipse(c,402,765,235,15,'#1738480b');clothMesh(c,materialDryCloth(r.dry,r.ox),(u,v)=>dryItemPoint(u,v,t));
  const pins={handkerchief:[.075,.925],tote:[.42,.60],scarf:[.35,.65],tshirt:[.28,.72]}[craftItemType]||[.075,.925],a=dryPoint(pins[0],0,t),b=dryPoint(pins[1],0,t);drawClip(c,a.x,a.y-2,-.055);drawClip(c,b.x,b.y-2,.07);
  drawHandFan(c,t);
}
// Water travels continuously from the pouring lip, across the wet textile and
// down from the cloth. Motion and translucency illustrate rinsing; they
// do not regenerate the fixed resist or introduce a second dye colour.
function rinsePoint(u,v,t){
 if(reduceMotion)t*=.6;
 const pulse=Math.sin(t*2),wave=Math.sin(u*5-v*3.8+t*2.8);
 return {x:144+u*480+wave*(reduceMotion?9:20)*Math.sin(v*Math.PI/2),y:150+v*502+Math.sin(u*Math.PI)*13+pulse*(reduceMotion?10:19)*v+wave*(reduceMotion?5:11)*v,light:Math.sin(u*7-v*4+t*1.6)*(reduceMotion?.028:.045)*v};
}
function drawWateringCan(c){
 // The rose sits at (566, 78), exactly where the water ribbons begin.
 c.save();c.translate(648,82);c.rotate(-.25);c.lineJoin='round';c.lineCap='round';
 c.strokeStyle='#789ba8';c.lineWidth=12;c.beginPath();c.ellipse(55,-10,35,34,0,-Math.PI*.65,Math.PI*.7);c.stroke();
 c.strokeStyle='#d2e0df';c.lineWidth=7;c.stroke();
 const metal=c.createLinearGradient(-42,0,49,0);metal.addColorStop(0,'#afc5c8');metal.addColorStop(.32,'#e1e9e5');metal.addColorStop(.75,'#c7d7d7');metal.addColorStop(1,'#8caeb8');
 c.fillStyle=metal;c.strokeStyle='#7d9fa9';c.lineWidth=1.5;
 c.beginPath();c.moveTo(-35,-31);c.lineTo(39,-31);c.quadraticCurveTo(56,0,48,51);c.quadraticCurveTo(3,64,-42,49);c.quadraticCurveTo(-49,9,-35,-31);c.fill();c.stroke();
 c.beginPath();c.moveTo(-40,28);c.lineTo(-88,-15);c.lineTo(-80,-27);c.lineTo(-28,3);c.closePath();c.fill();c.stroke();
 c.save();c.translate(-80,-25);c.rotate(-.44);c.fillStyle='#d8e6e4';c.beginPath();c.ellipse(0,0,11,23,0,0,Math.PI*2);c.fill();c.stroke();c.fillStyle='#759da9';for(let i=-2;i<=2;i++)for(let j=-1;j<=1;j++){c.beginPath();c.arc(j*4,i*6,1,0,Math.PI*2);c.fill();}c.restore();
 ellipse(c,3,-31,36,9,'#b8cdcf','#8caab2');ellipse(c,3,-33,24,5,'#85a5ac');
 c.strokeStyle='#e8efea';c.lineWidth=2;c.beginPath();c.moveTo(-25,-22);c.quadraticCurveTo(-32,10,-26,43);c.stroke();
 c.strokeStyle='#92afb6';c.lineWidth=5;c.beginPath();c.moveTo(-21,-31);c.quadraticCurveTo(3,-64,30,-32);c.stroke();c.restore();
}
function drawWashing(c,t){
 ellipse(c,384,727,267,22,'#5883910d');
 for(let i=0;i<4;i++){const f=(t*.5+i/4)%1;c.save();c.globalAlpha=(1-f)*.16;c.lineWidth=1.5;ellipse(c,384,730,35+f*220,5+f*22,null,'#6499af');c.restore();}
 c.save();c.beginPath();c.rect(0,0,768,755);c.clip();
 clothMesh(c,materialWashedCloth(r.wash),(u,v)=>rinsePoint(u,v,t));
 // Transparent film follows the drape rather than a flat screen rectangle.
 c.save();c.beginPath();for(let j=0;j<=24;j++){const p=rinsePoint(0,j/24,t);j?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y);}for(let j=24;j>=0;j--){const p=rinsePoint(1,j/24,t);c.lineTo(p.x,p.y);}c.closePath();c.clip();
 if(craftItemType!=='handkerchief'){c.save();c.translate(144,150);c.scale(480/N,502/N);itemBodyPath(c,craftItemType);c.restore();c.clip();}
 const glaze=c.createLinearGradient(380,210,380,652);glaze.addColorStop(0,'#f2ffff00');glaze.addColorStop(.22,'#e6ffff17');glaze.addColorStop(.8,'#a5d1cb25');glaze.addColorStop(1,'#d9f3ec30');c.fillStyle=glaze;c.fillRect(120,145,530,530);
 for(let j=0;j<24;j++){
  const u=.10+j*.034,travel=(t*.57+j*.081)%1,length=.16+(j%4)*.033;c.beginPath();
  for(let k=0;k<=9;k++){const v=travel-length+k*length/9;if(v<0||v>1)continue;const p=rinsePoint(u+Math.sin(v*8+j)*.009,v,t);k?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y);}
  c.lineWidth=j%4===0?1.8:.8;c.strokeStyle=j%3===0?'#ffffff50':'#e7ffff26';c.stroke();
 }
 c.restore();
 // A small continuous ribbon widens as it meets the cloth; bright moving
 // filaments give the flow direction without large cartoon splash shapes.
 const flow=c.createLinearGradient(552,95,478,320);flow.addColorStop(0,'#edfaffb5');flow.addColorStop(.55,'#d4f2fa65');flow.addColorStop(1,'#efffff12');
 c.fillStyle=flow;c.beginPath();c.moveTo(559,75);c.bezierCurveTo(531,125,506,192,484,269);c.bezierCurveTo(479,285,466,316,455,333);c.bezierCurveTo(501,308,516,283,524,255);c.bezierCurveTo(532,203,544,142,571,80);c.closePath();c.fill();
 for(let j=0;j<5;j++){const offset=j*3.2,wave=Math.sin(t*5+j)*2;c.strokeStyle=j%2?'#ffffff79':'#c6efff6b';c.lineWidth=j%2?1.1:2;c.beginPath();c.moveTo(560+offset,79);c.bezierCurveTo(537+offset,137,519+offset+wave,213,487+offset,279);c.stroke();}
 // Modest impact rings lie on the cloth and drain down its grain.
 for(let j=0;j<3;j++){const f=(t*1.35+j/3)%1;c.globalAlpha=(1-f)*.28;ellipse(c,502,282,6+f*41,2+f*9,null,'#f4ffff');}c.globalAlpha=1;
 c.restore();drawWateringCan(c);

}
function updateDevelopmentCaption(){
 if(r.phase!=='oxidizing'||isIndigoRecipe())return;
 const stage=r.ox<.34?0:r.ox<.73?1:2,counts=['初染','显色','颜色均匀'];
 if($('stageCount').textContent!==counts[stage])$('stageCount').textContent=counts[stage];
}
function drawScene(t){updateDevelopmentCaption();rc.clearRect(0,0,768,840);if(r.phase==='washing'){drawWashing(rc,t);return;}if(r.phase==='untying'){drawUntying(rc,t);return;}if(['softening','scraping'].includes(r.phase)){drawScraping(rc,t);return;}if(['drying','finishing'].includes(r.phase)){drawDrying(rc,t);return;}const washing=false;basinBack(rc,t,false);const width=508-24*r.dip,x=(768-width)/2,y=36+529*r.dip,h=width;const floating=r.phase==='airReady'?Math.sin(t*.8)*1.7:0;const alpha=clamp(1-(r.dip-.89)*7,.16,1);
let first=r.base==='raw'?rawCloth:previousCloth;if(['lifting','liftReady','airReady'].includes(r.phase)){first=craftTechnique==='tie'?tieBoundGreen:wetGreen;}
rc.save();rc.beginPath();rc.rect(0,0,768,602);rc.clip();
if(ritualWholeCloth()){
 rc.save();rc.globalAlpha=alpha;tiePlanDrawSurface(rc,first,craftTies,{x,y:y+floating,width,height:h,ropes:true});rc.restore();
}else{drawFabric(rc,first,x,y+floating,width,h,t,2.3+r.dip*8,alpha);if(craftTechnique==='tie')drawRitualTieRopes(rc,x,y+floating,width,h,t,alpha);drawRod(rc,x,y-7+floating,width,clamp(1-(r.dip-.88)*8));}
// Soft underwater veiling where fabric meets the indigo surface.
if(r.dip>.15){rc.save();rc.beginPath();rc.ellipse(384,570,292,74,0,0,Math.PI*2);rc.clip();const veil=rc.createLinearGradient(0,498,0,602);veil.addColorStop(0,'#1c424800');veil.addColorStop(1,'#183943e0');rc.fillStyle=veil;rc.fillRect(x-5,Math.max(y,498),width+10,120);rc.restore();}
if(['lifting','oxidizing','airReady'].includes(r.phase)){rc.strokeStyle='#5d8fa96a';rc.lineWidth=1.5;for(let j=0;j<7;j++){const yy=(t*86+j*27)%120;const fade=(1-yy/120)*(r.phase==='airReady'?.23:.8);rc.globalAlpha=fade;rc.beginPath();rc.moveTo(x+35+j*60,y+h+yy);rc.lineTo(x+35+j*60,y+h+yy+8);rc.stroke();}rc.globalAlpha=1;}
if(washing){rc.save();rc.globalAlpha=.65;rc.strokeStyle='#c6dcdd';rc.lineWidth=9;for(let j=0;j<10;j++){const xx=x+19+j*44,yy=y+((t*210+j*25)%width);rc.beginPath();rc.moveTo(xx,yy);rc.quadraticCurveTo(xx+9,yy+36,xx-2,yy+70);rc.stroke();}rc.restore();}rc.restore();basinFront(rc,t);
if(r.phase==='liftReady'){const pulse=reduceMotion?0:Math.sin(t*2.8)*3;rc.save();ellipse(rc,384,520+pulse,27,27,'#f5f4e9','#7898aa');rc.strokeStyle='#315c7f';rc.lineWidth=2;rc.beginPath();rc.moveTo(384,533+pulse);rc.lineTo(384,508+pulse);rc.moveTo(376,516+pulse);rc.lineTo(384,508+pulse);rc.lineTo(392,516+pulse);rc.stroke();rc.restore();}
if(r.phase==='dipReady'&&r.dip<.06){rc.save();rc.globalAlpha=.5;rc.strokeStyle='#3c6484';rc.lineWidth=1.5;rc.beginPath();const yy=464+(reduceMotion?0:Math.sin(t*2)*5);rc.moveTo(384,yy);rc.lineTo(384,yy+28);rc.moveTo(377,yy+21);rc.lineTo(384,yy+28);rc.lineTo(391,yy+21);rc.stroke();rc.restore();}}
function runScene(){if(sceneRaf)return;let last=0;function frame(t){if(screen!=='ritual'){sceneRaf=0;return;}if(t-last>32){const dt=Math.min(.1,last?(t-last)/1000:0);if(r.phase==='drying'&&!document.hidden&&$('modal').hidden)updateDrying(dt,t);drawScene(t/1000);last=t;}sceneRaf=requestAnimationFrame(frame);}sceneRaf=requestAnimationFrame(frame);}


// The lightweight tie route uses the exact material-space plan points. No
// folded mesh, knot projection or legacy unfolding solver is used here.
let tieRevealSurface=make(),tieRevealCtx=ctx(tieRevealSurface);
let tieRevealKey='',tieRevealBase=null,tieRevealTarget=null;
function releaseClothPoint(u,v,t){
 const wave=Math.sin(t*(reduceMotion?.9:1.5)-v*3+u*4)*(reduceMotion?.4:1);
 return {x:105+u*558+wave*5*v,y:110+v*558+Math.sin(u*Math.PI)*9+wave*4*v,light:Math.sin(u*6+t)*.018*v};
}
function tieReleaseProgress(id,now){
 if(!r.untied.includes(id))return 0;
 const item=r.released.find(entry=>entry.knot.id===id);
 return reduceMotion||!item?1:clamp((now-item.time)/650);
}
function tieRevealCloth(now=performance.now()){
 if(ritualWholeCloth())return unwaxedWetCloth;
 const points=ritualTiePoints(),base=tieBoundGreen,steps=points.map(p=>Math.round(tieReleaseProgress(p.id,now)*24));
 if(points.length&&steps.every(step=>step===24))return unwaxedWetCloth;
 const key=steps.join(',');if(key===tieRevealKey&&base===tieRevealBase&&unwaxedWetCloth===tieRevealTarget)return tieRevealSurface;
 if(base!==tieRevealBase||unwaxedWetCloth!==tieRevealTarget){tieRevealSurface.width=tieRevealSurface.height=1;tieRevealSurface=make();tieRevealCtx=ctx(tieRevealSurface);}
 tieRevealKey=key;tieRevealBase=base;tieRevealTarget=unwaxedWetCloth;
 const c=tieRevealCtx;c.clearRect(0,0,N,N);c.drawImage(base,0,0);
 for(let i=0;i<points.length;i++){
  const progress=steps[i]/24;if(progress<=0)continue;const point=points[i];c.save();c.beginPath();
  if(point.pattern==='stripes'||(!point.pattern&&craftTies.style==='stripes')){const reach=(point.radius||85)*1.65*ease(progress);c.rect(0,point.y-reach,N,reach*2);}
  else c.arc(point.x,point.y,(point.radius||85)*1.9*ease(progress),0,Math.PI*2);
  c.clip();c.globalAlpha=clamp(progress*3);c.drawImage(unwaxedWetCloth,0,0);c.restore();
 }return tieRevealSurface;
}
function drawRitualTieRopes(c,x,y,w,h,t=0,alpha=1,deform=false){
 const now=performance.now();
 for(const knot of ritualTiePoints()){
  const progress=tieReleaseProgress(knot.id,now);if(progress>=1)continue;
  const pos=deform?releaseClothPoint(knot.x/N,knot.y/N,t):{x:x+knot.x/N*w,y:y+knot.y/N*h};
  const size=(12+(knot.radius||85)*.07)*w/N;
  c.save();c.globalAlpha=alpha*(1-progress);c.translate(pos.x+progress*28,pos.y+progress*16);c.rotate(-.24+progress*.7);c.shadowColor='#3c302d36';c.shadowBlur=4;c.shadowOffsetY=2;
  c.strokeStyle='#a58b5e';c.lineWidth=3.6;for(let j=-1;j<=1;j++){c.beginPath();c.ellipse(0,j*3,size+progress*17,size*.48+progress*9,0,0,Math.PI*2);c.stroke();}
  c.shadowColor='transparent';c.strokeStyle='#e3cf9d';c.lineWidth=1;c.beginPath();c.ellipse(0,-2,size,size*.48,0,0,Math.PI*2);c.stroke();
  c.lineWidth=3;c.strokeStyle='#b79d6b';c.beginPath();c.moveTo(-6,0);c.bezierCurveTo(-24-progress*29,-17,-20,18,-3,3);c.bezierCurveTo(20,19,27+progress*25,-15,7,0);c.moveTo(-3,3);c.quadraticCurveTo(-8-progress*24,17+progress*16,-22-progress*45,21+progress*26);c.moveTo(5,4);c.quadraticCurveTo(13+progress*24,17,26+progress*47,24+progress*31);c.stroke();c.restore();
 }
}
function updateUntieUI(){
 const count=ritualTiePoints().length,released=resistRemovalComplete(),unfolding=released&&ritualWholeCloth()&&ritualUnfoldProgress()<1,done=released&&!unfolding;
 $('ritualPrimary').disabled=!done;$('ritualPrimary').textContent=done?'清水漂洗':unfolding?'正在展开布料':'先解开线结';$('ritualSecondary').hidden=released;$('ritualSecondary').disabled=r.untieAuto;$('ritualSecondary').textContent='依次解开';
 const hint=done?'线结已解开，清水漂洗':unfolding?'布料慢慢展开，露出染纹':'轻点线结，逐处解开';$('ritualDesc').textContent=hint;$('gestureHint').innerHTML=icon('flower')+`<span>${hint}</span>`;$('ritualProgress').style.width=`${count?r.untied.length/count*100:0}%`;
}
function releaseTie(id){
 if(r.phase!=='untying'||r.untied.includes(id))return;
 const knot=ritualTiePoints().find(p=>p.id===id);if(!knot)return;r.untied.push(id);r.released.push({knot,time:performance.now()});updateUntieUI();soundPlay('cloth');
 if(ritualWholeCloth()&&resistRemovalComplete()){const token=r.token;setTimeout(()=>{if(token===r.token&&screen==='ritual'&&r.phase==='untying')updateUntieUI();},reduceMotion?900:1750);}
}
async function autoUntie(){
 if(r.phase!=='untying'||r.untieAuto)return;r.untieAuto=true;updateUntieUI();const token=r.token,job=++r.untieToken;
 for(const knot of ritualTiePoints()){
  if(token!==r.token||job!==r.untieToken||r.phase!=='untying'||screen!=='ritual'||!r.untieAuto)break;
  if(r.untied.includes(knot.id))continue;releaseTie(knot.id);await sleep(reduceMotion?140:520);
 }
 if(job===r.untieToken){r.untieAuto=false;if(r.phase==='untying')updateUntieUI();}
}
function drawUntying(c,t){
 if(ritualWholeCloth()){
  const flatten=ritualUnfoldProgress();r.tieUnfold=flatten;
  ellipse(c,384,722,240,16,'#183a4b0d');tiePlanDrawSurface(c,unwaxedWetCloth,craftTies,{x:56,y:72,width:656,height:656,flatten,releasedIds:r.untied,ropes:true});return;
 }
 ellipse(c,384,722,265,16,'#183a4b0d');clothMesh(c,tieRevealCloth(),(u,v)=>releaseClothPoint(u,v,t));drawRitualTieRopes(c,105,110,558,558,t,1,true);
}
ritualCanvas.addEventListener('pointerdown',e=>{
 if(screen!=='ritual'||r.phase!=='untying'||r.untieAuto||!$('modal').hidden)return;
 const p=point(e,ritualCanvas),t=performance.now()/1000;
 const anchors=ritualWholeCloth()?tiePlanRopeAnchors(craftTies,{flatten:ritualUnfoldProgress()}):null;
 const nearest=ritualTiePoints().filter(k=>!r.untied.includes(k.id)).map(k=>{const local=anchors?.find(a=>a.id===k.id),anchor=local?{x:56+local.x*656/N,y:72+local.y*656/N}:releaseClothPoint(k.x/N,k.y/N,t);return {k,d:Math.hypot(p.x-anchor.x,p.y-anchor.y)};}).sort((a,b)=>a.d-b.d)[0];
 if(!nearest||nearest.d>43)return;e.preventDefault();releaseTie(nearest.k.id);
});
let ritualWasHidden=document.hidden;
function restoreRitualMaterials(){
 if(screen!=='ritual'||['idle','finishing'].includes(r.phase)||!dyeMask||!field)return;
 // Rebuild textures from the existing material snapshot; never re-read the
 // editor or change exposure, wax removal, oxidation or drying progress.
 generateDye(r.cycle);
}
document.addEventListener('visibilitychange',()=>{
 if(document.hidden)ritualWasHidden=true;
 else if(ritualWasHidden){ritualWasHidden=false;restoreRitualMaterials();}
 r.soakLast=performance.now();
});
ritualCanvas.addEventListener('contextrestored',restoreRitualMaterials);
