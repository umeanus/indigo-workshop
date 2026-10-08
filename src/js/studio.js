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
