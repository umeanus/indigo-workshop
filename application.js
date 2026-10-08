'use strict';
(()=>{
const WAX_ONLY=false;
const $=id=>document.getElementById(id), N=768, icon=(id)=>`<svg aria-hidden="true"><use href="#i-${id}"/></svg>`;
const make=(w=N,h=w)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
const ctx=(c)=>c.getContext('2d',{willReadFrequently:true});
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v)), lerp=(a,b,t)=>a+(b-a)*t, ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
const sleep=t=>new Promise(r=>setTimeout(r,t));
const serif='"Songti SC", "STSong", "Noto Serif CJK SC", "SimSun", serif';
let technique='wax', mode='draw', screen='home', tool='brush', symmetrical=false, brush=13;
let commands=[], activeStroke=null, drawingId=null,startTicket=0;
let photo=null, photoStyle='halftone', photoLight=.5, photoDetail=.55, photoDepth=.5, photoInverted=false, photoScale=1, photoX=0, photoY=0, photoBusy=false, photoJob=0;
const pointers=new Map(); let photoDrag=null;
const mask=make(), maskCtx=ctx(mask), photoMask=make(), photoMaskCtx=ctx(photoMask), view=$('drawCanvas'), viewCtx=ctx(view);
const paper=make(), paperCtx=ctx(paper), previewInk=make(), previewInkCtx=ctx(previewInk);
let toastTimer, previousFocus=null, modalCloseHook=null;
let currentResult=null, pendingPoster=null, gallery=[], memoryOnly=false;
let sound=false, audio=null, lastSound=0;
let seed=827361, sessionSeed=Date.now()>>>0;
function rand(){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;}
function noise(x,y,s=0){let n=Math.imul(x+374761393,y+668265263)^Math.imul(s+1,1274126177);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;}
function smoothNoise(x,y,s=0){const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;const a=fx*fx*(3-2*fx),b=fy*fy*(3-2*fy);return lerp(lerp(noise(ix,iy,s),noise(ix+1,iy,s),a),lerp(noise(ix,iy+1,s),noise(ix+1,iy+1,s),a),b);}
function toast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2900);}
function soundPlay(kind='tap'){
 if(!sound)return;try{audio=audio||new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();const now=audio.currentTime;if(kind==='brush'&&now-lastSound<.08)return;lastSound=now;
 if(kind==='water'||kind==='brush'||kind==='cloth'){const dur=kind==='water'?.8:kind==='cloth'?.38:.065,buffer=audio.createBuffer(1,audio.sampleRate*dur,audio.sampleRate),d=buffer.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,2);const src=audio.createBufferSource(),filter=audio.createBiquadFilter(),gain=audio.createGain();src.buffer=buffer;filter.type='lowpass';filter.frequency.value=kind==='water'?460:kind==='cloth'?1600:1200;gain.gain.value=kind==='water'?.08:.018;src.connect(filter);filter.connect(gain);gain.connect(audio.destination);src.start();
 }else{const o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.setValueAtTime(kind==='finish'?587:440,now);o.frequency.exponentialRampToValueAtTime(kind==='finish'?880:280,now+.32);g.gain.setValueAtTime(.028,now);g.gain.exponentialRampToValueAtTime(.001,now+.65);o.connect(g);g.connect(audio.destination);o.start();o.stop(now+.7);}}
 catch(e){sound=false;updateSound();}}
