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
