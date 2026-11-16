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

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Use POST.' });
  if (!process.env.OPENAI_API_KEY) return send(res, 500, { error: 'The OpenAI key is not configured.' });

  const image = req.body && req.body.image;
  if (typeof image !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/.test(image)) {
    return send(res, 400, { error: 'Please upload a JPG, PNG, or WebP image.' });
  }
  if (image.length > MAX_IMAGE_CHARS) return send(res, 413, { error: 'The image is too large. Please use a smaller photo.' });

  try {
    const apiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
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
      const message = responseBody.error && responseBody.error.message;
      return send(res, apiResponse.status, { error: message || 'The photo reader failed.' });
    }

    const outputText = responseBody.output_text || (responseBody.output || [])
      .flatMap(item => item.content || [])
      .filter(item => item.type === 'output_text')
      .map(item => item.text)
      .join('');
    if (!outputText) return send(res, 502, { error: 'The photo reader returned no result.' });

    return send(res, 200, { result: JSON.parse(outputText) });
  } catch (error) {
    console.error('image-to-map failed', error);
    return send(res, 500, { error: 'The photo reader could not finish. Please try again.' });
  }
}
