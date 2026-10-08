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
