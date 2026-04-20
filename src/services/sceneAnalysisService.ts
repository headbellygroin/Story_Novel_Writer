import { GenerationSettings } from './aiService';

export interface VisualMoment {
  textAnchor: string;
  imagePrompt: string;
  animationPrompt: string;
}

export async function analyzeChapterForVisuals(
  chapterText: string,
  genre: string,
  settings: GenerationSettings
): Promise<VisualMoment[]> {
  const prompt = buildAnalysisPrompt(chapterText, genre, settings);

  const requestBody: Record<string, unknown> = {
    prompt,
    temperature: 0.3,
    max_tokens: settings.max_tokens,
  };

  if (settings.top_p !== undefined) requestBody.top_p = settings.top_p;
  if (settings.stop_sequences && settings.stop_sequences.length > 0) {
    requestBody.stop = settings.stop_sequences;
  }

  const response = await fetch(settings.api_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(`Scene analysis API request failed: ${response.statusText}`);
  }

  const data = await response.json();
  const raw = data.choices?.[0]?.text || data.text || data.results?.[0]?.text || '';

  return parseVisualMoments(raw);
}

function buildAnalysisPrompt(chapterText: string, genre: string, settings: GenerationSettings): string {
  const genreHint = genre ? `The genre is ${genre}.` : '';

  return `${settings.system_prompt}

You are a visual director analyzing a chapter of a novel to identify key visual moments that should be illustrated for a YouTube litRPG audiobook. ${genreHint}

For each visual moment, provide:
1. TEXT_ANCHOR: The exact sentence or short passage from the chapter that this image corresponds to (so the system knows when to show this image during narration).
2. IMAGE_PROMPT: A Stable Diffusion prompt describing the scene in detail - include character appearances, setting, lighting, mood, action. Keep it under 400 characters.
3. ANIMATION_PROMPT: A brief description of subtle motion to add to the still image - glowing lights, swaying trees, flickering flames, breathing movement, floating particles. Keep it simple and under 100 characters.

Rules:
- Choose moments that are visually interesting: action scenes, dramatic reveals, important locations, emotional peaks.
- The number of images should match the chapter's needs. A quiet dialogue chapter might need 3-4 images. An action-packed chapter might need 8-12.
- Space images throughout the chapter so the viewer always has something relevant on screen.
- Do NOT choose moments that are purely internal thoughts with no visual component.

Output format (repeat for each moment):
---VISUAL_MOMENT---
TEXT_ANCHOR: [exact text from chapter]
IMAGE_PROMPT: [stable diffusion prompt]
ANIMATION_PROMPT: [subtle motion description]
---END_MOMENT---

Chapter text:
${chapterText.slice(0, 12000)}`;
}

function parseVisualMoments(raw: string): VisualMoment[] {
  const moments: VisualMoment[] = [];
  const blocks = raw.split('---VISUAL_MOMENT---').filter(Boolean);

  for (const block of blocks) {
    const cleaned = block.replace('---END_MOMENT---', '').trim();
    if (!cleaned) continue;

    const textAnchorMatch = cleaned.match(/TEXT_ANCHOR:\s*(.+?)(?=\nIMAGE_PROMPT:)/s);
    const imagePromptMatch = cleaned.match(/IMAGE_PROMPT:\s*(.+?)(?=\nANIMATION_PROMPT:)/s);
    const animationPromptMatch = cleaned.match(/ANIMATION_PROMPT:\s*(.+?)$/s);

    if (textAnchorMatch && imagePromptMatch) {
      moments.push({
        textAnchor: textAnchorMatch[1].trim(),
        imagePrompt: imagePromptMatch[1].trim().slice(0, 500),
        animationPrompt: animationPromptMatch?.[1]?.trim().slice(0, 200) || 'subtle ambient motion, gentle lighting shift',
      });
    }
  }

  return moments;
}