function updateSound(){if(!$('soundBtn'))return;$('soundBtn').innerHTML=icon(sound?'sound':'mute');$('soundBtn').setAttribute('aria-label',sound?'关闭音效':'开启音效');$('soundBtn').setAttribute('aria-pressed',String(sound));}
if($('soundBtn'))$('soundBtn').onclick=()=>{sound=!sound;updateSound();soundPlay();toast(sound?'音效已开启，轻轻听。':'音效已关闭。');};
function setStep(n){document.querySelectorAll('.step').forEach((s,i)=>{s.classList.toggle('active',i===n);s.classList.toggle('done',i<n);if(i===n)s.setAttribute('aria-current','step');else s.removeAttribute('aria-current');});}
function setScreen(s,options={}){
 const previous=screen;
 cancelWorkbenchPointers();
 if(s!=='editor'){startTicket++;photoSourcePreview=false;}
 if(previous==='mix'&&s!=='mix'&&typeof discardRecipeLab==='function')discardRecipeLab();
 if(previous==='ritual'&&s!=='ritual'){r.token++;r.drag=null;scrapeAuto=false;phase('idle');}
 if(s!=='ritual')stopMic();screen=s;
 for(const [id,name] of [['homePage','home'],['itemsPage','items'],['mixPage','mix'],['editorPage','editor'],['ritualPage','ritual'],['resultPage','result'],['galleryPage','gallery']]){const e=$(id);if(e)e.hidden=s!==name;}
 const workspace=['editor','ritual','result'].includes(s);document.body.dataset.workspace=String(workspace);$('app').dataset.screen=s;
 if(typeof syncGalleryNavigation==='function')syncGalleryNavigation(s);
 document.querySelector('.stepbar').hidden=!['editor','ritual'].includes(s);
 window.scrollTo({top:0,behavior:'instant'});
 if(s==='mix'){syncMixUI();runMixScene();}
 if(s==='editor'){setStep(1);renderEditor();updateEditorButtons();}
 if(s==='result')setStep(4);
 if(s==='home'&&typeof refreshHome==='function')refreshHome();
 if(typeof scheduleLayout==='function')scheduleLayout();
 if(typeof syncWorkshopChrome==='function')syncWorkshopChrome();
 if(options.history!==false&&previous!==s){try{history.pushState({yifanglan:true,screen:s},'',`#${s}`);}catch{}}
}
function openModal(title,html,hook=null){startTicket++;cancelWorkbenchPointers();if(typeof r!=='undefined'){r.drag=null;scrapeDrag=null;}if(!$('modal').hidden)closeModal();if(screen==='mix'){stopMixActivity();syncMixUI();}if(typeof r!=='undefined'&&r.phase==='untying'){r.untieDrag=null;r.untieAuto=false;r.untieToken++;updateUntieUI();}if(typeof r!=='undefined'&&r.phase==='drying'){stopFan();updateDryUI();}if(mic.state==='listening'||mic.state==='requesting'){stopMic();$('micStatus').textContent='麦克风已暂停，可重新开启';}previousFocus=document.activeElement;modalCloseHook=hook;$('sheetTitle').textContent=title;$('sheetBody').innerHTML=html;$('sheet').classList.remove('save-sheet');$('modal').hidden=false;document.body.style.overflow='hidden';$('closeModal').focus();}
function closeModal(){if($('modal').hidden)return;$('modal').hidden=true;document.body.style.overflow='';if(modalCloseHook)modalCloseHook();modalCloseHook=null;if(previousFocus&&previousFocus.isConnected)previousFocus.focus({preventScroll:true});if(screen==='mix'&&recipeLab){syncMixUI();runMixScene();}}
$('closeModal').onclick=closeModal;$('modal').addEventListener('click',e=>{if(e.target===$('modal'))closeModal();});
document.addEventListener('keydown',e=>{if(!$('modal').hidden){if(e.key==='Escape')closeModal();if(e.key==='Tab'){const f=[...$('sheet').querySelectorAll('button,input,[tabindex="0"],a[href]')].filter(x=>!x.disabled&&!x.hidden),first=f[0],last=f[f.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}}else if(screen==='editor'&&(e.ctrlKey||e.metaKey)&&!['INPUT','TEXTAREA'].includes(e.target?.tagName)){if(e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();}else if(e.key.toLowerCase()==='y'){e.preventDefault();redo();}}});
function ask(title,copy,action){openModal(title,`<p class="sheet-copy">${copy}</p><div class="confirm-row"><button class="outline-btn" id="cancelAsk">再想一下</button><button class="primary" id="confirmAsk">确定</button></div>`);$('cancelAsk').onclick=closeModal;$('confirmAsk').onclick=()=>{closeModal();action();};}
$('guideBtn').onclick=()=>openModal('画蜡留白','<div class="about-text"><p>画蜡的地方会挡住染液，去蜡后留下棉白。</p><p>照片会转成蜡稿：主体留白，细节留给蓝色。可在取景里调整留白或反转。</p></div>');


function cancelWorkbenchPointers(){
 if(typeof cancelTieGesture==='function')cancelTieGesture();
 if(typeof cancelTiePlanPointer==='function')cancelTiePlanPointer();
 const id=drawingId,changed=!!activeStroke;drawingId=null;activeStroke=null;
 if(id!==null)try{view.releasePointerCapture(id);}catch{}
 for(const pointerId of pointers.keys())try{view.releasePointerCapture(pointerId);}catch{}
 pointers.clear();photoDrag=null;if(changed){saveDraft();updateEditorButtons();}
}


// Digital botanical color studies: ratios control an illustration, not a dye recipe.
// Keep the original four keys so existing local recipes retain their quantities.
const PIGMENTS={
 indigo:{label:'靛蓝',source:'蓝草制靛',tone:[29,80,139],name:'蓝草初染'},
 madder:{label:'茜草红',source:'茜草根',tone:[177,86,74],name:'茜草暖绛'},
 ochre:{label:'槐米黄',source:'槐树花蕾',tone:[190,153,56],name:'槐米秋金'},
 green:{label:'黄蓝叠绿',source:'黄檗黄与靛蓝叠染',tone:[85,125,99],name:'春山叠绿'},
 tannin:{label:'茶褐',source:'茶叶 · 旧配方可继续用',tone:[112,91,65],name:'茶山烟褐'}
};
const RECIPE_STORE='yifanglan-dye-recipes-v1',RECIPE_LIMIT=20,PIGMENT_LIMIT=24;
const PREPARED_COLORS=['indigo','madder','ochre','green'];
const LEGACY_PIGMENTS=['indigo','madder','ochre','tannin'];
const emptyRecipeUnits=()=>Object.fromEntries(Object.keys(PIGMENTS).map(key=>[key,0]));
function makePreparedRecipe(key='indigo'){
 const units=emptyRecipeUnits();units[PIGMENTS[key]?key:'indigo']=3;
 return refreshDyeRecipe({units,water:4,mixed:true,name:'',family:key,label:'',tones:[]});
}
let dyeRecipe=makePreparedRecipe(),recipeLab=null,recipeLabReturn='editor';
const MIX_BOWL={x:384,y:162,rx:274,ry:104},MIX_STIR_TURN=Math.PI*2.2;
let savedRecipes=[],recipeStoreReadable=true,recipeStoreMessage='',mixRaf=0,mixStirProgress=1,mixStirAngle=0,mixStirVelocity=0,mixPointer=null,mixAutoToken=0,mixAnimating=false,mixStirAnnounced=false;
let mixSpoonPoint={x:551,y:114};
const mixCanvas=$('mixCanvas'),mixCtx=ctx(mixCanvas),mixMotionReduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function mixRecipe(){return recipeLab||dyeRecipe;}
function recipePigmentTotal(recipe=dyeRecipe){return Object.keys(PIGMENTS).reduce((sum,key)=>sum+(recipe.units[key]||0),0);}
function recipeTone(recipe=dyeRecipe){
 const total=recipePigmentTotal(recipe);if(!total)return [219,226,208];
 const active=Object.keys(PIGMENTS).filter(k=>recipe.units[k]>0),tone=[0,0,0];
 // Muted digital interpolation. Green is a pre-composed over-dye color study,
 // never a claim that stirring yellow and indigo makes a working green dye vat.
 for(let ch=0;ch<3;ch++){let density=0;for(const key of active)density+=recipe.units[key]/total*Math.log(Math.max(.02,PIGMENTS[key].tone[ch]/255));tone[ch]=255*Math.exp(density);}
 const concentration=total/recipe.water,lighten=clamp((.75-concentration)*.57,0,.30),darken=clamp((concentration-.75)*.12,0,.28);
 return tone.map((v,ch)=>Math.round(lerp(v*(1-darken),[223,224,202][ch],lighten)));
}
function refreshDyeRecipe(recipe=dyeRecipe){
 const active=Object.keys(PIGMENTS).filter(k=>recipe.units[k]>0);
 recipe.family=active.length===1?active[0]:'mixed';
 recipe.label=!active.length?'清水待染':active.length===1?PIGMENTS[active[0]].name:active.includes('indigo')&&active.includes('madder')?'草木烟紫':active.includes('madder')&&active.includes('ochre')?'落日赭红':'草木和色';
 const base=recipeTone(recipe);recipe.tones=[base,base.map(v=>Math.max(12,Math.round(v*.79))),base.map(v=>Math.max(9,Math.round(v*.64)))];
 return recipe;
}
function getDyeTone(cycle=1){return (dyeRecipe.tones[clamp(Math.round(cycle)-1,0,2)]||recipeTone()).slice();}
function isIndigoRecipe(){return dyeRecipe.family==='indigo';}
function getDevelopTone(cycle=1){
 if(isIndigoRecipe()){const indigoGreens=[[122,148,118],[87,120,101],[68,102,88]],reference=indigoGreens[clamp(Math.round(cycle)-1,0,2)],base=getDyeTone(cycle),factor=(base[0]+base[1]+base[2])/(49+98+140);return reference.map(v=>Math.round(clamp(v*(.80+.20*factor),0,255)));}
 const base=getDyeTone(cycle);return base.map((v,ch)=>Math.round(lerp(v,[214,204,177][ch],.63)));
}
function recipeSummary(recipe=dyeRecipe){return Object.keys(PIGMENTS).filter(k=>recipe.units[k]>0).map(k=>`${PIGMENTS[k].label} ${recipe.units[k]} 份`).concat(`水感 ${recipe.water} 份`).join(' · ');}
function colorCSS(tone,alpha=1){return alpha===1?`rgb(${tone.map(Math.round).join(',')})`:`rgba(${tone.map(Math.round).join(',')},${alpha})`;}
function mixSnapshot(recipe=dyeRecipe){return {units:{...emptyRecipeUnits(),...recipe.units},water:recipe.water,mixed:recipe.mixed,name:recipe.name,family:recipe.family,label:recipe.label,tones:recipe.tones.map(t=>t.slice())};}
function stopMixActivity(){mixAutoToken++;mixAnimating=false;endMixPointer();mixStirVelocity=0;mixStirAnnounced=false;if(mixRaf){cancelAnimationFrame(mixRaf);mixRaf=0;}}
function enterRecipeLab(){
 if(recipeLab&&screen==='mix')return;
 stopMixActivity();recipeLabReturn=screen==='mix'?'editor':screen;recipeLab=mixSnapshot();mixStirProgress=recipeLab.mixed?1:0;
 setScreen('mix');
}
// Core navigation calls this when leaving the activity by Home, Works or Back.
// dyeRecipe and all drawing/photo state stay untouched until explicit commit.
function discardRecipeLab(){stopMixActivity();recipeLab=null;mixStirProgress=dyeRecipe.mixed?1:0;syncMixUI();}
function leaveRecipeLab(commit=false){
 if(commit&&(!recipeLab||!recipeLab.mixed||!recipePigmentTotal(recipeLab)))return false;
 const target=commit?(['home','items','gallery'].includes(recipeLabReturn)?'items':'editor'):recipeLabReturn;
 if(commit)dyeRecipe=mixSnapshot(recipeLab);
 discardRecipeLab();
 if(commit&&photo)renderPhoto();
 setScreen(target==='mix'?'editor':target);return true;
}
function validStoredRecipe(item){
 if(!item||typeof item!=='object'||typeof item.name!=='string'||!item.name.trim()||item.name.length>20||!item.units||typeof item.units!=='object'||!Number.isInteger(item.water)||item.water<1||item.water>12)return null;
 const units={};for(const key of Object.keys(PIGMENTS)){const n=item.units[key]===undefined&&!LEGACY_PIGMENTS.includes(key)?0:item.units[key];if(!Number.isInteger(n)||n<0||n>PIGMENT_LIMIT)return null;units[key]=n;}
 const total=Object.values(units).reduce((a,b)=>a+b,0);if(total<1||total>PIGMENT_LIMIT)return null;
 return {id:typeof item.id==='string'?item.id:('recipe-'+Date.now()+'-'+Math.random().toString(36).slice(2,8)),name:item.name.trim(),units,water:item.water,date:Number(item.date)||Date.now()};
}
function loadStoredRecipes(){
 try{const raw=localStorage.getItem(RECIPE_STORE);if(!raw){savedRecipes=[];return;}const parsed=JSON.parse(raw);if(!Array.isArray(parsed)||parsed.length>RECIPE_LIMIT)throw new Error('invalid recipes');const items=parsed.map(validStoredRecipe);if(items.some(x=>!x))throw new Error('invalid recipe entry');savedRecipes=items;}
 catch(err){recipeStoreReadable=false;recipeStoreMessage='暂时无法读取本机配方，现有记录不会被覆盖。仍可调色和创作。';}
}
function persistRecipes(next){
 if(!recipeStoreReadable){toast(recipeStoreMessage);return false;}
 if(next.length>RECIPE_LIMIT){recipeStoreMessage='已存满 20 份配方，请先删除不需要的一份。';return false;}
 try{localStorage.setItem(RECIPE_STORE,JSON.stringify(next));savedRecipes=next;recipeStoreMessage='';syncMixUI();return true;}
 catch(err){recipeStoreMessage='配方未保存：浏览器储存不可用或空间不足，请释放空间后重试。';return false;}
}
function syncMixUI(){
 const recipe=mixRecipe(),total=recipePigmentTotal(recipe);
 for(const key of Object.keys(PIGMENTS)){const output=$(key+'Units');if(output)output.textContent=(recipe.units[key]||0)+' 份';const minus=document.querySelector(`[data-remove-pigment="${key}"]`);if(minus)minus.disabled=!recipe.units[key];}
 $('waterUnits').textContent=recipe.water+' 份';$('lessWaterBtn').disabled=recipe.water<=1;$('moreWaterBtn').disabled=recipe.water>=12;
 $('mixToneName').textContent=recipe.name||recipe.label;$('mixFormulaText').textContent=recipeSummary(recipe);$('mixSwatch').style.background=colorCSS(recipeTone(recipe));
 $('mixReadyBtn').disabled=!recipe.mixed||total===0;$('saveRecipeBtn').disabled=!recipe.mixed||total===0;$('stirMixBtn').disabled=total===0||mixAnimating;
 $('stirMixBtn').querySelector('span').textContent=mixAnimating?'搅拌中':recipe.mixed?'再搅一搅':'搅一搅';$('recipeCount').textContent=savedRecipes.length;
 $('mixProgressFill').style.width=Math.round(mixStirProgress*100)+'%';$('mixProgress').setAttribute('aria-valuenow',String(Math.round(mixStirProgress*100)));
 const status=total===0?'先添一点草木色':mixPointer?'顺着手指，慢慢画圈':recipe.mixed?'颜色已备好 · 可画圈搅动':mixStirProgress>0?'继续画圈，搅匀颜色':'在碗里画圈，搅匀草木色';if($('mixStatus').textContent!==status)$('mixStatus').textContent=status;
 if($('mixColorNote'))$('mixColorNote').textContent=recipe.units.green?'黄蓝叠绿借鉴黄檗黄与靛蓝的叠染色意；这里用预制色样呈现。':'份数只决定屏幕里的浓淡与配色，不是实际染色用量。';
 document.querySelectorAll('[data-lab-palette]').forEach(button=>button.setAttribute('aria-pressed',String(recipe.family===button.dataset.labPalette)));
 if($('studioRecipeName')){$('studioRecipeName').textContent=dyeRecipe.name||dyeRecipe.label;document.querySelectorAll('[data-studio-dye]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.studioDye===dyeRecipe.family)));}
 if($('editorRecipeName'))$('editorRecipeName').textContent=(dyeRecipe.name||dyeRecipe.label)+' · 染液已备好';if($('editorRecipeDot'))$('editorRecipeDot').style.background=colorCSS(getDyeTone());
}
function changedMix(){
 stopMixActivity();mixStirProgress=0;const recipe=mixRecipe();recipe.mixed=false;recipe.name='';refreshDyeRecipe(recipe);syncMixUI();drawMixScene(performance.now()/1000);if(screen==='mix')runMixScene();
}
function addPigment(key,delta){if(!recipeLab||!PIGMENTS[key])return;if(delta>0&&recipePigmentTotal(recipeLab)>=PIGMENT_LIMIT){toast('这碗色最多 24 份，可先减一点再调整。');return;}recipeLab.units[key]=clamp((recipeLab.units[key]||0)+delta,0,PIGMENT_LIMIT);changedMix();mixStirVelocity=1.7;soundPlay('water');}
function finishMix(){if(!recipeLab||!recipePigmentTotal(recipeLab))return;mixStirProgress=1;recipeLab.mixed=true;mixAnimating=false;syncMixUI();if(!mixStirAnnounced){mixStirAnnounced=true;toast('颜色调好了');}}
function stirMixButton(){
 if(!recipeLab||!recipePigmentTotal(recipeLab)||mixAnimating)return;endMixPointer();const token=++mixAutoToken,start=performance.now(),from=recipeLab.mixed?0:mixStirProgress,startAngle=mixPointerAngle(mixSpoonPoint);mixAnimating=true;mixStirProgress=from;recipeLab.mixed=false;mixStirAnnounced=false;syncMixUI();soundPlay('water');
 function tick(now){if(token!==mixAutoToken||!recipeLab)return;if(screen!=='mix'){mixAnimating=false;syncMixUI();return;}const t=clamp((now-start)/(mixMotionReduced?450:1500));mixStirProgress=lerp(from,1,t);if(!mixMotionReduced){mixStirAngle=startAngle+t*Math.PI*3;mixSpoonPoint={x:MIX_BOWL.x+Math.cos(mixStirAngle)*186,y:MIX_BOWL.y+Math.sin(mixStirAngle)*70};}mixStirVelocity=mixMotionReduced?0:5*(1-t*.45);$('mixProgressFill').style.width=Math.round(mixStirProgress*100)+'%';$('mixProgress').setAttribute('aria-valuenow',String(Math.round(mixStirProgress*100)));drawMixScene(mixMotionReduced?0:now/1000);if(t<1)requestAnimationFrame(tick);else{mixStirVelocity=0;finishMix();}}requestAnimationFrame(tick);
}
function mixPoint(e){const box=mixCanvas.getBoundingClientRect();return {x:(e.clientX-box.left)*768/box.width,y:(e.clientY-box.top)*400/box.height};}
function mixBowlRadius(p){return Math.hypot((p.x-MIX_BOWL.x)/MIX_BOWL.rx,(p.y-MIX_BOWL.y)/MIX_BOWL.ry);}
function mixPointerAngle(p){return Math.atan2((p.y-MIX_BOWL.y)/MIX_BOWL.ry,(p.x-MIX_BOWL.x)/MIX_BOWL.rx);}
function isInMixBowl(p){return mixBowlRadius(p)<1;}
function endMixPointer(e){
 if(!mixPointer||(e&&e.pointerId!==mixPointer.id))return;
 const id=mixPointer.id;mixPointer=null;mixStirVelocity=0;mixCanvas.classList?.remove('is-stirring');
 try{mixCanvas.releasePointerCapture(id);}catch{}
 if(screen==='mix'){syncMixUI();drawMixScene(mixMotionReduced?0:performance.now()/1000);}
}
function moveMixSpoon(p){
 const previous=mixPointer.point,angle=mixPointerAngle(p),nearCenter=mixBowlRadius(p)<.17;
 mixSpoonPoint={x:p.x,y:p.y};mixPointer.point=p;
 // A straight pass through the center is not a circle. Check the segment as
 // well as its endpoints, since touch events can skip the center entirely.
 const ax=(previous.x-MIX_BOWL.x)/MIX_BOWL.rx,ay=(previous.y-MIX_BOWL.y)/MIX_BOWL.ry,bx=(p.x-MIX_BOWL.x)/MIX_BOWL.rx,by=(p.y-MIX_BOWL.y)/MIX_BOWL.ry,dx=bx-ax,dy=by-ay;
 const along=clamp(-(ax*dx+ay*dy)/(dx*dx+dy*dy||1)),crossesCenter=Math.hypot(ax+dx*along,ay+dy*along)<.17;
 let d=0;if(!nearCenter&&!crossesCenter&&mixPointer.angle!==null){d=angle-mixPointer.angle;while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;if(Math.abs(d)>Math.PI*.65)d=0;}
 mixPointer.angle=nearCenter?null:angle;mixStirAngle+=d;mixStirVelocity=clamp(d*35,-6,6);
 if(!mixRecipe().mixed&&d){mixStirProgress=clamp(mixStirProgress+Math.abs(d)/MIX_STIR_TURN);if(mixStirProgress>=1)finishMix();else syncMixUI();}
 drawMixScene(mixMotionReduced?0:performance.now()/1000);
}
mixCanvas.addEventListener('pointerdown',e=>{
 if(screen!=='mix'||!recipeLab||mixAnimating||mixPointer||!recipePigmentTotal(recipeLab)||(e.button!==undefined&&e.button!==0)||e.isPrimary===false)return;
 const p=mixPoint(e);if(!isInMixBowl(p))return;e.preventDefault();
 mixPointer={id:e.pointerId,point:p,angle:mixBowlRadius(p)<.17?null:mixPointerAngle(p)};mixSpoonPoint={x:p.x,y:p.y};mixStirVelocity=0;
 try{mixCanvas.setPointerCapture(e.pointerId);}catch{}mixCanvas.classList?.add('is-stirring');syncMixUI();drawMixScene(mixMotionReduced?0:performance.now()/1000);soundPlay('water');
});
mixCanvas.addEventListener('pointermove',e=>{
 if(!mixPointer||e.pointerId!==mixPointer.id)return;if(screen!=='mix'){endMixPointer(e);return;}e.preventDefault();
 const samples=typeof e.getCoalescedEvents==='function'?e.getCoalescedEvents():[];
 for(const sample of samples.length?samples:[e]){const p=mixPoint(sample);if(!isInMixBowl(p)){endMixPointer(e);return;}moveMixSpoon(p);}
});
mixCanvas.addEventListener('pointerup',endMixPointer);mixCanvas.addEventListener('pointercancel',endMixPointer);mixCanvas.addEventListener('pointerleave',endMixPointer);mixCanvas.addEventListener('lostpointercapture',endMixPointer);
mixCanvas.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();stirMixButton();}});
function drawMixScene(t=0){
 const c=mixCtx,w=768,h=400,tone=recipeTone(mixRecipe()),hasPigment=recipePigmentTotal(mixRecipe())>0; c.clearRect(0,0,w,h);c.save();
 // Unglazed stoneware. The rim and shadow remain still while liquid circles inside it.
 let g=c.createRadialGradient(386,287,25,386,287,295);g.addColorStop(0,'#3b3a2d25');g.addColorStop(.7,'#3b3a2d16');g.addColorStop(1,'#3b3a2d00');c.fillStyle=g;c.beginPath();c.ellipse(386,290,305,60,0,0,Math.PI*2);c.fill();
 g=c.createLinearGradient(0,175,0,319);g.addColorStop(0,'#a7977b');g.addColorStop(.4,'#80715c');g.addColorStop(.8,'#72634d');g.addColorStop(1,'#9d8a6c');c.fillStyle=g;c.beginPath();c.moveTo(78,172);c.bezierCurveTo(105,381,652,381,690,172);c.closePath();c.fill();
 c.strokeStyle='#d4c4a333';c.lineWidth=1;for(let i=0;i<17;i++){c.beginPath();c.ellipse(384,193+i*5,296-i*4.8,85-i*.7,0,.10,Math.PI-.10);c.stroke();}
 g=c.createLinearGradient(0,42,0,284);g.addColorStop(0,'#c5b697');g.addColorStop(.40,'#ae9b78');g.addColorStop(.7,'#8c795a');g.addColorStop(1,'#d3c1a1');c.fillStyle=g;c.beginPath();c.ellipse(384,165,310,133,-.015,0,Math.PI*2);c.fill();c.lineWidth=1.6;c.strokeStyle='#847258';c.stroke();
 c.save();c.beginPath();c.ellipse(384,162,282,111,-.014,0,Math.PI*2);c.clip();
 const liquid=tone.map(v=>Math.max(12,v*.69)),light=tone.map((v,i)=>lerp(v,[202,220,192][i],.18));g=c.createRadialGradient(317,117,10,391,170,314);g.addColorStop(0,colorCSS(light));g.addColorStop(.48,colorCSS(tone));g.addColorStop(1,colorCSS(liquid));c.fillStyle=g;c.fillRect(84,33,600,275);
 c.save();c.translate(384,165);c.scale(1,.395);c.rotate(mixStirAngle*.15);const active=Object.keys(PIGMENTS).filter(k=>mixRecipe().units[k]>0),unmixed=1-mixStirProgress;
 if(hasPigment&&unmixed>.01){for(let i=0;i<active.length;i++){const pigment=PIGMENTS[active[i]],a=(i/active.length)*Math.PI*2+.6;c.save();c.rotate(a+mixStirAngle*.6);const pg=c.createRadialGradient(139,0,10,139,0,123);pg.addColorStop(0,colorCSS(pigment.tone,.67*unmixed));pg.addColorStop(.65,colorCSS(pigment.tone,.35*unmixed));pg.addColorStop(1,colorCSS(pigment.tone,0));c.fillStyle=pg;c.fillRect(10,-130,262,260);c.restore();}}
 const motion=mixMotionReduced?0:t*.24;for(let j=0;j<9;j++){const radius=29+j*25,angle=j*.72+mixStirAngle+motion;c.lineWidth=j%3===0?3.2:1.4;c.strokeStyle=colorCSS(j%2?light:liquid,j%2?.30:.18);c.beginPath();c.arc(0,0,radius,angle,angle+1.9+.35*Math.sin(j));c.stroke();}
 if(!mixMotionReduced&&Math.abs(mixStirVelocity)>.15){for(let j=0;j<3;j++){c.lineWidth=3;c.strokeStyle=colorCSS(light,.25);c.beginPath();const a=mixStirAngle-j*.7;for(let k=0;k<65;k++){const r=24+k*3.4,ang=a+k*.046;const x=Math.cos(ang)*r,y=Math.sin(ang)*r;if(!k)c.moveTo(x,y);else c.lineTo(x,y);}c.stroke();}}
 c.restore();
 // Floating pale foam and small pigment flecks, sparse enough to leave the liquid legible.
 for(let i=0;i<39;i++){const a=i*2.399+mixStirAngle*.035,rr=35+Math.sqrt((i*37)%90/90)*233,xx=384+Math.cos(a)*rr,yy=165+Math.sin(a)*rr*.36;c.fillStyle=i%3===0?'#eff2d43b':'#f7eed922';c.beginPath();c.ellipse(xx,yy,.8+(i%3)*.6,.7+(i%2)*.4,0,0,Math.PI*2);c.fill();}
 c.restore();
 c.strokeStyle='#604e3660';c.lineWidth=5;c.beginPath();c.ellipse(384,162,283,112,-.014,0,Math.PI*2);c.stroke();c.strokeStyle='#e8d6b667';c.lineWidth=2;c.beginPath();c.ellipse(384,160,300,125,-.014,Math.PI*1.05,Math.PI*1.85);c.stroke();
 // The immersed spoon head is exactly under the finger. Its long handle and
 // contact ripples make every part of a circle visible, even on a small phone.
 const spoon=mixSpoonPoint,spoonTilt=.38+Math.cos(mixPointerAngle(spoon))*.22;
 c.save();c.beginPath();c.ellipse(384,162,280,109,-.014,0,Math.PI*2);c.clip();
 if(mixPointer||mixAnimating){for(let i=0;i<3;i++){c.strokeStyle=colorCSS(light,.34-i*.08);c.lineWidth=2-i*.35;c.beginPath();c.ellipse(spoon.x,spoon.y+5,25+i*14,8+i*5,0,0,Math.PI*2);c.stroke();}}
 c.fillStyle='#1a261b24';c.beginPath();c.ellipse(spoon.x+6,spoon.y+10,21,9,0,0,Math.PI*2);c.fill();c.restore();
 c.save();c.translate(spoon.x,spoon.y);c.rotate(spoonTilt);c.shadowColor='#17231538';c.shadowBlur=6;c.shadowOffsetX=3;c.shadowOffsetY=5;
 g=c.createLinearGradient(-9,0,10,0);g.addColorStop(0,'#88633d');g.addColorStop(.3,'#c6a778');g.addColorStop(.65,'#e7cea2');g.addColorStop(1,'#97734a');c.fillStyle=g;
 c.beginPath();c.roundRect(-6,-120,13,114,6);c.fill();c.beginPath();c.ellipse(0,0,15,24,0,0,Math.PI*2);c.fill();c.shadowColor='transparent';
 c.strokeStyle='#7d593f70';c.lineWidth=1.2;c.beginPath();c.ellipse(0,0,10,17,0,0,Math.PI*2);c.stroke();c.beginPath();c.moveTo(1,-110);c.lineTo(1,-22);c.stroke();
 c.fillStyle=colorCSS(tone,.38);c.beginPath();c.ellipse(0,7,11,12,0,0,Math.PI*2);c.fill();c.restore();
 c.restore();
}
function runMixScene(){if(mixRaf)return;let last=0;function frame(now){if(screen!=='mix'){mixRaf=0;return;}if(now-last>32){const dt=last?Math.min(.06,(now-last)/1000):0;if(!mixPointer&&!mixAnimating){mixStirAngle+=mixStirVelocity*dt;mixStirVelocity*=.94;}drawMixScene(mixMotionReduced?0:now/1000);last=now;}mixRaf=requestAnimationFrame(frame);}mixRaf=requestAnimationFrame(frame);}
function openSaveRecipe(){
 const recipe=mixRecipe();if(!recipe.mixed||!recipePigmentTotal(recipe)){toast('先把这碗色搅匀，再留下配方。');return;}if(!recipeStoreReadable){toast(recipeStoreMessage);return;}if(savedRecipes.length>=RECIPE_LIMIT){toast('已存满 20 份配方。可先删除不需要的一份，再保存。');openRecipeCollection();return;}
 const proposed=recipe.name||recipe.label;openModal('存为草木配方',`<div class="recipe-save-form"><p class="sheet-copy">${escapeHTML(recipeSummary(recipe))}</p><label for="recipeNameInput">给这碗色起个名字</label><input id="recipeNameInput" class="recipe-name-input" maxlength="20" value="${escapeHTML(proposed)}" placeholder="例如：山雨后的一碗蓝" autocomplete="off"><p class="recipe-form-error" id="recipeFormError" role="alert"></p><button class="primary" id="confirmSaveRecipe">保存这份配方</button><p class="recipe-store-status">只存在当前浏览器，最多 20 份，不会自动删除旧配方。清理浏览器数据会丢失。</p></div>`);
 $('recipeNameInput').focus();$('recipeNameInput').select();$('confirmSaveRecipe').onclick=()=>{const name=$('recipeNameInput').value.trim();if(!name||name.length>20){$('recipeFormError').textContent='请输入 1 至 20 字的配方名。';$('recipeNameInput').focus();return;}if(savedRecipes.some(x=>x.name===name)){$('recipeFormError').textContent='已有同名配方，请换一个名字。';return;}if(savedRecipes.length>=RECIPE_LIMIT){$('recipeFormError').textContent='已存满 20 份，请先删除不需要的配方。';return;}const item={id:`dye-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,name,units:{...recipe.units},water:recipe.water,date:Date.now()};if(!persistRecipes([item,...savedRecipes])){$('recipeFormError').textContent=recipeStoreMessage;return;}recipe.name=name;syncMixUI();closeModal();toast(`草木配方「${name}」已留在本机。`);};$('recipeNameInput').onkeydown=e=>{if(e.key==='Enter')$('confirmSaveRecipe').click();};
}
function useReadyRecipe(recipe){
 stopMixActivity();const ready=refreshDyeRecipe({...recipe,units:{...emptyRecipeUnits(),...recipe.units},mixed:true});
 if(recipeLab)recipeLab=ready;else dyeRecipe=ready;
 mixStirProgress=1;closeModal();syncMixUI();
 if(recipeLab){drawMixScene();runMixScene();}else{if(photo)renderPhoto();if(screen==='editor')renderEditor();}
 if(screen==='ritual'&&r.phase==='dipReady'){generateDye(1);syncStudio();}
 toast(`已选用「${ready.name||ready.label}」。`);
}
function applySavedRecipe(item){const valid=validStoredRecipe(item);if(!valid){toast('这份配方暂时无法取用，原记录仍保留。');return false;}useReadyRecipe({...valid,mixed:true,tones:[]});return true;}
function choosePreparedColor(key){if(!PREPARED_COLORS.includes(key))return;useReadyRecipe(makePreparedRecipe(key));}
function preparedPaletteHTML(){return `<div class="prepared-palette" aria-label="已备好的草木色">${PREPARED_COLORS.map(key=>{const pigment=PIGMENTS[key];return `<button class="prepared-color" data-ready-color="${key}" aria-label="选用${pigment.name}"><span class="prepared-cloth" style="--swatch:${colorCSS(pigment.tone)}" aria-hidden="true"></span><strong>${pigment.name}</strong><small>${key==='green'?'黄檗黄 × 靛蓝叠染':pigment.source}</small></button>`;}).join('')}</div>`;}
function recipeCollectionHTML(){return `${savedRecipes.length?`<div class="recipe-list">${savedRecipes.map((item,i)=>`<div class="saved-recipe"><span class="mix-swatch" style="background:${colorCSS(recipeTone(item))}" aria-hidden="true"></span><div class="saved-recipe-copy"><strong>${escapeHTML(item.name)}</strong><small>${escapeHTML(recipeSummary(item))}</small></div><div class="saved-recipe-actions"><button class="saved-recipe-use" data-use-recipe="${i}">选用</button><button class="saved-recipe-delete" data-delete-recipe="${i}" aria-label="删除配方 ${escapeHTML(item.name)}">×</button></div></div>`).join('')}</div>`:'<div class="recipe-empty">还没有留下配方<br>去草木配方里，慢慢调一碗喜欢的色</div>'}<p class="recipe-store-status">${recipeStoreMessage?escapeHTML(recipeStoreMessage):`已存 ${savedRecipes.length} / ${RECIPE_LIMIT} 份 · 仅保存在当前浏览器<br>达到上限会提醒你，不会自动删掉旧配方`}</p>`;}
function bindRecipeCollection(reopen){
 document.querySelectorAll('[data-ready-color]').forEach(b=>b.onclick=()=>choosePreparedColor(b.dataset.readyColor));
 document.querySelectorAll('[data-use-recipe]').forEach(b=>b.onclick=()=>applySavedRecipe(savedRecipes[+b.dataset.useRecipe]));
 document.querySelectorAll('[data-delete-recipe]').forEach(b=>b.onclick=()=>{const item=savedRecipes[+b.dataset.deleteRecipe];ask('删掉这份配方？',`「${escapeHTML(item.name)}」将从当前浏览器删除。这个操作不能撤回，已染好的布不会受影响。`,()=>{const next=savedRecipes.filter(x=>x.id!==item.id);if(persistRecipes(next)){reopen();toast('已删除这份配方。');}else{reopen();toast(recipeStoreMessage);}});});
}
function chooseRecipe(){openModal('选一碗草木色',`<p class="sheet-copy">靛蓝已备好，也可以换一种颜色，接着完成这方布。</p>${preparedPaletteHTML()}<h4 class="recipe-section-title">我的草木配方</h4>${recipeCollectionHTML()}<p class="recipe-palette-note">绿色借鉴黄檗黄与靛蓝的叠染。色样与份数是艺术模拟。</p>`);bindRecipeCollection(chooseRecipe);}
function openRecipeCollection(){openModal('已存草木配方',`<p class="sheet-copy">喜欢的颜色，再用一次。选用后已备好，可以直接创作。</p>${recipeCollectionHTML()}`);bindRecipeCollection(openRecipeCollection);}
function selectLabPalette(key){if(!recipeLab||!PREPARED_COLORS.includes(key))return;stopMixActivity();recipeLab=makePreparedRecipe(key);mixStirProgress=1;syncMixUI();drawMixScene();runMixScene();soundPlay('water');}
document.querySelectorAll('[data-add-pigment]').forEach(b=>b.onclick=()=>addPigment(b.dataset.addPigment,1));document.querySelectorAll('[data-remove-pigment]').forEach(b=>b.onclick=()=>addPigment(b.dataset.removePigment,-1));
document.querySelectorAll('[data-lab-palette]').forEach(b=>b.onclick=()=>selectLabPalette(b.dataset.labPalette));
$('moreWaterBtn').onclick=()=>{if(recipeLab&&recipeLab.water<12){recipeLab.water++;changedMix();soundPlay('water');}};$('lessWaterBtn').onclick=()=>{if(recipeLab&&recipeLab.water>1){recipeLab.water--;changedMix();}};
$('stirMixBtn').onclick=stirMixButton;$('mixReadyBtn').onclick=()=>leaveRecipeLab(true);
$('saveRecipeBtn').onclick=openSaveRecipe;$('openRecipesBtn').onclick=openRecipeCollection;
if($('openMixBtn'))$('openMixBtn').onclick=chooseRecipe;
if($('chooseRecipeBtn'))$('chooseRecipeBtn').onclick=chooseRecipe;
if($('leaveRecipeLabBtn'))$('leaveRecipeLabBtn').onclick=()=>leaveRecipeLab(false);
$('resetMixBtn').onclick=()=>{if(!recipeLab)return;ask('重新调一碗？','这一碗会回到靛蓝色样，已保存的配方会保留。',()=>selectLabPalette('indigo'));};
loadStoredRecipes();syncMixUI();


// A compact plain weave built from individual spun yarns, not an overlaid grid.
// Yarn geometry is fixed; only the small capillary blooms vary with each work seed.
const textile={fiber:null,absorb:null,paper:null,preview:null,bleed:null,bleedSeed:null,bleedMask:null,waxPaper:null,waxCaches:new Map(),waxTargets:new WeakMap(),resists:new WeakMap(),edgeX:null,edgeY:null};
let photoTextile=null,photoSourcePreview=false;
function textileBlur(src,w,h,r){
 const tmp=new Float32Array(src.length),out=new Float32Array(src.length),div=2*r+1;
 for(let y=0;y<h;y++){const off=y*w;let sum=0;for(let k=-r;k<=r;k++)sum+=src[off+clamp(k,0,w-1)];for(let x=0;x<w;x++){tmp[off+x]=sum/div;sum+=src[off+Math.min(w-1,x+r+1)]-src[off+Math.max(0,x-r)];}}
 for(let x=0;x<w;x++){let sum=0;for(let k=-r;k<=r;k++)sum+=tmp[clamp(k,0,h-1)*w+x];for(let y=0;y<h;y++){out[y*w+x]=sum/div;sum+=tmp[Math.min(h-1,y+r+1)*w+x]-tmp[Math.max(0,y-r)*w+x];}}return out;
}
function textileSample(a,x,y,w=480){x=clamp(x,0,w-1);y=clamp(y,0,w-1);const ix=x|0,iy=y|0,fx=x-ix,fy=y-iy,j=iy*w+ix,nx=Math.min(ix+1,w-1),ny=Math.min(iy+1,w-1);return lerp(lerp(a[j],a[iy*w+nx],fx),lerp(a[ny*w+ix],a[ny*w+nx],fx),fy);}
function textilePreviewCache(){
 if(textile.preview)return textile.preview;const S=480,size=S*S,p={fiber:new Float32Array(size),absorb:new Float32Array(size),dx:new Float32Array(size),dy:new Float32Array(size)};
 // Area sampling keeps individual yarns from turning into moire during crop gestures.
 for(let y=0;y<S;y++)for(let x=0;x<S;x++){const i=y*S+x,xx=(x+.5)*N/S-.5,yy=(y+.5)*N/S-.5;p.fiber[i]=(textileSample(textile.fiber,xx-.28,yy-.28,N)+textileSample(textile.fiber,xx+.28,yy+.28,N))*.5;p.absorb[i]=textileSample(textile.absorb,xx,yy,N);p.dx[i]=(smoothNoise(x/9,y/9,44)-.5)*1.15;p.dy[i]=(smoothNoise(x/11,y/11,63)-.5)*1.15;}textile.preview=p;return p;
}
const textileLightPalettes={blue:[106,158,192],green:[160,190,154],red:[215,161,143],yellow:[223,198,124]};
function textileDyeLight(tone){return tone[1]>tone[2]*1.06&&tone[1]>tone[0]?textileLightPalettes.green:tone[0]>tone[2]*1.1?(tone[1]>tone[0]*.72?textileLightPalettes.yellow:textileLightPalettes.red):textileLightPalettes.blue;}
function textilePhotoPixel(out,k,resist,tone,fiber,absorb,wax=false,bleed=0){
 // Alpha always means protected cloth. Dye concentration and yarn relief are
 // evaluated together, so the photograph belongs to the same woven substrate.
 const a=clamp(resist),ink=1-a,cream=wax?[239,229,184]:[247,247,241];
 const seep=wax?0:bleed*Math.pow(a,3.2);
 // Vary optical concentration along a blue palette instead of multiplying all
 // RGB channels into grey/black clouds. The deepest bath colour is a floor.
 const variation=clamp(.25+absorb*1.9,.025,.62);
 const lights=textileDyeLight(tone);
 for(let ch=0;ch<3;ch++){
  const light=lights[ch],dyed=lerp(tone[ch],Math.max(tone[ch],light),variation),undyed=lerp(cream[ch],tone[ch],seep),base=lerp(dyed,undyed,a);
  out[k+ch]=base+fiber*(.22+.36*base/255)*(wax?1-a*.47:1);
 }out[k+3]=255;
}
function createPaper(){
 const waxPaper=textile.waxPaper=new Uint8ClampedArray(N*N*4),edgeX=textile.edgeX=new Float32Array(N*N),edgeY=textile.edgeY=new Float32Array(N*N);
 const im=paperCtx.createImageData(N,N),fiber=textile.fiber=new Float32Array(N*N),absorb=textile.absorb=new Float32Array(N*N);
 // Average 4.3px yarn pitch at 768px: still readable at a 340px mobile width.
 // Uneven spun thickness, wavering paths and alternating crossing occlusion
 // prevent perfect square holes, straight ruled grids and screen-door texture.
 const pitchX=4.36,pitchY=4.05;
 const yarnAxis=(pitch,s)=>{const a=new Float32Array(N);let left=-pitch,index=-1;while(left<N){const step=pitch*(.80+noise(index,0,s)*.41),right=left+step;for(let p=Math.max(0,Math.ceil(left));p<Math.min(N,Math.ceil(right));p++)a[p]=index+(p-left)/step;left=right;index++;}return a;};
 const axisX=yarnAxis(pitchX,173),axisY=yarnAxis(pitchY,179);
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){
  const i=y*N+x,k=i*4;
  const wx=axisX[x]+(smoothNoise(Math.floor(axisX[x])*.89,y/59,181)-.5)*.24+(smoothNoise(x/43,y/189,13)-.5)*.58+(smoothNoise(x/140,y/74,117)-.5)*.19;
  const wy=axisY[y]+(smoothNoise(x/67,Math.floor(axisY[y])*.87,191)-.5)*.24+(smoothNoise(x/171,y/39,17)-.5)*.52+(smoothNoise(x/83,y/156,119)-.5)*.17;
  const ix=Math.floor(wx),iy=Math.floor(wy),dx=wx-ix-.5,dy=wy-iy-.5;
  const slubX=Math.pow(smoothNoise(ix*.67,y/28,71),7)*.18,slubY=Math.pow(smoothNoise(x/33,iy*.69,83),7)*.17;
  const widthX=.45+(smoothNoise(ix*.71,y/18,107)-.5)*.12+slubX,widthY=.455+(smoothNoise(x/19,iy*.81,109)-.5)*.115+slubY;
  const nx=dx/widthX,ny=dy/widthY;
  const coverX=clamp((1.10-Math.abs(nx))*4.0),coverY=clamp((1.10-Math.abs(ny))*4.0);
  const roundX=Math.sqrt(Math.max(0,1-nx*nx)),roundY=Math.sqrt(Math.max(0,1-ny*ny));
  // Slant illumination reads the softly rounded yarn top and its lower-right seam.
  const bodyX=roundX*15.8-nx*4.5,bodyY=roundY*14.6-ny*3.9;
  const strandX=Math.sin(y*1.23+ix*2.47+dx*8.1+(smoothNoise(ix,y/11,3)-.5)*2.3)*1.65;
  const strandY=Math.sin(x*1.34+iy*2.19+dy*8.6+(smoothNoise(x/12,iy,5)-.5)*2.0)*1.45;
  const warpTop=((ix+iy)&1)===0;
  const top=warpTop?coverX:coverY,under=warpTop?coverY:coverX;
  const topLight=warpTop?bodyX+strandX:bodyY+strandY,underLight=(warpTop?bodyY+strandY:bodyX+strandX)*.63-3.0;
  const jointShadow=(warpTop?Math.abs(dy):Math.abs(dx))*.75;
  const yarn=lerp(-8.4,underLight,under)*(1-top)+(topLight-jointShadow)*top-7.7;
  const spun=(smoothNoise(ix*.8,y/12,137)-.5)*4.0*coverX+(smoothNoise(x/14,iy*.8,139)-.5)*3.4*coverY;
  const cloud=smoothNoise(x/92,y/81,7)-.5;
  fiber[i]=yarn+spun+cloud*2.1+(noise(x,y,38)-.5)*.7;
  // Irregular broad rims and short yarn-length teeth share this fixed cloth field.
  // They are sampled only near a resist boundary, never added across bare cloth.
  edgeX[i]=(smoothNoise(x/12,y/13,307)-.5)*8.6+(smoothNoise(x/2.3,y/18,311)-.5)*4.4;
  edgeY[i]=(smoothNoise(x/14,y/11,313)-.5)*8.1+(smoothNoise(x/21,y/2.6,317)-.5)*4.1;
  absorb[i]=cloud*.075+(smoothNoise(x/23,y/27,21)-.5)*.043+(smoothNoise(x/3.6,y/44,151)-.5)*.019+(smoothNoise(x/51,y/4.2,153)-.5)*.012;
  im.data[k]=246+fiber[i]*.94;im.data[k+1]=243+fiber[i]*.94;im.data[k+2]=232+fiber[i]*.94;im.data[k+3]=255;
  const waxGrain=(smoothNoise(x/5,y/6,291)-.5)*2.8+fiber[i]*.43;
  waxPaper[k]=238+waxGrain;waxPaper[k+1]=228+waxGrain;waxPaper[k+2]=179+waxGrain;waxPaper[k+3]=255;
 }
 textile.waxCaches.clear();textile.resists=new WeakMap();
 paperCtx.putImageData(im,0,0);textile.paper=im.data;textile.preview=null;
}
function prepareTextileBleed(workSeed){
 if(textile.bleed&&textile.bleedSeed===workSeed&&textile.bleedMask===dyeMask)return;
 textile.bleedSeed=workSeed;textile.bleedMask=dyeMask;
 const bleed=textile.bleed=new Float32Array(N*N),s=workSeed%100003;
 // Intact wax stays clean. Only a trace of colour on rare porous yarns, never forced pools inside a motif.
 for(let y=0;y<N;y++)for(let x=0;x<N;x++)bleed[y*N+x]=Math.pow(clamp((smoothNoise(x/55,y/61,s)-.39)/.61),2)*.10;
}
function textileWaxCache(S){
 if(S===N)return {base:textile.paper,paste:textile.waxPaper};
 if(textile.waxCaches.has(S))return textile.waxCaches.get(S);
 const small=make(S),c=ctx(small),full=make(),fc=ctx(full),im=fc.createImageData(N,N);
 c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';c.drawImage(paper,0,0,S,S);const base=c.getImageData(0,0,S,S).data;
 im.data.set(textile.waxPaper);fc.putImageData(im,0,0);c.clearRect(0,0,S,S);c.drawImage(full,0,0,S,S);const paste=c.getImageData(0,0,S,S).data;
 const result={base,paste};textile.waxCaches.set(S,result);return result;
}
// Keep the editable geometry intact, then build one shared physical resist mask.
// Preview, wet cloth and finished cloth therefore have the same fibrous outline.
// Only changed stroke bounds are processed during drawing; settled masks are cached.
function textileResistRecord(source){
 let entry=textile.resists.get(source);
 if(!entry){const canvas=make(),c=ctx(canvas),image=c.createImageData(N,N);entry={version:0,canvas,context:c,image,alpha:new Float32Array(N*N),dirty:{x0:0,y0:0,x1:N,y1:N},photo:null};textile.resists.set(source,entry);}
 return entry;
}
function markTextileResistDirty(source,bounds=null){
 const entry=textileResistRecord(source);entry.version++;const b=bounds||{x0:0,y0:0,x1:N,y1:N};
 if(entry.dirty){entry.dirty.x0=Math.min(entry.dirty.x0,b.x0);entry.dirty.y0=Math.min(entry.dirty.y0,b.y0);entry.dirty.x1=Math.max(entry.dirty.x1,b.x1);entry.dirty.y1=Math.max(entry.dirty.y1,b.y1);}
 else entry.dirty={...b};
}
function textileResistSurface(source,photo=false){
 if(source.width!==N||source.height!==N)return source;
 const entry=textileResistRecord(source);
 if(entry.photo!==photo){entry.photo=photo;entry.dirty={x0:0,y0:0,x1:N,y1:N};}
 if(!entry.dirty)return entry.canvas;
 const b=entry.dirty;entry.dirty=null;
 const x0=clamp(Math.floor(b.x0),0,N),y0=clamp(Math.floor(b.y0),0,N),x1=clamp(Math.ceil(b.x1),0,N),y1=clamp(Math.ceil(b.y1),0,N),w=x1-x0,h=y1-y0;
 if(!w||!h)return entry.canvas;
 const sourcePixels=ctx(source).getImageData(x0,y0,w,h).data,alpha=entry.alpha,out=entry.image.data;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)alpha[(y+y0)*N+x+x0]=sourcePixels[(y*w+x)*4+3]/255;
 // The finite sampling radius makes local erasing identical to a full replay.
 const ax=Math.max(0,x0-12),ay=Math.max(0,y0-12),bx=Math.min(N,x1+12),by=Math.min(N,y1+12);
 for(let y=ay;y<by;y++)for(let x=ax;x<bx;x++){
  const i=y*N+x,k=i*4,original=alpha[i];let a=original;
  if(original>0){
   const left=alpha[y*N+Math.max(0,x-6)],right=alpha[y*N+Math.min(N-1,x+6)],top=alpha[Math.max(0,y-6)*N+x],bottom=alpha[Math.min(N-1,y+6)*N+x];
   const contrast=Math.max(original,left,right,top,bottom)-Math.min(original,left,right,top,bottom);
   if(contrast>.015){
    const edge=clamp(contrast*(photo?2.3:1.8)),body=(original+left+right+top+bottom)/5;
    // Small strokes retain their core while wider wax deposits get a torn rim.
    const widthFactor=.18+.82*Math.pow(clamp((body-.30)/.50),2),strength=edge*widthFactor*(photo?.40:.72);
    const sx=x+textile.edgeX[i]*strength,sy=y+textile.edgeY[i]*strength;
    const center=textileSample(alpha,sx,sy,N),soft=(textileSample(alpha,sx-1.15,sy,N)+textileSample(alpha,sx+1.15,sy,N)+textileSample(alpha,sx,sy-1.15,N)+textileSample(alpha,sx,sy+1.15,N))*.25;
    // Capillary feathering erodes the wax rim. Exact zero stays zero: no wax
    // tint, flecks or halo can appear in a region that has never been coated.
    a=Math.min(original,lerp(original,center*.86+soft*.14,edge));
    if(!photo&&body<.68)a=Math.max(a,original*.20);
   }
  }
  out[k]=out[k+1]=out[k+2]=255;out[k+3]=Math.round(clamp(a)*255);
 }
 entry.context.putImageData(entry.image,0,0,ax,ay,bx-ax,by-ay);return entry.canvas;
}
function drawWaxOnCloth(canvas,source,photo=false){
 source=textileResistSurface(source,photo);
 const c=ctx(canvas),S=canvas.width;let alpha;
 if(source.width===S&&source.height===S)alpha=ctx(source).getImageData(0,0,S,S).data;
 else{const s=make(S),sc=ctx(s);sc.drawImage(source,0,0,S,S);alpha=sc.getImageData(0,0,S,S).data;}
 const cached=textileWaxCache(S),base=cached.base,paste=cached.paste;let target=textile.waxTargets.get(canvas);
 if(!target||target.size!==S){target={size:S,image:c.createImageData(S,S)};textile.waxTargets.set(canvas,target);}
 const im=target.image,out=im.data;out.set(base);const strength=(photo?.88:.94)/255;
 for(let y=0;y<S;y++)for(let x=0;x<S;x++){
  const k=(y*S+x)*4,m=alpha[k+3];if(!m)continue;
  const prev=((y?y-1:0)*S+(x?x-1:0))*4+3,next=((y<S-1?y+1:S-1)*S+(x<S-1?x+1:S-1))*4+3;
  const coat=m*strength,relief=(alpha[next]-alpha[prev])*(5/255);
  out[k]=base[k]+(paste[k]-base[k]+relief)*coat;
  out[k+1]=base[k+1]+(paste[k+1]-base[k+1]+relief)*coat;
  out[k+2]=base[k+2]+(paste[k+2]-base[k+2]+relief)*coat;
 }
 c.putImageData(im,0,0);if(S===N)drawSelvedge(c);return canvas;
}
function renderUndyedWax(canvas,source,options={}){return drawWaxOnCloth(canvas,source,!!options.photo);}
createPaper();



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


// All objects share material UVs. Their silhouette is applied to the editor,
// wet/dry textures and export, so the same wax marks travel through the process.
const CREATION_ITEMS=Object.freeze([{id:'handkerchief',name:'方巾'},{id:'tote',name:'帆布袋'},{id:'scarf',name:'围巾'},{id:'tshirt',name:'T 恤'}]);
let selectedItemId='handkerchief',itemSwiperFrame=0;
function creationItem(id){return CREATION_ITEMS.find(item=>item.id===id)||CREATION_ITEMS[0];}
function itemBodyPath(c,id){
 c.beginPath();
 if(id==='tote'){c.moveTo(167,237);c.lineTo(601,237);c.lineTo(616,689);c.quadraticCurveTo(383,725,152,689);c.closePath();}
 else if(id==='scarf'){c.moveTo(258,28);c.bezierCurveTo(251,255,267,485,254,728);c.lineTo(514,728);c.bezierCurveTo(499,485,516,254,510,28);c.closePath();}
 else if(id==='tshirt'){c.moveTo(291,89);c.lineTo(201,116);c.lineTo(47,274);c.lineTo(148,364);c.lineTo(208,307);c.lineTo(195,709);c.quadraticCurveTo(384,721,573,709);c.lineTo(560,307);c.lineTo(620,364);c.lineTo(721,274);c.lineTo(567,116);c.lineTo(477,89);c.bezierCurveTo(470,197,299,197,291,89);c.closePath();}
 else c.rect(2,2,N-4,N-4);
}
function itemStraps(c){
 // A rear handle, then a front handle; unpainted cotton remains visible.
 c.save();c.lineJoin='round';c.lineCap='butt';
 for(const [offset,color]of [[24,'#deded1'],[0,'#f2f1e5']]){c.beginPath();c.moveTo(267+offset,259);c.lineTo(267+offset,145);c.bezierCurveTo(267+offset,44,495+offset,44,495+offset,145);c.lineTo(495+offset,259);c.strokeStyle='#b6c0b8';c.lineWidth=35;c.stroke();c.strokeStyle=color;c.lineWidth=31;c.stroke();c.setLineDash([3,4]);c.lineWidth=1.4;c.strokeStyle='#a9b5ab';c.stroke();c.setLineDash([]);}
 c.restore();
}
function shapeItem(canvas,id=selectedItemId){
 if(id==='handkerchief')return canvas;
 const c=ctx(canvas);c.save();c.globalCompositeOperation='destination-in';itemBodyPath(c,id);c.fillStyle='#fff';c.fill();c.globalCompositeOperation='source-over';
 // Sewing and soft edge relief, with no grey overlay on the cotton field.
 c.save();itemBodyPath(c,id);c.clip();itemBodyPath(c,id);c.lineWidth=14;c.strokeStyle='#27495c14';c.stroke();
 c.setLineDash([3,4]);c.lineWidth=1.2;c.strokeStyle='#d8d9c7';
 if(id==='tote'){c.beginPath();c.moveTo(176,250);c.lineTo(590,250);c.moveTo(176,265);c.lineTo(590,265);c.moveTo(166,677);c.quadraticCurveTo(384,710,603,677);c.stroke();}
 if(id==='tshirt'){c.beginPath();c.moveTo(300,87);c.bezierCurveTo(308,208,460,208,469,87);c.moveTo(204,693);c.quadraticCurveTo(384,707,564,693);c.moveTo(60,271);c.lineTo(150,348);c.moveTo(708,271);c.lineTo(618,348);c.stroke();}
 if(id==='scarf'){c.beginPath();c.moveTo(261,45);c.lineTo(508,45);c.moveTo(258,709);c.lineTo(509,709);c.stroke();}
 c.restore();
 if(id==='tote'){itemStraps(c);c.strokeStyle='#b9c0b0';c.lineWidth=1.4;for(const x of [252,480]){c.strokeRect(x,242,29,33);c.beginPath();c.moveTo(x,242);c.lineTo(x+29,275);c.moveTo(x+29,242);c.lineTo(x,275);c.stroke();}}
 if(id==='scarf'){c.lineWidth=1.5;for(let i=0;i<72;i++){const x=256+i*3.6;c.strokeStyle=i%3?'#d4d8c7':'#eeeee0';c.beginPath();c.moveTo(x,726);c.quadraticCurveTo(x+Math.sin(i)*2,738,x+Math.sin(i*1.7)*3,748+i%4);c.stroke();}}
 c.restore();return canvas;
}
function renderItemPreview(canvas,id){
 const c=ctx(canvas),pixels=c.createImageData(N,N);pixels.data.set(textile.paper);c.putImageData(pixels,0,0);
 if(id==='handkerchief')drawSelvedge(c);else shapeItem(canvas,id);
}
function drawItemResult(c,texture,id){
 c.clearRect(0,0,N,N);
 if(id!=='scarf'){c.drawImage(texture,0,0);return;}
 // A continuous neck ribbon and a simple loose knot, with one long hanging end.
 const strip=make(256,704);ctx(strip).drawImage(texture,256,28,256,704,0,0,256,704);
 function ribbon(path,x,y,w,h,shade=0){c.save();path();c.clip();c.drawImage(strip,0,0,256,704,x,y,w,h);if(shade){const light=c.createLinearGradient(x,y,x+w,y);light.addColorStop(0,'#143b53'+shade);light.addColorStop(.4,'#ffffff08');light.addColorStop(1,'#143b5314');c.fillStyle=light;c.fillRect(x,y,w,h);}c.restore();}
 c.save();c.shadowColor='#29465716';c.shadowBlur=12;c.shadowOffsetY=7;
 // The short end tucks behind the longer drop instead of forming a wide bow.
 ribbon(()=>{c.beginPath();c.moveTo(334,331);c.bezierCurveTo(322,389,319,454,302,511);c.quadraticCurveTo(345,529,386,516);c.bezierCurveTo(399,459,409,389,402,331);c.closePath();},300,319,113,219,'20');
 ribbon(()=>{c.beginPath();c.moveTo(365,341);c.bezierCurveTo(376,434,352,573,358,697);c.quadraticCurveTo(408,712,453,696);c.bezierCurveTo(444,583,468,441,442,338);c.closePath();},353,327,110,382,'18');
 c.shadowColor='transparent';
 // One closed Bezier band gives the loop a smooth, connected fabric silhouette.
 ribbon(()=>{c.beginPath();c.moveTo(361,344);c.bezierCurveTo(263,322,231,227,263,151);c.bezierCurveTo(304,55,453,63,489,157);c.bezierCurveTo(516,230,478,309,423,346);c.lineTo(394,311);c.bezierCurveTo(448,275,473,216,453,169);c.bezierCurveTo(423,109,331,98,300,166);c.bezierCurveTo(278,219,303,276,386,307);c.closePath();},248,78,249,279,'20');
 // Soft directional relief follows the continuous loop; no tiled strip edges.
 c.save();c.strokeStyle='#f8f4e525';c.lineWidth=2;c.beginPath();c.moveTo(372,323);c.bezierCurveTo(278,285,252,217,284,161);c.bezierCurveTo(318,95,435,93,472,164);c.stroke();c.restore();
 ribbon(()=>{c.beginPath();c.moveTo(358,305);c.bezierCurveTo(381,287,420,300,440,320);c.quadraticCurveTo(451,339,427,362);c.quadraticCurveTo(384,366,352,343);c.quadraticCurveTo(344,323,358,305);c.closePath();},341,295,111,76,'30');
 c.strokeStyle='#13395025';c.lineWidth=2;c.beginPath();c.moveTo(359,338);c.quadraticCurveTo(392,343,421,357);c.stroke();
 c.setLineDash([3,4]);c.strokeStyle='#eae7d995';c.lineWidth=1;c.beginPath();c.moveTo(363,687);c.quadraticCurveTo(408,701,449,686);c.moveTo(309,502);c.quadraticCurveTo(349,518,380,508);c.stroke();c.restore();
 strip.width=strip.height=1;
}
function syncItemSwiper(scroll=false){
 const swiper=$('itemSwiper'),index=CREATION_ITEMS.findIndex(item=>item.id===selectedItemId);if(!swiper)return;
 $('itemsPage').setAttribute('aria-label','选择创作物件，当前'+creationItem(selectedItemId).name);
 swiper.querySelectorAll('[data-item-slide]').forEach(slide=>slide.setAttribute('aria-current',String(slide.dataset.itemSlide===selectedItemId)));
 document.querySelectorAll('[data-object]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.object===selectedItemId)));
 if(scroll&&swiper.clientWidth)swiper.scrollTo({left:index*swiper.clientWidth,behavior:reduceMotion?'instant':'smooth'});
}
function initItemSwiper(){
 const swiper=$('itemSwiper');
 swiper.innerHTML=CREATION_ITEMS.map((item,i)=>`<div class="item-slide" data-item-slide="${item.id}" role="group" aria-roledescription="幻灯片" aria-label="${i+1} / 4 · ${item.name}"><canvas width="768" height="768" aria-label="${item.name}"></canvas><span class="item-name-label">${item.name}</span></div>`).join('');
 swiper.querySelectorAll('canvas').forEach((canvas,i)=>renderItemPreview(canvas,CREATION_ITEMS[i].id));
 $('itemDots').innerHTML=CREATION_ITEMS.map(item=>`<button data-object="${item.id}" aria-label="选择${item.name}" aria-pressed="${item.id===selectedItemId}"></button>`).join('');
 $('itemDots').querySelectorAll('button').forEach(b=>b.onclick=()=>{studioSelectItem(b.dataset.object);syncItemSwiper(true);});
 swiper.addEventListener('scroll',()=>{if(itemSwiperFrame)return;itemSwiperFrame=requestAnimationFrame(()=>{itemSwiperFrame=0;if(!swiper.clientWidth)return;const index=Math.round(swiper.scrollLeft/swiper.clientWidth),item=CREATION_ITEMS[clamp(index,0,3)];if(item.id!==selectedItemId)studioSelectItem(item.id);});},{passive:true});
 swiper.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const index=CREATION_ITEMS.findIndex(item=>item.id===selectedItemId);studioSelectItem(CREATION_ITEMS[clamp(index+(e.key==='ArrowRight'?1:-1),0,3)].id);syncItemSwiper(true);});
 let drag=null;
 swiper.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse')return;drag={x:e.clientX,left:swiper.scrollLeft};swiper.setPointerCapture(e.pointerId);swiper.classList.add('dragging');});
 swiper.addEventListener('pointermove',e=>{if(drag)swiper.scrollLeft=drag.left+drag.x-e.clientX;});
 for(const name of ['pointerup','pointercancel','lostpointercapture'])swiper.addEventListener(name,()=>{if(!drag)return;const index=Math.round(swiper.scrollLeft/Math.max(1,swiper.clientWidth));drag=null;swiper.classList.remove('dragging');studioSelectItem(CREATION_ITEMS[clamp(index,0,3)].id);syncItemSwiper(true);});
 syncItemSwiper();
}


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


// A separate WebGL surface keeps the main canvas in 2D. The mesh and texture
// retain their original material UVs; depth testing resolves folded overlaps.
const drawWholeClothGPU=(()=>{
 const SIZE=768,MAX_TEXTURES=4;
 let surface=null,gl=null,unavailable=false,lost=false,ready=false;
 let program=null,positionBuffer=null,normalBuffer=null,uvBuffer=null,indexBuffer=null;
 let locations=null,vertexCount=0,indexCount=0,topology=null,indices=null;
 let positions=null,normals=null;
 const textures=new Map();
 const vertexSource=`
  attribute vec3 aPosition;
  attribute vec3 aNormal;
  attribute vec2 aUV;
  uniform vec2 uDepth;
  varying vec2 vUV;
  varying vec3 vNormal;
  void main(){
   vec2 projected=vec2(aPosition.x+0.10*aPosition.z,aPosition.y-0.62*aPosition.z);
   gl_Position=vec4(projected.x/384.0-1.0,1.0-projected.y/384.0,uDepth.y-aPosition.z*uDepth.x,1.0);
   vUV=aUV;
   vNormal=aNormal;
  }`;
 const fragmentSource=`
  precision mediump float;
  uniform sampler2D uCloth;
  uniform float uLighting;
  varying vec2 vUV;
  varying vec3 vNormal;
  void main(){
   vec4 cloth=texture2D(uCloth,vUV);
   if(cloth.a<0.01)discard;
   vec3 normal=vNormal/max(length(vNormal),0.0001);
   // Absolute incidence illuminates both cloth faces. Even a steep crease
   // keeps 85% of its cotton color instead of turning grey or black.
   float incidence=abs(dot(normal,normalize(vec3(0.25,-0.42,0.88))));
   float light=mix(1.0,0.85+0.15*min(1.0,incidence/0.88),uLighting);
   gl_FragColor=vec4(cloth.rgb*light,cloth.a);
  }`;
 function shader(type,source){
  const item=gl.createShader(type);if(!item)throw new Error('No cloth shader');
  gl.shaderSource(item,source);gl.compileShader(item);
  if(!gl.getShaderParameter(item,gl.COMPILE_STATUS)){gl.deleteShader(item);throw new Error('Cloth shader unavailable');}
  return item;
 }
 function initialize(){
  if(unavailable||lost)return false;
  if(ready)return !gl.isContextLost();
  try{
   if(!surface){
    if(typeof document==='undefined'||typeof document.createElement!=='function')return false;
    surface=document.createElement('canvas');surface.width=SIZE;surface.height=SIZE;
    surface.addEventListener('webglcontextlost',event=>{event.preventDefault();lost=true;ready=false;});
    surface.addEventListener('webglcontextrestored',()=>{
     // Restored contexts invalidate every GPU object, including source caches.
     lost=false;unavailable=false;ready=false;program=null;topology=null;
     vertexCount=0;indexCount=0;indices=null;textures.clear();
    });
   }
   gl=surface.getContext('webgl',{alpha:true,antialias:true,depth:true,stencil:false,premultipliedAlpha:false,preserveDrawingBuffer:true})||surface.getContext('experimental-webgl');
   if(!gl){unavailable=true;return false;}
   if(gl.isContextLost()){lost=true;return false;}
   const vertex=shader(gl.VERTEX_SHADER,vertexSource),fragment=shader(gl.FRAGMENT_SHADER,fragmentSource);
   program=gl.createProgram();gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
   gl.deleteShader(vertex);gl.deleteShader(fragment);
   if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('Cloth program unavailable');
   locations={position:gl.getAttribLocation(program,'aPosition'),normal:gl.getAttribLocation(program,'aNormal'),uv:gl.getAttribLocation(program,'aUV'),depth:gl.getUniformLocation(program,'uDepth'),lighting:gl.getUniformLocation(program,'uLighting'),cloth:gl.getUniformLocation(program,'uCloth')};
   positionBuffer=gl.createBuffer();normalBuffer=gl.createBuffer();uvBuffer=gl.createBuffer();indexBuffer=gl.createBuffer();
   if(!positionBuffer||!normalBuffer||!uvBuffer||!indexBuffer)throw new Error('No cloth buffers');
   gl.useProgram(program);gl.uniform1i(locations.cloth,0);
   gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.depthMask(true);
   gl.disable(gl.CULL_FACE);gl.disable(gl.BLEND);
   gl.clearColor(0,0,0,0);gl.clearDepth(1);gl.viewport(0,0,SIZE,SIZE);
   ready=true;return true;
  }catch{unavailable=true;ready=false;return false;}
 }
 function setTopology(vertices,faces){
  if(vertices.length!==vertexCount){
   const side=Math.sqrt(vertices.length),grid=side-1;
   if(!Number.isInteger(side)||grid<1||vertices.length>65535)return false;
   vertexCount=vertices.length;positions=new Float32Array(vertexCount*3);normals=new Float32Array(vertexCount*3);
   const uv=new Float32Array(vertexCount*2);
   for(let i=0;i<vertexCount;i++){uv[i*2]=(i%side)/grid;uv[i*2+1]=Math.floor(i/side)/grid;}
   gl.bindBuffer(gl.ARRAY_BUFFER,uvBuffer);gl.bufferData(gl.ARRAY_BUFFER,uv,gl.STATIC_DRAW);
   gl.bindBuffer(gl.ARRAY_BUFFER,positionBuffer);gl.bufferData(gl.ARRAY_BUFFER,positions.byteLength,gl.DYNAMIC_DRAW);
   gl.bindBuffer(gl.ARRAY_BUFFER,normalBuffer);gl.bufferData(gl.ARRAY_BUFFER,normals.byteLength,gl.DYNAMIC_DRAW);
   topology=null;
  }
  if(topology!==faces){
   const nested=typeof faces[0]!=='number',count=nested?faces.length*3:faces.length;
   if(!count||count%3)return false;
   const next=new Uint16Array(count);
   for(let i=0;i<count;i++){
    const index=nested?faces[Math.floor(i/3)]?.[i%3]:faces[i];
    if(!Number.isInteger(index)||index<0||index>=vertexCount)return false;
    next[i]=index;
   }
   indices=next;indexCount=count;topology=faces;
   gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indexBuffer);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.STATIC_DRAW);
  }
  return true;
 }
 function sourceTexture(source){
  const width=source.videoWidth||source.naturalWidth||source.width,height=source.videoHeight||source.naturalHeight||source.height;
  if(!(width>0&&height>0))return null;
  let entry=textures.get(source);
  if(entry&&(entry.width!==width||entry.height!==height)){gl.deleteTexture(entry.texture);textures.delete(source);entry=null;}
  if(!entry){
   const texture=gl.createTexture();if(!texture)return null;
   gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
   // The first source row is v=0; the projected mesh also starts at its top.
   gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
   try{gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);}catch{gl.deleteTexture(texture);return null;}
   entry={texture,width,height};
  }
  // Small LRU: animated material canvases must not accumulate GPU textures.
  textures.delete(source);textures.set(source,entry);
  while(textures.size>MAX_TEXTURES){const oldest=textures.keys().next().value;gl.deleteTexture(textures.get(oldest).texture);textures.delete(oldest);}
  return entry.texture;
 }
 function attribute(buffer,location,size){gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,size,gl.FLOAT,false,0,0);}
 function draw(c,texture,vertices,faces,options={}){
  if(!c||typeof c.drawImage!=='function'||!texture||!vertices?.length||!faces?.length)return false;
  if(!initialize())return false;
  try{
   if(!setTopology(vertices,faces))return false;
   let low=Infinity,high=-Infinity;normals.fill(0);
   for(let i=0;i<vertexCount;i++){
    const p=vertices[i],offset=i*3;
    if(!p||!Number.isFinite(p[0])||!Number.isFinite(p[1])||!Number.isFinite(p[2]))return false;
    positions[offset]=p[0];positions[offset+1]=p[1];positions[offset+2]=p[2];low=Math.min(low,p[2]);high=Math.max(high,p[2]);
   }
   // Area-weighted normals are shared across adjoining triangles, avoiding
   // the disconnected dark triangular patches of per-face canvas shading.
   for(let i=0;i<indexCount;i+=3){
    const a=indices[i]*3,b=indices[i+1]*3,d=indices[i+2]*3;
    const ux=positions[b]-positions[a],uy=positions[b+1]-positions[a+1],uz=positions[b+2]-positions[a+2],vx=positions[d]-positions[a],vy=positions[d+1]-positions[a+1],vz=positions[d+2]-positions[a+2];
    const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
    normals[a]+=nx;normals[a+1]+=ny;normals[a+2]+=nz;
    normals[b]+=nx;normals[b+1]+=ny;normals[b+2]+=nz;
    normals[d]+=nx;normals[d+1]+=ny;normals[d+2]+=nz;
   }
   for(let i=0;i<normals.length;i+=3){const length=Math.hypot(normals[i],normals[i+1],normals[i+2]);if(length>1e-8){normals[i]/=length;normals[i+1]/=length;normals[i+2]/=length;}else{normals[i]=0;normals[i+1]=0;normals[i+2]=1;}}
   const image=sourceTexture(texture);if(!image||gl.isContextLost())return false;
   gl.useProgram(program);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,image);
   gl.bindBuffer(gl.ARRAY_BUFFER,positionBuffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,positions);
   gl.bindBuffer(gl.ARRAY_BUFFER,normalBuffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,normals);
   attribute(positionBuffer,locations.position,3);attribute(normalBuffer,locations.normal,3);attribute(uvBuffer,locations.uv,2);
   gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indexBuffer);
   // Higher world z maps to smaller depth, matching the cloth hit test.
   const range=Math.max(1,high-low)+128;gl.uniform2f(locations.depth,2/range,(high+low)/range);gl.uniform1f(locations.lighting,options.lighting===false?0:1);
   gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.drawElements(gl.TRIANGLES,indexCount,gl.UNSIGNED_SHORT,0);
   if(gl.isContextLost())return false;
   c.drawImage(surface,0,0,SIZE,SIZE);return true;
  }catch{return false;}
 }
 // Call this after repainting an existing source canvas. New source references
 // upload automatically; ordinary pointer movement reuses their GPU texture.
 draw.invalidateTexture=source=>{
  const entry=textures.get(source);if(!entry)return;
  if(gl&&!lost&&!gl.isContextLost())gl.deleteTexture(entry.texture);
  textures.delete(source);
 };
 return draw;
})();


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


// One workbench, one material coordinate system, independent editable resist layers.
let studioMounted=false,studioDock='objects',studioBrushOpen=false,studioSeed=Date.now()>>>0;
try{studioSeed=Number(localStorage.getItem('indigo-studio-seed'))||studioSeed;localStorage.setItem('indigo-studio-seed',studioSeed);}catch{}
const studioWax=make(),studioTexture=make();let studioWaxKey='',studioTextureKey='';
function studioHasWax(){
 if(photo)return true;const d=maskCtx.getImageData(0,0,N,N).data;
 for(let i=3;i<d.length;i+=4)if(d[i]>20)return true;return false;
}
function studioWaxSource(){
 if(!photo)return mask;
 const key=textileResistRecord(mask).version+':'+textileResistRecord(photoMask).version;
 if(key!==studioWaxKey){const c=ctx(studioWax);c.clearRect(0,0,N,N);c.drawImage(photoMask,0,0);
  for(const cmd of commands){if(cmd.kind==='clear'){c.clearRect(0,0,N,N);c.drawImage(photoMask,0,0);}else if(cmd.kind==='motif')motif(c,cmd.name);else cmd.points.forEach((p,i)=>paintPoint(c,i?cmd.points[i-1]:p,i?p:null,cmd.width,cmd.erase,cmd.sym));}
  markTextileResistDirty(studioWax);studioWaxKey=key;}
 return studioWax;
}
function studioClothTexture(){
 const source=studioWaxSource(),key=(source===mask?'draw:':'mixed:')+textileResistRecord(source).version;
 if(key!==studioTextureKey){drawWaxOnCloth(studioTexture,source,!!photo);studioTextureKey=key;tieSurfaceCache.clear();}
 return studioTexture;
}
function studioSelectTool(name){
 if(!['wax','photo','erase','pattern'].includes(name))return;
 setTechnique('wax');setMode(name==='photo'?'photo':'draw');studioDock='wax';
 if(name!=='photo')setTool(name==='erase'?'eraser':'brush');
 if(name==='pattern')$('patternBtn').click();
 syncStudio();renderEditor();updateEditorButtons();
}
function studioSelectItem(id){
 const next=creationItem(id).id,changed=next!==selectedItemId;selectedItemId=next;
 document.body.dataset.item=next;
 if(changed){studioTextureKey='';tiePlanRestoreFabric();}
 syncItemSwiper();if(studioMounted){syncStudio();if(screen==='editor')renderEditor();}
}
function studioNewCloth(){
 ask('重置这件布料？','清除后仍可撤销恢复，已收藏的作品不受影响。',()=>{
  try{localStorage.setItem('indigo-studio-previous',JSON.stringify({commands,tie:getTieDraftData(),seed:studioSeed}));}catch{}
  cancelWorkbenchPointers();if(technique==='tie'){tiePlanReset();renderEditor();updateEditorButtons();return;}photoJob++;photoBusy=false;if(photoRaf){cancelAnimationFrame(photoRaf);photoRaf=0;}
  recordEditorEdit();commands=[];photo=null;photoStyle='halftone';photoInverted=false;photoLight=.5;photoDetail=.55;photoDepth=.5;photoScale=1;photoX=photoY=0;photoSourcePreview=false;
  photoMaskCtx.clearRect(0,0,N,N);markTextileResistDirty(photoMask);studioWaxKey=studioTextureKey='';studioSeed=(Date.now()^Math.floor(Math.random()*0xffffffff))>>>0;
  $('photoLight').value=50;$('photoDetail').value=55;$('photoDepth').value=50;$('photoZoom').value=100;$('invertBtn').setAttribute('aria-pressed','false');$('invertBtn').style.background='';
  for(const id of ['halftoneBtn','cutoutBtn']){$(id).classList.toggle('active',id==='halftoneBtn');$(id).setAttribute('aria-pressed',String(id==='halftoneBtn'));}
  resetTieDraft(tieNextSeed(studioSeed));try{localStorage.setItem('indigo-studio-seed',studioSeed);}catch{}
  $('photoEmptyControls').hidden=false;$('photoFilledControls').hidden=true;replay();saveDraft();studioSelectTool('wax');
 });
}
function syncStudio(){
 if(!studioMounted)return;
 const current=technique==='tie'?'tie':mode==='photo'?'photo':tool==='eraser'?'erase':'wax';
 $('editorPage').dataset.technique=technique;
 
 $('tiePlanControls').hidden=technique!=='tie';
 if(technique==='tie')syncTiePlanUI();
 document.querySelectorAll('[data-studio-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.studioTool===current)));
 $('workbenchTitle').textContent=creationItem(selectedItemId).name;
 $('studioView').textContent='';
 $('studioLayers').textContent='';
 document.querySelectorAll('[data-dock]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.dock===studioDock)));
 document.querySelectorAll('[data-slot-panel]').forEach(b=>b.hidden=b.dataset.slotPanel!==studioDock);
 $('studioRecipeName').textContent=dyeRecipe.name||dyeRecipe.label;
 const brushOpen=technique==='wax'&&current==='wax'&&studioBrushOpen;
 $('waxDock').setAttribute('aria-hidden',String(!brushOpen));$('studioWaxSettings').disabled=!brushOpen;
 $('editorBrushTool').parentElement.classList.toggle('is-open',brushOpen);
 $('editorToolRow').hidden=technique==='tie';$('editorBrushTool').setAttribute('aria-expanded',String(brushOpen));
 $('tieGestureTools').hidden=technique!=='tie';
 const tieTool=typeof tiePlanGetTool==='function'?tiePlanGetTool():tiePlan.tool||'pinch';
 document.querySelectorAll('[data-tie-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tieTool===tieTool)));
 if(technique==='tie')view.setAttribute('aria-label','扎染布面。'+studioTieToolHint(tieTool));
 syncWorkshopChrome();
 document.querySelectorAll('[data-studio-dye]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.studioDye===dyeRecipe.family)));
 scheduleLayout();
}
function studioCircleContent(ico,label){return `<span class="studio-tool-disc">${icon(ico)}</span><span class="studio-tool-label">${label}</span>`;}
function studioTieToolHint(kind=typeof tiePlanGetTool==='function'?tiePlanGetTool():tiePlan.tool||'pinch'){
 return {pinch:'按住布面向上拖，捏起布料。',gather:'按住布面向内拖，慢慢揉拢。',fold:'在布上划出折线，松手对折。',bind:'横跨布团划线，绕上绳子。'}[kind]||'按住布面向上拖，捏起布料。';
}
function studioTieToolContent(kind,label){
 const paths={
  pinch:'<path d="M3 20c3-1 5-3 7-7l2-4 2 4c2 4 4 6 7 7M8 20l4-7 4 7M12 7V2m-3 3 3-3 3 3"/>',
  gather:'<path d="M2 7h6m-3-3 3 3-3 3m17-3h-6m3-3-3 3 3 3M3 18l4-3 3 5 3-7 3 6 3-4 2 3"/>',
  fold:'<path d="M4 7v13h16V7M12 9v2m0 3v2m0 3v1M5 6c3-6 11-6 14 0m-5-1 5 1V2"/>',
  bind:'<path d="m5 5 7 3 7-3 2 7-3 7-6-3-6 3-3-7ZM4 10c5 4 11 4 16 0M4 14c5-4 11-4 16 0M10 11c-4-5-7 0-1 1m5 0c6 1 5-5 0-1m-3 2-2 7m4-7 3 7"/>'
 };
 return `<span class="studio-tool-disc"><svg viewBox="0 0 24 24" aria-hidden="true">${paths[kind]}</svg></span><span class="studio-tool-label">${label}</span>`;
}
function initStudio(){
 const frame=$('clothFrame'),host=document.createElement('div');host.className='studio-workspace';frame.before(host);host.appendChild(frame);
 const note=document.createElement('div');note.className='studio-view-note';note.hidden=true;note.innerHTML='<span id="studioView"></span><span id="studioLayers"></span>';host.before(note);
 const bottom=document.createElement('div');bottom.id='editorBottomControls';bottom.className='editor-bottom-controls';$('editorPage').appendChild(bottom);
 const history=document.createElement('div');history.id='editorHistoryRow';history.className='editor-history';history.setAttribute('role','toolbar');history.setAttribute('aria-label','编辑历史');
 for(const [id,label]of [['undoBtn','撤销'],['redoBtn','重做']]){const button=$(id);button.className='history-button';button.setAttribute('aria-label',label);button.title=label;button.innerHTML=icon(id==='undoBtn'?'undo':'redo');history.appendChild(button);}bottom.appendChild(history);
 const tools=document.createElement('div');tools.id='editorToolRow';tools.className='editor-tool-row';tools.setAttribute('role','toolbar');tools.setAttribute('aria-label','蜡染工具');
 tools.innerHTML=`<div class="studio-brush-group"><button id="editorBrushTool" class="studio-circle-tool" data-studio-tool="wax" aria-label="画笔" aria-pressed="true" aria-expanded="false" aria-controls="waxDock">${studioCircleContent('brush','画笔')}</button><div id="waxDock" class="studio-brush-options" aria-hidden="true" aria-label="笔触设置"><button id="studioWaxSettings" class="studio-circle-tool" aria-label="笔触">${studioCircleContent('sym','笔触')}</button></div></div><button class="studio-circle-tool" data-studio-tool="photo" aria-label="照片" aria-pressed="false">${studioCircleContent('photo','照片')}</button><button class="studio-circle-tool" data-studio-tool="erase" aria-label="擦蜡" aria-pressed="false">${studioCircleContent('erase','擦蜡')}</button><button class="studio-circle-tool" data-studio-tool="pattern" aria-label="纹样" aria-pressed="false">${studioCircleContent('flower','纹样')}</button>`;
 bottom.appendChild(tools);const photoButton=tools.querySelector('[data-studio-tool="photo"]');photoButton.after($('photoControls'));
 for(const [id,ico,label]of [['uploadEmptyBtn','upload','选照片'],['replacePhotoBtn','photo','换图'],['removePhotoBtn','clear','移除'],['photoSettingsBtn','sym','调整']]){const b=$(id);b.className='studio-circle-tool';b.innerHTML=studioCircleContent(ico,label);}
 const newCloth=$('techniqueBtn');newCloth.className='studio-circle-tool';newCloth.innerHTML=studioCircleContent('reset','重置');newCloth.setAttribute('aria-label','重置布料');tools.appendChild(newCloth);newCloth.onclick=studioNewCloth;
 const tieTools=document.createElement('div');tieTools.id='tieGestureTools';tieTools.className='tie-gesture-tools';tieTools.hidden=true;tieTools.setAttribute('role','toolbar');tieTools.setAttribute('aria-label','扎染工具');
 tieTools.innerHTML=[['pinch','捏布'],['gather','揉布'],['fold','折布'],['bind','系绳']].map(([kind,label])=>`<button id="tieTool${kind[0].toUpperCase()+kind.slice(1)}" class="studio-circle-tool" data-tie-tool="${kind}" aria-label="${label}" aria-pressed="${kind==='pinch'}" title="${studioTieToolHint(kind)}">${studioTieToolContent(kind,label)}</button>`).join('');bottom.appendChild(tieTools);
 tieTools.querySelectorAll('[data-tie-tool]').forEach(b=>b.onclick=()=>{if(technique!=='tie')return;tiePlanSetTool(b.dataset.tieTool);syncStudio();});
 const flow=document.createElement('div');flow.id='editorFlowRow';flow.className='editor-flow-row';flow.innerHTML=`<button id="editorBackBtn" class="flow-back" aria-label="返回物件选择">${icon('back')}</button>`;
 const action=$('startBtn').parentNode;flow.appendChild($('cropReturnBtn'));flow.appendChild($('startBtn'));action.remove();bottom.appendChild(flow);$('editorBackBtn').onclick=()=>{cancelWorkbenchPointers();setScreen('items');};
 const dyes=document.createElement('div');dyes.id='dyeDock';dyes.className='studio-dock dye-dock';dyes.setAttribute('aria-label','选择染液');
 dyes.innerHTML=`<div class="dock-caption"><span>选一碗染液</span><span id="studioRecipeName"></span></div><div class="slot-row">${[['indigo','靛蓝','#1d508b'],['madder','茜草','#b1564a'],['ochre','槐米','#be9938'],['green','叠绿','#557d63']].map(([id,label,color])=>`<button data-studio-dye="${id}"><i class="dye-sample" style="--dye:${color}"></i><span>${label}</span></button>`).join('')}<button id="studioRecipes">${icon('recipe')}<span>我的配方</span></button></div>`;
 $('ritualPage').querySelector('.ritual-actions').before(dyes);
 const head=document.createElement('div');head.id='workshopChrome';head.innerHTML='<header class="workshop-top"><h1>蓝染工坊</h1></header>';$('app').prepend(head);
 initTiePlanUI();host.appendChild($('tiePlanControls'));
 document.querySelectorAll('[data-studio-tool]').forEach(b=>b.onclick=()=>{const name=b.dataset.studioTool;if(name==='wax'){studioBrushOpen=!(mode==='draw'&&tool==='brush'&&studioBrushOpen);studioSelectTool(name);}else{studioBrushOpen=false;studioSelectTool(name);if(name==='photo'&&!photo)$('photoInput').click();}syncStudio();});
 document.querySelectorAll('[data-object]').forEach(b=>b.onclick=()=>studioSelectItem(b.dataset.object));
 document.querySelectorAll('[data-studio-dye]').forEach(b=>b.onclick=()=>{if(screen!=='ritual'||r.phase!=='dipReady'||r.soakTotal>0)return;dyeRecipe=makePreparedRecipe(b.dataset.studioDye);syncMixUI();generateDye(1);syncStudio();});
 $('removePhotoBtn').onclick=()=>{recordEditorEdit();photoJob++;photoBusy=false;if(photoRaf){cancelAnimationFrame(photoRaf);photoRaf=0;}photo=null;photoMaskCtx.clearRect(0,0,N,N);markTextileResistDirty(photoMask);studioWaxKey=studioTextureKey='';$('photoEmptyControls').hidden=false;$('photoFilledControls').hidden=true;setMode('draw');updateEditorButtons();};
 $('studioRecipes').onclick=()=>{if(r.phase==='dipReady'&&r.soakTotal===0)chooseRecipe();};
 $('studioWaxSettings').onclick=()=>{$('drawingSettingsBtn').click();};
 initItemSwiper();studioMounted=true;studioSelectItem(selectedItemId);syncStudio();
}

function studioUpdateCamera(){
 $('clothStage').style.transform='';
}

function syncWorkshopChrome(){
 if(!studioMounted)return;const active=screen==='editor'||screen==='ritual';$('workshopChrome').hidden=!active;
 $('workshopChrome').querySelector('h1').textContent=screen==='editor'?(technique==='tie'?'扎染':'蜡染'):'蓝染工坊';
 $('dyeDock').hidden=screen!=='ritual'||r.phase!=='dipReady'||r.soakTotal>0;
}


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


// --- Dye material: resist mask + fixed organic noise + woven cotton + sparse wax cracks. ---
let dyeMask=null, field=null, cracks=null, rawCloth=make(), wetGreen=make(), wetMid=make(), wetBlue=make(), unwaxedWetCloth=make(), rinsedWetCloth=make(), oxidizedWetCloth=make(), finishedCloth=make(), previousCloth=make();
const materialDryBlend={canvas:make(),step:-1},materialWashBlend={canvas:make(),step:-1},materialOxBlend={canvas:make(),step:-1};
let materialFinalPixels=null,tieBoundGreen=make(),craftPhotoDepth=.5;
function freshMaterialCanvas(previous){
 // Browser sleep and long file pickers can discard detached canvas backing
 // stores. Start a generation with new contexts, releasing the old buffers
 // first so recovery does not double the retained texture memory.
 if(previous){previous.width=1;previous.height=1;}return make();
}
function restoreFinishedCloth(){if(!materialFinalPixels)return;finishedCloth=freshMaterialCanvas(finishedCloth);ctx(finishedCloth).putImageData(materialFinalPixels,0,0);}
let craftMode='draw', craftStyle='halftone', craftSeed=0,craftTechnique='wax',craftTies=null;
let craftWaxMask=null,craftHasWax=false,craftExposure=20,craftItemType='handkerchief';
function prepareMaterial(){
 craftItemType=selectedItemId;
 const isTie=technique==='tie',waxSource=isTie?null:studioWaxSource();
 craftHasWax=!isTie&&studioHasWax();craftTies=isTie?tiePlanSnapshot():null;
 craftTechnique=isTie?'tie':'wax';craftMode=isTie?'tie':photo?'photo':'draw';
 craftStyle=photoStyle;craftSeed=isTie?craftTies.seed:studioSeed;craftExposure=20;
 craftPhotoDepth=craftMode==='photo'?photoDepth:.5;
 craftWaxMask=isTie?new Uint8ClampedArray(N*N*4):ctx(textileResistSurface(waxSource,!!photo)).getImageData(0,0,N,N).data;
 const itemStencil=make(),stencil=ctx(itemStencil);itemBodyPath(stencil,craftItemType);stencil.fill();const itemAlpha=stencil.getImageData(0,0,N,N).data;
 for(let k=3;k<craftWaxMask.length;k+=4)craftWaxMask[k]=Math.round(craftWaxMask[k]*itemAlpha[k]/255);itemStencil.width=itemStencil.height=1;
 const tied=isTie?ctx(tiePlanResist(craftTies)).getImageData(0,0,N,N).data:null;
 dyeMask=new Uint8ClampedArray(N*N*4);field=new Float32Array(N*N);
 cracks=new Uint8ClampedArray(N*N*4);
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){
  const i=y*N+x,k=i*4,wa=craftHasWax?craftWaxMask[k+3]/255:0,ta=tied?tied[k+3]/255:0;
  // Union in original material coordinates. Folding never mirrors or moves a wax mark on the flat result.
  dyeMask[k]=dyeMask[k+1]=dyeMask[k+2]=255;dyeMask[k+3]=Math.round((1-(1-wa)*(1-ta))*255);
  const s=craftSeed%997;
  field[i]=textile.absorb[i]+(smoothNoise(x/245,y/219,s)-.5)*.32+(smoothNoise(x/48,y/61,s+31)-.5)*.14+(smoothNoise(x/9,y/12,s+67)-.5)*.045;
 }
 prepareTextileBleed(craftSeed);
 if(craftHasWax)drawWaxOnCloth(rawCloth,waxSource,!!photo);
 else{const g=ctx(rawCloth);g.clearRect(0,0,N,N);g.drawImage(paper,0,0);drawSelvedge(g);}
 shapeItem(rawCloth,craftItemType);
 if(typeof drawWholeClothGPU==='function')drawWholeClothGPU.invalidateTexture?.(rawCloth);
 generateDye(1);
}
function exposureTone(cycle,seconds=craftExposure){
 const total=clamp(Number.isFinite(seconds)?seconds:0,0,20),strength=1-Math.exp(-total/(26/3)),base=getDyeTone(1),paperTone=[242,243,236];
 const depth=craftMode==='photo'?(craftPhotoDepth<.5?lerp(.55,1,craftPhotoDepth*2):lerp(1,1.15,(craftPhotoDepth-.5)*2)):1;
 return base.map((v,ch)=>Math.round(lerp(paperTone[ch],Math.max(8,v-12),clamp(strength*depth,0,.98))));
}
function renderMaterial(canvas,tone,wax,surface=null){
 const c=ctx(canvas),im=c.createImageData(N,N),data=im.data,isPhoto=craftMode==='photo';
 const wet=surface?.wet?1:0,residue=surface?.residue?1:0;if(!craftHasWax)wax=false;
 prepareTextileBleed(craftSeed);
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){
  const i=y*N+x,k=i*4;
  let a=surface?.bound?0:dyeMask[k+3]/255;
  
  textilePhotoPixel(data,k,a,tone,textile.fiber[i]*(wet?.86:1.10),field[i],false,craftHasWax?textile.bleed[i]:0);
  if(wax){const wa=craftWaxMask[k+3]/255;for(let ch=0;ch<3;ch++)data[k+ch]=lerp(data[k+ch],[237,226,179][ch]+textile.fiber[i]*.45,wa*.9);}
  // Wet yarn has less diffuse relief and slightly dimmer protected cotton. A
  // trace of loose colour remains until rinsing; the resist and bleed stay put.
  if(wet)for(let ch=0;ch<3;ch++)data[k+ch]-=(wax?0:a*[10,9,8][ch])+residue*([2.5,2,4][ch]+a*(wax?0:[.5,2,4][ch]));
  const left=2.1+Math.sin(y*.048)*.8+noise(0,y,craftSeed)*1.5,right=N-3.7-Math.sin(y*.037)*.7,top=2+Math.sin(x*.05)*.9,bottom=N-3.5-Math.sin(x*.043)*.8;
  data[k+3]=(x<left||x>right||y<top||y>bottom)?0:255;
 }
 c.putImageData(im,0,0);if(craftItemType==='handkerchief')drawSelvedge(c);else shapeItem(canvas,craftItemType);
}
function materialWetTone(tone){
 const light=tone[0]*.2126+tone[1]*.7152+tone[2]*.0722;
 return tone.map(v=>Math.round(clamp((light+(v-light)*1.035)*.91,0,255)));
}
function generateDye(cycle){
 if(typeof tieSurfaceCache!=='undefined')tieSurfaceCache.clear();
 wetGreen=freshMaterialCanvas(wetGreen);wetMid=freshMaterialCanvas(wetMid);wetBlue=freshMaterialCanvas(wetBlue);
 unwaxedWetCloth=freshMaterialCanvas(unwaxedWetCloth);rinsedWetCloth=freshMaterialCanvas(rinsedWetCloth);oxidizedWetCloth=freshMaterialCanvas(oxidizedWetCloth);finishedCloth=freshMaterialCanvas(finishedCloth);tieBoundGreen=freshMaterialCanvas(tieBoundGreen);
 for(const cache of [materialDryBlend,materialWashBlend,materialOxBlend]){cache.canvas=freshMaterialCanvas(cache.canvas);cache.step=-1;}
 const dryTone=exposureTone(cycle),tone=materialWetTone(dryTone);
 // Only indigo uses the green-to-blue air-oxidation sequence. Other colour
 // studies settle gently within their own hue, then share the wet/dry response.
 const develop=isIndigoRecipe()?materialWetTone(getDevelopTone(cycle).map((v,ch)=>lerp([222,228,205][ch],v,1-Math.exp(-clamp(craftExposure,0,20)/(26/3))))):tone.map((v,ch)=>Math.round(lerp(v,[208,199,177][ch],.13)));
 const middle=develop.map((v,ch)=>Math.round(lerp(v,tone[ch],.52))),wet={wet:true,residue:true};
 if(craftTechnique==='tie')renderMaterial(tieBoundGreen,develop,false,{wet:true,residue:true,bound:true});
 renderMaterial(wetGreen,develop,true,wet);renderMaterial(wetMid,middle,true,wet);renderMaterial(wetBlue,tone,true,wet);
 // In this experience the cloth stays green until wax removal AND rinsing
 // have finished. Air development is then shown during hanging, not lifting.
 renderMaterial(unwaxedWetCloth,develop,false,wet);renderMaterial(rinsedWetCloth,develop,false,{wet:true});renderMaterial(oxidizedWetCloth,tone,false,{wet:true});
 // The finished canvas is the canonical export. Transient water and drying
 // blends are cached separately and never baked into the saved textile.
 renderMaterial(finishedCloth,dryTone,false);materialFinalPixels=ctx(finishedCloth).getImageData(0,0,N,N);materialDryBlend.step=materialWashBlend.step=materialOxBlend.step=-1;
}
function materialStageBlend(cache,from,to,progress){
 const step=Math.round(clamp(Number.isFinite(progress)?progress:0)*120);
 if(step===0)return from;if(step===120)return to;
 if(cache.step!==step){const c=ctx(cache.canvas);c.save();c.globalAlpha=1;c.globalCompositeOperation='source-over';c.clearRect(0,0,N,N);c.drawImage(from,0,0);c.globalAlpha=step/120;c.drawImage(to,0,0);c.restore();cache.step=step;}
 return cache.canvas;
}
function materialWashedCloth(progress){return materialStageBlend(materialWashBlend,unwaxedWetCloth,rinsedWetCloth,progress);}
function materialDryCloth(progress,oxidation=progress){
 const ox=clamp(Number.isFinite(oxidation)?oxidation:0),dry=clamp(Number.isFinite(progress)?progress:0);
 if(ox<1)return materialStageBlend(materialOxBlend,rinsedWetCloth,oxidizedWetCloth,ox);
 return materialStageBlend(materialDryBlend,oxidizedWetCloth,finishedCloth,dry);
}


// A quiet plucked-string phrase is synthesized locally, so the offline package
// needs no audio file and remains within the Mini Tool asset whitelist.
const music={audio:null,wanted:true,forMic:false,version:0,pending:false,timer:0,step:0,playing:false,unlocked:false,buffers:new Map()};
// A pentatonic phrase with space between phrases. No recording or media asset.
const MUSIC_NOTES=[[293.66,1.5],[369.99,.5],[440,1],[493.88,1],[440,2],[369.99,1],[329.63,1],[293.66,2],[0,1],[440,1],[587.33,1.5],[493.88,.5],[440,1],[369.99,2],[329.63,1],[293.66,3],[0,2],[369.99,1],[440,.5],[493.88,.5],[587.33,2],[659.25,1],[587.33,1],[493.88,2],[440,1],[369.99,1],[329.63,1],[293.66,3],[0,2]];
function syncMusicUI(){
 const b=$('musicToggle');if(!b)return;const enabled=music.wanted&&!music.forMic;
 b.innerHTML=icon(enabled?'sound':'mute');b.setAttribute('aria-pressed',String(enabled));
 b.setAttribute('aria-label',music.forMic?'音乐已暂停，麦克风使用中':enabled?'关闭音乐':'播放音乐');b.title=b.getAttribute('aria-label');
 $('musicNote').textContent=music.forMic?'麦克风开启时音乐暂停':music.playing?'音乐播放中':'';
}
function pluckMusicNote(frequency,when,volume,voice='guzheng'){
 const audio=music.audio;if(!audio)return;const key=frequency+':'+voice;let buffer=music.buffers.get(key);
 if(!buffer){
  const length=Math.round(audio.sampleRate*(voice==='pipa'?1.2:3)),delay=Math.round(audio.sampleRate/frequency),ring=new Float32Array(delay);
  let seed=(Math.round(frequency*100)^7719)>>>0;
  for(let i=0;i<delay;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;ring[i]=(seed/4294967296*2-1)*.7;}
  buffer=audio.createBuffer(1,length,audio.sampleRate);const data=buffer.getChannelData(0),damping=voice==='pipa'?.984:.997;
  for(let i=0;i<length;i++){const j=i%delay,value=ring[j];ring[j]=(value+ring[(j+1)%delay])*.5*damping;data[i]=value*Math.min(1,i/(audio.sampleRate*.004));}
  music.buffers.set(key,buffer);
 }
 const source=audio.createBufferSource(),gain=audio.createGain(),filter=audio.createBiquadFilter();source.buffer=buffer;filter.type='lowpass';filter.frequency.setValueAtTime(voice==='pipa'?3300:2300,when);
 gain.gain.setValueAtTime(volume,when);gain.gain.linearRampToValueAtTime(0,when+buffer.duration);source.connect(filter);filter.connect(gain);gain.connect(audio.destination);source.start(when);
}
function playMusicPhrase(){
 clearTimeout(music.timer);if(!music.wanted||music.forMic||document.hidden||!music.audio||music.audio.state!=='running'){music.playing=false;syncMusicUI();return;}
 const now=music.audio.currentTime+.025,[note,beats]=MUSIC_NOTES[music.step%MUSIC_NOTES.length];
 if(note){pluckMusicNote(note,now,.15,music.step%3===1?'pipa':'guzheng');if(music.step%5===0)pluckMusicNote(146.83,now+.06,.09);if(beats===.5)pluckMusicNote(note*1.005,now+.07,.035,'pipa');}
 music.step++;music.playing=true;syncMusicUI();music.timer=setTimeout(playMusicPhrase,beats*620);
}
async function playMusic(){
 if(!music.unlocked||!music.wanted||music.forMic||document.hidden||music.pending)return;
 const version=++music.version;music.pending=true;
 try{
  const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio){$('musicNote').textContent='此环境暂不支持背景声';return;}
  if(!music.audio)music.audio=new Audio();await music.audio.resume();
  if(version!==music.version||!music.wanted||music.forMic||document.hidden){music.audio.suspend();return;}
  playMusicPhrase();
 }catch{/* Autoplay is policy-controlled. Keep the user's intended state. */}
 finally{music.pending=false;syncMusicUI();}
}
function pauseMusicForMic(){music.forMic=true;music.version++;clearTimeout(music.timer);music.playing=false;if(music.audio&&music.audio.state==='running')music.audio.suspend();syncMusicUI();}
function resumeMusicAfterMic(){if(!music.forMic)return;music.forMic=false;if(music.wanted&&!document.hidden)playMusic();else syncMusicUI();}
$('musicToggle').onclick=()=>{music.unlocked=true;music.wanted=!music.wanted;music.version++;if(!music.wanted){clearTimeout(music.timer);music.playing=false;if(music.audio&&music.audio.state==='running')music.audio.suspend();}else playMusic();syncMusicUI();};
function resumeDefaultMusic(e){music.unlocked=true;if(e?.target?.closest?.('#musicToggle'))return;if(music.wanted&&!music.forMic&&(!music.audio||music.audio.state!=='running'))playMusic();}
for(const type of ['pointerdown','keydown'])document.addEventListener(type,resumeDefaultMusic,{passive:true});
$('musicCredit').onclick=()=>openModal('设置说明',`<div class="about-text"><h3>背景音乐</h3><p>本机合成的古筝、琵琶风格纯音乐，以五声音阶与拨弦音色陪伴创作，不读取或上传音频文件。音乐默认开启，可用页面顶部的声音按钮关闭。浏览器限制自动播放时，会在第一次操作后开始。</p><h3>吹气与作品</h3><p>麦克风只在点击「吹气」后申请。声音在本机换算为风力，不录音、不上传；收音期间背景声暂停。照片与作品也只在当前浏览器处理和保存。</p></div>`);
document.addEventListener('visibilitychange',()=>{if(document.hidden){music.version++;clearTimeout(music.timer);music.playing=false;if(music.audio&&music.audio.state==='running')music.audio.suspend();syncMusicUI();}else if(music.wanted)playMusic();});
window.addEventListener('pagehide',()=>{music.version++;clearTimeout(music.timer);music.playing=false;if(music.audio&&music.audio.state==='running')music.audio.suspend();});
window.addEventListener('pageshow',()=>{if(music.wanted)playMusic();});
syncMusicUI();
setTimeout(()=>playMusic(),0);

// Breath is approximated by local audio energy. No recorder, network request, or saved audio.
const mic={state:'off',stream:null,context:null,source:null,analyser:null,buffer:null,token:0,timer:0,calibration:0,floor:0,frames:0};
function stopMic(state='off'){
  mic.token++;clearTimeout(mic.timer);mic.timer=0;
  if(mic.stream)mic.stream.getTracks().forEach(track=>track.stop());
  if(mic.source){try{mic.source.disconnect();}catch{}}
  if(mic.context){try{const close=mic.context.close();if(close&&close.catch)close.catch(()=>{});}catch{}}
  mic.stream=mic.context=mic.source=mic.analyser=mic.buffer=null;mic.state=state;resumeMusicAfterMic();
  const b=$('micBtn');if(b){b.disabled=false;b.classList.remove('listening');b.setAttribute('aria-pressed','false');b.textContent='吹气';}
}
async function toggleMic(){
  if(screen!=='ritual'||r.phase!=='drying')return;
  if(mic.state==='listening'||mic.state==='requesting'){stopMic();$('micStatus').textContent='';return;}
  if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){mic.state='unavailable';$('micStatus').textContent='可用扇风';toast('当前环境无法开启麦克风，可用扇风。');return;}
  const Audio=window.AudioContext||window.webkitAudioContext;
  if(!Audio){mic.state='unavailable';$('micStatus').textContent='可用扇风';return;}
  pauseMusicForMic();const token=++mic.token;mic.state='requesting';$('micBtn').textContent='取消';$('micStatus').textContent='等待许可';
  try{
    mic.context=new Audio();await mic.context.resume();
    if(token!==mic.token||r.phase!=='drying')return;
    mic.timer=setTimeout(()=>{if(token!==mic.token)return;stopMic('unavailable');$('micStatus').textContent='可用扇风';},15000);
    const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false});
    if(token!==mic.token||r.phase!=='drying'||screen!=='ritual'||document.hidden){stream.getTracks().forEach(t=>t.stop());return;}
    clearTimeout(mic.timer);mic.timer=0;mic.stream=stream;
    mic.source=mic.context.createMediaStreamSource(stream);mic.analyser=mic.context.createAnalyser();mic.analyser.fftSize=1024;mic.analyser.smoothingTimeConstant=.65;mic.buffer=new Float32Array(mic.analyser.fftSize);mic.source.connect(mic.analyser);
    // Deliberately never connect to the speakers; prevent feedback.
    mic.calibration=performance.now()+700;mic.floor=0;mic.frames=0;mic.state='listening';
    $('micBtn').classList.add('listening');$('micBtn').setAttribute('aria-pressed','true');$('micBtn').textContent='停止吹气';$('micStatus').textContent='校准中';
    stream.getTracks().forEach(track=>track.addEventListener('ended',()=>{if(mic.stream===stream){stopMic('unavailable');$('micStatus').textContent='已断开';}}));
  }catch(err){if(token!==mic.token)return;stopMic(err.name==='NotAllowedError'?'denied':'unavailable');$('micStatus').textContent='可用扇风';}
}
$('micBtn').onclick=toggleMic;
$('micBtn').setAttribute('aria-pressed','false');
function readWind(now){
  if(mic.state!=='listening'||!mic.analyser)return 0;
  try{mic.analyser.getFloatTimeDomainData(mic.buffer);}catch{stopMic('unavailable');$('micStatus').textContent='已暂停';return 0;}
  let energy=0;for(let i=0;i<mic.buffer.length;i++)energy+=mic.buffer[i]*mic.buffer[i];const rms=Math.sqrt(energy/mic.buffer.length);
  if(now<mic.calibration){mic.floor+=rms;mic.frames++;return 0;}
  const noiseFloor=mic.floor/Math.max(1,mic.frames),level=clamp((rms-Math.min(.018,noiseFloor)*1.4-.003)/.07);
  const label=level>.65?'风起':level>.1?'有风':'听风中';if($('micStatus').textContent!==label)$('micStatus').textContent=label;return level;
}
function beginDrying(){if(r.phase!=='washing'||r.wash<1||!resistRemovalComplete()||screen!=='ritual')return;r.dry=0;r.ox=0;r.wind=0;stopFan();phase('drying');$('micStatus').textContent='';soundPlay('cloth');}
function updateDrying(dt,now){
 if(r.phase!=='drying'||r.wash<1||!resistRemovalComplete())return;
 const signal=readWind(now),manual=now<r.fanUntil?.72:0,target=Math.max(signal,manual);
 // Stronger audio raises the wave amplitude continuously, then the breeze
 // relaxes smoothly after a breath instead of jumping between wind presets.
 r.wind=lerp(r.wind,target,1-Math.exp(-dt*(target>r.wind?6:2.8)));
 r.ox=clamp(r.ox+dt/14*(1+.7*r.wind));r.dry=clamp(r.dry+dt/32*(1+3*r.wind));
 updateDryUI();if(r.dry>=1&&r.ox>=1)finishRitual();
}
function updateDryUI(){
 if(r.phase==='drying'){
  const button=$('fanBtn'),active=performance.now()<r.fanUntil,label=active?'停止扇风':'扇风',pressed=String(active);
  if(button.textContent!==label)button.textContent=label;
  if(button.getAttribute('aria-pressed')!==pressed)button.setAttribute('aria-pressed',pressed);
 }
 const percent=Math.floor(Math.min(r.dry,r.ox)*100)+'%',reading=$('dryPercent'),progress=$('ritualProgress');
 if(reading.textContent!==percent)reading.textContent=percent;
 if(progress.style.width!==percent)progress.style.width=percent;
 const wind=String(Math.round(r.wind*1000)/1000),tools=$('dryTools');
 if(tools.style.getPropertyValue('--wind')!==wind)tools.style.setProperty('--wind',wind);
 const lit=Math.round(r.wind*12);document.querySelectorAll('.wind-meter i').forEach((bar,i)=>{const active=i<lit;if(bar.classList.contains('lit')!==active)bar.classList.toggle('lit',active);});
}
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopMic();stopFan();if(typeof r!=='undefined'&&r.phase==='drying')$('micStatus').textContent='已暂停';}});
window.addEventListener('pagehide',()=>{stopMic();stopFan();});
window.addEventListener('beforeunload',()=>{stopMic();stopFan();});


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


// --- Local collection v3. Every write is transactional; nothing is evicted. ---
const STORE='yifanglan-collection-v1', GALLERY_LIMIT=50;
const collectionStore=(()=>{
 const NAME='yifanglan-works-v3', VERSION=1;let db=null,opening=null;
 function requestValue(req){return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('storage-read'));});}
 function transactionDone(tx){return new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||new Error('storage-write'));tx.onabort=()=>reject(tx.error||new Error('storage-abort'));});}
 function open(){
  if(db)return Promise.resolve(db);if(opening)return opening;
  opening=new Promise((resolve,reject)=>{let settled=false,req;const timer=setTimeout(()=>fail(new Error('storage-timeout')),4500);function fail(e){if(settled)return;settled=true;clearTimeout(timer);reject(e);}
   try{if(!window.indexedDB)throw new Error('storage-unavailable');req=window.indexedDB.open(NAME,VERSION);}catch(e){fail(e);return;}
   req.onupgradeneeded=()=>{const d=req.result;if(!d.objectStoreNames.contains('works'))d.createObjectStore('works',{keyPath:'id'});if(!d.objectStoreNames.contains('meta'))d.createObjectStore('meta');};
   req.onerror=()=>fail(req.error||new Error('storage-open'));req.onblocked=()=>fail(new Error('storage-blocked'));
   req.onsuccess=()=>{if(settled){req.result.close();return;}settled=true;clearTimeout(timer);db=req.result;db.onversionchange=()=>{db.close();db=null;};db.onclose=()=>{db=null;};resolve(db);};
  }).finally(()=>{opening=null;});return opening;
 }
 async function snapshot(){const d=await open(),tx=d.transaction(['works','meta'],'readonly'),done=transactionDone(tx),items=requestValue(tx.objectStore('works').getAll()),migrated=requestValue(tx.objectStore('meta').get('legacy-v1'));const values=await Promise.all([items,migrated,done]);return{items:values[0],migrated:Array.isArray(values[1])?values[1]:[]};}
 async function put(item,legacyId=null){
  const d=await open();return new Promise((resolve,reject)=>{let tx;try{tx=d.transaction(['works','meta'],'readwrite');}catch(e){reject(e);return;}const store=tx.objectStore('works'),known=store.get(item.id),count=store.count();let exists=false,total=null,outcome='saved',failure=null;
   function write(){if(total===null||exists===null)return;if(!exists&&total>=GALLERY_LIMIT){outcome='full';return;}try{store.put(item);if(legacyId){const meta=tx.objectStore('meta'),req=meta.get('legacy-v1');req.onsuccess=()=>meta.put([...new Set([...(Array.isArray(req.result)?req.result:[]),legacyId])],'legacy-v1');}}catch(e){failure=e;try{tx.abort();}catch{}}}
   exists=null;known.onsuccess=()=>{exists=!!known.result;write();};count.onsuccess=()=>{total=count.result;write();};tx.oncomplete=()=>resolve(outcome);tx.onerror=()=>reject(failure||tx.error||new Error('storage-write'));tx.onabort=()=>reject(failure||tx.error||new Error('storage-abort'));
  });
 }
 async function remove(ids,legacyIds=[]){const d=await open(),tx=d.transaction(['works','meta'],'readwrite'),done=transactionDone(tx);ids.forEach(id=>tx.objectStore('works').delete(id));if(legacyIds.length){const meta=tx.objectStore('meta'),req=meta.get('legacy-v1');req.onsuccess=()=>meta.put([...new Set([...(Array.isArray(req.result)?req.result:[]),...legacyIds])],'legacy-v1');}await done;}
 return{open,snapshot,put,remove};
})();
let resultFromGallery=false, makingScreen='editor', makingResult=null;
let galleryReadyDone=false,storageIssue='',galleryQueue=Promise.resolve(),pendingWorks=[],gallerySelection=new Set(),gallerySelecting=false,galleryBusy=false;
const persistedIds=new Set(),dirtyIds=new Set(),legacySourceIds=new Set(),failedIds=new Set();
function escapeHTML(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function formatDate(date){const d=new Date(date);return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;}
function modeLabel(item){return item.mode==='combined'?'蜡染 + 扎染':item.mode==='tie'?'扎染':item.mode==='draw'?'蜡染 · 手绘':'蜡染 · 照片';}
function itemInfo(item){return `${creationItem(item.itemType).name} · ${modeLabel(item)}${item.exposure?' · 浸泡 '+item.exposure+' 秒':''} · ${item.recipeLabel||((item.recipe&&item.recipe.family!=='indigo'?['一浸浅染','二浸叠色','三浸深染']:['一浸浅蓝','二浸靛蓝','三浸藏蓝'])[item.cycles-1]||'一浸浅染')} · ${formatDate(item.date)}`;}
function validWork(x,index=0){if(!x||typeof x.image!=='string'||!/^data:image\/(jpeg|png|webp);base64,[a-zA-Z0-9+/=\s]+$/.test(x.image))return null;let hash=2166136261;for(let i=0;i<x.image.length;i+=127)hash=Math.imul(hash^x.image.charCodeAt(i),16777619);return{id:typeof x.id==='string'&&x.id?x.id:`legacy-${Number(x.date)||0}-${hash>>>0}-${index}`,name:typeof x.name==='string'&&x.name.trim()?x.name.trim().slice(0,12):'无题之蓝',itemType:creationItem(x.itemType).id,exposure:Math.min(90,Math.max(0,Number(x.exposure)||0)),mode:x.mode==='combined'?'combined':x.mode==='tie'?'tie':x.mode==='photo'?'photo':'draw',style:typeof x.style==='string'?x.style:'halftone',cycles:Math.max(1,Math.min(3,Number(x.cycles)||1)),date:Number(x.date)||Date.now(),seed:Number(x.seed)||0,recipe:x.recipe&&typeof x.recipe==='object'?JSON.parse(JSON.stringify(x.recipe)):null,recipeLabel:typeof x.recipeLabel==='string'?x.recipeLabel:'',image:x.image};}
function sortGallery(){gallery.sort((a,b)=>b.date-a.date);}
function collectionItems(){return [...pendingWorks,...gallery];}
function findWork(id){return collectionItems().find(x=>x.id===id);}
function queueGallery(action){const job=galleryQueue.then(action,action);galleryQueue=job.catch(()=>{});return job;}
function storageFailed(error){memoryOnly=true;storageIssue=error&&error.name==='QuotaExceededError'?'设备可用空间不足，未存好的作品只在本次打开中保留。请先导出，再清理作品或设备空间。':'本机作品暂时无法写入，未存好的作品只在本次打开中保留。请先导出，刷新或关闭后可能丢失。';}
function isUnsaved(item){return !!item&&(!persistedIds.has(item.id)||dirtyIds.has(item.id));}
function addPending(item){if(!pendingWorks.some(x=>x.id===item.id))pendingWorks.unshift(item);dirtyIds.add(item.id);}
function adoptSavedSnapshot(rows){const previous=collectionItems(),byId=new Map(previous.map(x=>[x.id,x])),stored=rows.map(validWork).filter(Boolean);persistedIds.clear();gallery=[];pendingWorks=[];for(const saved of stored){persistedIds.add(saved.id);const existing=byId.get(saved.id);const item=existing||saved;if(existing&&!dirtyIds.has(saved.id))Object.assign(existing,saved);if(gallery.length<GALLERY_LIMIT)gallery.push(item);else pendingWorks.push(item);}for(const item of previous){if(persistedIds.has(item.id)||!dirtyIds.has(item.id))continue;if(gallery.length<GALLERY_LIMIT)gallery.push(item);else pendingWorks.push(item);}sortGallery();}
function markSaved(item){persistedIds.add(item.id);dirtyIds.delete(item.id);failedIds.delete(item.id);pendingWorks=pendingWorks.filter(x=>x.id!==item.id);if(!gallery.some(x=>x.id===item.id))gallery.unshift(item);sortGallery();}
async function persistWorkNow(item){
 if(!gallery.some(x=>x.id===item.id)&&gallery.length>=GALLERY_LIMIT){addPending(item);refreshCollectionUI();return'full';}
 const record={...item};try{const answer=await collectionStore.put(record,legacySourceIds.has(item.id)?item.id:null);if(answer==='full'){gallery=gallery.filter(x=>x.id!==item.id);addPending(item);try{adoptSavedSnapshot((await collectionStore.snapshot()).items);}catch{}return'full';}markSaved(item);if(item.name!==record.name)dirtyIds.add(item.id);memoryOnly=failedIds.size>0;if(!memoryOnly)storageIssue='';return'saved';}
 catch(e){storageFailed(e);failedIds.add(item.id);dirtyIds.add(item.id);if(!gallery.some(x=>x.id===item.id)&&!pendingWorks.some(x=>x.id===item.id)){if(gallery.length<GALLERY_LIMIT)gallery.unshift(item);else addPending(item);}sortGallery();return'memory';}
 finally{refreshCollectionUI();}
}
function saveWork(item){dirtyIds.add(item.id);refreshCollectionUI();return queueGallery(async()=>{await galleryReady;return persistWorkNow(item);});}
async function initializeGallery(){
 let legacy=[];try{const raw=JSON.parse(localStorage.getItem(STORE)||'[]');if(Array.isArray(raw)){legacy=raw.map(validWork).filter(Boolean);if(legacy.length<raw.length)storageIssue='有旧版作品无法读取，原始本机备份仍保留。';}}catch(e){if(e&&e.name==='SyntaxError')storageIssue='旧版本机备份暂时无法读取，原始数据仍保留。';/* Legacy backup is deliberately never deleted. */}
 legacy.forEach(x=>legacySourceIds.add(x.id));
 try{const saved=await collectionStore.snapshot();gallery=saved.items.map(validWork).filter(Boolean);gallery.forEach(x=>persistedIds.add(x.id));sortGallery();const migrated=new Set(saved.migrated);for(const item of legacy){if(migrated.has(item.id))continue;if(gallery.some(x=>x.id===item.id)){await collectionStore.put(gallery.find(x=>x.id===item.id),item.id);continue;}await persistWorkNow(item);}}
 catch(e){storageFailed(e);for(const item of legacy){if(gallery.some(x=>x.id===item.id))continue;if(gallery.length<GALLERY_LIMIT)gallery.push(item);else addPending(item);dirtyIds.add(item.id);failedIds.add(item.id);}sortGallery();}
 galleryReadyDone=true;refreshCollectionUI();return true;
}
const galleryReady=initializeGallery();
function syncGalleryNavigation(s){
 const works=s==='gallery'||(s==='result'&&resultFromGallery);$('makeNav').classList.toggle('active',!works);$('worksNav').classList.toggle('active',works);
 for(const [id,active]of [['makeNav',!works],['worksNav',works]]){if(active)$(id).setAttribute('aria-current','page');else $(id).removeAttribute('aria-current');}
 if(['editor','result'].includes(s)&&!resultFromGallery)makingScreen=s;
}
function navigateWorks(){if(screen==='gallery')return;if(screen==='result')updateName();if(screen==='ritual'){ask('先去看看作品？','这一轮染色会结束，扎点、蜡稿和照片取景都会保留。回来后可重新入染。',()=>{makingScreen='editor';resultFromGallery=false;openCollection();});return;}openCollection();}
function navigateMaking(){navigateHome();}
$('makeNav').onclick=navigateMaking;$('worksNav').onclick=navigateWorks;

function archiveImage(){const image=make();drawItemResult(ctx(image),finishedCloth,craftItemType);const data=image.toDataURL('image/png');image.width=image.height=1;return data;}
function commitResult(){restoreFinishedCloth();const names=['一方草木','布里有风','小满人间','心事成花','今夜月白','且染春山'];currentResult={id:`${Date.now()}-${craftSeed}-${Math.random().toString(36).slice(2,8)}`,name:names[craftSeed%names.length],itemType:craftItemType,exposure:Math.round(r.soakTotal*10)/10,mode:craftMode,style:craftStyle,cycles:r.cycle,date:Date.now(),image:archiveImage(),seed:craftSeed,recipe:typeof dyeRecipe==='undefined'?null:JSON.parse(JSON.stringify(dyeRecipe)),recipeLabel:typeof recipeSummary==='function'?recipeSummary():''};resultFromGallery=false;makingResult=currentResult;const c=ctx($('resultCanvas'));drawItemResult(c,finishedCloth,craftItemType);showResult();saveWork(currentResult).then(status=>{if(status==='full')toast('作品已有 50 幅。这方蓝仍在待保存区，请先导出或删除一些旧作。');});}
function currentSaveStatus(){if(!currentResult)return'';if(!galleryReadyDone)return'正在打开本机作品，请稍候…';if(pendingWorks.some(x=>x.id===currentResult.id))return'作品已满 50 幅 · 这方蓝待保存，请先导出或删除旧作';if(isUnsaved(currentResult))return storageIssue?'尚未保存到本机 · 请及时导出，刷新后可能丢失':'正在保存到本机…';return'已保存在此浏览器 · 点标题可题名';}
function showResult(){if(!currentResult)return;document.querySelector('.result-hero p').textContent='';$('resultName').value=currentResult.name;$('resultInfo').textContent=itemInfo(currentResult);$('otherModeBtn').innerHTML=icon(currentResult.mode==='draw'?'photo':'brush')+(currentResult.itemType==='tote'?'看看帆布袋':currentResult.mode==='tie'?'试试蜡染':currentResult.mode==='draw'?'试试照片入染':'试试手绘');setScreen('result');refreshCollectionUI();}
function updateName(){if(!currentResult)return;const name=($('resultName').value.trim()||'无题之蓝').slice(0,12);if(currentResult.name!==name){currentResult.name=name;const item=findWork(currentResult.id);if(item)item.name=name;saveWork(currentResult);} $('resultName').value=name;}
$('resultName').addEventListener('change',updateName);$('resultName').addEventListener('keydown',e=>{if(e.key==='Enter')e.target.blur();});
function returnEditor(m,fresh){r.token++;setTechnique(m==='tie'?'tie':'wax');if(fresh&&m==='tie'){resetTieDraft();saveTieDraft();}r.phase='idle';resultFromGallery=false;if(fresh&&m==='draw'){commands=[];maskCtx.clearRect(0,0,N,N);markTextileResistDirty(mask);saveDraft();}setMode(m);setScreen('editor');updateEditorButtons();}
$('againBtn').onclick=()=>{updateName();startMaking();};$('otherModeBtn').onclick=()=>{updateName();if(currentResult.itemType==='tote'){openMorePlay(currentResult.id);return;}returnEditor(currentResult.mode==='draw'?'photo':'draw',false);};
let workOpenToken=0;
function openWork(item,fromGallery=true){const token=++workOpenToken,im=new Image();im.onload=()=>{if(token!==workOpenToken)return;r.token++;currentResult=item;resultFromGallery=fromGallery;const c=ctx($('resultCanvas'));c.clearRect(0,0,N,N);c.drawImage(im,0,0,N,N);closeModal();showResult();};im.onerror=()=>toast('这幅作品暂时无法显示，仍可在作品页选择后导出。');im.src=item.image;}
function openCollection(){workOpenToken++;renderGallery();setScreen('gallery');}
function workCard(item){const selected=gallerySelection.has(item.id);return`<div class="gallery-entry${selected?' selected':''}"><button class="gallery-card" data-work="${escapeHTML(item.id)}" aria-label="${gallerySelecting?(selected?'取消选择 ':'选择 '):'查看 '}${escapeHTML(item.name)}"${gallerySelecting?` aria-pressed="${selected}"`:''}><img src="${item.image}" alt="${escapeHTML(item.name)}" loading="lazy" decoding="async"><strong>${escapeHTML(item.name)}</strong><small>${modeLabel(item)} · ${formatDate(item.date)}</small>${isUnsaved(item)?'<span class="gallery-state">仅本次保留 · 请导出</span>':''}</button>${gallerySelecting?`<span class="gallery-checkbox" aria-hidden="true"><input type="checkbox" tabindex="-1" ${selected?'checked':''}></span>`:''}</div>`;}
function renderGallery(){
 if(!$('galleryGrid'))return;const all=collectionItems();gallerySelection=new Set([...gallerySelection].filter(id=>all.some(x=>x.id===id)));$('galleryCount').textContent=String(gallery.length);$('galleryGrid').innerHTML=gallery.map(workCard).join('');$('galleryEmpty').hidden=!!all.length;$('galleryManage').hidden=!all.length;$('galleryManage').textContent=gallerySelecting?'完成':'选择';$('galleryManage').setAttribute('aria-pressed',String(gallerySelecting));$('galleryToolbar').hidden=!gallerySelecting;$('gallerySelected').textContent=`已选 ${gallerySelection.size} 幅`;$('gallerySelectAll').textContent=gallerySelection.size===all.length&&all.length?'取消全选':'全选';$('galleryExport').disabled=!gallerySelection.size||galleryBusy;$('galleryDelete').disabled=!gallerySelection.size||galleryBusy;
 $('galleryPending').hidden=!pendingWorks.length;$('galleryPending').innerHTML=pendingWorks.length?`<h2>${pendingWorks.length} 方蓝，等待保存</h2><p>最多保存 50 幅。这里的作品仍可查看、导出；刷新或关闭前，请删去一些旧作后再保存。</p><div class="gallery-grid">${pendingWorks.map(workCard).join('')}</div><button class="outline-btn" id="savePendingWorks" ${galleryBusy?'disabled':''}>腾出位置后，继续保存</button>`:'';if($('savePendingWorks'))$('savePendingWorks').onclick=retryGalleryStorage;
 $('galleryNotice').hidden=!storageIssue;$('galleryNotice').textContent=storageIssue;const unsaved=all.filter(isUnsaved).length;$('galleryStorage').textContent=!galleryReadyDone?'正在打开作品…':unsaved?`有 ${unsaved} 幅尚未存好，请及时导出。作品不会上传，清理浏览器数据会移除本机作品。`:'仅保存在当前浏览器，最多 50 幅；不会自动替换旧作。清理浏览器数据会移除本机作品，喜欢的作品请另行导出。';$('galleryRetry').hidden=!storageIssue||!unsaved;$('galleryRetry').disabled=galleryBusy;
 $('galleryPage').querySelectorAll('[data-work]').forEach(button=>button.onclick=()=>{const item=findWork(button.dataset.work);if(!item)return;if(gallerySelecting){if(gallerySelection.has(item.id))gallerySelection.delete(item.id);else gallerySelection.add(item.id);renderGallery();const replacement=[...$('galleryPage').querySelectorAll('[data-work]')].find(b=>b.dataset.work===item.id);if(replacement)replacement.focus({preventScroll:true});}else openWork(item,true);});
}
function refreshCollectionUI(){if($('saveStatus'))$('saveStatus').textContent=currentSaveStatus();if($('manageFullGallery'))$('manageFullGallery').hidden=!currentResult||!pendingWorks.some(x=>x.id===currentResult.id);if($('retryCurrentSave'))$('retryCurrentSave').hidden=!currentResult||!isUnsaved(currentResult)||pendingWorks.some(x=>x.id===currentResult.id)||!storageIssue;if(screen==='gallery')renderGallery();}
$('galleryManage').onclick=()=>{gallerySelecting=!gallerySelecting;gallerySelection.clear();renderGallery();};$('gallerySelectAll').onclick=()=>{const items=collectionItems();gallerySelection=gallerySelection.size===items.length?new Set():new Set(items.map(x=>x.id));renderGallery();};$('galleryRetry').onclick=retryGalleryStorage;
$('manageFullGallery').onclick=navigateWorks;$('retryCurrentSave').onclick=()=>{if(currentResult)saveWork(currentResult);};
async function retryGalleryStorage(){if(galleryBusy)return;galleryBusy=true;renderGallery();await queueGallery(async()=>{await galleryReady;try{const snap=await collectionStore.snapshot();adoptSavedSnapshot(snap.items);for(const item of [...collectionItems()])if(isUnsaved(item)||pendingWorks.some(x=>x.id===item.id))await persistWorkNow(item);}catch(e){storageFailed(e);}});galleryBusy=false;refreshCollectionUI();toast(pendingWorks.length?'仍有待保存作品，请导出或删除一些旧作后再试。':dirtyIds.size?'还有作品未存好，请先导出备份。':'作品已保存到本机。');}
$('galleryDelete').onclick=()=>{const ids=[...gallerySelection];if(!ids.length||galleryBusy)return;ask(`删除这 ${ids.length} 幅作品？`,'将从本机作品中移除，无法在作品页恢复。请先导出想保留的作品。',()=>deleteSelectedWorks(ids));};
async function deleteSelectedWorks(ids){galleryBusy=true;renderGallery();await queueGallery(async()=>{await galleryReady;const persistent=ids.filter(id=>persistedIds.has(id)||legacySourceIds.has(id));try{if(persistent.length)await collectionStore.remove(ids,ids.filter(id=>legacySourceIds.has(id)));gallery=gallery.filter(x=>!ids.includes(x.id));pendingWorks=pendingWorks.filter(x=>!ids.includes(x.id));ids.forEach(id=>{persistedIds.delete(id);dirtyIds.delete(id);failedIds.delete(id);gallerySelection.delete(id);});if(!failedIds.size){memoryOnly=false;storageIssue='';}if(makingResult&&ids.includes(makingResult.id)){makingResult=null;makingScreen='editor';}if(currentResult&&ids.includes(currentResult.id))currentResult=null;toast(`已删除 ${ids.length} 幅作品。`);}catch(e){storageFailed(e);toast('删除未完成，作品仍然保留。请稍后重试。');}});galleryBusy=false;refreshCollectionUI();}
// A standards-based, uncompressed ZIP: real image files plus a portable metadata manifest.
$('galleryExport').onclick=async()=>{const items=collectionItems().filter(x=>gallerySelection.has(x.id));if(!items.length||galleryBusy)return;const api=window.xhs&&window.xhs.miniTool&&window.xhs.miniTool.saveImageToPhotosAlbum;if(!api){toast('打开单幅作品后，长按图片即可保存。');return;}galleryBusy=true;renderGallery();try{for(const item of items)await api({filePath:item.image});toast(`已保存 ${items.length} 幅作品到相册。`);}catch(e){toast('保存未完成，请逐幅打开作品重试。');}finally{galleryBusy=false;renderGallery();}};window.addEventListener('beforeunload',e=>{if(dirtyIds.size||pendingWorks.length){e.preventDefault();e.returnValue='';}});



function makePoster(){updateName();const poster=make(1200,1600),c=ctx(poster);c.fillStyle='#f6f4e9';c.fillRect(0,0,1200,1600);c.globalAlpha=.4;const tile=c.createPattern(paper,'repeat');c.fillStyle=tile;c.fillRect(0,0,1200,1600);c.globalAlpha=1;c.strokeStyle='#355e7b';c.lineWidth=2;c.strokeRect(36,36,1128,1528);c.strokeStyle='#b3c2c5';c.lineWidth=1;c.strokeRect(45,45,1110,1510);
const corners=[[66,66,1,1],[1134,66,-1,1],[66,1534,1,-1],[1134,1534,-1,-1]];c.strokeStyle='#355e7b';c.lineWidth=3;for(const [x,y,sx,sy]of corners){c.save();c.translate(x,y);c.scale(sx,sy);c.beginPath();c.moveTo(0,56);c.lineTo(0,0);c.lineTo(56,0);c.moveTo(11,41);c.lineTo(11,11);c.lineTo(41,11);c.stroke();c.restore();}
c.fillStyle='#28516e';c.textAlign='left';c.font=`32px ${serif}`;c.fillText('蓝 染 工 坊',88,127);c.textAlign='right';c.font=`22px ${serif}`;c.fillText(currentResult.mode==='tie'?'扎染作品':'蜡染作品',1112,124);c.fillStyle='#1c405c';c.shadowColor='#183b5525';c.shadowBlur=25;c.shadowOffsetY=8;c.drawImage($('resultCanvas'),85,193,1030,1030);c.shadowColor='transparent';c.textAlign='center';c.font=`54px ${serif}`;c.fillText(currentResult.name,585,1336);c.font=`22px ${serif}`;c.fillStyle='#648093';c.fillText(itemInfo(currentResult),600,1397);c.strokeStyle='#c4cece';c.beginPath();c.moveTo(452,1440);c.lineTo(748,1440);c.stroke();c.font=`22px ${serif}`;c.fillText('蓝染工坊 · 作品',600,1492);return poster;}
let posterURL=null;
function openExport(){if(!currentResult)return;try{pendingPoster=makePoster();const data=pendingPoster.toDataURL('image/png');openModal('保存作品',`<p class="sheet-copy" style="text-align:center">长按图片保存，或使用下方按钮存入相册。</p><img id="exportImage" class="save-image" src="${data}" alt="蓝染作品分享图"><button class="primary" id="downloadPoster">${icon('save')}保存作品图</button><div class="download-row"><button id="saveBare">仅保存布面</button></div><p class="footnote">照片与作品都留在你的设备里</p>`);$('sheet').classList.add('save-sheet');$('downloadPoster').onclick=()=>saveCanvas(pendingPoster);$('saveBare').onclick=()=>saveCanvas($('resultCanvas'));}catch(err){console.error(err);toast('图片生成失败，请重试。');}}
$('exportBtn').onclick=openExport;
async function saveCanvas(c){try{const api=window.xhs&&window.xhs.miniTool&&window.xhs.miniTool.saveImageToPhotosAlbum;if(!api){toast('长按作品图可以保存到本机。');return;}await api({filePath:c.toDataURL('image/png')});toast('作品已保存到相册。');}catch(e){toast('保存未完成，请长按作品图保存。');}}


// Home, navigation and viewport allocation. Drawing/ritual/result do not scroll.
let layoutFrame=0;
function scheduleLayout(){if(layoutFrame)return;layoutFrame=requestAnimationFrame(()=>{layoutFrame=0;fitWorkspace();});}
function fitWorkspace(){
 const viewport=window.visualViewport;const height=Math.round(viewport?.height||window.innerHeight||800);document.documentElement.style.setProperty('--app-height',height+'px');
 const frame=$('clothFrame');if(screen==='editor'&&frame){const size=Math.max(80,Math.floor(Math.min((frame.clientWidth||364)-24,frame.clientHeight||300)));document.documentElement.style.setProperty('--cloth-size',size+'px');studioUpdateCamera();}
 const stage=$('ritualStage');if(screen==='ritual'&&stage){const width=Math.max(90,Math.min(stage.clientWidth||300,(stage.clientHeight||330)*768/840));document.documentElement.style.setProperty('--scene-width',Math.floor(width)+'px');document.documentElement.style.setProperty('--scene-height',Math.floor(width*840/768)+'px');}
 if(screen==='result'){const holder=document.querySelector('.result-scroll'),size=Math.max(80,Math.floor(Math.min(holder?.clientWidth||300,(holder?.clientHeight||360)-60)));document.documentElement.style.setProperty('--result-size',size+'px');}
}
window.addEventListener('resize',scheduleLayout);window.visualViewport?.addEventListener('resize',scheduleLayout);window.visualViewport?.addEventListener('scroll',scheduleLayout);
if(typeof ResizeObserver!=='undefined'){const observer=new ResizeObserver(scheduleLayout);for(const id of ['app','clothFrame','ritualStage'])observer.observe($(id));}
function navigateHome(){
 const go=()=>{workOpenToken++;if(screen==='result')updateName();resultFromGallery=false;gallerySelecting=false;gallerySelection.clear();setScreen('home');};
 if(screen==='ritual'){ask('先回到首页？','这一轮染色会结束，蜡稿会保留。',go);return;}go();
}
function beginMaking(kind){closeModal();workOpenToken++;setTechnique(kind);resultFromGallery=false;if(!dyeRecipe.mixed){dyeRecipe.mixed=true;refreshDyeRecipe();syncMixUI();}setScreen('editor');}
function chooseTechnique(){
 const waxArt=`<svg class="method-illustration wax-method-art" viewBox="0 0 120 100" aria-hidden="true"><path class="method-cloth" d="M16 13 91 9 99 83 19 88Z"/><path class="method-stitch" d="m23 20 61-4 7 61-65 4Z"/><g transform="translate(55 48)"><path class="method-wax" d="M0-4C-25-40-39-5-6 0c-35 22-3 40 6 5 22 37 41 1 5-6C39-26 3-42 0-4Z"/><circle class="method-wax" r="5"/></g><path class="method-pencil" d="m86 21 10-12 10 9-11 11-30 26-7 1 2-8Z"/><path class="method-pencil-tip" d="m60 48-2 8 8-1Z"/></svg>`;
 const tieArt=`<svg class="method-illustration tie-method-art" viewBox="0 0 120 100" aria-hidden="true"><path class="method-folded-cloth" d="m18 35 16-22 19 14 13-18 15 21 21 1-9 23 9 22-25-1-13 16-14-18-21 9-4-23-12-9Z"/><path class="method-fold-lines" d="m34 13 17 38-26 8m41-50-8 40 23-19m21 1L63 52l39 24M29 82l24-23 11 32m13-16-17-17"/><path class="method-rope-shadow" d="M16 44c23 19 60 12 85-7M24 64c22-11 49-20 67-35"/><path class="method-rope" d="M16 42c23 19 60 12 85-7M24 62c22-11 49-20 67-35"/><path class="method-knot" d="M55 50c-22-17-21 5-1 5 21 13 23-11 3-5m-1 3-6 15m9-14 11 13"/></svg>`;
 openModal('选择染法',`<div class="technique-choices"><button data-technique="wax">${waxArt}<strong>蜡染</strong><span>描蜡留白</span></button><button data-technique="tie">${tieArt}<strong>扎染</strong><span>捏揉折叠，亲手系绳</span></button></div>`);
 $('sheetBody').querySelectorAll('button[data-technique]').forEach(b=>b.onclick=()=>{beginMaking(b.dataset.technique);syncStudio();});
}
function startMaking(){closeModal();setScreen('items');requestAnimationFrame(()=>syncItemSwiper(true));}
function refreshHome(){const hasDraft=commands.some(x=>x.kind!=='clear')||photo;$('homeStartHint').textContent=hasDraft?'选好布料，继续创作':'选一块布，染出自己的纹样';}
function drawHomeCloth(){/* The home illustration is a bundled image; material rendering remains on the workbench. */}
$('itemsBackBtn').onclick=navigateHome;
$('selectItemBtn').onclick=chooseTechnique;
function openSettings(id,title){
 const content=$(id),parent=content.parentNode,after=content.nextSibling;openModal(title,'<div id="settingsMount"></div>',()=>{content.hidden=true;parent.insertBefore(content,after?.isConnected?after:null);photoSourcePreview=false;renderEditor();scheduleLayout();});$('settingsMount').appendChild(content);content.hidden=false;
}
$('startMakingBtn').onclick=startMaking;$('homeRecipesBtn').onclick=()=>enterRecipeLab();$('homeCultureBtn').onclick=()=>openCulture();
$('drawingSettingsBtn').onclick=()=>openSettings('drawingSettings','随心落笔');$('photoSettingsBtn').onclick=()=>openSettings('photoSettings','调整蜡稿');
$('sourcePhotoBtn').onclick=()=>{const show=!photoSourcePreview;closeModal();photoSourcePreview=show;renderEditor();};
$('cropReturnBtn').onclick=()=>{photoSourcePreview=false;renderEditor();};
$('micInfoBtn').onclick=()=>openModal('让风经过布面','<div class="about-text"><p>点击「吹口气」后，浏览器才会申请麦克风许可。声音只在本机换算成风力，不录音，也不上传。</p><p>声音强弱只是吹气的近似，周围的说话声或音乐也可能起作用。使用麦克风时，背景弦音会暂时停止。</p><p>没有麦克风许可，也可以用手扇风，或等它自然晾干。</p></div>');
window.addEventListener('popstate',event=>{
 workOpenToken++;
 if(!$('modal').hidden)closeModal();
 const next=event.state?.yifanglan?event.state.screen:'home';
 // A timed ritual cannot be re-entered from history; keep its input and return to the workbench.
 const route=next==='ritual'?'editor':next==='result'&&!currentResult?'home':next==='mix'?'home':next;
 setScreen(['home','items','editor','result','gallery'].includes(route)?route:'home',{history:false});
});
// Read-only measurements for a real browser. jsdom has no layout engine and cannot validate these.
function getLayoutDiagnostics(){
 const height=window.visualViewport?.height||window.innerHeight,width=window.visualViewport?.width||window.innerWidth;
 const navElement=document.querySelector('.bottom-nav'),nav=navElement.getBoundingClientRect(),page=document.querySelector('.page:not([hidden])'),rect=page?.getBoundingClientRect(),workspaceBottom=getComputedStyle(navElement).display==='none'?height:nav.top;
 const visible=el=>{const r=el.getBoundingClientRect(),css=getComputedStyle(el);return r.width>0&&r.height>0&&css.visibility!=='hidden'&&css.display!=='none';};
 const controls=page?[...page.querySelectorAll('button,input,canvas')].filter(visible):[];
 const clipped=controls.filter(el=>{const r=el.getBoundingClientRect(),scrollable=el.closest('.editor-tool-row');return (!scrollable&&(r.left<-.5||r.right>width+.5))||r.top<-.5||r.bottom>workspaceBottom+1;}).map(el=>({id:el.id||el.getAttribute('aria-label'),rect:el.getBoundingClientRect().toJSON?.()}));
 return{screen,viewport:{width,height},workspace:document.body.dataset.workspace==='true',documentHeight:document.documentElement.scrollHeight,verticalOverflow:Math.max(0,document.documentElement.scrollHeight-height),page:rect?.toJSON?.(),nav:nav.toJSON?.(),controlsOutsideWorkspace:clipped,modalOpen:!$('modal').hidden};
}


// Optional, independent discovery experiences. Load after gallery/export and before bootstrap.
const DISCOVERY_INTRO_KEY='yifanglan-intro-seen-v1';
let discoveryActive=null,discoverySequence=0,discoveryIntroSeen=false,discoveryInitialized=false;
let discoveryProduct={kind:'tote',scale:1,sourceId:null,source:null,texture:null,canvas:null,loading:false};
function discoveryTemplate(id){const t=$(id);return t?t.innerHTML:'';}
function discoveryEscape(value){return String(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function discoverySeen(){if(discoveryIntroSeen)return true;try{return localStorage.getItem(DISCOVERY_INTRO_KEY)==='1';}catch{return false;}}
function discoveryMarkSeen(){discoveryIntroSeen=true;try{localStorage.setItem(DISCOVERY_INTRO_KEY,'1');}catch{/* One visit remains skippable even when persistent storage is blocked. */}}
function discoveryOpen(title,html,kind,onClose=null){
 if(!$('modal').hidden)closeModal();
 const ticket=++discoverySequence;discoveryActive=kind;
 openModal(title,html,()=>{if(ticket===discoverySequence){discoverySequence++;discoveryActive=null;}if(onClose)onClose();$('sheet').classList.remove('discovery-sheet','intro-sheet');$('modal').classList.remove('intro-modal');$('closeModal').hidden=false;});
 $('sheet').classList.add('discovery-sheet');$('sheet').scrollTop=0;return ticket;
}
function initDiscovery(){
 if(discoveryInitialized)return;discoveryInitialized=true;
 if(!discoverySeen()&&$('discoveryIntroTemplate'))replayIntro();
}
function discoveryShowIntro(kind='intro'){
 const html=discoveryTemplate('discoveryIntroTemplate');if(!html)return;
 let keyHandler;
 discoveryOpen('蓝染小记',html,kind,()=>{discoveryMarkSeen();document.body.classList.remove('intro-open');document.removeEventListener('keydown',keyHandler);});
 document.body.classList.add('intro-open');
 $('sheet').classList.add('intro-sheet');$('modal').classList.add('intro-modal');
 // Page changes are manual; the footer stays in place.
 $('closeModal').hidden=true;
 const slides=[...$('introDeck').querySelectorAll('.intro-slide')],dots=[...$('introDots').querySelectorAll('i')];let page=0;
 function go(next){page=Math.max(0,Math.min(slides.length-1,next));slides.forEach((slide,i)=>{slide.classList.toggle('is-active',i===page);slide.classList.toggle('is-before',i<page);slide.setAttribute('aria-hidden',String(i!==page));});dots.forEach((dot,i)=>dot.classList.toggle('is-current',i===page));$('introCounter').textContent=String(page+1).padStart(2,'0')+' / 04';$('introStart').textContent=page===3?'开始制作':'跳过介绍，开始制作';}
 $('introDeck').onclick=()=>go((page+1)%slides.length);
 keyHandler=e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key)&&!(['Enter',' '].includes(e.key)&&e.target===$('introDeck')))return;e.preventDefault();go((page+(e.key==='ArrowLeft'?-1:1)+slides.length)%slides.length);};document.addEventListener('keydown',keyHandler);
 go(0);
 $('introSkip').onclick=closeModal;
 $('introStart').onclick=()=>{closeModal();if(typeof startMaking==='function')startMaking();};
 $('introSkip').focus({preventScroll:true});
}
function replayIntro(){discoveryShowIntro('intro');}
function openCulture(){discoveryShowIntro('culture');}
function discoverySources(){
 const sources=[],seen=new Set();if(currentResult&&currentResult.image){sources.push({...currentResult,isCurrent:true});seen.add(currentResult.id);}
 if(typeof collectionItems==='function')for(const item of collectionItems()){if(!item||!item.image||seen.has(item.id))continue;sources.push({...item,isCurrent:false});seen.add(item.id);}return sources;
}
function discoverySample(){
 const c=make(),g=ctx(c);g.fillStyle='#2c5872';g.fillRect(0,0,N,N);g.lineCap='round';g.strokeStyle='#e6e3cf';g.lineWidth=8;
 for(let y=86;y<N;y+=145)for(let x=84;x<N;x+=145){g.save();g.translate(x,y);g.beginPath();for(let k=0;k<6;k++){const a=k*Math.PI/3;g.moveTo(Math.cos(a)*7,Math.sin(a)*7);g.bezierCurveTo(Math.cos(a-.4)*53,Math.sin(a-.4)*53,Math.cos(a+.4)*53,Math.sin(a+.4)*53,Math.cos(a)*7,Math.sin(a)*7);}g.stroke();g.beginPath();g.arc(0,0,6,0,Math.PI*2);g.stroke();g.restore();}
 g.strokeStyle='#ebe8d217';g.lineWidth=1;for(let x=0;x<N;x+=4){g.beginPath();g.moveTo(x,0);g.lineTo(x,N);g.stroke();}for(let y=0;y<N;y+=4){g.beginPath();g.moveTo(0,y);g.lineTo(N,y);g.stroke();}return c;
}
function openMorePlay(preferredId=null,settings={}){
 const html=discoveryTemplate('discoveryPlayTemplate');if(!html)return;
 const ticket=discoveryOpen('帆布袋预览',html,'product');let sources=discoverySources(),sourceJob=0;
 const initialKind='tote',initialScale=Math.min(1.8,Math.max(1,Number(settings.scale)||1));
 discoveryProduct={kind:initialKind,scale:initialScale,sourceId:null,source:null,texture:null,canvas:null,loading:false};
 function active(){return ticket===discoverySequence&&discoveryActive==='product'&&!!$('productPreview');}
 function list(){
  if(!active())return;const box=$('productSources');box.innerHTML='';$('productSourceCount').textContent=sources.length?`${sources.length} 方可用`:'示意样布';$('productEmpty').hidden=sources.length>0;
  const entries=sources.length?sources:[{id:'sample',name:'示意纹样',sample:true}];
  entries.forEach(item=>{const b=document.createElement('button');b.className='product-source';b.type='button';b.setAttribute('aria-label',`${item.sample?'示意纹样':item.isCurrent?'当前作品':'已保存作品'}：${item.name||'无题之蓝'}`);b.setAttribute('aria-pressed',String(discoveryProduct.sourceId===item.id));b.dataset.sourceId=item.id;
   const im=document.createElement('img');im.alt='';im.loading='lazy';im.src=item.sample?discoverySample().toDataURL('image/png'):item.image;b.appendChild(im);const label=document.createElement('span');label.textContent=item.sample?'示意纹样':`${item.isCurrent?'当前 · ':''}${item.name||'无题之蓝'}`;b.appendChild(label);b.onclick=()=>select(item,true);box.appendChild(b);});
 }
 function select(item,restoreFocus=false){
  if(!active())return;const job=++sourceJob;discoveryProduct.sourceId=item.id;discoveryProduct.source=item;discoveryProduct.loading=true;discoveryProduct.texture=null;discoveryProduct.canvas=null;$('productExport').disabled=true;$('productStatus').textContent='正在读取布面…';$('productPreviewTag').textContent=item.sample?'示意纹样':item.isCurrent?'当前作品':'已保存作品';
  const g=ctx($('productPreview'));g.fillStyle='#e6e7db';g.fillRect(0,0,960,1200);list();if(restoreFocus){const button=[...$('productSources').children].find(el=>el.dataset.sourceId===item.id);if(button)button.focus({preventScroll:true});}
  function ready(texture){if(!active()||job!==sourceJob)return;discoveryProduct.texture=texture;discoveryProduct.loading=false;render();}
  if(item.sample){ready(discoverySample());return;}
  const im=new Image();im.onload=()=>{if(!active()||job!==sourceJob)return;const normalized=make();ctx(normalized).drawImage(im,0,0,N,N);ready(normalized);};im.onerror=()=>{if(!active()||job!==sourceJob)return;discoveryProduct.loading=false;$('productStatus').textContent='布面读取失败，请换一幅作品。';};im.src=item.image;
 }
 function render(){
  if(!active()||!discoveryProduct.texture)return;
  try{const p=discoveryProduct;const artwork=discoveryRenderProduct(p.texture,p.kind,p.scale,p.source);p.canvas=artwork;const c=$('productPreview'),g=ctx(c);g.clearRect(0,0,c.width,c.height);g.drawImage(artwork,0,0,c.width,c.height);c.setAttribute('aria-label',`${p.source.sample?'示意纹样':p.source.name||'作品'}的帆布袋预览`);$('productStatus').textContent=p.source.sample?'示意纹样 · 染好自己的作品后，可以替换这方布。':`正在使用「${p.source.name||'无题之蓝'}」的实际布面`;$('productExport').disabled=false;}catch(e){discoveryProduct.canvas=null;$('productExport').disabled=true;$('productStatus').textContent='预览生成失败，请换一幅作品。';}
 }
 $('productScale').oninput=e=>{discoveryProduct.scale=Number(e.target.value)/100;$('productScaleValue').textContent=`${e.target.value}%`;render();};
 $('productStart').onclick=()=>{closeModal();if(typeof startMaking==='function')startMaking();};$('productExport').onclick=()=>{if(discoveryProduct.canvas&&!discoveryProduct.loading)discoveryExportProduct();};
 $('productScale').value=String(Math.round(initialScale*100));$('productScaleValue').textContent=`${Math.round(initialScale*100)}%`;
 list();select(sources.find(x=>x.id===preferredId)||sources[0]||{id:'sample',name:'示意纹样',sample:true});
 // Gallery hydration may finish after the sheet opens. Preserve an explicit user selection.
 if(typeof galleryReady!=='undefined')Promise.resolve(galleryReady).then(()=>{if(!active())return;const fresh=discoverySources();if(fresh.length===sources.length&&fresh.every((x,i)=>x.id===sources[i]?.id))return;sources=fresh;list();if(discoveryProduct.source?.sample&&sources.length)select(sources[0]);}).catch(()=>{});
}
function discoveryRenderProduct(texture,kind,scale,source){
 const out=make(960,1200),g=ctx(out),tile=make(),t=ctx(tile);t.fillStyle='#e9e4d3';t.fillRect(0,0,N,N);const size=N/scale;t.drawImage(texture,(N-size)/2,(N-size)/2,size,size,0,0,N,N);
 g.fillStyle='#fbfcfe';g.fillRect(0,0,960,1200);g.strokeStyle='#163e8c03';g.lineWidth=1;for(let y=0;y<1200;y+=5){g.beginPath();g.moveTo(0,y);g.lineTo(960,y);g.stroke();}
 const light=g.createRadialGradient(320,360,20,480,620,800);light.addColorStop(0,'#ffffff44');light.addColorStop(1,'#d6e1f410');g.fillStyle=light;g.fillRect(0,0,960,1200);
 g.fillStyle='#667b9d';g.font='18px sans-serif';g.textAlign='left';g.fillText('蓝 染 工 坊  /  布 上 生 活',70,87);g.fillStyle='#173d8f';g.font='bold 42px sans-serif';g.fillText('帆布袋预览',70,155);
 {
  g.save();g.strokeStyle='#aab4a0';g.lineWidth=49;g.lineCap='round';g.shadowColor='#26475022';g.shadowBlur=18;g.shadowOffsetY=9;
  g.beginPath();g.moveTo(331,499);g.bezierCurveTo(310,230,625,230,628,499);g.stroke();g.shadowColor='transparent';g.lineWidth=35;g.strokeStyle='#d8d9c6';g.stroke();g.lineWidth=2;g.setLineDash([5,7]);g.strokeStyle='#71877588';g.stroke();g.restore();
  const bag=()=>{g.beginPath();g.moveTo(211,447);g.quadraticCurveTo(480,427,749,447);g.lineTo(715,895);g.quadraticCurveTo(480,934,246,895);g.closePath();};
  g.save();bag();g.shadowColor='#2544512a';g.shadowBlur=26;g.shadowOffsetY=18;g.fillStyle='#c6cdba';g.fill();g.shadowColor='transparent';g.clip();g.drawImage(tile,209,421,541,511);
  const folds=g.createLinearGradient(210,0,750,0);folds.addColorStop(0,'#0c263856');folds.addColorStop(.07,'#ffffe00a');folds.addColorStop(.17,'#ffffff12');folds.addColorStop(.23,'#09263813');folds.addColorStop(.65,'#ffffff05');folds.addColorStop(.84,'#152d3d21');folds.addColorStop(.94,'#e5e2b211');folds.addColorStop(1,'#09233456');g.fillStyle=folds;g.fillRect(208,420,544,515);g.fillStyle='#e3e2c82b';g.fillRect(200,447,560,15);g.strokeStyle='#efeedb85';g.lineWidth=2;g.setLineDash([5,7]);g.beginPath();g.moveTo(231,469);g.lineTo(267,879);g.quadraticCurveTo(480,912,695,879);g.lineTo(729,469);g.stroke();g.beginPath();g.moveTo(221,468);g.quadraticCurveTo(480,451,739,468);g.stroke();g.restore();
  g.save();g.fillStyle='#d9ddc8';g.fillRect(312,449,38,67);g.fillRect(610,449,38,67);g.strokeStyle='#788d7b';g.lineWidth=1.5;g.setLineDash([3,4]);g.strokeRect(317,454,28,55);g.strokeRect(615,454,28,55);g.restore();
 }
 g.strokeStyle='#82977c55';g.beginPath();g.moveTo(70,1005);g.lineTo(890,1005);g.stroke();g.fillStyle='#173d8f';g.textAlign='left';g.font='bold 27px sans-serif';const title=(source.name||'无题之蓝').slice(0,12);g.fillText(source.sample?'示意纹样 · 体验样布':title,70,1065);g.fillStyle='#657b9e';g.font='18px sans-serif';g.fillText(source.sample?'生成的样布，仅作搭配示意':'使用这一方作品的实际布面',70,1103);g.textAlign='right';g.font='18px sans-serif';g.fillText('数字成品预览',890,1065);g.fillText('帆布袋 / 随身一点蓝',890,1103);return out;
}
function discoveryExportProduct(){
 const p=discoveryProduct;if(!p.canvas||p.loading)return;let data;
 try{data=p.canvas.toDataURL('image/png');}catch{toast('图片没有生成成功，请重试。');return;}
 const canvas=p.canvas,source=p.source,kind=p.kind,scale=p.scale,sourceId=source.sample?null:source.id,name=`${source.sample?'示意纹样':(source.name||'蓝染工坊').replace(/[\\/:*?"<>|]/g,'')}-帆布袋预览.png`;
 discoveryOpen('保存成品预览',`<div class="discovery product-export"><p class="product-export-intro">长按图片保存，或存入小红书相册。</p><img class="product-export-image" src="${data}" alt="${discoveryEscape(source.name)}的帆布袋搭配预览"><button class="primary" id="productDownload">保存预览图</button><p class="product-export-file">960 × 1200 · PNG · ${source.sample?'示意纹样':'你的作品布面'}</p><div class="product-save-options"><button id="productReturn">换个搭配再看看</button></div></div>`,'product-export');
 $('productDownload').onclick=()=>saveCanvas(canvas);$('productReturn').onclick=()=>openMorePlay(sourceId,{kind,scale});
}


// Read-only diagnostics for integration and regression testing.
window.IndigoDemo={version:'19.0.0',getState:()=>({screen,itemType:selectedItemId,mode,technique,ties:technique==='tie'?tiePlan.bindings.length:0,tiePreparation:tiePlanUndoStack.length,tieStage:tiePlan.tool==='bind'?'bind':'prepare',tieTool:tiePlan.tool,tieUnfold:r.tieUnfold,untied:r.untied.length,phase:r.phase,soakSeconds:r.soakSeconds,soakTotal:r.soakTotal,craftMode,cycles:r.cycle,fanActive:performance.now()<r.fanUntil,scraped:r.scrape,dry:r.dry,wind:r.wind,microphone:mic.state,micActive:!!mic.stream,hasPhoto:!!photo,photoStyle,photoInverted,photoScale,photoSourcePreview,strokes:commands.length,collection:gallery.length,pendingCollection:pendingWorks.length,unsavedCollection:collectionItems().filter(isUnsaved).length,collectionReady:galleryReadyDone,collectionLimit:GALLERY_LIMIT,storageIssue,memoryOnly,sound}),getIntegrationNotes:()=>({offline:true,platformBridge:'window.xhs.miniTool.saveImageToPhotosAlbum({filePath})',noNetworkRequests:true,microphone:'User-initiated RMS amplitude, locally processed, no recording/upload; HTTPS or localhost required',cloth:'Separate tonal-wax and whole-sheet pinch, gather, fold and bind workflows; 20-second bath, rinse then oxidation and animated wind drying'})};
window.IndigoDemo.mixing={getRecipe:()=>mixSnapshot(),getSavedRecipes:()=>savedRecipes.map(x=>({...x,units:{...x.units}})),getDyeTone,getDevelopTone,isIndigoRecipe,recipeSummary,getState:()=>({progress:mixStirProgress,stirring:mixAnimating,storageReadable:recipeStoreReadable,storageMessage:recipeStoreMessage,recipeCount:savedRecipes.length})};
window.IndigoApp=window.IndigoDemo;
window.IndigoApp.getLayoutDiagnostics=getLayoutDiagnostics;
initStudio();replay();setMode('draw');drawHomeCloth();setScreen('home',{history:false});
try{history.replaceState({yifanglan:true,screen:'home'},'','#home');}catch{}
if(typeof initDiscovery==='function')initDiscovery();
scheduleLayout();

})();