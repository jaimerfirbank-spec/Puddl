const MAX_IMAGE_CHARS = 4_000_000;

const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['nodes', 'edges', 'warnings', 'image_summary'],
  properties: {
    nodes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'label', 'shape', 'x', 'y', 'width', 'height', 'confidence', 'notes'],
        properties: {
          id: { type: 'string' },
          label: { type: 'string' },
          shape: { type: 'string', enum: ['circle', 'oval', 'rectangle', 'unknown'] },
          x: { type: 'integer', minimum: 0, maximum: 1000 },
          y: { type: 'integer', minimum: 0, maximum: 1000 },
          width: { type: 'integer', minimum: 1, maximum: 1000 },
          height: { type: 'integer', minimum: 1, maximum: 1000 },
          confidence: { type: 'integer', minimum: 0, maximum: 100 },
          notes: { type: 'string' }
        }
      }
    },
    edges: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['source', 'target', 'direction', 'confidence', 'notes'],
        properties: {
          source: { type: 'string' },
          target: { type: 'string' },
          direction: { type: 'string', enum: ['source_to_target', 'target_to_source', 'both', 'unclear'] },
          confidence: { type: 'integer', minimum: 0, maximum: 100 },
          notes: { type: 'string' }
        }
      }
    },
    warnings: { type: 'array', items: { type: 'string' } },
    image_summary: { type: 'string' }
  }
};

const instructions = `You convert a clear hand-drawn systems or social map into structured data.
The drawing uses black marker on white paper. Nodes are circles, ovals, or rectangles. Printed labels are inside or very close to nodes. Lines connect nodes and arrowheads show direction.

Rules:
- Find every real node exactly once. Do not treat arrowheads, lines, text, page edges, or notebook holes as nodes.
- Copy each label exactly as written. Use [UNREADABLE] only when genuinely unreadable. Never guess a different common name.
- Give every node a unique id such as n1, n2, n3.
- Coordinates use a 0-1000 grid relative to the full image. x and y are the top-left of the node box.
- Find every visible connection. Trace each line between node outlines. Read arrowheads carefully.
- For a one-way arrow, source is where the line starts and target is where the arrow points; direction is source_to_target.
- Use both only when arrowheads clearly appear at both ends.
- Do not invent connections. Put doubtful details in warnings and lower confidence.
- Return empty arrays if the image is not a map.`;

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function validGraph(result){
  if(!result||!Array.isArray(result.nodes)||!Array.isArray(result.edges)||!Array.isArray(result.warnings)||result.nodes.length>500||result.edges.length>2000) return false;
  const ids=new Set();
  for(const n of result.nodes){
    if(!n||typeof n.id!=='string'||ids.has(n.id)||typeof n.label!=='string'||!['circle','oval','rectangle','unknown'].includes(n.shape)) return false;
    for(const k of ['x','y','width','height']) if(!Number.isFinite(n[k])||n[k]<0||n[k]>1000) return false;
    if(n.width<=0||n.height<=0) return false;
    ids.add(n.id);
  }
  return result.edges.every(e=>e&&ids.has(e.source)&&ids.has(e.target)&&['source_to_target','target_to_source','both','unclear'].includes(e.direction));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Use POST.' });
  if (!process.env.OPENAI_API_KEY||!process.env.SUPABASE_URL||!process.env.SUPABASE_ANON_KEY) return send(res, 503, { error: 'The photo reader is not configured yet.' });

  const image = req.body && req.body.image;
  if (typeof image !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/.test(image)) {
    return send(res, 400, { error: 'Please upload a JPG, PNG, or WebP image.' });
  }
  if (image.length > MAX_IMAGE_CHARS) return send(res, 413, { error: 'The image is too large. Please use a smaller photo.' });

  const token=req.headers.authorization;
  if(typeof token!=='string'||!/^Bearer \S+$/.test(token)) return send(res,401,{error:'Sign in to Puddle before reading a photo.'});
  try {
    const authHeaders={apikey:process.env.SUPABASE_ANON_KEY,Authorization:token};
    const userResponse=await fetch(process.env.SUPABASE_URL+'/auth/v1/user',{headers:authHeaders,signal:AbortSignal.timeout(10000)});
    if(!userResponse.ok) return send(res,401,{error:'Please sign in again before reading a photo.'});
    const user=await userResponse.json();
    if(!user.id) return send(res,401,{error:'Please sign in again.'});
    const allowance=await fetch(process.env.SUPABASE_URL+'/rest/v1/rpc/consume_photo_read',{
      method:'POST',headers:{...authHeaders,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(10000)
    });
    if(!allowance.ok) return send(res,503,{error:'Photo reading is temporarily unavailable.'});
    if(await allowance.json()!==true) { res.setHeader('Retry-After','3600'); return send(res,429,{error:'Your account cannot read another photo right now. Check your subscription or try again in an hour.'}); }
    const apiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      signal: AbortSignal.timeout(90000),
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-6.1-terra',
        store: false,
        reasoning: { effort: 'medium' },
        instructions,
        input: [{
          role: 'user',
          content: [
            { type: 'input_text', text: 'Read this hand-drawn map. Be exact and conservative.' },
            { type: 'input_image', image_url: image, detail: 'high' }
          ]
        }],
        text: {
          format: {
            type: 'json_schema',
            name: 'puddl_image_map',
            description: 'Nodes and directed edges detected in a hand-drawn map.',
            strict: true,
            schema
          }
        }
      })
    });

    const responseBody = await apiResponse.json();
    if (!apiResponse.ok) {
      return send(res, 502, { error: 'The photo reader could not finish. Please try again shortly.' });
    }

    const outputText = responseBody.output_text || (responseBody.output || [])
      .flatMap(item => item.content || [])
      .filter(item => item.type === 'output_text')
      .map(item => item.text)
      .join('');
    if (!outputText) return send(res, 502, { error: 'The photo reader returned no result.' });

    const result=JSON.parse(outputText);
    if(!validGraph(result)) return send(res,502,{error:'The photo reading was incomplete. Try a clearer photo.'});
    return send(res, 200, { result });
  } catch (error) {
    console.error('image-to-map failed', error.name||'Error');
    return send(res, 500, { error: 'The photo reader could not finish. Please try again.' });
  }
}
