export interface GenerationSettings {
  model_name: string;
  api_endpoint: string;
  temperature: number;
  max_tokens: number;
  system_prompt: string;
  style_guide: string;
  top_p?: number;
  top_k?: number;
  repetition_penalty?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  context_length?: number;
  stop_sequences?: string[];
  style_rules?: Record<string, boolean>;
}

export interface StoryEvent {
  title: string;
  description: string;
  importance: string;
}

export interface CharacterState {
  character_name: string;
  physical_state: string;
  emotional_state: string;
  knowledge: string;
}

export interface StyleAnchorData {
  label: string;
  passage: string;
  notes: string;
}

export interface StoryBibleFact {
  subject: string;
  fact: string;
  importance: string;
  category: string;
  canon_status?: string;
}

export interface SceneSummaryData {
  sceneTitle: string;
  summary: string;
  key_facts: string[];
}

export type GenerationMode = 'scene' | 'design_brief' | 'outline' | 'deep_analysis';
export type ContextMode = 'minimal' | 'relevant' | 'full';

export interface PromptAssemblyReport {
  sections: Array<{
    label: string;
    key: string;
    tokens: number;
    included: boolean;
    truncated: boolean;
  }>;
  frameTokens: number;
  totalPromptTokens: number;
  maxBudget: number;
  contextMode: ContextMode;
}

const GENERATION_MODE_INSTRUCTIONS: Record<GenerationMode, string> = {
  scene: `Write this scene with vivid detail, engaging dialogue, and strong character voice. Focus on showing rather than telling.`,
  design_brief: `Generate a structured Design Brief document based on the above context and instructions. Do NOT write prose, dialogue, or scenes. Output ONLY the structured planning document with clear section headings. Focus on emotional purpose, character goals, theme goals, worldbuilding goals, reveal restrictions, and ending beats. The brief should be detailed enough that multiple writers could independently produce a recognizable chapter from it.`,
  outline: `Generate a structured chapter-by-chapter outline based on the above context and instructions. Do NOT write prose, dialogue, or scenes. For each chapter provide: title, POV character, location, emotional arc, plot beats, theme advancement, and key relationship moments. Focus on how each chapter serves the book's core question and advances character relationships.`,
  deep_analysis: `Perform a thorough analytical review of the provided material. Identify inconsistencies, continuity errors, unresolved plot threads, character behavior contradictions, timeline issues, and lore conflicts. Provide a structured report with specific citations and severity ratings. Focus on factual accuracy within the story world, not stylistic preferences.`,
};

export interface GenerateSceneRequest {
  sceneDescription: string;
  generationMode?: GenerationMode;
  contextMode?: ContextMode;
  context: {
    franchiseManifesto?: string;
    characters?: Array<{ name: string; role: string; personality: string; background: string; image_description?: string; dialogue_style?: string; personality_sliders_text?: string; infrastructure_sliders_text?: string; dossier?: string; canon_status?: string }>;
    places?: Array<{ name: string; type: string; description: string; image_description?: string; canon_status?: string; emergent_character?: boolean; infrastructure_sliders_text?: string }>;
    things?: Array<{ name: string; type: string; description: string; image_description?: string; canon_status?: string; emergent_character?: boolean; infrastructure_sliders_text?: string }>;
    technologies?: Array<{ name: string; type: string; description: string; image_description?: string; canon_status?: string; emergent_character?: boolean; infrastructure_sliders_text?: string }>;
    previousScenes?: string;
    previousSceneSummaries?: SceneSummaryData[];
    chapterSummary?: string;
    outlineSynopsis?: string;
    storyEvents?: StoryEvent[];
    characterStates?: CharacterState[];
    referencedScenes?: Array<{ title: string; content: string; note: string }>;
    storyBibleFacts?: StoryBibleFact[];
    styleAnchors?: StyleAnchorData[];
    prohibitedWords?: string[];
  };
  settings: GenerationSettings;
}

import { getActiveRulePrompts } from '../lib/styleRules';
import { aiProxyFetch } from '../lib/proxyFetch';

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}

