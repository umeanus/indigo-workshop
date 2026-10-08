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
