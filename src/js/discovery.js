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
