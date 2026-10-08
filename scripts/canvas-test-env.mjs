import {access,copyFile,mkdir,readdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import os from 'node:os';

// Windows Skia needs ICU data next to the native binding. Some registry builds
// omit it; an installed Edge already supplies it. No download or app change.
export async function canvasTestEnv(){
 const env={...process.env};if(process.platform!=='win32'||env.NAPI_RS_NATIVE_LIBRARY_PATH)return env;
 const require=createRequire(import.meta.url);let native;
 try{native=require.resolve(`@napi-rs/canvas-win32-${process.arch}-msvc`);}catch{return env;}
 const present=async file=>{try{await access(file);return true;}catch{return false;}};
 if(await present(path.join(path.dirname(native),'icudtl.dat')))return env;
 let data;for(const base of [process.env['ProgramFiles(x86)'],process.env.ProgramFiles]){
  if(!base)continue;const app=path.join(base,'Microsoft','Edge','Application');
  try{const versions=(await readdir(app)).filter(x=>/^\d+\./.test(x)).sort((a,b)=>b.localeCompare(a,undefined,{numeric:true}));for(const version of versions){const file=path.join(app,version,'icudtl.dat');if(await present(file)){data=file;break;}}}catch{}
  if(data)break;
 }
 if(!data)return env;
 const dir=path.join(os.tmpdir(),'lanran-canvas-qa-0.1.100',process.arch);await mkdir(dir,{recursive:true});
 await copyFile(native,path.join(dir,'skia.node'));await copyFile(data,path.join(dir,'icudtl.dat'));
 env.NAPI_RS_NATIVE_LIBRARY_PATH=path.join(dir,'skia.node');return env;
}
