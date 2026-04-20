export interface ArtStylePreset {
  id: string;
  name: string;
  checkpoint: string;
  promptPrefix: string;
  promptSuffix: string;
  negativePrompt: string;
  samplerOverride: string;
  stepsOverride: number | null;
  cfgOverride: number | null;
}

export const DEFAULT_ART_STYLE_PRESETS: ArtStylePreset[] = [
  {
    id: 'photorealistic',
    name: 'Photorealistic',
    checkpoint: '',
    promptPrefix: 'photorealistic, ultra detailed photograph,',
    promptSuffix: 'natural lighting, sharp focus, DSLR quality, 8k',
    negativePrompt: 'cartoon, anime, illustration, painting, drawing, art, sketch, text, watermark, blurry',
    samplerOverride: '',
    stepsOverride: 30,
    cfgOverride: 7,
  },
  {
    id: 'fantasy-illustration',
    name: 'Fantasy Illustration',
    checkpoint: '',
    promptPrefix: 'epic fantasy illustration, detailed digital painting,',
    promptSuffix: 'dramatic lighting, rich colors, concept art, artstation trending',
    negativePrompt: 'photograph, photo, realistic, text, watermark, blurry, low quality',
    samplerOverride: '',
    stepsOverride: 25,
    cfgOverride: 7.5,
  },
  {
    id: 'dark-gothic',
    name: 'Dark / Gothic',
    checkpoint: '',
    promptPrefix: 'dark gothic art, moody atmosphere,',
    promptSuffix: 'dramatic shadows, muted colors, atmospheric, detailed',
    negativePrompt: 'bright, colorful, cheerful, cartoon, text, watermark, blurry',
    samplerOverride: '',
    stepsOverride: 30,
    cfgOverride: 8,
  },
  {
    id: 'anime-manga',
    name: 'Anime / Manga',
    checkpoint: '',
    promptPrefix: 'anime style, detailed anime illustration,',
    promptSuffix: 'vibrant colors, clean lines, high quality anime art',
    negativePrompt: 'photograph, realistic, 3d render, text, watermark, blurry, bad anatomy',
    samplerOverride: '',
    stepsOverride: 25,
    cfgOverride: 7,
  },
  {
    id: 'sci-fi',
    name: 'Sci-Fi / Cyberpunk',
    checkpoint: '',
    promptPrefix: 'science fiction concept art, futuristic,',
    promptSuffix: 'neon lighting, high tech, cinematic, detailed environment',
    negativePrompt: 'medieval, fantasy, nature, text, watermark, blurry, low quality',
    samplerOverride: '',
    stepsOverride: 28,
    cfgOverride: 7.5,
  },
  {
    id: 'watercolor',
    name: 'Watercolor',
    checkpoint: '',
    promptPrefix: 'beautiful watercolor painting,',
    promptSuffix: 'soft edges, flowing colors, artistic, traditional media, elegant',
    negativePrompt: 'photograph, digital art, sharp edges, text, watermark, blurry',
    samplerOverride: '',
    stepsOverride: 25,
    cfgOverride: 7,
  },
  {
    id: 'oil-painting',
    name: 'Oil Painting',
    checkpoint: '',
    promptPrefix: 'oil painting, classical art style, masterwork,',
    promptSuffix: 'rich textures, visible brushstrokes, museum quality, fine art',
    negativePrompt: 'photograph, digital art, anime, cartoon, text, watermark',
    samplerOverride: '',
    stepsOverride: 30,
    cfgOverride: 8,
  },
  {
    id: 'comic-book',
    name: 'Comic Book',
    checkpoint: '',
    promptPrefix: 'comic book art, bold ink lines,',
    promptSuffix: 'dynamic composition, vibrant flat colors, graphic novel style',
    negativePrompt: 'photograph, realistic, 3d, text, watermark, blurry',
    samplerOverride: '',
    stepsOverride: 25,
    cfgOverride: 7,
  },
];
