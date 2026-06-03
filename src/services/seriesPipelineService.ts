import { supabase } from '../lib/supabase';
import { generateScene, GenerationSettings } from './aiService';
import { resolveSettingsForTask, logTaskSettings, PipelineTaskMode } from './taskPresetResolver';
import {
  BookOwnershipRule,
  RevealEntry,
  SceneDepthMode,
  SCENE_DEPTH_THRESHOLDS,
  buildCanonIntegrityPrompt,
  buildPlanningAuthorityPrompt,
  buildRevealDisciplinePrompt,
  buildOwnershipPrompt,
  buildSceneDepthPrompt,
  buildWorldContextFromData,
  checkBookOwnership,
  checkMSU,
  checkRevealTimeline,
  repairBookOutline,
  repairMSU,
  repairReveal,
  expandScene,
  countWords,
  GateStatus,
} from './qualityGateService';
import {
  extractCharacterStatesFromBook,
  buildCharacterStatePromptForBook,
} from './characterStateService';

export type { BookOwnershipRule, RevealEntry, SceneDepthMode } from './qualityGateService';
export { SCENE_DEPTH_THRESHOLDS } from './qualityGateService';

export type PipelineLevel = 1 | 2 | 3 | 4 | 5 | 6;
export type PipelineMode = 'accelerated' | 'guided';
export type LevelStatus = 'pending' | 'running' | 'complete' | 'stale';

export interface SeriesPlan {
  id: string;
  project_id: string;
  outline_id: string | null;
  book_number: number;
  title: string;
  core_theme: string;
  beginning_state: string;
  ending_state: string;
  main_conflict: string;
  major_reveal: string;
  character_arc_focus: string;
  relationship_movement: string;
  mystery_progression: string;
  setup_for_next: string;
  high_level_outline: string;
  status: string;
}

export interface ChapterBrief {
  id: string;
  project_id: string;
  chapter_id: string;
  book_number: number;
  chapter_purpose: string;
  emotional_goal: string;
  character_goals: string;
  conflict_structure: string;
  theme_goals: string;
  worldbuilding_allowed: string;
  reveal_restrictions: string;
  continuity_requirements: string;
  scene_blueprint_text: string;
  raw_output: string;
  status: string;
}

export interface SceneBlueprint {
  id: string;
  project_id: string;
  chapter_id: string;
  scene_id: string | null;
  order_index: number;
  title: string;
  pov_character: string;
  characters_present: string;
  setting: string;
  opening_beat: string;
  conflict_tension: string;
  key_dialogue_beats: string;
  emotional_turn: string;
  worldbuilding_allowed: string;
  reveal_restrictions: string;
  closing_beat: string;
  transition_to_next: string;
  raw_output: string;
  status: string;
}