function truncateToTokenBudget(text: string, maxTokens: number): string {
  const estimatedChars = Math.floor(maxTokens * 3.5);
  if (text.length <= estimatedChars) return text;
  return text.slice(0, estimatedChars) + '\n[...truncated for context length]';
}

export async function generateScene(request: GenerateSceneRequest): Promise<string> {
  const { sceneDescription, context, settings, generationMode = 'scene', contextMode = 'full' } = request;

  const contextLength = settings.context_length || 4096;
  let reservedForOutput = settings.max_tokens;
  const reservedForPromptFrame = 300;
  // Safety: cap context usage at 85% of window to prevent overflow
  const safeContextBudget = Math.floor(contextLength * 0.85);
  const availableForContext = safeContextBudget - reservedForOutput - reservedForPromptFrame;

  let contextPrompt = buildContextPrompt(context, availableForContext, contextMode);

  const activeRules = settings.style_rules ? getActiveRulePrompts(settings.style_rules) : [];
  const rulesBlock = activeRules.length > 0
    ? `\n\n=== ENFORCED STYLE RULES ===\n${activeRules.join('\n\n')}\n`
    : '';

  const prohibitedBlock = context.prohibitedWords && context.prohibitedWords.length > 0
    ? `\n\n=== PROHIBITED WORDS AND PHRASES ===\nDo NOT use any of these words or phrases in the generated text:\n${context.prohibitedWords.join(', ')}\n`
    : '';

  const modeLabel = generationMode === 'scene' ? 'Scene to write' : generationMode === 'design_brief' ? 'Design Brief Instructions' : generationMode === 'deep_analysis' ? 'Analysis Instructions' : 'Outline Instructions';
  const modeInstruction = GENERATION_MODE_INSTRUCTIONS[generationMode];

  let fullPrompt = `${settings.system_prompt}${rulesBlock}${prohibitedBlock}

${settings.style_guide ? `Writing Style Guidelines:\n${settings.style_guide}\n\n` : ''}${contextPrompt}

${modeLabel}:
${sceneDescription}

${modeInstruction}`;

  // Context window safety: if prompt exceeds 85%, progressively reduce
  let estimatedPromptTokens = estimateTokens(fullPrompt);
  let totalEstimated = estimatedPromptTokens + reservedForOutput;

  if (totalEstimated > safeContextBudget) {
    // Try with reduced context budget (strip to 70%)
    const reducedBudget = Math.floor(contextLength * 0.70) - reservedForOutput - reservedForPromptFrame;
    if (reducedBudget > 500) {
      console.warn(`[Story Forge] Context safety: prompt exceeded 85% threshold (${estimatedPromptTokens} tokens). Reducing context scope.`);
      contextPrompt = buildContextPrompt(context, reducedBudget, contextMode === 'full' ? 'relevant' : 'minimal');
      fullPrompt = `${settings.system_prompt}${rulesBlock}${prohibitedBlock}

${settings.style_guide ? `Writing Style Guidelines:\n${settings.style_guide}\n\n` : ''}${contextPrompt}

${modeLabel}:
${sceneDescription}

${modeInstruction}`;
      estimatedPromptTokens = estimateTokens(fullPrompt);
      totalEstimated = estimatedPromptTokens + reservedForOutput;
    }
  }

  if (totalEstimated > contextLength) {
    const available = contextLength - estimatedPromptTokens - 100;
    if (available < 200) {
      throw new Error(
        `Context window exceeded: prompt is ~${estimatedPromptTokens.toLocaleString()} tokens but model context is only ${contextLength.toLocaleString()} tokens. Try adding context tags to limit included entities.`
      );
    }
    reservedForOutput = available;
    console.warn(`[Story Forge] Auto-reduced max_tokens from ${settings.max_tokens} to ${reservedForOutput} to fit context window (${contextLength})`);
  }

  const isChatEndpoint = settings.api_endpoint.includes('/chat/completions');

  const baseBody: Record<string, unknown> = {
    temperature: settings.temperature,
    max_tokens: reservedForOutput,
  };

  if (settings.model_name) baseBody.model = settings.model_name;
  if (settings.top_p !== undefined) baseBody.top_p = settings.top_p;
  if (settings.top_k !== undefined) baseBody.top_k = settings.top_k;
  if (settings.repetition_penalty !== undefined) baseBody.repetition_penalty = settings.repetition_penalty;
  if (settings.presence_penalty !== undefined) baseBody.presence_penalty = settings.presence_penalty;
  if (settings.frequency_penalty !== undefined) baseBody.frequency_penalty = settings.frequency_penalty;
  if (settings.stop_sequences && settings.stop_sequences.length > 0) {
    baseBody.stop = settings.stop_sequences;
  }

  const requestBody: Record<string, unknown> = isChatEndpoint
    ? { ...baseBody, messages: [{ role: 'user', content: fullPrompt }] }
    : { ...baseBody, prompt: fullPrompt };

  try {
    const response = await aiProxyFetch(
      settings.api_endpoint,
      { ...requestBody, stream: false } as Record<string, unknown>,
    );

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`API request failed: ${response.status} ${errBody}`);
    }

    const data = await response.json();

    return (
      data.choices?.[0]?.message?.content ||
      data.choices?.[0]?.text ||
      data.text ||
      data.results?.[0]?.text ||
      'No content generated'
    );
  } catch (error) {
    console.error('Error generating scene:', error);
    throw error;
  }
}

