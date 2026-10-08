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