export interface PipelineState {
  id: string;
  project_id: string;
  pipeline_mode: PipelineMode;
  current_level: number;
  current_book: number;
  current_chapter: number;
  current_scene: number;
  level1_status: LevelStatus;
  level2_status: LevelStatus;
  level3_status: LevelStatus;
  level4_status: LevelStatus;
  level5_status: LevelStatus;
  level6_status: LevelStatus;
  is_running: boolean;
  error_message: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface PipelineProgress {
  level: PipelineLevel;
  book: number;
  chapter: number;
  scene: number;
  message: string;
}

type ProgressCallback = (progress: PipelineProgress) => void;

// ------ HELPERS ------

async function loadSettings(projectId: string, taskMode?: PipelineTaskMode): Promise<GenerationSettings> {
  const { data, error } = await supabase
    .from('generation_settings')
    .select('*')
    .eq('project_id', projectId)
    .maybeSingle();

  if (error || !data) throw new Error('Generation settings not configured. Please set up your AI settings first.');
  const global = data as GenerationSettings;

  if (taskMode) {
    const resolved = await resolveSettingsForTask(projectId, taskMode, global);
    console.log(logTaskSettings(taskMode, resolved));
    return resolved;
  }

  return global;
}

async function loadWorldContext(projectId: string) {
  const [chars, places, things, techs, manifesto, bible, reveals, charStates] = await Promise.all([
    supabase.from('characters').select('*').eq('project_id', projectId),
    supabase.from('places').select('*').eq('project_id', projectId),
    supabase.from('things').select('*').eq('project_id', projectId),
    supabase.from('technologies').select('*').eq('project_id', projectId),
    supabase.from('franchise_manifesto').select('*').eq('project_id', projectId).maybeSingle(),
    supabase.from('story_bible_entries').select('*').eq('project_id', projectId),
    supabase.from('reveal_timeline').select('*').eq('project_id', projectId).order('target_chapter', { ascending: true }),
    supabase.from('character_states').select('*').eq('project_id', projectId).eq('extraction_source', 'pipeline').order('book_number', { ascending: false }),
  ]);

  return {
    characters: chars.data || [],
    places: places.data || [],
    things: things.data || [],
    technologies: techs.data || [],
    manifesto: manifesto.data,
    bibleFacts: bible.data || [],
    reveals: reveals.data || [],
    characterStates: charStates.data || [],
  };
}

function buildWorldSummary(world: Awaited<ReturnType<typeof loadWorldContext>>): string {
  const parts: string[] = [];

  if (world.manifesto?.content) {
    parts.push(`=== FRANCHISE MANIFESTO ===\n${world.manifesto.content}`);
  }

  if (world.characters.length > 0) {
    parts.push(`=== CHARACTERS (${world.characters.length}) ===\n${world.characters.map(c =>
      `- ${c.name}: ${c.description || 'No description'}${c.notes ? ` | Notes: ${c.notes}` : ''}`
    ).join('\n')}`);
  }

  if (world.places.length > 0) {
    parts.push(`=== LOCATIONS (${world.places.length}) ===\n${world.places.map(p =>
      `- ${p.name}: ${p.description || 'No description'}`
    ).join('\n')}`);
  }

  if (world.things.length > 0) {
    parts.push(`=== ARTIFACTS/THINGS (${world.things.length}) ===\n${world.things.map(t =>
      `- ${t.name}: ${t.description || 'No description'}`
    ).join('\n')}`);
  }

  if (world.technologies.length > 0) {
    parts.push(`=== TECHNOLOGIES (${world.technologies.length}) ===\n${world.technologies.map(t =>
      `- ${t.name}: ${t.description || 'No description'}`
    ).join('\n')}`);
  }

  if (world.reveals.length > 0) {
    parts.push(`=== REVEAL TIMELINE ===\n${world.reveals.map(r =>
      `- Book ${r.target_book || '?'} Ch${r.target_chapter || '?'}: ${r.title} - ${r.description || ''}`
    ).join('\n')}`);
  }

  if (world.bibleFacts.length > 0) {
    const important = world.bibleFacts.filter((f: any) => f.importance === 'high' || f.importance === 'critical');
    if (important.length > 0) {
      parts.push(`=== KEY LORE FACTS ===\n${important.slice(0, 30).map((f: any) =>
        `- [${f.category}] ${f.subject}: ${f.fact}`
      ).join('\n')}`);
    }
  }

  return parts.join('\n\n');
}

// ------ PIPELINE STATE MANAGEMENT ------

export async function getOrCreatePipelineState(projectId: string, mode: PipelineMode): Promise<PipelineState> {
  const { data: existing } = await supabase
    .from('pipeline_state')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return existing as PipelineState;

  const { data: created, error } = await supabase
    .from('pipeline_state')
    .insert({ project_id: projectId, pipeline_mode: mode })
    .select()
    .single();

  if (error) throw error;
  return created as PipelineState;
}

export async function updatePipelineState(id: string, updates: Partial<PipelineState>) {
  const { error } = await supabase
    .from('pipeline_state')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deletePipelineState(projectId: string) {
  await supabase.from('pipeline_state').delete().eq('project_id', projectId);
}

// ------ LEVEL 1: SERIES ARCHITECT ------

export async function runLevel1SeriesArchitect(
  projectId: string,
  bookCount: number,
  seriesPremise: string,
  genre: string,
  endingState: string,
  onProgress: ProgressCallback,
): Promise<SeriesPlan[]> {
  const settings = await loadSettings(projectId, 'series_architect');
  const world = await loadWorldContext(projectId);
  const worldSummary = buildWorldSummary(world);

  onProgress({ level: 1, book: 0, chapter: 0, scene: 0, message: `Generating ${bookCount}-book series architecture...` });

  const prompt = `You are a Series Architect. Create a comprehensive high-level plan for a ${bookCount}-book series.

${worldSummary}

${buildCanonIntegrityPrompt()}

${buildPlanningAuthorityPrompt()}

SERIES PREMISE: ${seriesPremise}
GENRE: ${genre}
SERIES ENDING STATE: ${endingState}

For EACH of the ${bookCount} books, provide the following in a clearly numbered format:

BOOK [N]: [Title]
- Core Theme: [theme]
- Beginning State: [where the world/characters start]
- Ending State: [where they end up]
- Main Conflict: [central conflict for this book]
- Major Reveal: [the key revelation or turn]
- Character Arc Focus: [whose arc drives this book]
- Relationship Movement: [key relationship changes]
- Mystery/Truth Progression: [what the reader learns]
- Setup for Next Book: [what threads carry forward]
- High-Level Outline: [3-5 sentence overview of the book's story]

RULES:
- Each book must advance the overall series arc toward the ending state
- Reveals should be paced across books, not front-loaded
- Character arcs should interweave - when one peaks, another builds
- Each book should be satisfying standalone while advancing the series
- Do NOT write prose, scenes, or chapter breakdowns
- Keep each book plan compact (under 200 words per book)`;

  const result = await generateScene({
    sceneDescription: prompt,
    generationMode: 'outline',
    contextMode: 'minimal',
    context: {},
    settings,
  });

  // Parse result into individual book plans
  const plans: SeriesPlan[] = [];

  for (let i = 0; i < bookCount; i++) {
    const bookNum = i + 1;
    const section = findBookSection(result, bookNum);

    const plan: Partial<SeriesPlan> = {
      project_id: projectId,
      book_number: bookNum,
      title: extractField(section, 'title') || `Book ${bookNum}`,
      core_theme: extractField(section, 'core theme') || '',
      beginning_state: extractField(section, 'beginning state') || '',
      ending_state: extractField(section, 'ending state') || '',
      main_conflict: extractField(section, 'main conflict') || '',
      major_reveal: extractField(section, 'major reveal') || '',
      character_arc_focus: extractField(section, 'character arc focus') || '',
      relationship_movement: extractField(section, 'relationship movement') || '',
      mystery_progression: extractField(section, 'mystery') || extractField(section, 'truth progression') || '',
      setup_for_next: extractField(section, 'setup for next') || '',
      high_level_outline: extractField(section, 'high-level outline') || extractField(section, 'outline') || section,
      status: 'complete',
    };

    const { data, error } = await supabase
      .from('series_plans')
      .insert(plan)
      .select()
      .single();

    if (error) throw error;
    plans.push(data as SeriesPlan);

    onProgress({ level: 1, book: bookNum, chapter: 0, scene: 0, message: `Saved Book ${bookNum}: ${plan.title}` });
  }

  return plans;
}

// ------ LEVEL 2: BOOK ARCHITECT ------

export async function runLevel2BookArchitect(
  projectId: string,
  bookNumber: number,
  seriesPlans: SeriesPlan[],
  chapterCount: number,
  onProgress: ProgressCallback,
  ownershipRule?: BookOwnershipRule,
  revealTimeline?: RevealEntry[],
): Promise<string> {
  const settings = await loadSettings(projectId, 'book_architect');
  const world = await loadWorldContext(projectId);
  const worldSummary = buildWorldSummary(world);

  const currentPlan = seriesPlans.find(p => p.book_number === bookNumber);
  if (!currentPlan) throw new Error(`No series plan found for book ${bookNumber}`);

  // Build context from prior books
  const priorBooks = seriesPlans
    .filter(p => p.book_number < bookNumber)
    .sort((a, b) => a.book_number - b.book_number);

  const priorContext = priorBooks.length > 0
    ? `=== PRIOR BOOKS (completed outlines) ===\n${priorBooks.map(p =>
        `Book ${p.book_number} "${p.title}": ${p.high_level_outline}\n  Ending state: ${p.ending_state}\n  Reveals made: ${p.major_reveal}`
      ).join('\n\n')}`
    : '';

  // Also include chapter outlines from prior books if they exist
  const priorOutlines: string[] = [];
  for (const prior of priorBooks) {
    if (prior.outline_id) {
      const { data: chapters } = await supabase
        .from('chapters')
        .select('title, summary, order_index')
        .eq('outline_id', prior.outline_id)
        .order('order_index', { ascending: true });
      if (chapters && chapters.length > 0) {
        priorOutlines.push(`Book ${prior.book_number} Chapter Outline:\n${chapters.map(c =>
          `  Ch${c.order_index + 1} "${c.title}": ${c.summary || 'No summary'}`
        ).join('\n')}`);
      }
    }
  }

  const priorChapterContext = priorOutlines.length > 0
    ? `\n\n=== PRIOR BOOK CHAPTER OUTLINES ===\n${priorOutlines.join('\n\n')}`
    : '';

  const characterStateContext = await buildCharacterStatePromptForBook(projectId, bookNumber);

  onProgress({ level: 2, book: bookNumber, chapter: 0, scene: 0, message: `Generating chapter outline for Book ${bookNumber}...` });

  const prompt = `You are a Book Architect. Expand the following book plan into a detailed ${chapterCount}-chapter outline.

${worldSummary}

${buildCanonIntegrityPrompt()}

${buildPlanningAuthorityPrompt()}

${revealTimeline ? buildRevealDisciplinePrompt(bookNumber, revealTimeline) : ''}

${ownershipRule ? buildOwnershipPrompt(ownershipRule) : ''}

${priorContext}${priorChapterContext}

${characterStateContext}

=== CURRENT BOOK PLAN (Book ${bookNumber}) ===
Title: ${currentPlan.title}
Core Theme: ${currentPlan.core_theme}
Beginning State: ${currentPlan.beginning_state}
Ending State: ${currentPlan.ending_state}
Main Conflict: ${currentPlan.main_conflict}
Major Reveal: ${currentPlan.major_reveal}
Character Arc Focus: ${currentPlan.character_arc_focus}
Relationship Movement: ${currentPlan.relationship_movement}
Mystery Progression: ${currentPlan.mystery_progression}
High-Level Outline: ${currentPlan.high_level_outline}

Generate exactly ${chapterCount} chapters. For each chapter provide:

Chapter [N]: [Title]
- POV Character: [name]
- Location: [primary setting]
- Emotional Arc: [from X to Y]
- Plot Function: [what this chapter accomplishes in the book]
- Key Beats: [2-3 critical moments]
- Relationship Movement: [how relationships change]
- Reveal/Mystery: [what is learned or deepened]
- Ending Hook: [what pulls the reader forward]

RULES:
- Build from the prior books' endings (character states, reveals already made)
- Pace the major reveal - build toward it, don't dump it early
- Vary POV characters and locations for rhythm
- Each chapter must serve the overall book arc
- Do NOT write prose or scenes`;

  const result = await generateScene({
    sceneDescription: prompt,
    generationMode: 'outline',
    contextMode: 'minimal',
    context: {},
    settings,
  });

  return result;
}

export async function saveLevel2Chapters(
  projectId: string,
  outlineId: string,
  bookNumber: number,
  rawOutput: string,
  characters: Array<{ id: string; name: string }>,
  places: Array<{ id: string; name: string }>,
): Promise<void> {
  const chapters = parseChaptersFromOutput(rawOutput);

  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i];
    const povChar = characters.find(c =>
      c.name.toLowerCase() === (ch.pov || '').toLowerCase() ||
      c.name.toLowerCase().includes((ch.pov || '').toLowerCase()) ||
      (ch.pov || '').toLowerCase().includes(c.name.toLowerCase())
    );
    const settingPlace = places.find(p =>
      p.name.toLowerCase() === (ch.location || '').toLowerCase() ||
      p.name.toLowerCase().includes((ch.location || '').toLowerCase()) ||
      (ch.location || '').toLowerCase().includes(p.name.toLowerCase())
    );

    await supabase.from('chapters').insert({
      project_id: projectId,
      outline_id: outlineId,
      title: ch.title || `Chapter ${i + 1}`,
      summary: ch.summary || '',
      key_events: ch.keyBeats || '',
      pov_character_id: povChar?.id || null,
      setting_place_id: settingPlace?.id || null,
      order_index: i,
    });
  }

