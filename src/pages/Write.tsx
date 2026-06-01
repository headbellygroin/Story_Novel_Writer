import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { Database } from '../lib/database.types';
import { generateScene, GenerationMode, ContextMode, WorldRichness, assemblePromptReport, PromptAssemblyReport } from '../services/aiService';
import { recommendContextTags, TagRecommendation, EntityCandidate } from '../services/contextRecommendationService';
import { formatSlidersForPrompt } from '../lib/personalitySliders';
import { formatInfraSlidersForPrompt } from '../lib/infrastructureSliders';
import { getAcceptedArcEventsForCharacter, computeEvolvedSliders } from '../services/arcAnalysisService';
import ProjectSelector from '../components/ProjectSelector';
import SceneSummaryPanel from '../components/write/SceneSummaryPanel';
import ContextTagsPanel from '../components/write/ContextTagsPanel';
import SceneImagePanel from '../components/write/SceneImagePanel';
import SceneBriefPanel from '../components/write/SceneBriefPanel';
import EditingPassPanel from '../components/write/EditingPassPanel';
import PromptReportPanel from '../components/write/PromptReportPanel';
import ChapterContextTagsPanel from '../components/write/ChapterContextTagsPanel';
import RecommendedTagsPanel from '../components/write/RecommendedTagsPanel';

type Scene = Database['public']['Tables']['scenes']['Row'];
type Chapter = Database['public']['Tables']['chapters']['Row'];
type GenerationSettings = Database['public']['Tables']['generation_settings']['Row'];

