// Only public client configuration is exposed. Private/service-role keys are rejected.
export default function handler(req,res){
  res.setHeader('Content-Type','application/javascript; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  const supabaseUrl=process.env.SUPABASE_URL;
  const supabaseKey=process.env.SUPABASE_ANON_KEY;
  let publicKey=typeof supabaseKey==='string'&&supabaseKey.startsWith('sb_publishable_');
  if(!publicKey&&typeof supabaseKey==='string'){
    try { publicKey=JSON.parse(Buffer.from(supabaseKey.split('.')[1],'base64url').toString()).role==='anon'; } catch(_) {}
  }
  let validUrl=false;
  try { const url=new URL(supabaseUrl); validUrl=url.protocol==='https:'&&url.hostname.endsWith('.supabase.co')&&!url.username&&!url.password; } catch(_) {}
  const config=validUrl&&publicKey?{supabaseUrl,supabaseKey}:{error:'The preview database is not configured yet.'};
  res.statusCode=validUrl&&publicKey?200:503;
  res.end('window.PUDDLE_CONFIG='+JSON.stringify(config).replace(/</g,'\\u003c')+';');
}
