import { aiProxyFetch, aiProxyGet } from '../lib/proxyFetch';
import { supabase } from '../lib/supabase';

function getEntityLabel(entityType: string): string {
  switch (entityType) {
    case 'characters': return 'character';
    case 'places': return 'place/location';
    case 'things': return 'object/item';
    default: return 'technology/system';
  }
}

function buildPrompt(entityType: string, entityName: string): string {
  const label = getEntityLabel(entityType);
  return `You are a visual analyst for a novel-writing application. Describe what you see in this image as it relates to a fictional ${label}${entityName ? ` named "${entityName}"` : ''}. Focus on:
- Physical appearance, distinctive features, and visual details
- Colors, textures, materials, and lighting
- Mood, atmosphere, and emotional tone
- Any notable symbols, markings, or distinguishing characteristics
Write a rich, detailed description that a writer could use to maintain visual consistency. Be specific and vivid. Write in present tense, 2-3 paragraphs.`;
}

async function getVisionEndpoint(): Promise<string> {
  const { data } = await supabase
    .from('generation_settings')
    .select('vision_api_endpoint, api_endpoint, remote_api_endpoint')
    .limit(1)
    .maybeSingle();

  const candidates = [
    data?.vision_api_endpoint,
    data?.api_endpoint,
    data?.remote_api_endpoint,
  ].filter(Boolean) as string[];

  if (candidates.length === 0) return 'http://localhost:1234';

  // Try each candidate to find one that's reachable
  for (const ep of candidates) {
    const base = ep.replace(/\/v1\/.*$/, '');
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(`${base}/v1/models`, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) return base;
    } catch {
      // try next
    }
  }

  // None reachable, return first one (will show error to user)
  return candidates[0].replace(/\/v1\/.*$/, '');
}

export async function checkVisionConnection(endpoint?: string): Promise<boolean> {
  try {
    let base: string;
    if (endpoint) {
      base = endpoint.replace(/\/v1\/.*$/, '');
    } else {
      base = await getVisionEndpoint();
    }
    const res = await aiProxyGet(`${base}/v1/models`);
    return res.ok;
  } catch {
    return false;
  }
}

export async function analyzeImageWithVision(params: {
  imageBase64: string;
  entityType: string;
  entityName: string;
  model?: string;
  apiEndpoint?: string;
}): Promise<string> {
  const { imageBase64, entityType, entityName, model, apiEndpoint } = params;
  const modelName = model || 'llava-v1.6-mistral-7b';

  let dataUri = imageBase64;
  if (!dataUri.startsWith('data:')) {
    dataUri = `data:image/jpeg;base64,${dataUri}`;
  }

  const prompt = buildPrompt(entityType, entityName);

  let targetUrl: string;
  if (apiEndpoint) {
    const base = apiEndpoint.replace(/\/v1\/.*$/, '');
    targetUrl = `${base}/v1/chat/completions`;
  } else {
    const base = await getVisionEndpoint();
    targetUrl = `${base}/v1/chat/completions`;
  }

  const res = await aiProxyFetch(targetUrl, {
    model: modelName,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: { url: dataUri },
          },
        ],
      },
    ],
    max_tokens: 1000,
    temperature: 0.3,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Vision API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || data.choices?.[0]?.text || '';
}