  // Link the series plan to this outline
  await supabase
    .from('series_plans')
    .update({ outline_id: outlineId, updated_at: new Date().toISOString() })
    .eq('project_id', projectId)
    .eq('book_number', bookNumber);
}

// ------ LEVEL 3: CHAPTER ARCHITECT ------

export async function runLevel3ChapterBrief(
  projectId: string,
  chapterId: string,
  bookNumber: number,
  seriesPlans: SeriesPlan[],
  onProgress: ProgressCallback,
): Promise<ChapterBrief> {
  const settings = await loadSettings(projectId, 'chapter_brief');

  // Load chapter and its siblings
  const { data: chapter } = await supabase.from('chapters').select('*').eq('id', chapterId).single();
  if (!chapter) throw new Error('Chapter not found');

  const { data: allChapters } = await supabase
    .from('chapters')
    .select('*')
    .eq('outline_id', chapter.outline_id)
    .order('order_index', { ascending: true });

  // Load prior chapter briefs for continuity
  const priorChapters = (allChapters || []).filter(c => c.order_index < chapter.order_index);
  const { data: priorBriefs } = await supabase
    .from('chapter_briefs')
    .select('*')
    .in('chapter_id', priorChapters.map(c => c.id))
    .eq('status', 'complete');

  const currentPlan = seriesPlans.find(p => p.book_number === bookNumber);

  const priorBriefContext = (priorBriefs || []).length > 0
    ? `=== PRIOR CHAPTER BRIEFS (this book) ===\n${(priorBriefs || []).map((b: any) => {
        const ch = priorChapters.find(c => c.id === b.chapter_id);
        return `Ch${ch?.order_index !== undefined ? ch.order_index + 1 : '?'} "${ch?.title}": Purpose: ${b.chapter_purpose} | Emotional: ${b.emotional_goal} | Conflict: ${b.conflict_structure}`;
      }).join('\n')}`
    : '';

  const characterStateContext = await buildCharacterStatePromptForBook(projectId, bookNumber);

  onProgress({
    level: 3,
    book: bookNumber,
    chapter: chapter.order_index + 1,
    scene: 0,
    message: `Generating design brief for Ch${chapter.order_index + 1}: ${chapter.title}`,
  });

  const prompt = `You are a Chapter Architect. Generate a detailed design brief for this chapter.

${buildCanonIntegrityPrompt()}

${buildPlanningAuthorityPrompt()}

${characterStateContext}

=== BOOK CONTEXT ===
Book ${bookNumber}: ${currentPlan?.title || 'Unknown'}
Theme: ${currentPlan?.core_theme || ''}
Major Reveal: ${currentPlan?.major_reveal || ''}

=== CHAPTER CONTEXT ===
Chapter ${chapter.order_index + 1}: ${chapter.title}
Summary: ${chapter.summary || 'No summary provided'}
Key Events: ${chapter.key_events || 'None specified'}

${priorBriefContext}

=== FULL CHAPTER LIST (this book) ===
${(allChapters || []).map(c => `Ch${c.order_index + 1}: ${c.title} - ${c.summary || 'No summary'}`).join('\n')}

Generate a structured design brief with these exact sections:

CHAPTER PURPOSE: [why this chapter exists in the book]
EMOTIONAL GOAL: [what the reader should feel by chapter end]
CHARACTER GOALS: [what each present character wants and what they do about it]
CONFLICT STRUCTURE: [the central tension and how it escalates]
THEME GOALS: [how this chapter serves the book's theme]
WORLDBUILDING ALLOWED: [what new world details can be introduced here]
REVEAL RESTRICTIONS: [what must NOT be revealed yet]
CONTINUITY REQUIREMENTS: [facts that must be maintained from prior chapters]
SCENE-BY-SCENE BLUEPRINT: [3-5 scenes with brief purpose for each]

RULES:
- Be specific, not generic
- Reference actual character names and locations
- The brief must be detailed enough to hand to a writer who produces recognizable prose
- Do NOT write prose or dialogue`;

  const result = await generateScene({
    sceneDescription: prompt,
    generationMode: 'design_brief',
    contextMode: 'minimal',
    planningMode: 'strict',
    context: {},
    settings,
  });

  const brief = {
    project_id: projectId,
    chapter_id: chapterId,
    book_number: bookNumber,
    chapter_purpose: extractSection(result, 'chapter purpose'),
    emotional_goal: extractSection(result, 'emotional goal'),
    character_goals: extractSection(result, 'character goals'),
    conflict_structure: extractSection(result, 'conflict structure'),
    theme_goals: extractSection(result, 'theme goals'),
    worldbuilding_allowed: extractSection(result, 'worldbuilding allowed'),
    reveal_restrictions: extractSection(result, 'reveal restrictions'),
    continuity_requirements: extractSection(result, 'continuity requirements'),
    scene_blueprint_text: extractSection(result, 'scene-by-scene blueprint') || extractSection(result, 'scene blueprint'),
    raw_output: result,
    status: 'complete',
  };

  const { data, error } = await supabase
    .from('chapter_briefs')
    .insert(brief)
    .select()
    .single();

  if (error) throw error;
  return data as ChapterBrief;
}

// ------ LEVEL 4: SCENE ARCHITECT ------