export default function Write() {
  const { currentProjectId, currentOutlineId } = useStore();
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showSceneForm, setShowSceneForm] = useState(false);
  const [sceneFormData, setSceneFormData] = useState<Partial<Scene>>({});
  const [settings, setSettings] = useState<GenerationSettings | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<'scenes' | 'context' | 'brief' | 'image' | 'report'>('scenes');
  const [generationMode, setGenerationMode] = useState<GenerationMode>('scene');
  const [contextMode, setContextMode] = useState<ContextMode>('relevant');
  const [worldRichness, setWorldRichness] = useState<WorldRichness>('balanced');
  const [promptReport, setPromptReport] = useState<PromptAssemblyReport | null>(null);
  const [tagRecommendations, setTagRecommendations] = useState<TagRecommendation[] | null>(null);
  const [recommendingTags, setRecommendingTags] = useState(false);
  const [activePresetLabel, setActivePresetLabel] = useState<string | null>(null);

  useEffect(() => {
    if (currentProjectId && currentOutlineId) {
      loadData();
    }
  }, [currentProjectId, currentOutlineId]);

  useEffect(() => {
    if (selectedChapterId) {
      loadScenes();
    }
  }, [selectedChapterId]);

  useEffect(() => {
    if (!currentProjectId) return;
    supabase
      .from('model_presets')
      .select('label, model_name')
      .eq('project_id', currentProjectId)
      .eq('task_mode', generationMode)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setActivePresetLabel(data ? `${data.label} (${data.model_name})` : null);
      });
  }, [currentProjectId, generationMode]);

  useEffect(() => {
    const smartDefaults: Record<GenerationMode, ContextMode> = {
      scene: 'relevant',
      design_brief: 'relevant',
      outline: 'relevant',
      deep_analysis: 'full',
    };
    setContextMode(smartDefaults[generationMode]);
  }, [generationMode]);

  useEffect(() => {
    if (selectedSceneId && settings && currentProjectId) {
      refreshPromptReport();
    }
  }, [selectedSceneId, contextMode, generationMode]);

  async function loadData() {
    if (!currentProjectId || !currentOutlineId) return;

    setLoading(true);
    try {
      const [chaptersRes, settingsRes] = await Promise.all([
        supabase.from('chapters').select('*').eq('outline_id', currentOutlineId).order('order_index', { ascending: true }),
        supabase.from('generation_settings').select('*').eq('project_id', currentProjectId).maybeSingle(),
      ]);

      if (chaptersRes.error) throw chaptersRes.error;

      setChapters(chaptersRes.data || []);
      setSettings(settingsRes.data);

      if (chaptersRes.data && chaptersRes.data.length > 0 && !selectedChapterId) {
        setSelectedChapterId(chaptersRes.data[0].id);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadScenes() {
    if (!selectedChapterId) return;

    try {
      const { data, error } = await supabase
        .from('scenes')
        .select('*')
        .eq('chapter_id', selectedChapterId)
        .order('order_index', { ascending: true });

      if (error) throw error;
      setScenes(data || []);

      if (data && data.length > 0 && !selectedSceneId) {
        setSelectedSceneId(data[0].id);
      }
    } catch (error) {
      console.error('Error loading scenes:', error);
    }
  }

  async function saveScene() {
    if (!currentProjectId || !selectedChapterId) {
      alert('Please select a chapter first.');
      return;
    }
    if (!sceneFormData.title) return;

    try {
      const maxOrder = scenes.length > 0 ? Math.max(...scenes.map(s => s.order_index)) : -1;
      const { data, error } = await supabase
        .from('scenes')
        .insert([{
          title: sceneFormData.title,
          description: sceneFormData.description || '',
          project_id: currentProjectId,
          chapter_id: selectedChapterId,
          order_index: maxOrder + 1,
        }])
        .select()
        .single();

      if (error) throw error;

      setScenes([...scenes, data]);
      setSelectedSceneId(data.id);
      setShowSceneForm(false);
      setSceneFormData({});
    } catch (error) {
      console.error('Error saving scene:', error);
      alert('Failed to save scene. Check the console for details.');
    }
  }

  async function generateSceneContent(sceneId: string) {
    if (!currentProjectId || !settings) {
      alert('Please configure AI settings first in the Settings page');
      return;
    }

    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;

    setGenerating(true);
    try {
      // Auto-routing: load preset for current generation mode
      const presetRes = await supabase
        .from('model_presets')
        .select('*')
        .eq('project_id', currentProjectId)
        .eq('task_mode', generationMode)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      const activePreset = presetRes.data;
      if (activePreset) {
        console.log(`[Story Forge] Auto-routing: ${generationMode} -> ${activePreset.model_name} (ctx: ${activePreset.context_length}, max: ${activePreset.max_tokens}, temp: ${activePreset.temperature})`);
      } else {
        const proceed = confirm(`WARNING: No Auto-Routing preset found for "${generationMode}". Falling back to global settings (${settings.model_name}, ctx: ${settings.context_length || 4096}). This may produce suboptimal results.\n\nGo to Settings → Model Presets → "Load Default Presets" to fix this.\n\nContinue with fallback settings?`);
        if (!proceed) {
          setGenerating(false);
          return;
        }
      }

      const [
        outline,
        chapter,
        worldData,
        eventsRes,
        statesRes,
        refsRes,
        bibleRes,
        styleRes,
        summariesRes,
        contextTagsRes,
        prohibitedWordsRes,
        manifestoRes,
        chapterTagsRes,
        revealTimelineRes,
      ] = await Promise.all([
        currentOutlineId ? supabase.from('outlines').select('*').eq('id', currentOutlineId).maybeSingle() : null,
        supabase.from('chapters').select('*').eq('id', scene.chapter_id).maybeSingle(),
        Promise.all([
          supabase.from('characters').select('*').eq('project_id', currentProjectId),
          supabase.from('places').select('*').eq('project_id', currentProjectId),
          supabase.from('things').select('*').eq('project_id', currentProjectId),
          supabase.from('technologies').select('*').eq('project_id', currentProjectId),
        ]),
        supabase.from('story_events').select('*').eq('project_id', currentProjectId).order('created_at'),
        supabase.from('character_states').select('*').eq('project_id', currentProjectId).order('created_at', { ascending: false }),
        supabase.from('scene_references').select('*').eq('project_id', currentProjectId).eq('active', true),
        supabase.from('story_bible_entries').select('*').eq('project_id', currentProjectId),
        supabase.from('style_anchors').select('*').eq('project_id', currentProjectId).eq('active', true),
        supabase.from('scene_summaries').select('*, scenes!inner(title, order_index, chapter_id)').eq('project_id', currentProjectId),
        supabase.from('scene_context_tags').select('*').eq('scene_id', sceneId),
        supabase.from('prohibited_words').select('word').eq('project_id', currentProjectId),
        supabase.from('franchise_manifesto').select('content').eq('project_id', currentProjectId).maybeSingle(),
        supabase.from('chapter_context_tags').select('*').eq('chapter_id', scene.chapter_id),
        supabase.from('reveal_timeline').select('entity_id, book_number').eq('project_id', currentProjectId),
      ]);

      const prohibitedWords = (prohibitedWordsRes.data || []).map((w: { word: string }) => w.word);
      const allCharacters = worldData[0].data || [];
      const allPlaces = worldData[1].data || [];
      const allThings = worldData[2].data || [];
      const allTechs = worldData[3].data || [];
      const sceneContextTags = contextTagsRes.data || [];
      const chapterContextTags = chapterTagsRes.data || [];

      // Smart Context Assembly: scene tags > chapter tags > relevance-driven auto-select
      const contextTags = sceneContextTags.length > 0 ? sceneContextTags : chapterContextTags;
      const hasContextTags = contextTags.length > 0;
      const taggedIds = new Set(contextTags.map(t => t.entity_id));

      // Character Visibility Gate: filter out characters not yet introduced
      const currentBook = 1; // Default book number (outline = book)
      const currentChapter = chapter.data?.order_index ?? 0;
      const visibleCharacters = generationMode === 'deep_analysis'
        ? allCharacters
        : allCharacters.filter((c: any) => {
            const bookIntro = c.book_introduced ?? 1;
            if (bookIntro > currentBook) return false;
            if (bookIntro < currentBook) return true;
            const chapterIntro = c.chapter_introduced;
            if (chapterIntro != null && chapterIntro > currentChapter) return false;
            return true;
          });

      let characters: any[];
      let places: any[];
      let things: any[];
      let technologies: any[];

      if (hasContextTags) {
        characters = visibleCharacters.filter((c: Record<string, string>) => taggedIds.has(c.id));
        places = allPlaces.filter((p: Record<string, string>) => taggedIds.has(p.id));
        things = allThings.filter((t: Record<string, string>) => taggedIds.has(t.id));
        technologies = allTechs.filter((t: Record<string, string>) => taggedIds.has(t.id));
      } else if (generationMode === 'deep_analysis') {
        characters = allCharacters;
        places = allPlaces;
        things = allThings;
        technologies = allTechs;
      } else {
        // Relevance-driven filtering: use scene description + chapter summary as signals
        const relevanceText = [
          scene.description || '',
          chapter.data?.summary || '',
          scene.content || '',
        ].join(' ').toLowerCase();

        // Characters: POV + named in brief/chapter + main roles (from visible pool only)
        const mainRoles = ['protagonist', 'antagonist', 'main', 'pov'];
        const relevantChars = visibleCharacters.filter((c: any) => {
          const role = (c.role || '').toLowerCase();
          if (mainRoles.some(r => role.includes(r))) return true;
          const name = (c.name || '').toLowerCase();
          if (name.length > 2 && relevanceText.includes(name)) return true;
          return false;
        });
        characters = relevantChars;

        // Places: preserve generously -- worldbuilding context is core
        places = allPlaces;

        // Things/Tech: include if name-referenced, otherwise limit
        things = allThings.filter((t: any) => {
          const name = (t.name || '').toLowerCase();
          return name.length > 2 && relevanceText.includes(name);
        });
        if (things.length === 0) things = allThings.slice(0, 3);

        technologies = allTechs.filter((t: any) => {
          const name = (t.name || '').toLowerCase();
          return name.length > 2 && relevanceText.includes(name);
        });
        if (technologies.length === 0) technologies = allTechs.slice(0, 3);

        console.log(`[Story Forge] Visibility: ${visibleCharacters.length}/${allCharacters.length} chars visible (book ${currentBook}, ch ${currentChapter}). Relevance: ${characters.length} selected, ${places.length} places, ${things.length} things, ${technologies.length} tech`);
      }

      const storyBibleFacts = (bibleRes.data || []).map((b: Record<string, string>) => ({
        subject: b.subject,
        fact: b.fact,
        importance: b.importance,
        category: b.category,
        canon_status: b.canon_status || 'canon',
      }));

      const taggedBibleIds = contextTags
        .filter(t => t.entity_type === 'story_bible_entries')
        .map(t => t.entity_id);
      let filteredBibleFacts: typeof storyBibleFacts;
      if (hasContextTags && taggedBibleIds.length > 0) {
        filteredBibleFacts = storyBibleFacts.filter((_: Record<string, string>, i: number) => {
          const entry = (bibleRes.data || [])[i];
          return taggedBibleIds.includes(entry.id);
        });
      } else if (generationMode === 'deep_analysis') {
        filteredBibleFacts = storyBibleFacts;
      } else {
        // Relevance-driven bible filtering
        const futureRevealEntityIds = new Set(
          (revealTimelineRes.data || [])
            .filter((r: any) => r.book_number > 1)
            .map((r: any) => r.entity_id)
        );
        const excludedCategories = ['future_plot', 'mystery', 'hidden', 'revelation', 'secret', 'spoiler'];
        const bibleRelevanceText = [
          scene.description || '',
          chapter.data?.summary || '',
          ...characters.map((c: any) => c.name || ''),
          ...places.map((p: any) => p.name || ''),
        ].join(' ').toLowerCase();

        filteredBibleFacts = storyBibleFacts.filter((f: any, i: number) => {
          const entry = (bibleRes.data || [])[i];
          if (f.importance === 'critical') return true;
          if (futureRevealEntityIds.has(entry.id)) return false;
          if (excludedCategories.some(cat => (f.category || '').toLowerCase().includes(cat))) return false;
          if (f.importance === 'high') return true;
          const subject = (f.subject || '').toLowerCase();
          if (subject.length > 2 && bibleRelevanceText.includes(subject)) return true;
          return false;
        });
      }

      const styleAnchors = (styleRes.data || []).map((a: Record<string, string>) => ({
        label: a.label,
        passage: a.passage,
        notes: a.notes,
      }));

      const storyEvents = (eventsRes.data || []).map((e: Record<string, string>) => ({
        title: e.title,
        description: e.description,
        importance: e.importance,
      }));

      const latestStates = new Map<string, Record<string, string>>();
      for (const s of statesRes.data || []) {
        if (!latestStates.has(s.character_id)) {
          const char = allCharacters.find((c: Record<string, string>) => c.id === s.character_id);
          latestStates.set(s.character_id, {
            character_name: char?.name || 'Unknown',
            physical_state: s.physical_state,
            emotional_state: s.emotional_state,
            knowledge: s.knowledge,
          });
        }
      }

      const allScenes = await supabase.from('scenes').select('id, title, content').eq('project_id', currentProjectId);
      const referencedScenes: Array<{ title: string; content: string; note: string }> = [];
      for (const ref of refsRes.data || []) {
        const refScene = (allScenes.data || []).find((s: Record<string, string>) => s.id === ref.scene_id);
        if (refScene) {
          referencedScenes.push({ title: refScene.title, content: refScene.content || '', note: ref.reference_note });
        }
      }

      const sceneSummaries = (summariesRes.data || [])
        .filter((s: any) => {
          const sceneData = s.scenes;
          return sceneData &&
            sceneData.chapter_id === scene.chapter_id &&
            sceneData.order_index < scene.order_index;
        })
        .map((s: any) => ({
          sceneTitle: s.scenes?.title || 'Untitled',
          summary: s.summary,
          key_facts: s.key_facts || [],
        }));

      const recentScenes = scenes
        .filter(s => s.order_index < scene.order_index && s.content)
        .slice(-2);
      const previousScenes = recentScenes.length > 0
        ? recentScenes.map(s => `${s.title}:\n${s.content}`).join('\n\n---\n\n')
        : undefined;

      const enrichedCharacters = await Promise.all(characters.map(async (c: any) => {
        const baseSliders = c.personality_sliders
          ? (typeof c.personality_sliders === 'string' ? JSON.parse(c.personality_sliders) : c.personality_sliders)
          : null;

        let slidersText: string | undefined;
        if (baseSliders) {
          const arcEvents = await getAcceptedArcEventsForCharacter(currentProjectId!, c.id);
          const evolved = arcEvents.length > 0 ? computeEvolvedSliders(baseSliders, arcEvents) : baseSliders;
          slidersText = formatSlidersForPrompt(evolved);
        }

        const infraSliders = c.infrastructure_sliders
          ? (typeof c.infrastructure_sliders === 'string' ? JSON.parse(c.infrastructure_sliders) : c.infrastructure_sliders)
          : null;
        const infraText = infraSliders ? formatInfraSlidersForPrompt(infraSliders) : undefined;

        return {
          ...c,
          dialogue_style: c.dialogue_style || undefined,
          personality_sliders_text: slidersText,
          infrastructure_sliders_text: infraText,
        };
      }));

      const enrichEntitiesWithInfra = (entities: any[]) => entities.map((e: any) => {
        if (!e.emergent_character || !e.infrastructure_sliders) return e;
        const sliders = typeof e.infrastructure_sliders === 'string' ? JSON.parse(e.infrastructure_sliders) : e.infrastructure_sliders;
        return { ...e, infrastructure_sliders_text: formatInfraSlidersForPrompt(sliders) };
      });

      const content = await generateScene({
        sceneDescription: scene.description,
        generationMode,
        contextMode,
        worldRichness,
        context: {
          franchiseManifesto: manifestoRes?.data?.content || undefined,
          outlineSynopsis: outline?.data?.synopsis,
          chapterSummary: chapter.data?.summary,
          characters: enrichedCharacters,
          places: enrichEntitiesWithInfra(places),
          things: enrichEntitiesWithInfra(things),
          technologies: enrichEntitiesWithInfra(technologies),
          previousScenes: previousScenes || undefined,
          previousSceneSummaries: sceneSummaries.length > 0 ? sceneSummaries : undefined,
          storyEvents: storyEvents.length > 0 ? storyEvents : undefined,
          characterStates: latestStates.size > 0 ? Array.from(latestStates.values()) as any : undefined,
          referencedScenes: referencedScenes.length > 0 ? referencedScenes : undefined,
          storyBibleFacts: filteredBibleFacts.length > 0 ? filteredBibleFacts : undefined,
          styleAnchors: styleAnchors.length > 0 ? styleAnchors : undefined,
          prohibitedWords: prohibitedWords.length > 0 ? prohibitedWords : undefined,
        },
        settings: {
          ...settings,
          ...(activePreset ? {
            model_name: activePreset.model_name,
            api_endpoint: activePreset.api_endpoint || settings.api_endpoint,
            context_length: activePreset.context_length,
            max_tokens: activePreset.max_tokens,
            temperature: activePreset.temperature,
            ...(activePreset.top_p != null ? { top_p: activePreset.top_p } : {}),
            ...(activePreset.top_k != null ? { top_k: activePreset.top_k } : {}),
            ...(activePreset.repetition_penalty != null ? { repetition_penalty: activePreset.repetition_penalty } : {}),
            ...(activePreset.presence_penalty != null ? { presence_penalty: activePreset.presence_penalty } : {}),
            ...(activePreset.frequency_penalty != null ? { frequency_penalty: activePreset.frequency_penalty } : {}),
          } : {}),
          style_rules: (settings.style_rules as Record<string, boolean>) || undefined,
        },
      });

      const { error } = await supabase
        .from('scenes')
        .update({
          content,
          ai_prompt: scene.description,
          context_data: {
            generationMode,
            outline: outline?.data?.synopsis,
            chapter: chapter.data?.summary,
            characters: characters.map((c: Record<string, string>) => c.name),
            places: places.map((p: Record<string, string>) => p.name),
            storyEvents: storyEvents.length,
            characterStates: latestStates.size,
            referencedScenes: referencedScenes.length,
            storyBibleFacts: filteredBibleFacts.length,
            styleAnchors: styleAnchors.length,
            sceneSummaries: sceneSummaries.length,
            usedContextTags: hasContextTags,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', sceneId);

      if (error) throw error;

      setScenes(scenes.map(s => s.id === sceneId ? { ...s, content } : s));

      // After Design Brief generation, recommend context tags
      if (generationMode === 'design_brief' && content && selectedChapterId) {
        triggerTagRecommendation(content, chapter.data?.summary || '', sceneId);
      }
    } catch (error: any) {
      console.error('Error generating scene:', error);
      const msg = error?.message || 'Unknown error';
      if (msg.includes('Context window exceeded')) {
        alert(msg);
      } else {
        alert(`Generation failed: ${msg}\n\nCheck that the correct model is loaded in LM Studio.`);
      }
    } finally {
      setGenerating(false);
    }
  }

  async function refreshPromptReport() {
    if (!currentProjectId || !settings || !selectedSceneId) return;

    const scene = scenes.find(s => s.id === selectedSceneId);
    if (!scene) return;

    try {
      const [
        outline,
        chapter,
        worldData,
        eventsRes,
        statesRes,
        refsRes,
        bibleRes,
        styleRes,
        summariesRes,
        contextTagsRes,
        prohibitedWordsRes,
        manifestoRes,
        chapterTagsRes,
        revealTimelineRes2,
      ] = await Promise.all([
        currentOutlineId ? supabase.from('outlines').select('*').eq('id', currentOutlineId).maybeSingle() : null,
        supabase.from('chapters').select('*').eq('id', scene.chapter_id).maybeSingle(),
        Promise.all([
          supabase.from('characters').select('*').eq('project_id', currentProjectId),
          supabase.from('places').select('*').eq('project_id', currentProjectId),
          supabase.from('things').select('*').eq('project_id', currentProjectId),
          supabase.from('technologies').select('*').eq('project_id', currentProjectId),
        ]),
        supabase.from('story_events').select('*').eq('project_id', currentProjectId).order('created_at'),
        supabase.from('character_states').select('*').eq('project_id', currentProjectId).order('created_at', { ascending: false }),
        supabase.from('scene_references').select('*').eq('project_id', currentProjectId).eq('active', true),
        supabase.from('story_bible_entries').select('*').eq('project_id', currentProjectId),
        supabase.from('style_anchors').select('*').eq('project_id', currentProjectId).eq('active', true),
        supabase.from('scene_summaries').select('*, scenes!inner(title, order_index, chapter_id)').eq('project_id', currentProjectId),
        supabase.from('scene_context_tags').select('*').eq('scene_id', selectedSceneId),
        supabase.from('prohibited_words').select('word').eq('project_id', currentProjectId),
        supabase.from('franchise_manifesto').select('content').eq('project_id', currentProjectId).maybeSingle(),
        supabase.from('chapter_context_tags').select('*').eq('chapter_id', scene.chapter_id),
        supabase.from('reveal_timeline').select('entity_id, book_number').eq('project_id', currentProjectId),
      ]);

      const prohibitedWords = (prohibitedWordsRes.data || []).map((w: { word: string }) => w.word);
      const allCharacters = worldData[0].data || [];
      const allPlaces = worldData[1].data || [];
      const allThings = worldData[2].data || [];
      const allTechs = worldData[3].data || [];
      const sceneContextTags = contextTagsRes.data || [];
      const chapterContextTags = chapterTagsRes.data || [];

      // Smart Context Assembly (mirrors generation logic)
      const contextTags = sceneContextTags.length > 0 ? sceneContextTags : chapterContextTags;
      const hasContextTags = contextTags.length > 0;
      const taggedIds = new Set(contextTags.map(t => t.entity_id));

      // Character Visibility Gate
      const currentBook = 1;
      const currentChapter = chapter.data?.order_index ?? 0;
      const visibleCharacters = generationMode === 'deep_analysis'
        ? allCharacters
        : allCharacters.filter((c: any) => {
            const bookIntro = c.book_introduced ?? 1;
            if (bookIntro > currentBook) return false;
            if (bookIntro < currentBook) return true;
            const chapterIntro = c.chapter_introduced;
            if (chapterIntro != null && chapterIntro > currentChapter) return false;
            return true;
          });

      let characters: any[];
      let places: any[];
      let things: any[];
      let technologies: any[];

      if (hasContextTags) {
        characters = visibleCharacters.filter((c: Record<string, string>) => taggedIds.has(c.id));
        places = allPlaces.filter((p: Record<string, string>) => taggedIds.has(p.id));
        things = allThings.filter((t: Record<string, string>) => taggedIds.has(t.id));
        technologies = allTechs.filter((t: Record<string, string>) => taggedIds.has(t.id));
      } else if (generationMode === 'deep_analysis') {
        characters = allCharacters;
        places = allPlaces;
        things = allThings;
        technologies = allTechs;
      } else {
        const relevanceText = [
          scene.description || '',
          chapter.data?.summary || '',
        ].join(' ').toLowerCase();
        const mainRoles = ['protagonist', 'antagonist', 'main', 'pov'];
        characters = visibleCharacters.filter((c: any) => {
          const role = (c.role || '').toLowerCase();
          if (mainRoles.some(r => role.includes(r))) return true;
          const name = (c.name || '').toLowerCase();
          if (name.length > 2 && relevanceText.includes(name)) return true;
          return false;
        });
        places = allPlaces;
        things = allThings.filter((t: any) => {
          const name = (t.name || '').toLowerCase();
          return name.length > 2 && relevanceText.includes(name);
        });
        if (things.length === 0) things = allThings.slice(0, 3);
        technologies = allTechs.filter((t: any) => {
          const name = (t.name || '').toLowerCase();
          return name.length > 2 && relevanceText.includes(name);
        });
        if (technologies.length === 0) technologies = allTechs.slice(0, 3);
      }

      const storyBibleFacts = (bibleRes.data || []).map((b: Record<string, string>) => ({
        subject: b.subject,
        fact: b.fact,
        importance: b.importance,
        category: b.category,
        canon_status: b.canon_status || 'canon',
      }));

      const taggedBibleIds = contextTags
        .filter(t => t.entity_type === 'story_bible_entries')
        .map(t => t.entity_id);
      let filteredBibleFacts: typeof storyBibleFacts;
      if (hasContextTags && taggedBibleIds.length > 0) {
        filteredBibleFacts = storyBibleFacts.filter((_: Record<string, string>, i: number) => {
          const entry = (bibleRes.data || [])[i];
          return taggedBibleIds.includes(entry.id);
        });
      } else if (generationMode === 'deep_analysis') {
        filteredBibleFacts = storyBibleFacts;
      } else {
        const futureRevealEntityIds = new Set(
          (revealTimelineRes2.data || [])
            .filter((r: any) => r.book_number > 1)
            .map((r: any) => r.entity_id)
        );
        const excludedCategories = ['future_plot', 'mystery', 'hidden', 'revelation', 'secret', 'spoiler'];
        const bibleRelevanceText = [
          scene.description || '',
          chapter.data?.summary || '',
          ...characters.map((c: any) => c.name || ''),
          ...places.map((p: any) => p.name || ''),
        ].join(' ').toLowerCase();

        filteredBibleFacts = storyBibleFacts.filter((f: any, i: number) => {
          const entry = (bibleRes.data || [])[i];
          if (f.importance === 'critical') return true;
          if (futureRevealEntityIds.has(entry.id)) return false;
          if (excludedCategories.some(cat => (f.category || '').toLowerCase().includes(cat))) return false;
          if (f.importance === 'high') return true;
          const subject = (f.subject || '').toLowerCase();
          if (subject.length > 2 && bibleRelevanceText.includes(subject)) return true;
          return false;
        });
      }

      const styleAnchors = (styleRes.data || []).map((a: Record<string, string>) => ({
        label: a.label,
        passage: a.passage,
        notes: a.notes,
      }));

      const storyEvents = (eventsRes.data || []).map((e: Record<string, string>) => ({
        title: e.title,
        description: e.description,
        importance: e.importance,
      }));

      const latestStates = new Map<string, Record<string, string>>();
      for (const s of statesRes.data || []) {
        if (!latestStates.has(s.character_id)) {
          const char = allCharacters.find((c: Record<string, string>) => c.id === s.character_id);
          latestStates.set(s.character_id, {
            character_name: char?.name || 'Unknown',
            physical_state: s.physical_state,
            emotional_state: s.emotional_state,
            knowledge: s.knowledge,
          });
        }
      }

      const allScenes = await supabase.from('scenes').select('id, title, content').eq('project_id', currentProjectId);
      const referencedScenes: Array<{ title: string; content: string; note: string }> = [];
      for (const ref of refsRes.data || []) {
        const refScene = (allScenes.data || []).find((s: Record<string, string>) => s.id === ref.scene_id);
        if (refScene) {
          referencedScenes.push({ title: refScene.title, content: refScene.content || '', note: ref.reference_note });
        }
      }

      const sceneSummaries = (summariesRes.data || [])
        .filter((s: any) => {
          const sceneData = s.scenes;
          return sceneData &&
            sceneData.chapter_id === scene.chapter_id &&
            sceneData.order_index < scene.order_index;
        })
        .map((s: any) => ({
          sceneTitle: s.scenes?.title || 'Untitled',
          summary: s.summary,
          key_facts: s.key_facts || [],
        }));

      const recentScenes = scenes
        .filter(s => s.order_index < scene.order_index && s.content)
        .slice(-2);
      const previousScenes = recentScenes.length > 0
        ? recentScenes.map(s => `${s.title}:\n${s.content}`).join('\n\n---\n\n')
        : undefined;

      const enrichedCharacters = await Promise.all(characters.map(async (c: any) => {
        const baseSliders = c.personality_sliders
          ? (typeof c.personality_sliders === 'string' ? JSON.parse(c.personality_sliders) : c.personality_sliders)
          : null;

        let slidersText: string | undefined;
        if (baseSliders) {
          const arcEvents = await getAcceptedArcEventsForCharacter(currentProjectId!, c.id);
          const evolved = arcEvents.length > 0 ? computeEvolvedSliders(baseSliders, arcEvents) : baseSliders;
          slidersText = formatSlidersForPrompt(evolved);
        }

        const infraSliders = c.infrastructure_sliders
          ? (typeof c.infrastructure_sliders === 'string' ? JSON.parse(c.infrastructure_sliders) : c.infrastructure_sliders)
          : null;
        const infraText = infraSliders ? formatInfraSlidersForPrompt(infraSliders) : undefined;

        return {
          ...c,
          dialogue_style: c.dialogue_style || undefined,
          personality_sliders_text: slidersText,
          infrastructure_sliders_text: infraText,
        };
      }));

      const enrichEntitiesWithInfra = (entities: any[]) => entities.map((e: any) => {
        if (!e.emergent_character || !e.infrastructure_sliders) return e;
        const sliders = typeof e.infrastructure_sliders === 'string' ? JSON.parse(e.infrastructure_sliders) : e.infrastructure_sliders;
        return { ...e, infrastructure_sliders_text: formatInfraSlidersForPrompt(sliders) };
      });

      const report = assemblePromptReport({
        sceneDescription: scene.description,
        generationMode,
        contextMode,
        worldRichness,
        context: {
          franchiseManifesto: manifestoRes?.data?.content || undefined,
          outlineSynopsis: outline?.data?.synopsis,
          chapterSummary: chapter.data?.summary,
          characters: enrichedCharacters,
          places: enrichEntitiesWithInfra(places),
          things: enrichEntitiesWithInfra(things),
          technologies: enrichEntitiesWithInfra(technologies),
          previousScenes: previousScenes || undefined,
          previousSceneSummaries: sceneSummaries.length > 0 ? sceneSummaries : undefined,
          storyEvents: storyEvents.length > 0 ? storyEvents : undefined,
          characterStates: latestStates.size > 0 ? Array.from(latestStates.values()) as any : undefined,
          referencedScenes: referencedScenes.length > 0 ? referencedScenes : undefined,
          storyBibleFacts: filteredBibleFacts.length > 0 ? filteredBibleFacts : undefined,
          styleAnchors: styleAnchors.length > 0 ? styleAnchors : undefined,
          prohibitedWords: prohibitedWords.length > 0 ? prohibitedWords : undefined,
        },
        settings: {
          ...settings,
          style_rules: (settings.style_rules as Record<string, boolean>) || undefined,
        },
      });

      setPromptReport(report);
    } catch (error) {
      console.error('Error generating prompt report:', error);
    }
  }

  async function triggerTagRecommendation(briefContent: string, chapterSummary: string, _sceneId: string) {
    if (!currentProjectId || !settings) return;

    setRecommendingTags(true);
    try {
      // Load tag_recommendation preset for auto-routing
      const presetRes = await supabase
        .from('model_presets')
        .select('*')
        .eq('project_id', currentProjectId)
        .eq('task_mode', 'tag_recommendation')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      const tagPreset = presetRes.data;
      if (tagPreset) {
        console.log(`[Story Forge] Auto-routing: tag_recommendation -> ${tagPreset.model_name} (ctx: ${tagPreset.context_length})`);
      } else {
        const proceed = confirm(`WARNING: No Auto-Routing preset found for "tag_recommendation". Falling back to global settings.\n\nGo to Settings → Model Presets → "Load Default Presets" to fix this.\n\nContinue with fallback settings?`);
        if (!proceed) {
          setRecommendingTags(false);
          return;
        }
      }

      const [chars, places, things, techs, bible] = await Promise.all([
        supabase.from('characters').select('id, name').eq('project_id', currentProjectId),
        supabase.from('places').select('id, name').eq('project_id', currentProjectId),
        supabase.from('things').select('id, name').eq('project_id', currentProjectId),
        supabase.from('technologies').select('id, name').eq('project_id', currentProjectId),
        supabase.from('story_bible_entries').select('id, subject, category').eq('project_id', currentProjectId),
      ]);

      const candidates: EntityCandidate[] = [
        ...(chars.data || []).map(c => ({ id: c.id, name: c.name, type: 'characters' as const })),
        ...(places.data || []).map(p => ({ id: p.id, name: p.name, type: 'places' as const })),
        ...(things.data || []).map(t => ({ id: t.id, name: t.name, type: 'things' as const })),
        ...(techs.data || []).map(t => ({ id: t.id, name: t.name, type: 'technologies' as const })),
        ...(bible.data || []).map(b => ({ id: b.id, name: `${b.subject} (${b.category})`, type: 'story_bible_entries' as const })),
      ];

      // Use tag_recommendation preset if available, otherwise fall back to default settings
      const effectiveSettings = tagPreset
        ? {
            ...settings,
            model_name: tagPreset.model_name,
            api_endpoint: tagPreset.api_endpoint || settings.api_endpoint,
            context_length: tagPreset.context_length,
            max_tokens: tagPreset.max_tokens,
            temperature: tagPreset.temperature,
            ...(tagPreset.top_p != null ? { top_p: tagPreset.top_p } : {}),
            ...(tagPreset.top_k != null ? { top_k: tagPreset.top_k } : {}),
            ...(tagPreset.repetition_penalty != null ? { repetition_penalty: tagPreset.repetition_penalty } : {}),
            style_rules: (settings.style_rules as Record<string, boolean>) || undefined,
          }
        : { ...settings, style_rules: (settings.style_rules as Record<string, boolean>) || undefined };

      const recommendations = await recommendContextTags(
        briefContent,
        chapterSummary,
        candidates,
        effectiveSettings,
      );

      if (recommendations.length > 0) {
        setTagRecommendations(recommendations);
      }
    } catch (error) {
      console.error('Error generating tag recommendations:', error);
    } finally {
      setRecommendingTags(false);
    }
  }

  async function updateSceneContent(sceneId: string, content: string) {
    try {
      const { error } = await supabase
        .from('scenes')
        .update({ content, updated_at: new Date().toISOString() })
        .eq('id', sceneId);

      if (error) throw error;

      setScenes(scenes.map(s => s.id === sceneId ? { ...s, content } : s));
    } catch (error) {
      console.error('Error updating scene:', error);
    }
  }

  async function deleteScene(sceneId: string) {
    if (!confirm('Delete this scene?')) return;

    try {
      const { error } = await supabase.from('scenes').delete().eq('id', sceneId);

      if (error) throw error;
      setScenes(scenes.filter(s => s.id !== sceneId));
      if (selectedSceneId === sceneId) {
        setSelectedSceneId(scenes[0]?.id || null);
      }
    } catch (error) {
      console.error('Error deleting scene:', error);
    }
  }

  if (!currentProjectId) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center text-slate-600">Please select or create a project first.</div>
      </div>
    );
  }

  if (!currentOutlineId) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center text-slate-600">Please select or create an outline first.</div>
      </div>
    );
  }

  const selectedScene = scenes.find(s => s.id === selectedSceneId);

  return (
    <div className="h-screen flex flex-col">
      <div className="border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold text-slate-900">Write</h1>
            <ProjectSelector />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Chapter</label>
              <select
                value={selectedChapterId || ''}
                onChange={(e) => setSelectedChapterId(e.target.value || null)}
                className="block w-full rounded-md border-slate-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
              >
                {chapters.length === 0 && <option value="">No chapters</option>}
                {chapters.map((chapter, idx) => (
                  <option key={chapter.id} value={chapter.id}>
                    {idx + 1}. {chapter.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Scene</label>
              <div className="flex gap-2">
                <select
                  value={selectedSceneId || ''}
                  onChange={(e) => setSelectedSceneId(e.target.value || null)}
                  className="block w-full rounded-md border-slate-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
                >
                  {scenes.length === 0 && <option value="">No scenes</option>}
                  {scenes.map((scene, idx) => (
                    <option key={scene.id} value={scene.id}>
                      {idx + 1}. {scene.title}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setShowSceneForm(true)}
                  className="px-3 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-sm whitespace-nowrap"
                >
                  Add Scene
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showSceneForm && (
        <div className="border-b border-slate-200 bg-slate-50 p-4">
          <div className="max-w-7xl mx-auto">
            <h3 className="text-lg font-semibold mb-3">Add New Scene</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Scene Title</label>
                <input
                  type="text"
                  value={sceneFormData.title || ''}
                  onChange={(e) => setSceneFormData({ ...sceneFormData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Opening scene"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Scene Description</label>
                <textarea
                  value={sceneFormData.description || ''}
                  onChange={(e) => setSceneFormData({ ...sceneFormData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Describe what happens in this scene..."
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={saveScene}
                  disabled={!sceneFormData.title}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  Add Scene
                </button>
                <button
                  onClick={() => {
                    setShowSceneForm(false);
                    setSceneFormData({});
                  }}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedScene && (
        <div className="flex-1 overflow-hidden flex">
          <div className={`${showSidebar ? 'w-72' : 'w-0'} border-r border-slate-200 bg-white overflow-y-auto transition-all flex-shrink-0`}>
            {showSidebar && (
              <div>
                <div className="flex border-b border-slate-200">
                  <button
                    onClick={() => setSidebarTab('scenes')}
                    className={`flex-1 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                      sidebarTab === 'scenes'
                        ? 'border-primary-500 text-primary-700'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Scenes
                  </button>
                  <button
                    onClick={() => setSidebarTab('context')}
                    className={`flex-1 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                      sidebarTab === 'context'
                        ? 'border-primary-500 text-primary-700'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Context
                  </button>
                  <button
                    onClick={() => setSidebarTab('brief')}
                    className={`flex-1 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                      sidebarTab === 'brief'
                        ? 'border-teal-500 text-teal-700'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Brief
                  </button>
                  <button
                    onClick={() => setSidebarTab('image')}
                    className={`flex-1 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                      sidebarTab === 'image'
                        ? 'border-sky-500 text-sky-700'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Image
                  </button>
                  <button
                    onClick={() => setSidebarTab('report')}
                    className={`flex-1 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                      sidebarTab === 'report'
                        ? 'border-amber-500 text-amber-700'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Tokens
                  </button>
                </div>

                {sidebarTab === 'scenes' && (
                  <div className="p-3">
                    <h3 className="font-semibold text-slate-900 text-sm mb-2">Scenes</h3>
                    <div className="space-y-2">
                      {scenes.map((scene, idx) => (
                        <div
                          key={scene.id}
                          onClick={() => setSelectedSceneId(scene.id)}
                          className={`p-3 rounded-lg cursor-pointer transition-colors ${
                            selectedSceneId === scene.id
                              ? 'bg-primary-50 border-2 border-primary-500'
                              : 'bg-slate-50 border-2 border-transparent hover:bg-slate-100'
                          }`}
                        >
                          <div className="text-xs text-slate-500 mb-1">Scene {idx + 1}</div>
                          <div className="text-sm font-medium text-slate-900">{scene.title}</div>
                          {scene.content && (
                            <div className="text-xs text-green-600 mt-1">Written</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {sidebarTab === 'context' && selectedScene && (
                  <div className="divide-y divide-slate-200">
                    <div className="p-3">
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Generation Sources</h4>
                      <div className="space-y-1">
                        {[
                          { label: 'Franchise Manifesto', active: true },
                          { label: 'System Prompt', active: !!settings?.system_prompt },
                          { label: 'Style Guide', active: !!settings?.style_guide },
                          { label: 'Style Anchors', active: true },
                          { label: 'Story Bible', active: true },
                          { label: 'Character Context', active: true },
                          { label: 'Outline Context', active: !!currentOutlineId },
                          { label: 'Scene History', active: true },
                        ].map(source => (
                          <div key={source.label} className="flex items-center gap-2 text-xs">
                            <span className={`w-3 h-3 rounded-sm flex items-center justify-center ${source.active ? 'bg-teal-100 text-teal-600' : 'bg-slate-100 text-slate-400'}`}>
                              {source.active ? '\u2713' : '\u2013'}
                            </span>
                            <span className={source.active ? 'text-slate-700' : 'text-slate-400'}>{source.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <SceneSummaryPanel
                      sceneId={selectedScene.id}
                      projectId={currentProjectId}
                      sceneContent={selectedScene.content}
                    />
                    <ContextTagsPanel
                      sceneId={selectedScene.id}
                      projectId={currentProjectId}
                    />
                    {selectedChapterId && (
                      <ChapterContextTagsPanel
                        chapterId={selectedChapterId}
                        projectId={currentProjectId}
                      />
                    )}
                  </div>
                )}

                {sidebarTab === 'brief' && selectedScene && selectedChapterId && (
                  <div className="divide-y divide-slate-200">
                    <SceneBriefPanel
                      chapterId={selectedChapterId}
                      projectId={currentProjectId}
                      chapterTitle={chapters.find(c => c.id === selectedChapterId)?.title || ''}
                      chapterSummary={chapters.find(c => c.id === selectedChapterId)?.summary || ''}
                    />
                    <EditingPassPanel
                      sceneId={selectedScene.id}
                      projectId={currentProjectId}
                      sceneContent={selectedScene.content}
                      chapterTitle={chapters.find(c => c.id === selectedChapterId)?.title || ''}
                      onContentUpdate={(content) => {
                        updateSceneContent(selectedScene.id, content);
                      }}
                    />
                  </div>
                )}

                {sidebarTab === 'image' && selectedScene && settings && (
                  <SceneImagePanel
                    scene={selectedScene}
                    settings={settings}
                    projectId={currentProjectId}
                    onSceneUpdate={(updated) => {
                      setScenes(scenes.map(s => s.id === updated.id ? updated : s));
                    }}
                  />
                )}

                {sidebarTab === 'image' && selectedScene && !settings && (
                  <div className="p-4">
                    <p className="text-xs text-slate-500">
                      Please configure AI settings first in the Settings page.
                    </p>
                  </div>
                )}

                {sidebarTab === 'report' && selectedScene && (
                  <PromptReportPanel
                    report={promptReport}
                    contextMode={contextMode}
                    worldRichness={worldRichness}
                    onContextModeChange={(mode) => {
                      setContextMode(mode);
                      setPromptReport(null);
                    }}
                    onWorldRichnessChange={(richness) => {
                      setWorldRichness(richness);
                      setPromptReport(null);
                    }}
                    onRefresh={refreshPromptReport}
                  />
                )}
              </div>
            )}
          </div>

          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="bg-white border-b border-slate-200 p-4">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowSidebar(!showSidebar)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded transition-colors"
                    title={showSidebar ? 'Hide sidebar' : 'Show sidebar'}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <line x1="9" y1="3" x2="9" y2="21" />
                    </svg>
                  </button>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">{selectedScene.title}</h2>
                    {selectedScene.description && (
                      <p className="text-sm text-slate-600 mt-1">{selectedScene.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                    <button
                      onClick={() => setGenerationMode('scene')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        generationMode === 'scene'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Scene
                    </button>
                    <button
                      onClick={() => setGenerationMode('design_brief')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        generationMode === 'design_brief'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Brief
                    </button>
                    <button
                      onClick={() => setGenerationMode('outline')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        generationMode === 'outline'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Outline
                    </button>
                    <button
                      onClick={() => setGenerationMode('deep_analysis')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        generationMode === 'deep_analysis'
                          ? 'bg-amber-100 text-amber-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                      title="Deep Analysis (Meta Llama 128K) - slow but thorough"
                    >
                      Analysis
                    </button>
                  </div>
                  <button
                    onClick={() => generateSceneContent(selectedScene.id)}
                    disabled={generating || !settings}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm"
                  >
                    {generating ? 'Generating...' : generationMode === 'scene' ? 'Generate Scene' : generationMode === 'design_brief' ? 'Generate Brief' : generationMode === 'deep_analysis' ? 'Run Analysis' : 'Generate Outline'}
                  </button>
                  <button
                    onClick={() => deleteScene(selectedScene.id)}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
              {activePresetLabel && (
                <div className="text-xs text-slate-500 mt-1 text-right">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                    {activePresetLabel}
                  </span>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {(tagRecommendations || recommendingTags) && selectedChapterId && (
                <div className="mb-4">
                  {recommendingTags && (
                    <div className="border border-slate-200 rounded-lg p-4 text-center">
                      <p className="text-sm text-slate-600">Analyzing Design Brief for context recommendations...</p>
                    </div>
                  )}
                  {tagRecommendations && !recommendingTags && (
                    <RecommendedTagsPanel
                      recommendations={tagRecommendations}
                      chapterId={selectedChapterId}
                      projectId={currentProjectId}
                      onAccepted={() => setTagRecommendations(null)}
                      onDismiss={() => setTagRecommendations(null)}
                    />
                  )}
                </div>
              )}
              {selectedScene.generated_image_url && (
                <div className="mb-4 relative group">
                  <img
                    src={selectedScene.generated_image_url}
                    alt={`Scene: ${selectedScene.title}`}
                    className="w-full max-h-64 object-cover rounded-lg border border-slate-200 shadow-sm"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setSidebarTab('image')}
                      className="px-2 py-1 bg-black/60 text-white text-xs rounded backdrop-blur-sm hover:bg-black/80 transition-colors"
                    >
                      Edit in Image tab
                    </button>
                  </div>
                </div>
              )}
              <textarea
                value={selectedScene.content}
                onChange={(e) => updateSceneContent(selectedScene.id, e.target.value)}
                className="w-full h-full p-4 border-none resize-none focus:outline-none focus:ring-0 text-slate-900 leading-relaxed"
                placeholder="Scene content will appear here. Click 'Generate with AI' to create content, or start typing..."
                style={{ minHeight: '100%' }}
              />
            </div>
          </div>
        </div>
      )}

      {!selectedScene && scenes.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-slate-600">
          Add a scene to start writing
        </div>
      )}
    </div>
  );
}
