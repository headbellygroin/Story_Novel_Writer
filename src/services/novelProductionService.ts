import { supabase } from '../lib/supabase';
import { generateScene } from './aiService';

export type DraftProfile = 'fast_draft' | 'standard_draft' | 'novel_draft' | 'publisher_draft';

export const DRAFT_PROFILES: Record<DraftProfile, { label: string; wordRange: string; minWords: number; maxWords: number }> = {
  fast_draft: { label: 'Fast Draft', wordRange: '500-800', minWords: 500, maxWords: 800 },
  standard_draft: { label: 'Standard Draft', wordRange: '1000-1500', minWords: 1000, maxWords: 1500 },
  novel_draft: { label: 'Novel Draft', wordRange: '1500-2500', minWords: 1500, maxWords: 2500 },
  publisher_draft: { label: 'Publisher Draft', wordRange: '2500-4000', minWords: 2500, maxWords: 4000 },
};

export interface GenerationRunState {
  id: string;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed';
  draftProfile: DraftProfile;
  currentChapterIndex: number;
  currentSceneIndex: number;
  totalChapters: number;
  totalScenes: number;
  completedScenes: number;
  totalWords: number;
  errorMessage: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface ProductionStats {
  booksCompleted: number;
  chaptersCompleted: number;
  scenesCompleted: number;
  totalWords: number;
  currentRun: GenerationRunState | null;
}

// Load or create a generation run for the given outline
export async function getOrCreateRun(projectId: string, outlineId: string, profile: DraftProfile): Promise<GenerationRunState> {
  const { data: existing } = await supabase
    .from('generation_runs')
    .select('*')
    .eq('project_id', projectId)
    .eq('outline_id', outlineId)
    .in('status', ['idle', 'running', 'paused', 'failed'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    return mapRunRow(existing);
  }

  const { data: chaptersData } = await supabase
    .from('chapters')
    .select('id')
    .eq('outline_id', outlineId)
    .order('order_index', { ascending: true });

  const chapterIds = (chaptersData || []).map(c => c.id);
  let totalScenes = 0;
  if (chapterIds.length > 0) {
    const { count } = await supabase
      .from('scenes')
      .select('*', { count: 'exact', head: true })
      .in('chapter_id', chapterIds);
    totalScenes = count || 0;
  }

  const { data: newRun, error } = await supabase
    .from('generation_runs')
    .insert({
      project_id: projectId,
      outline_id: outlineId,
      status: 'idle',
      draft_profile: profile,
      total_chapters: chapterIds.length,
      total_scenes: totalScenes,
    })
    .select()
    .single();

  if (error) throw error;
  return mapRunRow(newRun);
}

export async function updateRunState(runId: string, updates: Partial<Record<string, any>>): Promise<void> {
  const { error } = await supabase
    .from('generation_runs')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', runId);
  if (error) {
    console.error('[Production] Failed to update run state:', error.message);
  }
}

// Save scene content with retry
export async function saveSceneContent(
  sceneId: string,
  content: string,
): Promise<void> {
  const payload = {
    content,
    status: 'draft',
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('scenes').update(payload).eq('id', sceneId);

  if (error) {
    console.error('[Production] Scene save failed, retrying once:', error.message);
    // Retry once after short delay
    await new Promise(r => setTimeout(r, 2000));
    const { error: retryErr } = await supabase.from('scenes').update(payload).eq('id', sceneId);
    if (retryErr) {
      throw new Error(`Scene save failed after retry: ${retryErr.message}. Content was ${content.length} chars.`);
    }
  }

  // Verify the save by reading back
  const { data: verified } = await supabase
    .from('scenes')
    .select('id')
    .eq('id', sceneId)
    .gt('content', '')
    .maybeSingle();

  if (!verified) {
    throw new Error(`Scene save verification failed: content not persisted for scene ${sceneId}`);
  }
}

// Build rich context for scene generation
export async function buildSceneContext(
  projectId: string,
  outlineId: string,
  chapterId: string,
  sceneIndex: number,
  allChapters: any[],
  allScenes: any[],
): Promise<{ contextPrompt: string; characters: string; previousEnding: string }> {
  const [outlineRes, bibleRes, manifestoRes, charsRes, voicesRes, placesRes] = await Promise.all([
    supabase.from('outlines').select('*').eq('id', outlineId).maybeSingle(),
    supabase.from('story_bible_entries').select('*').eq('project_id', projectId).limit(40),
    supabase.from('franchise_manifesto').select('*').eq('project_id', projectId).maybeSingle(),
    supabase.from('characters').select('*').eq('project_id', projectId),
    supabase.from('character_voices').select('*').eq('project_id', projectId),
    supabase.from('places').select('*').eq('project_id', projectId),
  ]);

  const outline = outlineRes.data;
  const bible = bibleRes.data || [];
  const manifesto = manifestoRes.data;
  const characters = charsRes.data || [];
  const voices = voicesRes.data || [];
  const places = placesRes.data || [];

  const chapter = allChapters.find((c: any) => c.id === chapterId);
  const chapterIndex = chapter ? allChapters.indexOf(chapter) : 0;
  const chapterScenes = allScenes.filter((s: any) => s.chapter_id === chapterId);

  // POV character voice
  let povVoice = '';
  if (chapter?.pov_character_id) {
    const char = characters.find(c => c.id === chapter.pov_character_id);
    const voice = voices.find(v => v.character_id === chapter.pov_character_id);
    if (char) {
      povVoice = `\n=== POV CHARACTER: ${char.name} ===\n${char.description || ''}\n`;
      if (voice) {
        povVoice += `Speaking Style: ${voice.speaking_style || 'Not defined'}\n`;
        povVoice += `Vocabulary: ${voice.vocabulary || 'Not defined'}\n`;
        povVoice += `Personality: ${voice.personality_traits || 'Not defined'}\n`;
        povVoice += `Emotional Tendencies: ${voice.emotional_tendencies || 'Not defined'}\n`;
        povVoice += `Relationships: ${voice.relationship_dynamics || 'Not defined'}\n`;
        if (voice.sample_dialogue) povVoice += `Sample Dialogue:\n${voice.sample_dialogue}\n`;
      }
    }
  }

  // Setting
  let settingContext = '';
  if (chapter?.setting_place_id) {
    const place = places.find(p => p.id === chapter.setting_place_id);
    if (place) {
      settingContext = `\n=== SETTING: ${place.name} ===\n${place.description || ''}\n`;
    }
  }

  // Previous content for continuity
  let previousEnding = '';
  if (sceneIndex > 0 && chapterScenes[sceneIndex - 1]?.content) {
    previousEnding = chapterScenes[sceneIndex - 1].content.slice(-800);
  } else if (sceneIndex === 0 && chapterIndex > 0) {
    const prevChapter = allChapters[chapterIndex - 1];
    const prevScenes = allScenes.filter((s: any) => s.chapter_id === prevChapter.id);
    const lastScene = prevScenes[prevScenes.length - 1];
    if (lastScene?.content && lastScene.content.length > 100) {
      previousEnding = lastScene.content.slice(-800);
    }
  }

  const chapterSummary = chapter?.summary || '';
  const contextParts: string[] = [];

  if (manifesto?.content) {
    contextParts.push(`=== SERIES MANIFESTO ===\n${manifesto.content.slice(0, 1000)}`);
  }
  if (outline?.themes) {
    contextParts.push(`=== SERIES THEME ===\n${outline.themes}`);
  }
  if (outline?.synopsis) {
    contextParts.push(`=== BOOK OUTLINE (Summary) ===\n${outline.synopsis.slice(0, 1500)}`);
  }

  contextParts.push(`=== CHAPTER ${chapterIndex + 1}: ${chapter?.title || 'Untitled'} ===\n${chapterSummary}`);

  if (povVoice) contextParts.push(povVoice);
  if (settingContext) contextParts.push(settingContext);

  const relevantBible = bible
    .filter(b => b.importance === 'critical' || b.importance === 'high')
    .slice(0, 15)
    .map(b => `[${b.category}] ${b.subject}: ${b.fact}`)
    .join('\n');
  if (relevantBible) {
    contextParts.push(`=== WORLD BIBLE (Key Entries) ===\n${relevantBible}`);
  }

  const charSummaries = characters
    .filter(c => c.description)
    .slice(0, 10)
    .map(c => `${c.name}: ${c.description!.slice(0, 200)}`)
    .join('\n');
  if (charSummaries) {
    contextParts.push(`=== CHARACTERS ===\n${charSummaries}`);
  }

  return {
    contextPrompt: contextParts.join('\n\n'),
    characters: charSummaries,
    previousEnding,
  };
}

// Generate a single scene with full context
export async function generateSceneContent(
  projectId: string,
  outlineId: string,
  scene: any,
  chapterId: string,
  sceneIndex: number,
  allChapters: any[],
  allScenes: any[],
  profile: DraftProfile,
  settings: any,
): Promise<string> {
  const { minWords, maxWords } = DRAFT_PROFILES[profile];
  const { contextPrompt, previousEnding } = await buildSceneContext(
    projectId, outlineId, chapterId, sceneIndex, allChapters, allScenes,
  );

  const previousSection = previousEnding
    ? `\n\n=== CONTINUITY: PREVIOUS SCENE ENDING ===\n${previousEnding}`
    : '';

  const prompt = `${contextPrompt}

=== SCENE BRIEF: ${scene.title} ===
${scene.description || scene.content || 'Write this scene based on the chapter outline above.'}
${previousSection}

=== GENERATION TASK ===
Write this scene as polished prose fiction. Target ${minWords}-${maxWords} words.
Use third-person limited POV from the chapter's POV character.

Requirements:
- Sensory detail (sight, sound, smell, texture)
- Character interiority and subtext
- Natural dialogue with distinct character voices
- Scene-level tension and pacing
- A clear opening hook and closing beat
- Maintain consistency with previous scenes and character voices
- Advance the plot according to the scene brief

Do NOT include headers, scene titles, metadata, or word counts. Write only the prose.`;

  const result = await generateScene({
    sceneDescription: prompt,
    generationMode: 'scene',
    contextMode: 'full',
    worldRichness: 'rich',
    planningMode: 'creative',
    context: {},
    settings,
  });

  return result;
}

// Assemble a chapter from its scenes
export async function assembleChapter(
  projectId: string,
  chapterId: string,
): Promise<{ content: string; wordCount: number; sceneCount: number }> {
  const { data: chapter, error: chapterErr } = await supabase
    .from('chapters')
    .select('*')
    .eq('id', chapterId)
    .maybeSingle();

  if (chapterErr) {
    throw new Error(`Failed to load chapter ${chapterId}: ${chapterErr.message}`);
  }

  const { data: scenes, error: scenesErr } = await supabase
    .from('scenes')
    .select('*')
    .eq('chapter_id', chapterId)
    .order('order_index', { ascending: true });

  if (scenesErr) {
    throw new Error(`Failed to load scenes for chapter ${chapterId}: ${scenesErr.message}`);
  }

  if (!scenes || scenes.length === 0) {
    return { content: '', wordCount: 0, sceneCount: 0 };
  }

  const parts: string[] = [];

  if (chapter) {
    parts.push(`# ${chapter.title}\n`);
    if (chapter.summary) {
      parts.push(`<!-- Summary: ${chapter.summary.slice(0, 300)} -->\n`);
    }
  }

  // Assemble scenes with breaks
  let totalWords = 0;
  let assembledSceneCount = 0;
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    if (!scene.content || scene.content.length < 50) continue;

    if (assembledSceneCount > 0) {
      parts.push('\n* * *\n');
    }
    parts.push(scene.content);
    totalWords += countWords(scene.content);
    assembledSceneCount++;
  }

  const content = parts.join('\n');

  // Upsert the chapter assembly
  const { data: existing, error: existErr } = await supabase
    .from('chapter_assemblies')
    .select('id, word_count')
    .eq('chapter_id', chapterId)
    .maybeSingle();

  if (existErr) {
    throw new Error(`Failed to check existing assembly for chapter ${chapterId}: ${existErr.message}`);
  }

  // Refuse to overwrite a longer assembly with a shorter one (protects against partial loads)
  if (existing && existing.word_count > 0 && totalWords < existing.word_count * 0.5 && totalWords > 0) {
    console.warn(`[Production] Refusing to downgrade chapter assembly: existing=${existing.word_count} words, new=${totalWords} words`);
    return { content, wordCount: totalWords, sceneCount: assembledSceneCount };
  }

  const assemblyData = {
    project_id: projectId,
    chapter_id: chapterId,
    content,
    word_count: totalWords,
    scene_count: assembledSceneCount,
    status: 'assembled',
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { error } = await supabase.from('chapter_assemblies').update(assemblyData).eq('id', existing.id);
    if (error) throw new Error(`Failed to update chapter assembly: ${error.message}`);
  } else {
    const { error } = await supabase.from('chapter_assemblies').insert(assemblyData);
    if (error) throw new Error(`Failed to create chapter assembly: ${error.message}`);
  }

  return { content, wordCount: totalWords, sceneCount: assembledSceneCount };
}

// Assemble a full book manuscript
export async function assembleBook(
  projectId: string,
  outlineId: string,
): Promise<{ content: string; wordCount: number; chapterCount: number }> {
  const { data: outline, error: outlineErr } = await supabase
    .from('outlines')
    .select('*')
    .eq('id', outlineId)
    .maybeSingle();

  if (outlineErr) {
    throw new Error(`Failed to load outline: ${outlineErr.message}`);
  }

  const { data: chapters, error: chapErr } = await supabase
    .from('chapters')
    .select('*')
    .eq('outline_id', outlineId)
    .order('order_index', { ascending: true });

  if (chapErr) {
    throw new Error(`Failed to load chapters: ${chapErr.message}`);
  }

  if (!chapters || chapters.length === 0) {
    return { content: '', wordCount: 0, chapterCount: 0 };
  }

  const { data: assemblies, error: asmErr } = await supabase
    .from('chapter_assemblies')
    .select('*')
    .in('chapter_id', chapters.map(c => c.id));

  if (asmErr) {
    throw new Error(`Failed to load chapter assemblies: ${asmErr.message}`);
  }

  const assemblyMap = new Map((assemblies || []).map(a => [a.chapter_id, a]));

  // Check existing manuscript to prevent downgrades
  const { data: existingManuscript } = await supabase
    .from('book_manuscripts')
    .select('id, word_count, chapter_count, status')
    .eq('outline_id', outlineId)
    .maybeSingle();

  const bookTitle = outline?.title || 'Untitled';
  const parts: string[] = [];
  let totalWords = 0;
  let completedChapters = 0;

  const titlePage = `# ${bookTitle}\n\nA Novel\n\n---\n`;
  parts.push(titlePage);

  const indexLines = chapters.map((ch, i) => {
    const assembly = assemblyMap.get(ch.id);
    const words = assembly?.word_count || 0;
    return `${i + 1}. ${ch.title}${words > 0 ? ` (${words.toLocaleString()} words)` : ' (not yet written)'}`;
  });
  parts.push(`## Table of Contents\n\n${indexLines.join('\n')}\n\n---\n`);

  for (const chapter of chapters) {
    const assembly = assemblyMap.get(chapter.id);
    if (assembly && assembly.content) {
      parts.push(`\n\n${assembly.content}`);
      totalWords += assembly.word_count;
      completedChapters++;
    } else {
      parts.push(`\n\n# ${chapter.title}\n\n[Chapter not yet written]\n`);
    }
  }

  // Refuse to overwrite a more-complete manuscript with a less-complete one
  if (existingManuscript && existingManuscript.status === 'assembled') {
    if (completedChapters < existingManuscript.chapter_count) {
      console.warn(
        `[Production] Refusing to downgrade manuscript: existing has ${existingManuscript.chapter_count} chapters, new would have ${completedChapters}`
      );
      return { content: parts.join('\n'), wordCount: totalWords, chapterCount: completedChapters };
    }
  }

  const content = parts.join('\n');

  const manuscriptData = {
    project_id: projectId,
    outline_id: outlineId,
    title: bookTitle,
    title_page: titlePage,
    chapter_index: indexLines.join('\n'),
    content,
    word_count: totalWords,
    chapter_count: completedChapters,
    status: completedChapters === chapters.length ? 'assembled' : 'draft',
    updated_at: new Date().toISOString(),
  };

  if (existingManuscript) {
    const { error } = await supabase.from('book_manuscripts').update(manuscriptData).eq('id', existingManuscript.id);
    if (error) throw new Error(`Failed to update manuscript: ${error.message}`);
  } else {
    const { error } = await supabase.from('book_manuscripts').insert(manuscriptData);
    if (error) throw new Error(`Failed to create manuscript: ${error.message}`);
  }

  return { content, wordCount: totalWords, chapterCount: completedChapters };
}

// Extract new world-building elements from generated scene content
export async function extractBibleEntries(
  projectId: string,
  sceneId: string,
  content: string,
  settings: any,
): Promise<void> {
  const prompt = `Analyze this scene text and extract any NEW world-building elements that were introduced.

=== SCENE TEXT ===
${content.slice(0, 3000)}

=== TASK ===
List only NEWLY INTRODUCED elements (not previously established ones). Format as JSON array:
[
  { "type": "character|location|technology|organization|event", "name": "...", "description": "..." }
]

If no new elements were introduced, return an empty array: []
Return ONLY the JSON array, nothing else.`;

  try {
    const result = await generateScene({
      sceneDescription: prompt,
      generationMode: 'deep_analysis',
      contextMode: 'minimal',
      worldRichness: 'minimal',
      planningMode: 'strict',
      context: {},
      settings,
    });

    const jsonMatch = result.match(/\[[\s\S]*?\]/);
    if (!jsonMatch) return;

    const entries = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(entries) || entries.length === 0) return;

    const inserts = entries
      .filter((e: any) => e.name && e.type && e.description)
      .slice(0, 10)
      .map((e: any) => ({
        project_id: projectId,
        scene_id: sceneId,
        extraction_type: e.type,
        name: e.name,
        description: e.description,
        status: 'pending',
      }));

    if (inserts.length > 0) {
      await supabase.from('bible_extraction_queue').insert(inserts);
    }
  } catch (err) {
    console.warn('[Production] Bible extraction failed (non-critical):', err instanceof Error ? err.message : 'unknown');
  }
}

// Generate a chapter summary from assembled content
export async function generateChapterSummary(
  content: string,
  settings: any,
): Promise<string> {
  const prompt = `Summarize this chapter in 2-3 sentences. Focus on key plot events, character development, and emotional beats.

=== CHAPTER TEXT ===
${content.slice(0, 4000)}

=== TASK ===
Write a concise summary (2-3 sentences). No headers or labels.`;

  try {
    const result = await generateScene({
      sceneDescription: prompt,
      generationMode: 'deep_analysis',
      contextMode: 'minimal',
      worldRichness: 'minimal',
      planningMode: 'strict',
      context: {},
      settings,
    });
    return result.trim();
  } catch {
    return '';
  }
}

// Get production stats for the dashboard
export async function getProductionStats(projectId: string): Promise<ProductionStats> {
  const [manuscriptsRes, assembliesRes, scenesRes, runsRes] = await Promise.all([
    supabase.from('book_manuscripts').select('word_count, chapter_count, status').eq('project_id', projectId),
    supabase.from('chapter_assemblies').select('word_count, status').eq('project_id', projectId),
    supabase.from('scenes').select('content').eq('project_id', projectId),
    supabase.from('generation_runs').select('*').eq('project_id', projectId).order('created_at', { ascending: false }).limit(1),
  ]);

  const manuscripts = manuscriptsRes.data || [];
  const assemblies = assembliesRes.data || [];
  const scenes = scenesRes.data || [];
  const currentRunRow = (runsRes.data || [])[0];

  const booksCompleted = manuscripts.filter(m => m.status === 'assembled').length;
  const chaptersCompleted = assemblies.filter(a => a.status === 'assembled').length;
  const scenesCompleted = scenes.filter(s => s.content && s.content.length > 100).length;
  const totalWords = assemblies.reduce((sum, a) => sum + (a.word_count || 0), 0)
    || scenes.reduce((sum, s) => sum + countWords(s.content || ''), 0);

  return {
    booksCompleted,
    chaptersCompleted,
    scenesCompleted,
    totalWords,
    currentRun: currentRunRow ? mapRunRow(currentRunRow) : null,
  };
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function mapRunRow(row: any): GenerationRunState {
  return {
    id: row.id,
    status: row.status,
    draftProfile: row.draft_profile,
    currentChapterIndex: row.current_chapter_index,
    currentSceneIndex: row.current_scene_index,
    totalChapters: row.total_chapters,
    totalScenes: row.total_scenes,
    completedScenes: row.completed_scenes,
    totalWords: row.total_words,
    errorMessage: row.error_message || '',
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}