export async function runLevel4SceneBlueprints(
  projectId: string,
  chapterId: string,
  chapterBrief: ChapterBrief,
  onProgress: ProgressCallback,
): Promise<SceneBlueprint[]> {
  const settings = await loadSettings(projectId, 'scene_blueprint');

  const { data: chapter } = await supabase.from('chapters').select('*').eq('id', chapterId).single();
  if (!chapter) throw new Error('Chapter not found');

  // Load character names for context
  const { data: characters } = await supabase.from('characters').select('name, description').eq('project_id', projectId);

  onProgress({
    level: 4,
    book: chapterBrief.book_number,
    chapter: chapter.order_index + 1,
    scene: 0,
    message: `Generating scene blueprints for Ch${chapter.order_index + 1}...`,
  });

  const prompt = `You are a Scene Architect. Generate detailed scene blueprints (scene cards) for this chapter.

${buildCanonIntegrityPrompt()}

${buildPlanningAuthorityPrompt()}

=== CHAPTER BRIEF ===
Chapter: ${chapter.title}
Purpose: ${chapterBrief.chapter_purpose}
Emotional Goal: ${chapterBrief.emotional_goal}
Character Goals: ${chapterBrief.character_goals}
Conflict: ${chapterBrief.conflict_structure}
Theme: ${chapterBrief.theme_goals}
Worldbuilding Allowed: ${chapterBrief.worldbuilding_allowed}
Reveal Restrictions: ${chapterBrief.reveal_restrictions}
Continuity: ${chapterBrief.continuity_requirements}
Scene Blueprint from Brief: ${chapterBrief.scene_blueprint_text}

=== AVAILABLE CHARACTERS ===
${(characters || []).map(c => `- ${c.name}: ${c.description || ''}`).join('\n')}

Generate 3-5 scene cards. For each scene:

SCENE [N]: [Title]
- POV Character: [name]
- Characters Present: [comma-separated names]
- Setting: [specific location]
- Opening Beat: [how the scene starts]
- Conflict/Tension: [what creates tension]
- Key Dialogue Beats: [2-3 critical dialogue moments]
- Emotional Turn: [how the emotional state shifts]
- Worldbuilding Allowed: [what can be shown/introduced]
- Reveal Restrictions: [what must NOT be revealed]
- Closing Beat: [how the scene ends]
- Transition to Next: [how it connects to the next scene]

RULES:
- Each scene must serve the chapter's emotional goal
- Scenes should build on each other (escalating tension)
- Vary pacing: not every scene should be high-intensity
- Be specific about character names and actions
- Do NOT write prose or dialogue`;

  const result = await generateScene({
    sceneDescription: prompt,
    generationMode: 'outline',
    contextMode: 'minimal',
    context: {},
    settings,
  });

  const blueprints = parseSceneBlueprints(result, projectId, chapterId);

  const saved: SceneBlueprint[] = [];
  for (let i = 0; i < blueprints.length; i++) {
    const bp = blueprints[i];
    bp.order_index = i;
    bp.status = 'complete';

    const { data, error } = await supabase
      .from('scene_blueprints')
      .insert(bp)
      .select()
      .single();

    if (error) throw error;
    saved.push(data as SceneBlueprint);

    onProgress({
      level: 4,
      book: chapterBrief.book_number,
      chapter: chapter.order_index + 1,
      scene: i + 1,
      message: `Saved blueprint: ${bp.title}`,
    });
  }

  return saved;
}

// ------ LEVEL 5: SCENE WRITER ------

export async function runLevel5SceneWriter(
  projectId: string,
  sceneId: string,
  blueprint: SceneBlueprint,
  chapterBrief: ChapterBrief,
  seriesPlan: SeriesPlan | null,
  onProgress: ProgressCallback,
  sceneDepthMode?: SceneDepthMode,
): Promise<string> {
  const settings = await loadSettings(projectId, 'scene_writer');

  // Load scoped context
  const { data: scene } = await supabase.from('scenes').select('*').eq('id', sceneId).single();
  if (!scene) throw new Error('Scene not found');

  const { data: chapter } = await supabase.from('chapters').select('*').eq('id', scene.chapter_id).single();

  // Previous scene ending for continuity
  const { data: priorScenes } = await supabase
    .from('scenes')
    .select('title, content')
    .eq('chapter_id', scene.chapter_id)
    .lt('order_index', scene.order_index)
    .order('order_index', { ascending: false })
    .limit(1);

  const prevEnding = priorScenes && priorScenes.length > 0 && priorScenes[0].content
    ? priorScenes[0].content.slice(-500)
    : '';

  // Load relevant characters
  const characterNames = blueprint.characters_present.split(',').map(n => n.trim()).filter(Boolean);
  let characterContext = '';
  if (characterNames.length > 0) {
    const { data: chars } = await supabase
      .from('characters')
      .select('name, description, notes')
      .eq('project_id', projectId);
    const relevant = (chars || []).filter(c =>
      characterNames.some(n => c.name.toLowerCase().includes(n.toLowerCase()) || n.toLowerCase().includes(c.name.toLowerCase()))
    );
    if (relevant.length > 0) {
      characterContext = relevant.map(c => `${c.name}: ${c.description || ''} ${c.notes || ''}`).join('\n');
    }
  }

  onProgress({
    level: 5,
    book: chapterBrief.book_number,
    chapter: chapter?.order_index !== undefined ? chapter.order_index + 1 : 0,
    scene: scene.order_index + 1,
    message: `Writing scene: ${blueprint.title}`,
  });

  const characterStateContext = await buildCharacterStatePromptForBook(projectId, chapterBrief.book_number);
  const depthPrompt = sceneDepthMode ? `\n\n${buildSceneDepthPrompt(sceneDepthMode)}` : '';

  const sceneDescription = `Write this scene based on the following blueprint:
${depthPrompt}

${characterStateContext}

=== SERIES CONTEXT ===
${seriesPlan ? `Book ${seriesPlan.book_number}: "${seriesPlan.title}" - Theme: ${seriesPlan.core_theme}` : 'Standalone book'}

=== CHAPTER CONTEXT ===
Chapter: ${chapter?.title || 'Unknown'}
Purpose: ${chapterBrief.chapter_purpose}
Emotional Goal: ${chapterBrief.emotional_goal}

=== SCENE BLUEPRINT ===
Title: ${blueprint.title}
POV: ${blueprint.pov_character}
Characters Present: ${blueprint.characters_present}
Setting: ${blueprint.setting}
Opening Beat: ${blueprint.opening_beat}
Conflict/Tension: ${blueprint.conflict_tension}
Key Dialogue Beats: ${blueprint.key_dialogue_beats}
Emotional Turn: ${blueprint.emotional_turn}
Closing Beat: ${blueprint.closing_beat}
Transition to Next: ${blueprint.transition_to_next}

=== RESTRICTIONS ===
Worldbuilding Allowed: ${blueprint.worldbuilding_allowed}
Reveal Restrictions: ${blueprint.reveal_restrictions}

${prevEnding ? `=== PREVIOUS SCENE ENDING ===\n...${prevEnding}` : ''}

${characterContext ? `=== CHARACTER DETAILS ===\n${characterContext}` : ''}

=== CREATIVE LICENSE ===
This is the Scene Writer stage — the ONLY stage where creativity is concentrated. You have full creative freedom over:
- Prose style, rhythm, sentence structure, and word choice
- Dialogue cadence, subtext, interruptions, and silences
- Sensory detail, metaphor, and imagery
- Internal monologue and emotional nuance
- Micro-pacing within the scene (beats, pauses, transitions)
- Show-don't-tell techniques

You MUST still honor the blueprint structure (opening/conflict/closing beats, characters present, setting, restrictions). But HOW you render those beats into living prose is entirely your domain. Be bold, be vivid, be surprising in execution.

Write this scene with vivid prose, strong character voice, and natural dialogue. Follow the blueprint closely but bring it to life with sensory detail and emotional depth.`;

  const depthTokenOverride = sceneDepthMode ? SCENE_DEPTH_THRESHOLDS[sceneDepthMode].maxTokens : undefined;

  const content = await generateScene({
    sceneDescription,
    generationMode: 'scene',
    contextMode: 'minimal',
    context: {},
    settings: depthTokenOverride ? { ...settings, max_tokens: depthTokenOverride } : settings,
  });

  // Save the prose
  await supabase
    .from('scenes')
    .update({ content, updated_at: new Date().toISOString() })
    .eq('id', sceneId);

  return content;
}

// ------ LEVEL 6: ASSEMBLY ------

