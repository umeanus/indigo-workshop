import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../dist/',import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.json':'application/json'};
const server=createServer(async(request,response)=>{
 try{
  if(!['GET','HEAD'].includes(request.method)){response.writeHead(405);response.end();return;}
  const pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname);
  const target=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!target.startsWith(root)){response.writeHead(403);response.end();return;}
  const data=await readFile(target);response.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store'});response.end(request.method==='HEAD'?undefined:data);
 }catch{response.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});response.end('页面不存在');}
});
server.on('error',error=>{console.error(error.message);process.exitCode=1;});
server.listen(Number(process.env.PORT)||4173,'127.0.0.1',()=>console.log(`蓝染工坊：http://localhost:${Number(process.env.PORT)||4173}`));
