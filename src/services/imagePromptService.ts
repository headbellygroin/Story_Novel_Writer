interface SceneContext {
  sceneDescription: string;
  sceneContent?: string;
  characters?: Array<{ name: string; role: string; personality: string; image_description?: string }>;
  places?: Array<{ name: string; type: string; description: string; image_description?: string }>;
  things?: Array<{ name: string; type: string; description: string; image_description?: string }>;
  genre?: string;
}

export function buildImagePrompt(context: SceneContext): string {
  const parts: string[] = [];

  const genreStyle = context.genre ? mapGenreToStyle(context.genre) : '';
  if (genreStyle) parts.push(genreStyle);

  const sceneText = context.sceneContent
    ? extractVisualElements(context.sceneContent)
    : context.sceneDescription;

  parts.push(sceneText);

  if (context.places && context.places.length > 0) {
    const place = context.places[0];
    if (place.image_description) {
      parts.push(place.image_description);
    } else if (place.description) {
      parts.push(`setting: ${place.description}`);
    }
  }

  if (context.characters && context.characters.length > 0) {
    const charDescs = context.characters.slice(0, 3).map((c) => {
      if (c.image_description) return c.image_description;
      return `${c.name}`;
    });
    if (charDescs.length > 0) {
      parts.push(charDescs.join(', '));
    }
  }

  if (context.things && context.things.length > 0) {
    const thingDescs = context.things.slice(0, 2).map((t) => {
      if (t.image_description) return t.image_description;
      return t.description;
    });
    parts.push(thingDescs.join(', '));
  }

  parts.push('cinematic lighting, detailed, high quality, 8k');

  let prompt = parts.filter(Boolean).join(', ');

  if (prompt.length > 500) {
    prompt = prompt.slice(0, 497) + '...';
  }

  return prompt;
}

function mapGenreToStyle(genre: string): string {
  const g = genre.toLowerCase();
  if (g.includes('fantasy')) return 'epic fantasy illustration, magical atmosphere';
  if (g.includes('sci-fi') || g.includes('science fiction')) return 'science fiction concept art, futuristic';
  if (g.includes('horror')) return 'dark atmospheric horror, moody lighting';
  if (g.includes('romance')) return 'romantic soft lighting, warm tones';
  if (g.includes('thriller') || g.includes('mystery')) return 'noir style, dramatic shadows, suspenseful';
  if (g.includes('historical')) return 'historically accurate period piece, detailed costumes';
  if (g.includes('western')) return 'american western landscape, dusty frontier';
  if (g.includes('steampunk')) return 'steampunk aesthetic, brass and gears, victorian';
  if (g.includes('cyberpunk')) return 'cyberpunk neon city, rain, holographic';
  if (g.includes('dystop')) return 'dystopian wasteland, post-apocalyptic';
  if (g.includes('literary') || g.includes('fiction')) return 'realistic, painterly, atmospheric';
  return 'cinematic, atmospheric';
}

function extractVisualElements(content: string): string {
  const sentences = content.split(/[.!?]+/).filter(Boolean);
  const visualKeywords = [
    'light', 'dark', 'shadow', 'bright', 'glow', 'shimmer',
    'red', 'blue', 'green', 'gold', 'silver', 'black', 'white',
    'tall', 'vast', 'narrow', 'wide', 'massive', 'tiny',
    'forest', 'city', 'room', 'castle', 'street', 'mountain',
    'rain', 'snow', 'fire', 'water', 'wind', 'storm',
    'sword', 'gun', 'door', 'window', 'throne', 'bridge',
    'standing', 'running', 'sitting', 'fighting', 'walking',
    'smoke', 'fog', 'mist', 'dust', 'blood',
  ];

  const visualSentences = sentences.filter((s) => {
    const lower = s.toLowerCase();
    return visualKeywords.some((kw) => lower.includes(kw));
  });

  const chosen = visualSentences.length > 0 ? visualSentences.slice(0, 3) : sentences.slice(0, 2);
  return chosen
    .map((s) => s.trim())
    .join('. ')
    .replace(/["']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