export async function runLevel6Assembly(
  projectId: string,
  outlineId: string,
  bookNumber: number,
  onProgress: ProgressCallback,
): Promise<void> {
  const { data: chapters } = await supabase
    .from('chapters')
    .select('*')
    .eq('outline_id', outlineId)
    .order('order_index', { ascending: true });

  if (!chapters || chapters.length === 0) throw new Error('No chapters found');

  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i];

    onProgress({
      level: 6,
      book: bookNumber,
      chapter: i + 1,
      scene: 0,
      message: `Assembling Ch${i + 1}: ${chapter.title}`,
    });

    const { data: scenes } = await supabase
      .from('scenes')
      .select('title, content, order_index')
      .eq('chapter_id', chapter.id)
      .order('order_index', { ascending: true });

    if (!scenes || scenes.length === 0) continue;

    const assembledContent = scenes
      .filter(s => s.content && s.content.length > 0)
      .map(s => s.content)
      .join('\n\n---\n\n');

    const wordCount = assembledContent.split(/\s+/).length;

    // Upsert chapter assembly
    const { data: existing } = await supabase
      .from('chapter_assemblies')
      .select('id')
      .eq('chapter_id', chapter.id)
      .maybeSingle();

    if (existing) {
      await supabase.from('chapter_assemblies').update({
        content: assembledContent,
        word_count: wordCount,
        scene_count: scenes.filter(s => s.content).length,
        status: 'assembled',
        updated_at: new Date().toISOString(),
      }).eq('id', existing.id);
    } else {
      await supabase.from('chapter_assemblies').insert({
        project_id: projectId,
        chapter_id: chapter.id,
        content: assembledContent,
        word_count: wordCount,
        scene_count: scenes.filter(s => s.content).length,
        status: 'assembled',
      });
    }
  }

  // Assemble full book
  onProgress({ level: 6, book: bookNumber, chapter: 0, scene: 0, message: 'Assembling complete book manuscript...' });

  const { data: assemblies } = await supabase
    .from('chapter_assemblies')
    .select('content, word_count')
    .in('chapter_id', chapters.map(c => c.id))
    .eq('status', 'assembled');

  if (assemblies && assemblies.length > 0) {
    const fullContent = assemblies.map((a, idx) =>
      `# Chapter ${idx + 1}\n\n${a.content}`
    ).join('\n\n---\n\n');

    const totalWords = assemblies.reduce((sum, a) => sum + (a.word_count || 0), 0);

    const { data: existingBook } = await supabase
      .from('book_manuscripts')
      .select('id')
      .eq('outline_id', outlineId)
      .maybeSingle();

    const bookData = {
      project_id: projectId,
      outline_id: outlineId,
      title: `Book ${bookNumber}`,
      content: fullContent,
      word_count: totalWords,
      chapter_count: chapters.length,
      status: 'assembled',
    };

    if (existingBook) {
      await supabase.from('book_manuscripts').update({
        ...bookData,
        updated_at: new Date().toISOString(),
      }).eq('id', existingBook.id);
    } else {
      await supabase.from('book_manuscripts').insert(bookData);
    }
  }
}

// ------ DELETE / RESET PER LAYER ------

export async function deleteSeriesPlans(projectId: string) {
  await supabase.from('series_plans').delete().eq('project_id', projectId);
}

export async function deleteChapterBriefs(projectId: string, chapterId?: string) {
  if (chapterId) {
    await supabase.from('chapter_briefs').delete().eq('chapter_id', chapterId);
  } else {
    await supabase.from('chapter_briefs').delete().eq('project_id', projectId);
  }
}

export async function deleteSceneBlueprints(projectId: string, chapterId?: string) {
  if (chapterId) {
    await supabase.from('scene_blueprints').delete().eq('chapter_id', chapterId);
  } else {
    await supabase.from('scene_blueprints').delete().eq('project_id', projectId);
  }
}

// ------ FULL ACCELERATED PIPELINE (Wizard Orchestration) ------

export interface AcceleratedPipelineConfig {
  projectId: string;
  bookCount: number;
  seriesPremise: string;
  genre: string;
  endingState: string;
  chapterCount: number;
  onProgress: ProgressCallback;
  onLog: (message: string) => void;
  abortSignal?: { current: boolean };
  bookOwnership?: BookOwnershipRule[];
  sceneDepthMode?: SceneDepthMode;
  revealTimeline?: RevealEntry[];
}