export async function generateSceneStreaming(
  request: GenerateSceneRequest,
  onChunk: (text: string) => void,
): Promise<string> {
  const { sceneDescription, context, settings, generationMode = 'scene', contextMode = 'full' } = request;

  const contextLength = settings.context_length || 4096;
  const reservedForOutput = settings.max_tokens;
  const reservedForPromptFrame = 300;
  const safeContextBudget = Math.floor(contextLength * 0.85);
  const availableForContext = safeContextBudget - reservedForOutput - reservedForPromptFrame;

  let contextPrompt = buildContextPrompt(context, availableForContext, contextMode);

  const activeRules = settings.style_rules ? getActiveRulePrompts(settings.style_rules) : [];
  const rulesBlock = activeRules.length > 0
    ? `\n\n=== ENFORCED STYLE RULES ===\n${activeRules.join('\n\n')}\n`
    : '';

  const prohibitedBlock = context.prohibitedWords && context.prohibitedWords.length > 0
    ? `\n\n=== PROHIBITED WORDS AND PHRASES ===\nDo NOT use any of these words or phrases in the generated text:\n${context.prohibitedWords.join(', ')}\n`
    : '';

  const modeLabel = generationMode === 'scene' ? 'Scene to write' : generationMode === 'design_brief' ? 'Design Brief Instructions' : generationMode === 'deep_analysis' ? 'Analysis Instructions' : 'Outline Instructions';
  const modeInstruction = GENERATION_MODE_INSTRUCTIONS[generationMode];

  let fullPrompt = `${settings.system_prompt}${rulesBlock}${prohibitedBlock}

${settings.style_guide ? `Writing Style Guidelines:\n${settings.style_guide}\n\n` : ''}${contextPrompt}

${modeLabel}:
${sceneDescription}

${modeInstruction}`;

  // Context window safety: if prompt exceeds 85%, progressively reduce
  let estimatedPromptTokens = estimateTokens(fullPrompt);
  if (estimatedPromptTokens + reservedForOutput > safeContextBudget) {
    const reducedBudget = Math.floor(contextLength * 0.70) - reservedForOutput - reservedForPromptFrame;
    if (reducedBudget > 500) {
      console.warn(`[Story Forge] Streaming: context safety triggered, reducing scope.`);
      contextPrompt = buildContextPrompt(context, reducedBudget, contextMode === 'full' ? 'relevant' : 'minimal');
      fullPrompt = `${settings.system_prompt}${rulesBlock}${prohibitedBlock}

${settings.style_guide ? `Writing Style Guidelines:\n${settings.style_guide}\n\n` : ''}${contextPrompt}

${modeLabel}:
${sceneDescription}

${modeInstruction}`;
    }
  }

  const isChatEndpoint = settings.api_endpoint.includes('/chat/completions');

  const baseBody: Record<string, unknown> = {
    temperature: settings.temperature,
    max_tokens: settings.max_tokens,
    stream: true,
  };

  if (settings.model_name) baseBody.model = settings.model_name;
  if (settings.top_p !== undefined) baseBody.top_p = settings.top_p;
  if (settings.top_k !== undefined) baseBody.top_k = settings.top_k;
  if (settings.repetition_penalty !== undefined) baseBody.repetition_penalty = settings.repetition_penalty;
  if (settings.presence_penalty !== undefined) baseBody.presence_penalty = settings.presence_penalty;
  if (settings.frequency_penalty !== undefined) baseBody.frequency_penalty = settings.frequency_penalty;
  if (settings.stop_sequences && settings.stop_sequences.length > 0) {
    baseBody.stop = settings.stop_sequences;
  }

  const requestBody: Record<string, unknown> = isChatEndpoint
    ? { ...baseBody, messages: [{ role: 'user', content: fullPrompt }] }
    : { ...baseBody, prompt: fullPrompt };

  const response = await aiProxyFetch(
    settings.api_endpoint,
    requestBody as Record<string, unknown>,
    true,
  );

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`API request failed: ${response.status} ${errBody}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body reader available');

  const decoder = new TextDecoder();
  let accumulated = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]') continue;
      if (!trimmed.startsWith('data: ')) continue;

      try {
        const json = JSON.parse(trimmed.slice(6));
        const token = isChatEndpoint
          ? json.choices?.[0]?.delta?.content || ''
          : json.choices?.[0]?.text || '';
        if (token) {
          accumulated += token;
          onChunk(accumulated);
        }
      } catch {
        // skip malformed SSE lines
      }
    }
  }

  return accumulated || 'No content generated';
}

interface ContextSection {
  key: string;
  label: string;
  content: string;
  priority: number;
}

const SECTION_LABELS: Record<string, string> = {
  manifesto: 'Franchise Manifesto',
  bible: 'Story Bible',
  style: 'Style Anchors',
  synopsis: 'Story Synopsis',
  chapter: 'Chapter Summary',
  events: 'Story Events / Timeline',
  states: 'Character States',
  characters: 'Characters',
  places: 'Places / Setting',
  things: 'Things / Objects',
  tech: 'Technology / Magic',
  refs: 'Referenced Scenes',
  summaries: 'Scene Summaries',
  previous: 'Previous Scenes (Full)',
};

function buildSections(context: GenerateSceneRequest['context'], contextMode: ContextMode): ContextSection[] {
  const sections: ContextSection[] = [];

  if (context.franchiseManifesto) {
    sections.push({
      key: 'manifesto',
      label: SECTION_LABELS.manifesto,
      content: `=== FRANCHISE MANIFESTO (ABSOLUTE RULES - OVERRIDE ALL OTHER GUIDANCE) ===\n${context.franchiseManifesto}`,
      priority: 13,
    });
  }

  if (context.storyBibleFacts && context.storyBibleFacts.length > 0) {
    const activeFacts = context.storyBibleFacts.filter(f => f.canon_status !== 'deprecated');
    let factsToInclude = activeFacts;
    if (contextMode === 'minimal') {
      factsToInclude = activeFacts.filter(f => f.importance === 'critical');
    } else if (contextMode === 'relevant') {
      factsToInclude = activeFacts.filter(f => f.importance === 'critical' || f.importance === 'high');
    }
    if (factsToInclude.length > 0) {
      const sorted = [...factsToInclude].sort((a, b) => {
        const rank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
        return (rank[b.importance] || 0) - (rank[a.importance] || 0);
      });
      const facts = sorted
        .map(f => {
          const tag = f.canon_status === 'experimental' ? ' [EXPERIMENTAL]' : '';
          return `[${f.importance.toUpperCase()}] ${f.subject}${tag}: ${f.fact}`;
        })
        .join('\n');
      sections.push({
        key: 'bible',
        label: SECTION_LABELS.bible,
        content: `=== STORY BIBLE (CANONICAL FACTS - DO NOT CONTRADICT) ===\n${facts}`,
        priority: 11,
      });
    }
  }

  if (context.styleAnchors && context.styleAnchors.length > 0) {
    const anchors = context.styleAnchors
      .map(a => `--- ${a.label} ---\n${a.notes ? `(${a.notes})\n` : ''}${a.passage}`)
      .join('\n\n');
    sections.push({
      key: 'style',
      label: SECTION_LABELS.style,
      content: `=== STYLE REFERENCE (MATCH THIS VOICE AND TONE) ===\n${anchors}`,
      priority: 12,
    });
  }

  if (context.outlineSynopsis) {
    sections.push({ key: 'synopsis', label: SECTION_LABELS.synopsis, content: `=== STORY SYNOPSIS ===\n${context.outlineSynopsis}`, priority: 5 });
  }

  if (context.chapterSummary) {
    sections.push({ key: 'chapter', label: SECTION_LABELS.chapter, content: `=== CHAPTER SUMMARY ===\n${context.chapterSummary}`, priority: 6 });
  }

  if (context.storyEvents && context.storyEvents.length > 0) {
    let eventsToInclude = context.storyEvents;
    if (contextMode === 'minimal') {
      eventsToInclude = context.storyEvents.filter(e => e.importance === 'critical');
    } else if (contextMode === 'relevant') {
      eventsToInclude = context.storyEvents.filter(e => e.importance === 'critical' || e.importance === 'high');
    }
    if (eventsToInclude.length > 0) {
      const sorted = [...eventsToInclude].sort((a, b) => {
        const rank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
        return (rank[b.importance] || 0) - (rank[a.importance] || 0);
      });
      const events = sorted
        .map(e => `[${e.importance.toUpperCase()}] ${e.title}: ${e.description}`)
        .join('\n');
      sections.push({ key: 'events', label: SECTION_LABELS.events, content: `=== IMPORTANT STORY EVENTS (FOR CONSISTENCY) ===\n${events}`, priority: 8 });
    }
  }

  if (context.characterStates && context.characterStates.length > 0) {
    const states = context.characterStates
      .map(s => `${s.character_name}:\n  Physical: ${s.physical_state}\n  Emotional: ${s.emotional_state}\n  Knowledge: ${s.knowledge}`)
      .join('\n\n');
    sections.push({ key: 'states', label: SECTION_LABELS.states, content: `=== CHARACTER CURRENT STATES ===\n${states}`, priority: 7 });
  }

  if (context.characters && context.characters.length > 0) {
    const activeChars = context.characters.filter(c => c.canon_status !== 'deprecated');
    const charInfo = activeChars.map(c => {
      const statusTag = c.canon_status === 'experimental' ? ' [EXPERIMENTAL - may not be canon]' : '';
      let info = `- ${c.name} (${c.role})${statusTag}: ${c.personality}\n  Background: ${c.background}`;
      if (c.dialogue_style) info += `\n  Dialogue Style: ${c.dialogue_style}`;
      if (contextMode !== 'minimal') {
        if (c.personality_sliders_text) info += `\n  Personality Profile:\n${c.personality_sliders_text.split('\n').map((l: string) => `    ${l}`).join('\n')}`;
        if (c.infrastructure_sliders_text) info += `\n  Infrastructure Traits:\n${c.infrastructure_sliders_text.split('\n').map((l: string) => `    ${l}`).join('\n')}`;
      }
      if (c.image_description) info += `\n  Visual: ${c.image_description}`;
      if (contextMode === 'full' && c.dossier?.trim()) info += `\n  Character Dossier:\n${c.dossier.split('\n').map((l: string) => `    ${l}`).join('\n')}`;
      if (contextMode === 'relevant' && c.dossier?.trim()) {
        const dossierLines = c.dossier.split('\n').slice(0, 10);
        info += `\n  Character Dossier (summary):\n${dossierLines.map((l: string) => `    ${l}`).join('\n')}`;
      }
      return info;
    }).join('\n');
    if (charInfo) sections.push({ key: 'characters', label: SECTION_LABELS.characters, content: `=== CHARACTERS IN THIS SCENE ===\n${charInfo}`, priority: 4 });
  }

  if (context.places && context.places.length > 0) {
    const activePlaces = context.places.filter(p => p.canon_status !== 'deprecated');
    const placeInfo = activePlaces.map(p => {
      const statusTag = p.canon_status === 'experimental' ? ' [EXPERIMENTAL]' : '';
      const emergentTag = p.emergent_character ? ' [EMERGENT CHARACTER]' : '';
      let info = `- ${p.name} (${p.type})${statusTag}${emergentTag}: ${p.description}`;
      if (p.image_description) info += `\n  Visual: ${p.image_description}`;
      if (p.emergent_character && p.infrastructure_sliders_text && contextMode !== 'minimal') info += `\n  Infrastructure Traits:\n${p.infrastructure_sliders_text.split('\n').map((l: string) => `    ${l}`).join('\n')}`;
      return info;
    }).join('\n');
    if (placeInfo) sections.push({ key: 'places', label: SECTION_LABELS.places, content: `=== SETTING ===\n${placeInfo}`, priority: 3 });
  }

  if (context.things && context.things.length > 0) {
    const activeThings = context.things.filter(t => t.canon_status !== 'deprecated');
    const thingInfo = activeThings.map(t => {
      const statusTag = t.canon_status === 'experimental' ? ' [EXPERIMENTAL]' : '';
      const emergentTag = t.emergent_character ? ' [EMERGENT CHARACTER]' : '';
      let info = `- ${t.name} (${t.type})${statusTag}${emergentTag}: ${t.description}`;
      if (t.image_description) info += `\n  Visual: ${t.image_description}`;
      if (t.emergent_character && t.infrastructure_sliders_text && contextMode !== 'minimal') info += `\n  Infrastructure Traits:\n${t.infrastructure_sliders_text.split('\n').map((l: string) => `    ${l}`).join('\n')}`;
      return info;
    }).join('\n');
    if (thingInfo) sections.push({ key: 'things', label: SECTION_LABELS.things, content: `=== IMPORTANT OBJECTS ===\n${thingInfo}`, priority: 2 });
  }

  if (context.technologies && context.technologies.length > 0) {
    const activeTech = context.technologies.filter(t => t.canon_status !== 'deprecated');
    const techInfo = activeTech.map(t => {
      const statusTag = t.canon_status === 'experimental' ? ' [EXPERIMENTAL]' : '';
      const emergentTag = t.emergent_character ? ' [EMERGENT CHARACTER]' : '';
      let info = `- ${t.name} (${t.type})${statusTag}${emergentTag}: ${t.description}`;
      if (t.image_description) info += `\n  Visual: ${t.image_description}`;
      if (t.emergent_character && t.infrastructure_sliders_text && contextMode !== 'minimal') info += `\n  Infrastructure Traits:\n${t.infrastructure_sliders_text.split('\n').map((l: string) => `    ${l}`).join('\n')}`;
      return info;
    }).join('\n');
    if (techInfo) sections.push({ key: 'tech', label: SECTION_LABELS.tech, content: `=== TECHNOLOGY/MAGIC SYSTEMS ===\n${techInfo}`, priority: 2 });
  }

  if (context.referencedScenes && context.referencedScenes.length > 0) {
    const refs = context.referencedScenes
      .map(r => `Scene: "${r.title}"\nReference Note: ${r.note}\nContent:\n${r.content}`)
      .join('\n\n---\n\n');
    sections.push({ key: 'refs', label: SECTION_LABELS.refs, content: `=== REFERENCED SCENES (MAINTAIN CONSISTENCY) ===\n${refs}`, priority: 9 });
  }

  if (context.previousSceneSummaries && context.previousSceneSummaries.length > 0) {
    const summaries = context.previousSceneSummaries
      .map(s => {
        let text = `"${s.sceneTitle}": ${s.summary}`;
        if (s.key_facts.length > 0) {
          text += `\n  Key facts: ${s.key_facts.join('; ')}`;
        }
        return text;
      })
      .join('\n\n');
    sections.push({
      key: 'summaries',
      label: SECTION_LABELS.summaries,
      content: `=== PREVIOUS SCENE SUMMARIES (COMPRESSED HISTORY) ===\n${summaries}`,
      priority: 10,
    });
  }

  if (context.previousScenes) {
    if (contextMode === 'minimal') {
      // Skip full previous scenes in minimal mode
    } else {
      sections.push({ key: 'previous', label: SECTION_LABELS.previous, content: `=== PREVIOUS SCENES IN THIS CHAPTER ===\n${context.previousScenes}`, priority: 10 });
    }
  }

  return sections;
}

function buildContextPrompt(context: GenerateSceneRequest['context'], tokenBudget: number, contextMode: ContextMode = 'full'): string {
  const sections = buildSections(context, contextMode);
  sections.sort((a, b) => b.priority - a.priority);

  const result: string[] = [];
  let usedTokens = 0;

  for (const section of sections) {
    const sectionTokens = estimateTokens(section.content);

    if (usedTokens + sectionTokens <= tokenBudget) {
      result.push(section.content);
      usedTokens += sectionTokens;
    } else {
      const remaining = tokenBudget - usedTokens;
      if (remaining > 100) {
        result.push(truncateToTokenBudget(section.content, remaining));
        break;
      }
      break;
    }
  }

  return result.join('\n\n');
}

export function assemblePromptReport(request: GenerateSceneRequest): PromptAssemblyReport {
  const { context, settings, contextMode = 'full' } = request;

  const contextLength = settings.context_length || 4096;
  const reservedForOutput = settings.max_tokens;
  const reservedForPromptFrame = 300;
  const availableForContext = contextLength - reservedForOutput - reservedForPromptFrame;

  const activeRules = settings.style_rules ? getActiveRulePrompts(settings.style_rules) : [];
  const rulesBlock = activeRules.length > 0
    ? `\n\n=== ENFORCED STYLE RULES ===\n${activeRules.join('\n\n')}\n`
    : '';
  const prohibitedBlock = context.prohibitedWords && context.prohibitedWords.length > 0
    ? `\n\n=== PROHIBITED WORDS AND PHRASES ===\nDo NOT use any of these words or phrases in the generated text:\n${context.prohibitedWords.join(', ')}\n`
    : '';

  const frameText = `${settings.system_prompt}${rulesBlock}${prohibitedBlock}\n\n${settings.style_guide ? `Writing Style Guidelines:\n${settings.style_guide}\n\n` : ''}`;
  const frameTokens = estimateTokens(frameText);

  const sections = buildSections(context, contextMode);
  sections.sort((a, b) => b.priority - a.priority);

  const reportSections: PromptAssemblyReport['sections'] = [];
  let usedTokens = 0;

  for (const section of sections) {
    const sectionTokens = estimateTokens(section.content);
    const fits = usedTokens + sectionTokens <= availableForContext;
    const remaining = availableForContext - usedTokens;
    const wouldTruncate = !fits && remaining > 100;

    reportSections.push({
      label: section.label,
      key: section.key,
      tokens: fits ? sectionTokens : (wouldTruncate ? remaining : sectionTokens),
      included: fits || wouldTruncate,
      truncated: wouldTruncate,
    });

    if (fits) {
      usedTokens += sectionTokens;
    } else {
      if (wouldTruncate) usedTokens += remaining;
      break;
    }
  }

  // Mark remaining sections as not included
  const includedKeys = new Set(reportSections.map(s => s.key));
  for (const section of sections) {
    if (!includedKeys.has(section.key)) {
      reportSections.push({
        label: section.label,
        key: section.key,
        tokens: estimateTokens(section.content),
        included: false,
        truncated: false,
      });
    }
  }

  return {
    sections: reportSections,
    frameTokens,
    totalPromptTokens: frameTokens + usedTokens,
    maxBudget: availableForContext,
    contextMode,
  };
}
