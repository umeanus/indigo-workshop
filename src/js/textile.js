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