export async function runFullAcceleratedPipeline(config: AcceleratedPipelineConfig): Promise<void> {
  const { projectId, bookCount, seriesPremise, genre, endingState, chapterCount, onProgress, onLog, abortSignal, bookOwnership, sceneDepthMode, revealTimeline: configReveals } = config;

  const state = await getOrCreatePipelineState(projectId, 'accelerated');
  const depthMode: SceneDepthMode = sceneDepthMode || 'standard_draft';

  // Save depth mode to pipeline state
  await updatePipelineState(state.id, { scene_depth_mode: depthMode } as any);

  function checkAbort() {
    if (abortSignal?.current) throw new Error('Pipeline aborted by user.');
  }

  // Load world context for quality gates
  const world = await loadWorldContext(projectId);
  const worldCtx = buildWorldContextFromData(world);
  const reveals: RevealEntry[] = configReveals || world.reveals.map(r => ({
    id: r.id, title: r.title, description: r.description || '',
    target_book: r.target_book || null, target_chapter: r.target_chapter || null,
  }));

  // ===== LEVEL 1: Series Architect =====
  onLog('Level 1: Series Architect starting...');
  await updatePipelineState(state.id, { level1_status: 'running', is_running: true, current_level: 1, started_at: new Date().toISOString() });

  const seriesPlans = await runLevel1SeriesArchitect(projectId, bookCount, seriesPremise, genre, endingState, onProgress);
  checkAbort();

  // Level 1 MSU Check (light, single check on full output)
  const seriesPlanText = seriesPlans.map(p => `Book ${p.book_number}: ${p.title} - ${p.high_level_outline}`).join('\n');
  const l1Msu = await checkMSU(projectId, seriesPlanText, 'series_architect', worldCtx);
  onLog(`Level 1 MSU Check: ${l1Msu.status.toUpperCase()}${l1Msu.flags.length > 0 ? ' - ' + l1Msu.flags[0] : ''}`);

  if (l1Msu.status === 'failed' && l1Msu.severity === 'major') {
    onLog('Level 1 MSU: MAJOR failure detected. Attempting repair...');
    await repairMSU(projectId, seriesPlanText, l1Msu.flags, worldCtx, 'series_architect');
    onLog('Level 1 MSU repair complete. Proceeding (plans already saved, downstream will use repaired context).');
  }

  await updatePipelineState(state.id, { level1_status: 'complete', current_level: 2 });
  onLog(`Level 1 complete: ${seriesPlans.length} book plans generated.`);

  // ===== LEVEL 2: Book Architect (all books) =====
  onLog('Level 2: Book Architect starting...');
  await updatePipelineState(state.id, { level2_status: 'running', current_level: 2 });

  const [charsRes, placesRes] = await Promise.all([
    supabase.from('characters').select('id, name').eq('project_id', projectId),
    supabase.from('places').select('id, name').eq('project_id', projectId),
  ]);
  const chars = charsRes.data || [];
  const places = placesRes.data || [];

  for (let b = 1; b <= seriesPlans.length; b++) {
    checkAbort();
    onLog(`Level 2: Book ${b} of ${seriesPlans.length}...`);
    await updatePipelineState(state.id, { current_book: b });

    const ownershipRule = bookOwnership?.find(o => o.bookNumber === b);

    let result = await runLevel2BookArchitect(projectId, b, seriesPlans, chapterCount, onProgress, ownershipRule, reveals);
    checkAbort();

    // --- OWNERSHIP GATE ---
    if (ownershipRule && ownershipRule.requiredOwner) {
      const ownerCheck = await checkBookOwnership(projectId, b, result, ownershipRule);
      onLog(`Book ${b} Ownership Check: ${ownerCheck.passed ? 'PASSED' : 'FAILED'} (score: ${ownerCheck.score})${ownerCheck.failures.length > 0 ? ' - ' + ownerCheck.failures[0] : ''}`);

      if (!ownerCheck.passed) {
        onLog(`Book ${b} Story Doctor: repairing...`);
        result = await repairBookOutline(projectId, b, result, ownershipRule, ownerCheck.failures);
        const recheck = await checkBookOwnership(projectId, b, result, ownershipRule);
        onLog(`Book ${b} Ownership Re-check: ${recheck.passed ? 'PASSED' : 'FAILED'} (score: ${recheck.score})`);

        if (!recheck.passed) {
          await supabase.from('series_plans').update({
            ownership_status: 'needs_review',
            ownership_score: recheck.score,
            repair_attempts: 2,
          }).eq('project_id', projectId).eq('book_number', b);
          await updatePipelineState(state.id, {
            is_running: false,
            error_message: `Book ${b} failed ownership check after repair: ${recheck.failures.join('; ')}`,
          });
          onLog(`PIPELINE HALTED: Book ${b} ownership cannot be resolved. Needs human review.`);
          return;
        }

        await supabase.from('series_plans').update({
          ownership_status: 'passed',
          ownership_score: recheck.score,
          repair_attempts: 1,
        }).eq('project_id', projectId).eq('book_number', b);
      } else {
        await supabase.from('series_plans').update({
          ownership_status: 'passed',
          ownership_score: ownerCheck.score,
        }).eq('project_id', projectId).eq('book_number', b);
      }
    }

    // --- REVEAL GATE ---
    if (reveals.length > 0) {
      const revealCheck = await checkRevealTimeline(projectId, b, result, reveals, 'book_architect');
      onLog(`Book ${b} Reveal Check: ${revealCheck.status.toUpperCase()}${revealCheck.flags.length > 0 ? ' - ' + revealCheck.flags[0] : ''}`);

      if (revealCheck.status === 'failed') {
        onLog(`Book ${b} Reveal repair: fixing...`);
        result = await repairReveal(projectId, b, result, revealCheck.flags, reveals);
        const revRecheck = await checkRevealTimeline(projectId, b, result, reveals, 'book_architect');
        onLog(`Book ${b} Reveal Re-check: ${revRecheck.status.toUpperCase()}`);

        if (revRecheck.status === 'failed') {
          await supabase.from('series_plans').update({ reveal_status: 'needs_review', reveal_flags: revRecheck.flags.join('; ') })
            .eq('project_id', projectId).eq('book_number', b);
          await updatePipelineState(state.id, {
            is_running: false,
            error_message: `Book ${b} failed reveal check: ${revRecheck.flags.join('; ')}`,
          });
          onLog(`PIPELINE HALTED: Book ${b} reveal violations unresolvable.`);
          return;
        }
        await supabase.from('series_plans').update({ reveal_status: 'passed' })
          .eq('project_id', projectId).eq('book_number', b);
      } else {
        await supabase.from('series_plans').update({ reveal_status: revealCheck.status })
          .eq('project_id', projectId).eq('book_number', b);
      }
    }

    // --- MSU GATE ---
    const msuCheck = await checkMSU(projectId, result, 'book_architect', worldCtx);
    onLog(`Book ${b} MSU Check: ${msuCheck.status.toUpperCase()}${msuCheck.flags.length > 0 ? ' - ' + msuCheck.flags[0] : ''}`);

    if (msuCheck.status === 'failed' && msuCheck.severity === 'major') {
      onLog(`Book ${b} MSU repair: removing unapproved elements...`);
      result = await repairMSU(projectId, result, msuCheck.flags, worldCtx, 'book_architect');
      const msuRecheck = await checkMSU(projectId, result, 'book_architect', worldCtx);
      onLog(`Book ${b} MSU Re-check: ${msuRecheck.status.toUpperCase()}`);

      if (msuRecheck.status === 'failed') {
        await supabase.from('series_plans').update({ msu_status: 'needs_review', msu_flags: msuRecheck.flags.join('; ') })
          .eq('project_id', projectId).eq('book_number', b);
        await updatePipelineState(state.id, {
          is_running: false,
          error_message: `Book ${b} MSU check failed: ${msuRecheck.flags.join('; ')}`,
        });
        onLog(`PIPELINE HALTED: Book ${b} MSU violations unresolvable.`);
        return;
      }
    }

    await supabase.from('series_plans').update({ msu_status: msuCheck.status === 'failed' ? 'passed' : msuCheck.status })
      .eq('project_id', projectId).eq('book_number', b);

    // --- SAVE OUTLINE & CHAPTERS ---
    const plan = seriesPlans.find(p => p.book_number === b);
    const { data: outline } = await supabase
      .from('outlines')
      .insert({ project_id: projectId, title: plan?.title || `Book ${b}`, synopsis: plan?.high_level_outline || '' })
      .select()
      .single();

    if (outline) {
      await saveLevel2Chapters(projectId, outline.id, b, result, chars, places);
      await supabase.from('series_plans').update({ outline_id: outline.id }).eq('id', plan!.id);
      seriesPlans[b - 1].outline_id = outline.id;
    }
  }

  await updatePipelineState(state.id, { level2_status: 'complete', current_level: 3 });
  onLog('Level 2 complete: All book outlines generated and validated.');

  // ===== LEVEL 3: Chapter Architect (all books) =====
  onLog('Level 3: Chapter Architect starting...');
  await updatePipelineState(state.id, { level3_status: 'running', current_level: 3 });

  for (let b = 1; b <= seriesPlans.length; b++) {
    checkAbort();
    const plan = seriesPlans[b - 1];
    if (!plan.outline_id) continue;

    onLog(`Level 3: Chapter briefs for Book ${b}...`);
    await updatePipelineState(state.id, { current_book: b });

    const { data: chapters } = await supabase
      .from('chapters')
      .select('*')
      .eq('outline_id', plan.outline_id)
      .order('order_index', { ascending: true });

    if (!chapters || chapters.length === 0) continue;

    const briefTexts: string[] = [];
    const briefIds: string[] = [];

    for (const chapter of chapters) {
      checkAbort();
      const brief = await runLevel3ChapterBrief(projectId, chapter.id, b, seriesPlans, onProgress);
      briefTexts.push(brief.raw_output);
      briefIds.push(brief.id);
    }

    // --- BATCH REVEAL GATE (per book) ---
    if (reveals.length > 0) {
      const batchText = briefTexts.join('\n\n---\n\n');
      const revCheck = await checkRevealTimeline(projectId, b, batchText, reveals, 'chapter_architect_batch');
      onLog(`Book ${b} Chapter Batch Reveal Check: ${revCheck.status.toUpperCase()}${revCheck.flags.length > 0 ? ' - ' + revCheck.flags[0] : ''}`);

      if (revCheck.status === 'failed') {
        onLog(`Book ${b} Chapter Batch Reveal repair...`);
        const repairedBatch = await repairReveal(projectId, b, batchText, revCheck.flags, reveals);
        const revRecheck = await checkRevealTimeline(projectId, b, repairedBatch, reveals, 'chapter_architect_batch');
        onLog(`Book ${b} Chapter Batch Reveal Re-check: ${revRecheck.status.toUpperCase()}`);

        const revStatus: GateStatus = revRecheck.status === 'failed' ? 'needs_review' : 'passed';
        for (const id of briefIds) {
          await supabase.from('chapter_briefs').update({ reveal_status: revStatus, reveal_flags: revRecheck.flags.join('; ') }).eq('id', id);
        }

        if (revRecheck.status === 'failed') {
          await updatePipelineState(state.id, { is_running: false, error_message: `Book ${b} chapters reveal check failed.` });
          onLog(`PIPELINE HALTED: Book ${b} chapter reveal violations unresolvable.`);
          return;
        }
      } else {
        for (const id of briefIds) {
          await supabase.from('chapter_briefs').update({ reveal_status: revCheck.status }).eq('id', id);
        }
      }
    }

    // --- BATCH MSU GATE (per book) ---
    const batchMsuText = briefTexts.join('\n\n---\n\n');
    const msuCheck = await checkMSU(projectId, batchMsuText, 'chapter_architect_batch', worldCtx);
    onLog(`Book ${b} Chapter Batch MSU Check: ${msuCheck.status.toUpperCase()}${msuCheck.flags.length > 0 ? ' - ' + msuCheck.flags[0] : ''}`);

    if (msuCheck.status === 'failed' && msuCheck.severity === 'major') {
      onLog(`Book ${b} Chapter Batch MSU repair...`);
      const repairedMsu = await repairMSU(projectId, batchMsuText, msuCheck.flags, worldCtx, 'chapter_architect_batch');
      const msuRecheck = await checkMSU(projectId, repairedMsu, 'chapter_architect_batch', worldCtx);
      onLog(`Book ${b} Chapter Batch MSU Re-check: ${msuRecheck.status.toUpperCase()}`);

      const msuStatus: GateStatus = msuRecheck.status === 'failed' ? 'needs_review' : 'passed';
      for (const id of briefIds) {
        await supabase.from('chapter_briefs').update({ msu_status: msuStatus, msu_flags: msuRecheck.flags.join('; ') }).eq('id', id);
      }

      if (msuRecheck.status === 'failed') {
        await updatePipelineState(state.id, { is_running: false, error_message: `Book ${b} chapters MSU check failed.` });
        onLog(`PIPELINE HALTED: Book ${b} chapter MSU violations unresolvable.`);
        return;
      }
    } else {
      for (const id of briefIds) {
        await supabase.from('chapter_briefs').update({ msu_status: msuCheck.status }).eq('id', id);
      }
    }
  }

  await updatePipelineState(state.id, { level3_status: 'complete', current_level: 4 });
  onLog('Level 3 complete: All chapter briefs generated and validated.');

  // ===== LEVEL 4: Scene Architect (all books) =====
  onLog('Level 4: Scene Architect starting...');
  await updatePipelineState(state.id, { level4_status: 'running', current_level: 4 });

  for (let b = 1; b <= seriesPlans.length; b++) {
    checkAbort();
    const plan = seriesPlans[b - 1];
    if (!plan.outline_id) continue;

    onLog(`Level 4: Scene blueprints for Book ${b}...`);
    await updatePipelineState(state.id, { current_book: b });

    const { data: chapters } = await supabase
      .from('chapters')
      .select('*')
      .eq('outline_id', plan.outline_id)
      .order('order_index', { ascending: true });

    if (!chapters) continue;

    for (const chapter of chapters) {
      checkAbort();

      const { data: briefData } = await supabase
        .from('chapter_briefs')
        .select('*')
        .eq('chapter_id', chapter.id)
        .eq('status', 'complete')
        .maybeSingle();

      if (!briefData) continue;

      const existingBps = await supabase
        .from('scene_blueprints')
        .select('id')
        .eq('chapter_id', chapter.id);

      if (existingBps.data && existingBps.data.length > 0) continue;

      const blueprints = await runLevel4SceneBlueprints(projectId, chapter.id, briefData as ChapterBrief, onProgress);

      for (let i = 0; i < blueprints.length; i++) {
        const bp = blueprints[i];
        const { data: scene } = await supabase
          .from('scenes')
          .insert({
            project_id: projectId,
            chapter_id: chapter.id,
            title: bp.title,
            description: `POV: ${bp.pov_character}\nSetting: ${bp.setting}\n\n${bp.opening_beat}\n\n${bp.conflict_tension}`,
            order_index: i,
          })
          .select()
          .single();

        if (scene) {
          await supabase.from('scene_blueprints').update({ scene_id: scene.id }).eq('id', bp.id);
        }
      }

      // --- OPTIONAL MSU WARNING at Level 4 (lore-triggered only) ---
      const bpText = blueprints.map(bp => bp.raw_output || '').join('\n');
      const hasLoreTrigger = /\b(ancient|prophecy|civilization|faction|order|guild|council)\b/i.test(bpText);
      if (hasLoreTrigger) {
        const l4Msu = await checkMSU(projectId, bpText, 'scene_architect', worldCtx);
        if (l4Msu.status !== 'passed') {
          onLog(`Book ${b} Ch${chapter.order_index + 1} Scene MSU: ${l4Msu.status.toUpperCase()} (warning only) - ${l4Msu.flags[0] || ''}`);
          for (const bp of blueprints) {
            await supabase.from('scene_blueprints').update({ msu_status: l4Msu.status, msu_flags: l4Msu.flags.join('; ') }).eq('id', bp.id);
          }
        }
      }
    }
  }

  await updatePipelineState(state.id, { level4_status: 'complete', current_level: 5 });
  onLog('Level 4 complete: All scene blueprints generated.');

  // ===== LEVELS 5 & 6: Scene Writer + Assembly (book by book) =====
  const depthThresholds = SCENE_DEPTH_THRESHOLDS[depthMode];

  for (let b = 1; b <= seriesPlans.length; b++) {
    checkAbort();
    const plan = seriesPlans[b - 1];
    if (!plan.outline_id) continue;

    // Level 5: Scene Writer
    onLog(`Level 5: Writing prose for Book ${b} (${depthMode.replace('_', ' ')}, target ${depthThresholds.target} words)...`);
    await updatePipelineState(state.id, { level5_status: 'running', current_level: 5, current_book: b });

    const { data: chapters } = await supabase
      .from('chapters')
      .select('*')
      .eq('outline_id', plan.outline_id)
      .order('order_index', { ascending: true });

    if (chapters) {
      for (const chapter of chapters) {
        checkAbort();

        const { data: briefData } = await supabase
          .from('chapter_briefs')
          .select('*')
          .eq('chapter_id', chapter.id)
          .eq('status', 'complete')
          .maybeSingle();

        if (!briefData) continue;

        const { data: scenes } = await supabase
          .from('scenes')
          .select('*')
          .eq('chapter_id', chapter.id)
          .order('order_index', { ascending: true });

        if (!scenes) continue;

        for (const scene of scenes) {
          checkAbort();
          if (scene.content && scene.content.length > 200) continue;

          const { data: blueprint } = await supabase
            .from('scene_blueprints')
            .select('*')
            .eq('scene_id', scene.id)
            .maybeSingle();

          if (!blueprint) continue;

          const content = await runLevel5SceneWriter(projectId, scene.id, blueprint as SceneBlueprint, briefData as ChapterBrief, plan, onProgress, depthMode);

          // --- SCENE DEPTH CHECK ---
          const wc = countWords(content);
          const targetWc = depthThresholds.target;

          if (wc < depthThresholds.minimum) {
            onLog(`Scene ${b}.${chapter.order_index + 1}.${scene.order_index + 1} Depth Check: FAILED - ${wc} words, target ${targetWc}`);

            const briefContext = `Purpose: ${briefData.chapter_purpose}\nEmotional: ${briefData.emotional_goal}\nConflict: ${briefData.conflict_structure}`;
            const bpContext = `Title: ${blueprint.title}\nPOV: ${blueprint.pov_character}\nSetting: ${blueprint.setting}\nOpening: ${blueprint.opening_beat}\nConflict: ${blueprint.conflict_tension}\nClosing: ${blueprint.closing_beat}`;

            const expanded = await expandScene(projectId, content, bpContext, briefContext, targetWc);
            const expandedWc = countWords(expanded);

            if (expandedWc >= depthThresholds.minimum) {
              await supabase.from('scenes').update({
                content: expanded,
                word_count: expandedWc,
                target_word_count: targetWc,
                scene_depth_status: 'passed',
                expansion_attempts: 1,
                updated_at: new Date().toISOString(),
              }).eq('id', scene.id);
              onLog(`Scene ${b}.${chapter.order_index + 1}.${scene.order_index + 1} Expansion: PASSED - ${expandedWc} words`);
            } else {
              await supabase.from('scenes').update({
                word_count: wc,
                target_word_count: targetWc,
                scene_depth_status: 'needs_review',
                expansion_attempts: 1,
                updated_at: new Date().toISOString(),
              }).eq('id', scene.id);
              onLog(`Scene ${b}.${chapter.order_index + 1}.${scene.order_index + 1} Expansion: still short (${expandedWc} words), marking needs_review`);
            }
          } else {
            await supabase.from('scenes').update({
              word_count: wc,
              target_word_count: targetWc,
              scene_depth_status: 'passed',
            }).eq('id', scene.id);
          }
        }
      }
    }

    // Level 6: Assembly
    onLog(`Level 6: Assembling Book ${b}...`);
    await updatePipelineState(state.id, { level6_status: 'running', current_level: 6, current_book: b });
    await runLevel6Assembly(projectId, plan.outline_id, b, onProgress);

    // Level 5.5: Character State Extraction (after assembly, before next book)
    onLog(`Extracting character states from Book ${b}...`);
    try {
      const snapshots = await extractCharacterStatesFromBook(projectId, b, onLog);
      onLog(`Book ${b} complete. ${snapshots.length} character states extracted.`);
    } catch (err: any) {
      onLog(`Book ${b} character state extraction failed (non-blocking): ${err.message}`);
    }
  }

  await updatePipelineState(state.id, {
    level5_status: 'complete',
    level6_status: 'complete',
    is_running: false,
    completed_at: new Date().toISOString(),
  });
  onLog('ACCELERATED PIPELINE COMPLETE. Full series drafted with quality gates.');
}

