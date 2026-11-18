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

const connectionSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['edges', 'warnings'],
  properties: {
    edges: schema.properties.edges,
    warnings: schema.properties.warnings
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
- Never omit a visible connection merely because its arrow direction is uncertain. Use direction unclear, confidence below 70, and explain the uncertainty in notes.
- Do not invent lines that are not visible. Put doubtful details in warnings and lower confidence.
- Return empty arrays if the image is not a map.`;

const connectionInstructions = `You are performing a second, connections-only inspection of a hand-drawn systems map.
The nodes have already been detected and their ids, labels, and boxes are supplied. Do not add, rename, merge, or remove nodes.

Inspect every supplied node one at a time:
- Look around the full outline for every line that touches or clearly enters/leaves it.
- Follow each line through crossings until it reaches another supplied node. A crossing without a marked junction is not a connection to the crossing line.
- Return every visible connection, including connections already found by an earlier pass.
- If endpoints are visible but arrow direction is not, return direction unclear with confidence below 70 rather than omitting the connection.
- If a crowded crossing leaves two plausible routes, return the most visually supported endpoint with low confidence and explain the ambiguity in notes.
- Do not return a connection unless visible ink supports a route between the two node outlines.
- source and target must use only supplied node ids.`;

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

function responseText(responseBody) {
  return responseBody.output_text || (responseBody.output || [])
    .flatMap(item => item.content || [])
    .filter(item => item.type === 'output_text')
    .map(item => item.text)
    .join('');
}

async function readWithOpenAI(body, timeoutMs = 90000) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const responseBody = await response.json();
  if (!response.ok) {
    const error = Error('provider_failed');
    error.isProviderFailure = true;
    throw error;
  }
  const outputText = responseText(responseBody);
  if (!outputText) {
    const error = Error('empty_provider_result');
    error.isProviderFailure = true;
    throw error;
  }
  return JSON.parse(outputText);
}

function edgeMeaning(edge) {
  if (edge.direction === 'both' || edge.direction === 'unclear') return edge.direction;
  const from = edge.direction === 'target_to_source' ? edge.target : edge.source;
  const to = edge.direction === 'target_to_source' ? edge.source : edge.target;
  return from + '>' + to;
}

function mergeEdges(firstEdges, focusedEdges) {
  const merged = new Map();
  for (const edge of [...firstEdges, ...focusedEdges]) {
    const key = [edge.source, edge.target].sort().join('|');
    const current = merged.get(key);
    if (!current) {
      merged.set(key, { ...edge });
      continue;
    }
    const currentMeaning = edgeMeaning(current), nextMeaning = edgeMeaning(edge);
    if (currentMeaning === nextMeaning) {
      if (edge.confidence > current.confidence) Object.assign(current, edge);
      current.confidence = Math.max(current.confidence, edge.confidence);
      continue;
    }
    if (current.direction === 'unclear' && edge.direction !== 'unclear') {
      merged.set(key, { ...edge, confidence: Math.min(edge.confidence, 69), notes: [edge.notes, current.notes].filter(Boolean).join(' ') });
      continue;
    }
    if (edge.direction === 'unclear') {
      current.confidence = Math.min(current.confidence, 69);
      current.notes = [current.notes, edge.notes].filter(Boolean).join(' ');
      continue;
    }
    current.direction = 'unclear';
    current.confidence = Math.min(current.confidence, edge.confidence, 49);
    current.notes = [current.notes, edge.notes, 'The two AI passes disagreed about arrow direction.'].filter(Boolean).join(' ');
  }
  return [...merged.values()];
}

function validFocusedConnections(result, ids) {
  return result && Array.isArray(result.edges) && Array.isArray(result.warnings) && result.edges.length <= 2000 && result.edges.every(edge =>
    edge && ids.has(edge.source) && ids.has(edge.target) && edge.source !== edge.target &&
    ['source_to_target', 'target_to_source', 'both', 'unclear'].includes(edge.direction) &&
    Number.isInteger(edge.confidence) && edge.confidence >= 0 && edge.confidence <= 100 && typeof edge.notes === 'string'
  );
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
    // Product usage allowances are still being decided. Keep server-verified
    // sign-in above, but let every authenticated user reach the paid reader.
    const result = await readWithOpenAI({
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
      });
    if(!validGraph(result)) return send(res,502,{error:'The photo reading was incomplete. Try a clearer photo.'});
    if (!result.nodes.length) return send(res, 200, { result });

    const nodeGuide = result.nodes.map(node => ({
      id: node.id,
      label: node.label,
      box: [node.x, node.y, node.width, node.height]
    }));
    try {
      const focused = await readWithOpenAI({
        model: 'gpt-6.1-terra',
        store: false,
        reasoning: { effort: 'low' },
        instructions: connectionInstructions,
        input: [{
          role: 'user',
          content: [
            { type: 'input_text', text: 'Trace connections for every node in this list. Boxes are [x, y, width, height] on a 0-1000 image grid.\n' + JSON.stringify(nodeGuide) },
            { type: 'input_image', image_url: image, detail: 'high' }
          ]
        }],
        text: {
          format: {
            type: 'json_schema',
            name: 'puddl_connection_pass',
            description: 'Directed and uncertain connections found during a node-by-node inspection.',
            strict: true,
            schema: connectionSchema
          }
        }
      }, 120000);
      const ids = new Set(result.nodes.map(node => node.id));
      if (validFocusedConnections(focused, ids)) {
        result.edges = mergeEdges(result.edges, focused.edges);
        result.warnings = [...new Set([...result.warnings, ...focused.warnings])];
      } else {
        result.warnings.push('The focused connection check returned incomplete data; review the first-pass connections carefully.');
      }
    } catch (error) {
      console.error('image-to-map connection pass failed', error.name || 'Error');
      result.warnings.push('The focused connection check could not finish; review the first-pass connections carefully.');
    }

    return send(res, 200, { result });
  } catch (error) {
    console.error('image-to-map failed', error.name||'Error');
    if (error.isProviderFailure) return send(res, 502, { error: 'The photo reader could not finish. Please try again shortly.' });
    return send(res, 500, { error: 'The photo reader could not finish. Please try again.' });
  }
}
