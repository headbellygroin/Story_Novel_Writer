const PROXY_BASE = '/lmstudio-api';
const DEFAULT_CHAT_PATH = '/v1/chat/completions';

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

export async function checkVisionConnection(): Promise<boolean> {
  try {
    const res = await fetch(`${PROXY_BASE}/v1/models`, {
      signal: AbortSignal.timeout(5000),
    });
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
}): Promise<string> {
  const { imageBase64, entityType, entityName, model } = params;
  const modelName = model || 'llava-1.6-mistral-7b';

  let dataUri = imageBase64;
  if (!dataUri.startsWith('data:')) {
    dataUri = `data:image/jpeg;base64,${dataUri}`;
  }

  const prompt = buildPrompt(entityType, entityName);

  const res = await fetch(`${PROXY_BASE}${DEFAULT_CHAT_PATH}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
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
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Vision API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || data.choices?.[0]?.text || '';
}
