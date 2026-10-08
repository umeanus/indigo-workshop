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
