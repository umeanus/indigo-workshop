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
