// Local-only preview connected to an explicit isolated staging project.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),vm=require('node:vm'),assert=require('node:assert/strict');
const a=JSON.parse(fs.readFileSync(process.env.PUDDLE_STAGING_AUTH||'../staging-auth.json','utf8'));
assert.ok(process.env.PUDDLE_STAGING_REF&&process.env.PUDDLE_STAGING_REF!=='amjkbkbmqpaifqurzozg');
assert.equal(a.url,`https://${process.env.PUDDLE_STAGING_REF}.supabase.co`);
const root=process.cwd();
http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/api/client-config'){
  const context=vm.createContext({process:{env:{SUPABASE_URL:a.url,SUPABASE_ANON_KEY:a.key}},Buffer,URL});
  vm.runInContext(fs.readFileSync('api/client-config.js','utf8').replace('export default ',''),context);return context.handler(req,res);
 }
 const target=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
 if(!target.startsWith(root+path.sep)||url.pathname.startsWith('/.')){res.writeHead(403);return res.end();}
 try{res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.png':'image/png','.webp':'image/webp'})[path.extname(target)]||'text/plain');res.end(fs.readFileSync(target));}
 catch{res.writeHead(404);res.end('Not found');}
}).listen(7894,'127.0.0.1',()=>console.log('Staging-only local preview listening on 127.0.0.1:7894'));