// ------ PARSING HELPERS ------

function findBookSection(text: string, bookNum: number): string {
  const regex = new RegExp(`BOOK\\s+${bookNum}[:\\s]([\\s\\S]*?)(?=BOOK\\s+${bookNum + 1}[:\\s]|$)`, 'i');
  const match = text.match(regex);
  return match ? match[0] : '';
}

function extractField(section: string, fieldName: string): string {
  const patterns = [
    new RegExp(`[-*]?\\s*${fieldName}\\s*:\\s*(.+?)(?=\\n[-*]|\\n\\n|$)`, 'is'),
    new RegExp(`${fieldName}\\s*:\\s*(.+?)(?=\\n[-*]|\\n[A-Z]|$)`, 'is'),
  ];

  for (const pattern of patterns) {
    const match = section.match(pattern);
    if (match && match[1]) return match[1].trim();
  }

  // Try to get text after title line for "title" field
  if (fieldName.toLowerCase() === 'title') {
    const titleMatch = section.match(/BOOK\s+\d+[:\s]+(.+?)(?:\n|$)/i);
    if (titleMatch) return titleMatch[1].trim();
  }

  return '';
}

function extractSection(text: string, sectionName: string): string {
  const regex = new RegExp(`${sectionName}\\s*:\\s*([\\s\\S]*?)(?=\\n[A-Z][A-Z\\s/\\-]+:|$)`, 'i');
  const match = text.match(regex);
  return match ? match[1].trim() : '';
}

interface ParsedChapter {
  title: string;
  pov: string;
  location: string;
  summary: string;
  keyBeats: string;
}

function parseChaptersFromOutput(text: string): ParsedChapter[] {
  const chapters: ParsedChapter[] = [];
  const chapterRegex = /Chapter\s+(\d+)\s*[:\-]\s*(.+?)(?=\nChapter\s+\d+|$)/gis;
  let match;

  while ((match = chapterRegex.exec(text)) !== null) {
    const section = match[0];
    const title = match[2]?.trim() || `Chapter ${match[1]}`;

    chapters.push({
      title,
      pov: extractField(section, 'pov character') || extractField(section, 'pov'),
      location: extractField(section, 'location') || extractField(section, 'setting'),
      summary: extractField(section, 'plot function') || extractField(section, 'emotional arc') || '',
      keyBeats: extractField(section, 'key beats') || '',
    });
  }

  // Fallback: if regex found nothing, split by numbered lines
  if (chapters.length === 0) {
    const lines = text.split('\n');
    let current: ParsedChapter | null = null;

    for (const line of lines) {
      const chMatch = line.match(/^(?:Chapter\s+)?(\d+)[.:\-]\s*(.+)/i);
      if (chMatch) {
        if (current) chapters.push(current);
        current = { title: chMatch[2].trim(), pov: '', location: '', summary: '', keyBeats: '' };
      } else if (current) {
        const povMatch = line.match(/POV\s*(?:Character)?[:\-]\s*(.+)/i);
        const locMatch = line.match(/(?:Location|Setting)[:\-]\s*(.+)/i);
        const beatMatch = line.match(/Key\s*Beats?[:\-]\s*(.+)/i);
        if (povMatch) current.pov = povMatch[1].trim();
        else if (locMatch) current.location = locMatch[1].trim();
        else if (beatMatch) current.keyBeats = beatMatch[1].trim();
        else if (!current.summary && line.trim().startsWith('-')) {
          current.summary += line.trim().slice(1).trim() + ' ';
        }
      }
    }
    if (current) chapters.push(current);
  }

  return chapters;
}

function parseSceneBlueprints(text: string, projectId: string, chapterId: string): Array<Partial<SceneBlueprint>> {
  const blueprints: Array<Partial<SceneBlueprint>> = [];
  const sceneRegex = /SCENE\s+(\d+)\s*[:\-]\s*(.+?)(?=\nSCENE\s+\d+|$)/gis;
  let match;

  while ((match = sceneRegex.exec(text)) !== null) {
    const section = match[0];
    blueprints.push({
      project_id: projectId,
      chapter_id: chapterId,
      title: match[2]?.trim() || `Scene ${match[1]}`,
      pov_character: extractField(section, 'pov character') || extractField(section, 'pov'),
      characters_present: extractField(section, 'characters present'),
      setting: extractField(section, 'setting'),
      opening_beat: extractField(section, 'opening beat'),
      conflict_tension: extractField(section, 'conflict') || extractField(section, 'tension'),
      key_dialogue_beats: extractField(section, 'key dialogue') || extractField(section, 'dialogue beats'),
      emotional_turn: extractField(section, 'emotional turn'),
      worldbuilding_allowed: extractField(section, 'worldbuilding'),
      reveal_restrictions: extractField(section, 'reveal restrictions') || extractField(section, 'restrictions'),
      closing_beat: extractField(section, 'closing beat'),
      transition_to_next: extractField(section, 'transition'),
      raw_output: section,
    });
  }

  // Fallback if no SCENE headers found
  if (blueprints.length === 0) {
    const sections = text.split(/\n(?=\d+[.)]\s|Scene\s+\d)/i);
    for (const section of sections) {
      if (section.trim().length < 20) continue;
      const titleMatch = section.match(/^(?:\d+[.)]\s*|Scene\s+\d+[:\-]\s*)(.+)/i);
      blueprints.push({
        project_id: projectId,
        chapter_id: chapterId,
        title: titleMatch?.[1]?.trim() || 'Unnamed Scene',
        pov_character: extractField(section, 'pov'),
        characters_present: extractField(section, 'characters'),
        setting: extractField(section, 'setting'),
        opening_beat: extractField(section, 'opening'),
        conflict_tension: extractField(section, 'conflict'),
        key_dialogue_beats: extractField(section, 'dialogue'),
        emotional_turn: extractField(section, 'emotional'),
        worldbuilding_allowed: extractField(section, 'worldbuilding'),
        reveal_restrictions: extractField(section, 'reveal'),
        closing_beat: extractField(section, 'closing'),
        transition_to_next: extractField(section, 'transition'),
        raw_output: section,
      });
    }
  }

  return blueprints;
}
