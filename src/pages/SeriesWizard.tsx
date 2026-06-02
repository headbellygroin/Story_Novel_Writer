import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { generateScene } from '../services/aiService';
import { jobRunner, GenerationJob, WizardJobMetadata, GenerationMode } from '../services/generationJobService';

const STEPS = [
  { id: 1, key: 'seriesMap', title: 'Series Map', description: 'High-level arc across all books.' },
  { id: 2, key: 'majorEvents', title: 'Major Events', description: 'Key turning points for the selected book.' },
  { id: 3, key: 'bookOutline', title: 'Book Outline', description: 'Detailed structural outline with act breaks.' },
  { id: 4, key: 'chapterList', title: 'Chapter List', description: 'Chapter breakdown with POV, location, events.' },
  { id: 5, key: 'chapterBriefs', title: 'Chapter Briefs', description: 'Detailed planning for each chapter.' },
  { id: 6, key: 'scenes', title: 'Scene Breakdown', description: 'Individual scene cards from the brief.' },
] as const;

type StepKey = typeof STEPS[number]['key'];

interface WizardOutput {
  seriesMap: string;
  majorEvents: string;
  bookOutline: string;
  chapterList: string;
  chapterBriefs: string;
  scenes: string;
}

type WizardMode = 'quick' | 'advanced';

function toSnakeCase(key: string): string {
  return key.replace(/([A-Z])/g, '_$1').toLowerCase();
}

function SeriesWizard() {
  const { currentProjectId, setCurrentOutlineId } = useStore();
  const [mode, setMode] = useState<WizardMode>('quick');

  // Quick Start state
  const [bookCount, setBookCount] = useState(7);
  const [genre, setGenre] = useState('');
  const [endGoal, setEndGoal] = useState('');
  const [planningStyle, setPlanningStyle] = useState<'discovery' | 'balanced' | 'architect'>('balanced');
  const [reviewFirst, setReviewFirst] = useState(true);
  const [planApproved, setPlanApproved] = useState(false);
  const [quickRunning, setQuickRunning] = useState(false);
  const [quickStep, setQuickStep] = useState(0);
  const [generationMode, setGenerationMode] = useState<GenerationMode>('guided');
  const [autoApproveSteps, setAutoApproveSteps] = useState<string[]>([]);
  const [needsReview, setNeedsReview] = useState(false);
  const [quickOutput, setQuickOutput] = useState<WizardOutput>({
    seriesMap: '', majorEvents: '', bookOutline: '', chapterList: '', chapterBriefs: '', scenes: '',
  });
  const abortRef = useRef(false);
  const sessionLoadedRef = useRef(false);

  // Advanced mode state
  const [currentStep, setCurrentStep] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [output, setOutput] = useState<WizardOutput>({
    seriesMap: '', majorEvents: '', bookOutline: '', chapterList: '', chapterBriefs: '', scenes: '',
  });
  const [userInput, setUserInput] = useState('');
  const [selectedBook, setSelectedBook] = useState(1);
  const [selectedChapter, setSelectedChapter] = useState(1);

  // Shared state
  const [settings, setSettings] = useState<any>(null);
  const [projectData, setProjectData] = useState<{
    characters: any[];
    places: any[];
    things: any[];
    technologies: any[];
    storyBible: any[];
    manifesto: string;
    outlines: any[];
  }>({ characters: [], places: [], things: [], technologies: [], storyBible: [], manifesto: '', outlines: [] });

  // Block navigation while generation is running
  const isGenerating = quickRunning || generating;

  // Browser tab/close guard
  useEffect(() => {
    if (!isGenerating) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isGenerating]);

  useEffect(() => {
    if (!currentProjectId) return;
    loadProjectData();
    loadWizardSession();
  }, [currentProjectId]);

  async function loadWizardSession() {
    if (!currentProjectId) return;
    const { data } = await supabase
      .from('wizard_sessions')
      .select('*')
      .eq('project_id', currentProjectId)
      .maybeSingle();

    if (data) {
      setMode(data.mode as WizardMode || 'quick');
      setBookCount(data.book_count || 7);
      setGenre(data.genre || '');
      setEndGoal(data.end_goal || '');
      setPlanningStyle((data.planning_style as any) || 'balanced');
      setReviewFirst(data.review_first ?? true);
      setPlanApproved(data.plan_approved ?? false);
      setQuickStep(data.quick_step || 0);

      const restored: WizardOutput = {
        seriesMap: data.output_series_map || '',
        majorEvents: data.output_major_events || '',
        bookOutline: data.output_book_outline || '',
        chapterList: data.output_chapter_list || '',
        chapterBriefs: data.output_chapter_briefs || '',
        scenes: data.output_scenes || '',
      };
      setQuickOutput(restored);
      setOutput(restored);

      // If it was marked running, it means generation was interrupted
      if (data.is_running) {
        await supabase.from('wizard_sessions')
          .update({ is_running: false, updated_at: new Date().toISOString() })
          .eq('project_id', currentProjectId);
      }
    }
    sessionLoadedRef.current = true;
  }

  async function saveWizardSession(updates: Partial<{
    mode: string;
    quick_step: number;
    is_running: boolean;
    book_count: number;
    genre: string;
    end_goal: string;
    planning_style: string;
    review_first: boolean;
    plan_approved: boolean;
    output_series_map: string;
    output_major_events: string;
    output_book_outline: string;
    output_chapter_list: string;
    output_chapter_briefs: string;
    output_scenes: string;
  }>) {
    if (!currentProjectId) return;
    const payload = {
      project_id: currentProjectId,
      updated_at: new Date().toISOString(),
      ...updates,
    };

    const { data: existing } = await supabase
      .from('wizard_sessions')
      .select('id')
      .eq('project_id', currentProjectId)
      .maybeSingle();

    if (existing) {
      await supabase.from('wizard_sessions')
        .update(payload)
        .eq('project_id', currentProjectId);
    } else {
      await supabase.from('wizard_sessions').insert(payload);
    }
  }

  async function loadProjectData() {
    if (!currentProjectId) return;

    const [settingsRes, charsRes, placesRes, thingsRes, techRes, bibleRes, manifestoRes, outlinesRes] = await Promise.all([
      supabase.from('generation_settings').select('*').eq('project_id', currentProjectId).maybeSingle(),
      supabase.from('characters').select('*').eq('project_id', currentProjectId),
      supabase.from('places').select('*').eq('project_id', currentProjectId),
      supabase.from('things').select('*').eq('project_id', currentProjectId),
      supabase.from('technologies').select('*').eq('project_id', currentProjectId),
      supabase.from('story_bible_entries').select('*').eq('project_id', currentProjectId),
      supabase.from('franchise_manifestos').select('*').eq('project_id', currentProjectId).maybeSingle(),
      supabase.from('outlines').select('*').eq('project_id', currentProjectId),
    ]);

    setSettings(settingsRes.data);
    setProjectData({
      characters: charsRes.data || [],
      places: placesRes.data || [],
      things: thingsRes.data || [],
      technologies: techRes.data || [],
      storyBible: bibleRes.data || [],
      manifesto: manifestoRes.data?.content || '',
      outlines: outlinesRes.data || [],
    });
  }

  function buildWorldSummary(): string {
    const parts: string[] = [];

    if (projectData.manifesto) {
      parts.push(`=== FRANCHISE MANIFESTO ===\n${projectData.manifesto}`);
    }

    if (projectData.characters.length > 0) {
      const charSummary = projectData.characters
        .map(c => `- ${c.name} (${c.role || 'unknown role'}): ${c.personality || ''} ${c.background || ''}`.trim())
        .join('\n');
      parts.push(`=== CHARACTERS (${projectData.characters.length}) ===\n${charSummary}`);
    }

    if (projectData.places.length > 0) {
      const placeSummary = projectData.places
        .map(p => `- ${p.name} (${p.type || 'location'}): ${p.description || ''}`.trim())
        .join('\n');
      parts.push(`=== PLACES (${projectData.places.length}) ===\n${placeSummary}`);
    }

    if (projectData.things.length > 0) {
      const thingSummary = projectData.things
        .map(t => `- ${t.name} (${t.type || 'item'}): ${t.description || ''}`.trim())
        .join('\n');
      parts.push(`=== THINGS (${projectData.things.length}) ===\n${thingSummary}`);
    }

    if (projectData.technologies.length > 0) {
      const techSummary = projectData.technologies
        .map(t => `- ${t.name} (${t.type || 'tech'}): ${t.description || ''}`.trim())
        .join('\n');
      parts.push(`=== TECHNOLOGIES (${projectData.technologies.length}) ===\n${techSummary}`);
    }

    if (projectData.storyBible.length > 0) {
      const critical = projectData.storyBible.filter((b: any) => b.importance === 'critical' || b.importance === 'high');
      if (critical.length > 0) {
        const bibleSummary = critical
          .map((b: any) => `[${b.importance.toUpperCase()}] ${b.subject}: ${b.fact}`)
          .join('\n');
        parts.push(`=== STORY BIBLE (KEY FACTS) ===\n${bibleSummary}`);
      }
    }

    return parts.join('\n\n');
  }

  // --- Quick Start ---

  // Subscribe to active job on mount
  useEffect(() => {
    if (!currentProjectId) return;
    let unsub: (() => void) | null = null;

    (async () => {
      const activeJob = await jobRunner.getActiveJob(currentProjectId);
      if (activeJob && activeJob.task_type === 'wizard_quick') {
        setActiveJobId(activeJob.id);
        setQuickRunning(true);
        applyJobState(activeJob);
        unsub = jobRunner.subscribe(activeJob.id, handleJobUpdate);
      }
    })();

    return () => { if (unsub) unsub(); };
  }, [currentProjectId]);

  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  function applyJobState(job: GenerationJob) {
    const meta = job.metadata as WizardJobMetadata | undefined;
    if (!meta) return;

    setQuickStep(job.current_step);
    const o = meta.outputs || { seriesMap: '', majorEvents: '', bookOutline: '', chapterList: '', chapterBriefs: '', scenes: '' };
    setQuickOutput(o);
    setOutput(o);
    if (meta.needs_review) setNeedsReview(true);
    if (meta.generation_mode) setGenerationMode(meta.generation_mode);

    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
      setQuickRunning(false);
      if (job.status === 'completed') setQuickStep(7);
      if (job.status === 'failed') setError(job.error_message || 'Generation failed');
    }
  }

  function handleJobUpdate(job: GenerationJob) {
    applyJobState(job);
  }

  async function runQuickStart() {
    if (!settings || !currentProjectId) {
      setError('No generation settings found. Configure your AI settings first.');
      return;
    }

    setQuickRunning(true);
    setError('');
    abortRef.current = false;

    // In Guided mode with reviewFirst: only generate step 1 for approval gate
    // In Accelerated mode: skip the review gate entirely
    const onlySeriesMap = generationMode === 'guided' && reviewFirst && !planApproved;
    if (onlySeriesMap && !quickOutput.seriesMap) {
      // Step 1 only -- run inline for the review gate
      try {
        setQuickStep(1);
        const world = buildWorldSummary();
        const genreText = genre || 'epic genre fiction';
        const endText = endGoal || 'the protagonist achieves their ultimate goal';
        const planningGuidance = getPlanningGuidance();
        const canonRule = world.trim()
          ? `\n\n=== STRICT CANON RULE ===\nYou MUST use ONLY the characters, places, things, and technologies listed above. Do NOT invent new characters, locations, or world elements. Do NOT hallucinate motivations, backstories, or relationships that are not established in the world data. If the world data is sparse, keep your output proportionally focused on what IS established. Expand only where the existing data logically implies structure.\n`
          : '';

        const seriesPrompt = `${world}${canonRule}${planningGuidance}
=== TASK: SERIES MAP ===
Create a ${bookCount}-book series roadmap.
Genre/Tone: ${genreText}
Series End Goal: ${endText}

For each book provide:
- Theme
- Beginning State
- Ending State
- Major Events (3-5 key moments)
- Character Growth
- World Changes

Do not create chapter outlines.
Do not create scene outlines.
Focus only on the overall series structure.`;

        const seriesMap = await generateScene({
          sceneDescription: seriesPrompt,
          generationMode: 'outline',
          contextMode: 'minimal',
          worldRichness: 'minimal',
          planningMode: 'creative',
          context: {},
          settings,
        });
        if (abortRef.current) return;
        setQuickOutput(prev => ({ ...prev, seriesMap }));
        await saveWizardSession({ quick_step: 1, output_series_map: seriesMap });
        setQuickStep(0);
      } catch (err: any) {
        setError(err.message || 'Generation failed');
      } finally {
        setQuickRunning(false);
      }
      return;
    }

    // Full run via job manager
    const world = buildWorldSummary();
    const planningGuidance = getPlanningGuidance();
    const canonRule = world.trim()
      ? `\n\n=== STRICT CANON RULE ===\nYou MUST use ONLY the characters, places, things, and technologies listed above. Do NOT invent new characters, locations, or world elements. Do NOT hallucinate motivations, backstories, or relationships that are not established in the world data. If the world data is sparse, keep your output proportionally focused on what IS established. Expand only where the existing data logically implies structure.\n`
      : '';

    const metadata: WizardJobMetadata = {
      book_count: bookCount,
      genre: genre || 'epic genre fiction',
      end_goal: endGoal || 'the protagonist achieves their ultimate goal',
      planning_style: planningStyle,
      world_summary: world,
      canon_rule: canonRule,
      planning_guidance: planningGuidance,
      generation_mode: generationMode,
      auto_approve_steps: generationMode === 'accelerated' ? autoApproveSteps : ['seriesMap', 'majorEvents', 'bookOutline', 'chapterList', 'chapterBriefs', 'scenes'],
      needs_review: false,
      outputs: { ...quickOutput },
    };

    try {
      const jobId = await jobRunner.createWizardJob(currentProjectId, settings, metadata);
      setActiveJobId(jobId);

      const unsub = jobRunner.subscribe(jobId, handleJobUpdate);
      // Store unsub in ref for cleanup
      jobUnsubRef.current = unsub;

      // Fire and forget -- the runner owns the connection now
      jobRunner.runWizardJob(jobId);

      await saveWizardSession({
        mode: 'quick',
        is_running: true,
        book_count: bookCount,
        genre,
        end_goal: endGoal,
        planning_style: planningStyle,
        review_first: reviewFirst,
        plan_approved: planApproved,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to start generation');
      setQuickRunning(false);
    }
  }

  const jobUnsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => { if (jobUnsubRef.current) jobUnsubRef.current(); };
  }, []);

  function getPlanningGuidance(): string {
    return planningStyle === 'discovery'
      ? '\nPlanning Style: DISCOVERY WRITING. Keep plans loose and suggestive. Leave room for surprise and organic development. Fewer rigid plot points, more thematic direction and character motivation.\n'
      : planningStyle === 'architect'
      ? '\nPlanning Style: ARCHITECT WRITING. Plan meticulously. Strong foreshadowing, tight causality, interconnected plot threads. Every element should serve a structural purpose. Heavy planning with clear cause-and-effect chains.\n'
      : '\nPlanning Style: BALANCED. Mix structured planning with room for organic development.\n';
  }

  function handleAbort() {
    abortRef.current = true;
    setQuickRunning(false);
    if (activeJobId) {
      jobRunner.cancelJob(activeJobId);
      setActiveJobId(null);
    }
    saveWizardSession({ is_running: false });
  }

  function handleApprovePlan() {
    setPlanApproved(true);
    saveWizardSession({ plan_approved: true });
    runQuickStart();
  }

  function handleSwitchToAdvanced() {
    setOutput({ ...quickOutput });
    setMode('advanced');
  }

  async function handleQuickSaveAll() {
    if (!currentProjectId) return;
    setSaving(true);
    setError('');

    console.log('[Wizard Save] Starting save for project:', currentProjectId);
    console.log('[Wizard Save] Output sizes:', {
      seriesMap: quickOutput.seriesMap.length,
      majorEvents: quickOutput.majorEvents.length,
      bookOutline: quickOutput.bookOutline.length,
      chapterList: quickOutput.chapterList.length,
      chapterBriefs: quickOutput.chapterBriefs.length,
      scenes: quickOutput.scenes.length,
    });

    try {
      const entries: { project_id: string; category: string; subject: string; fact: string; importance: string }[] = [];

      if (quickOutput.seriesMap) {
        entries.push({ project_id: currentProjectId, category: 'series_planning', subject: 'Series Map', fact: quickOutput.seriesMap, importance: 'critical' });
      }
      if (quickOutput.majorEvents) {
        entries.push({ project_id: currentProjectId, category: 'series_planning', subject: 'Book 1 - Major Events', fact: quickOutput.majorEvents, importance: 'high' });
      }
      if (quickOutput.chapterList) {
        entries.push({ project_id: currentProjectId, category: 'series_planning', subject: 'Book 1 - Chapter List', fact: quickOutput.chapterList, importance: 'high' });
      }
      if (quickOutput.chapterBriefs) {
        entries.push({ project_id: currentProjectId, category: 'series_planning', subject: 'Book 1 - Chapter Briefs (Ch 1-5)', fact: quickOutput.chapterBriefs, importance: 'medium' });
      }
      if (quickOutput.scenes) {
        entries.push({ project_id: currentProjectId, category: 'series_planning', subject: 'Book 1 - Scene Breakdown (Ch 1)', fact: quickOutput.scenes, importance: 'medium' });
      }

      if (entries.length > 0) {
        const { error: insertErr } = await supabase.from('story_bible_entries').insert(entries);
        if (insertErr) throw insertErr;
      }

      // Create outline + all chapters parsed from chapterList
      if (quickOutput.bookOutline) {
        const { data: outlineData, error: outlineErr } = await supabase.from('outlines').insert({
          project_id: currentProjectId,
          title: 'Book 1',
          synopsis: quickOutput.bookOutline,
        }).select().single();
        if (outlineErr) throw outlineErr;

        if (outlineData) {
          console.log('[Wizard Save] Outline created:', outlineData.id);
          setCurrentOutlineId(outlineData.id);

          // Parse chapters from Step 4 (Chapter List)
          let parsedChapters = parseChaptersFromOutput(quickOutput.chapterList);

          // Also parse any additional chapters from Step 3 (Book Outline) that Step 4 missed
          if (quickOutput.bookOutline) {
            const outlineChapters = parseChaptersFromOutput(quickOutput.bookOutline);
            const existingNums = new Set(parsedChapters.map((_, i) => i + 1));
            for (const oc of outlineChapters) {
              const numMatch = oc.title.match(/Chapter\s+(\d+)/i);
              if (numMatch && !existingNums.has(Number(numMatch[1]))) {
                parsedChapters.push(oc);
              }
            }
            // Sort by chapter number
            parsedChapters.sort((a, b) => {
              const numA = Number(a.title.match(/Chapter\s+(\d+)/i)?.[1] || 0);
              const numB = Number(b.title.match(/Chapter\s+(\d+)/i)?.[1] || 0);
              return numA - numB;
            });
          }

          console.log('[Wizard Save] Parsed chapters:', parsedChapters.length, parsedChapters.map(c => c.title));

          if (parsedChapters.length > 0) {
            // Collect unique character names and locations from parsed chapters
            const uniqueCharNames = [...new Set(parsedChapters.map(c => c.povCharacter).filter(Boolean))];
            const uniqueLocNames = [...new Set(parsedChapters.map(c => c.location).filter(Boolean))];

            // Load existing characters and places for this project
            const [existingCharsRes, existingPlacesRes] = await Promise.all([
              supabase.from('characters').select('id, name').eq('project_id', currentProjectId),
              supabase.from('places').select('id, name').eq('project_id', currentProjectId),
            ]);
            const existingChars = existingCharsRes.data || [];
            const existingPlaces = existingPlacesRes.data || [];

            // Match or create characters (with fuzzy "The X" / "X" matching)
            const charMap = new Map<string, string>(); // normalized name -> id
            for (const ec of existingChars) {
              charMap.set(ec.name.toLowerCase(), ec.id);
              // Also index without "the " prefix for fuzzy matching
              const stripped = ec.name.toLowerCase().replace(/^the\s+/, '');
              if (stripped !== ec.name.toLowerCase()) charMap.set(stripped, ec.id);
            }

            function findCharId(name: string): string | null {
              const lower = name.toLowerCase();
              if (charMap.has(lower)) return charMap.get(lower)!;
              const stripped = lower.replace(/^the\s+/, '');
              if (charMap.has(stripped)) return charMap.get(stripped)!;
              if (charMap.has('the ' + stripped)) return charMap.get('the ' + stripped)!;
              return null;
            }

            const newChars = uniqueCharNames.filter(name => !findCharId(name));
            if (newChars.length > 0) {
              const { data: createdChars } = await supabase
                .from('characters')
                .insert(newChars.map(name => ({
                  project_id: currentProjectId,
                  name,
                  description: `POV character identified during series planning.`,
                })))
                .select('id, name');
              if (createdChars) {
                for (const c of createdChars) {
                  charMap.set(c.name.toLowerCase(), c.id);
                }
              }
            }
            console.log('[Wizard Save] Characters mapped:', charMap.size, '(created', newChars.length, 'new)');

            // Match or create places (with fuzzy "The X" / "X" matching)
            const placeMap = new Map<string, string>(); // normalized name -> id
            for (const ep of existingPlaces) {
              placeMap.set(ep.name.toLowerCase(), ep.id);
              const stripped = ep.name.toLowerCase().replace(/^the\s+/, '');
              if (stripped !== ep.name.toLowerCase()) placeMap.set(stripped, ep.id);
            }

            function findPlaceId(name: string): string | null {
              const lower = name.toLowerCase();
              if (placeMap.has(lower)) return placeMap.get(lower)!;
              const stripped = lower.replace(/^the\s+/, '');
              if (placeMap.has(stripped)) return placeMap.get(stripped)!;
              if (placeMap.has('the ' + stripped)) return placeMap.get('the ' + stripped)!;
              return null;
            }

            const newPlaces = uniqueLocNames.filter(name => !findPlaceId(name));
            if (newPlaces.length > 0) {
              const { data: createdPlaces } = await supabase
                .from('places')
                .insert(newPlaces.map(name => ({
                  project_id: currentProjectId,
                  name,
                  description: `Location identified during series planning.`,
                })))
                .select('id, name');
              if (createdPlaces) {
                for (const p of createdPlaces) {
                  placeMap.set(p.name.toLowerCase(), p.id);
                }
              }
            }
            console.log('[Wizard Save] Places mapped:', placeMap.size, '(created', newPlaces.length, 'new)');

            // Create chapters with character and place links
            const chapterInserts = parsedChapters.map((ch, idx) => ({
              project_id: currentProjectId,
              outline_id: outlineData.id,
              title: ch.title,
              summary: ch.summary,
              order_index: idx,
              pov_character_id: ch.povCharacter ? findCharId(ch.povCharacter) : null,
              setting_place_id: ch.location ? findPlaceId(ch.location) : null,
            }));

            const { data: chapterRows, error: chapterErr } = await supabase
              .from('chapters')
              .insert(chapterInserts)
              .select();
            if (chapterErr) throw chapterErr;
            console.log('[Wizard Save] Chapters inserted:', chapterRows?.length);

            // Create scenes for Chapter 1 if we have scene breakdown
            if (chapterRows && chapterRows.length > 0 && quickOutput.scenes) {
              const ch1 = chapterRows[0];
              const parsedScenes = parseScenesFromOutput(quickOutput.scenes);
              console.log('[Wizard Save] Parsed scenes for Ch1:', parsedScenes.length);

              if (parsedScenes.length > 0) {
                const sceneInserts = parsedScenes.map((sc, idx) => ({
                  project_id: currentProjectId,
                  chapter_id: ch1.id,
                  title: sc.title,
                  description: sc.description,
                  content: sc.content,
                  order_index: idx,
                  status: 'draft',
                }));
                await supabase.from('scenes').insert(sceneInserts);
              } else {
                await supabase.from('scenes').insert({
                  project_id: currentProjectId,
                  chapter_id: ch1.id,
                  title: 'Scene 1',
                  description: 'Opening scene - generated by Quick Start wizard',
                  content: generatePlaceholderScene(quickOutput.scenes, quickOutput.chapterBriefs),
                  order_index: 0,
                  status: 'draft',
                });
              }
            }
          } else {
            // Fallback: create one chapter if parsing fails
            console.log('[Wizard Save] Chapter parsing returned 0 results, using fallback');
            const { data: chapterData, error: chapterErr } = await supabase.from('chapters').insert({
              project_id: currentProjectId,
              outline_id: outlineData.id,
              title: 'Chapter 1',
              summary: extractChapter1Summary(quickOutput.chapterList),
              order_index: 0,
            }).select().single();
            if (chapterErr) throw chapterErr;

            if (chapterData) {
              await supabase.from('scenes').insert({
                project_id: currentProjectId,
                chapter_id: chapterData.id,
                title: 'Scene 1',
                description: 'Opening scene - generated by Quick Start wizard',
                content: generatePlaceholderScene(quickOutput.scenes, quickOutput.chapterBriefs),
                order_index: 0,
                status: 'draft',
              });
            }
          }
        }
      }

      console.log('[Wizard Save] Save complete. Reloading project data...');
      await loadProjectData();
      console.log('[Wizard Save] Done. currentOutlineId is now:', useStore.getState().currentOutlineId);
    } catch (err: any) {
      console.error('[Wizard Save] Error:', err);
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function parseChaptersFromOutput(chapterList: string): Array<{ title: string; summary: string; povCharacter: string; location: string }> {
    if (!chapterList) return [];
    const results: Array<{ title: string; summary: string; povCharacter: string; location: string }> = [];
    const lines = chapterList.split('\n');

    let currentTitle = '';
    let currentLines: string[] = [];
    let currentPov = '';
    let currentLocation = '';

    for (const line of lines) {
      const trimmed = line.trim();
      // Match: "Chapter 1 - ..." or "Chapter 1:" or "## Chapter 1" etc.
      const chapterMatch = trimmed.match(/^(?:#+\s*)?Chapter\s+(\d+)\s*[-–—:]\s*"?(.+?)"?\s*$/i)
        || trimmed.match(/^(?:#+\s*)?Chapter\s+(\d+)\s*$/i);

      if (chapterMatch) {
        if (currentTitle && currentLines.length > 0) {
          results.push({ title: currentTitle, summary: currentLines.join('\n').trim(), povCharacter: currentPov, location: currentLocation });
        }
        const num = chapterMatch[1];
        const name = chapterMatch[2] ? chapterMatch[2].replace(/^["']|["']$/g, '') : '';
        currentTitle = name ? `Chapter ${num} - ${name}` : `Chapter ${num}`;
        currentLines = [line];
        currentPov = '';
        currentLocation = '';
      } else if (currentTitle) {
        currentLines.push(line);
        // Extract POV character
        const povMatch = trimmed.match(/^[-*]?\s*POV\s*(?:Character)?[:\s]+(.+)/i);
        if (povMatch) currentPov = povMatch[1].trim().replace(/^["']|["']$/g, '');
        // Extract location
        const locMatch = trimmed.match(/^[-*]?\s*(?:Location|Primary Location|Setting)[:\s]+(.+)/i);
        if (locMatch) currentLocation = locMatch[1].trim().replace(/^["']|["']$/g, '');
      }
    }

    if (currentTitle && currentLines.length > 0) {
      results.push({ title: currentTitle, summary: currentLines.join('\n').trim(), povCharacter: currentPov, location: currentLocation });
    }

    // Also parse from outline (Step 3) to find chapters beyond what the chapter list generated
    return results;
  }

  function parseScenesFromOutput(scenesText: string): Array<{ title: string; description: string; content: string }> {
    if (!scenesText) return [];
    const results: Array<{ title: string; description: string; content: string }> = [];
    const lines = scenesText.split('\n');

    let currentTitle = '';
    let currentLines: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      const sceneMatch = trimmed.match(/^(?:#+\s*)?Scene\s+(\d+)\s*[-–—:]\s*"?(.+?)"?\s*$/i)
        || trimmed.match(/^(?:#+\s*)?Scene\s+(\d+)\s*$/i);

      if (sceneMatch) {
        if (currentTitle && currentLines.length > 0) {
          const block = currentLines.join('\n').trim();
          results.push({ title: currentTitle, description: block.slice(0, 500), content: block });
        }
        const num = sceneMatch[1];
        const name = sceneMatch[2] ? sceneMatch[2].replace(/^["']|["']$/g, '') : '';
        currentTitle = name ? `Scene ${num} - ${name}` : `Scene ${num}`;
        currentLines = [line];
      } else if (currentTitle) {
        currentLines.push(line);
      }
    }

    if (currentTitle && currentLines.length > 0) {
      const block = currentLines.join('\n').trim();
      results.push({ title: currentTitle, description: block.slice(0, 500), content: block });
    }

    return results;
  }

  function extractChapter1Summary(chapterList: string): string {
    if (!chapterList) return '';
    const lines = chapterList.split('\n');
    const ch1Lines: string[] = [];
    let capturing = false;
    for (const line of lines) {
      if (/chapter\s*1\b/i.test(line)) {
        capturing = true;
        ch1Lines.push(line);
      } else if (capturing) {
        if (/chapter\s*2\b/i.test(line)) break;
        ch1Lines.push(line);
      }
    }
    return ch1Lines.join('\n').trim().slice(0, 2000);
  }

  function generatePlaceholderScene(scenes: string, briefs: string): string {
    const source = scenes || briefs || '';
    if (!source) {
      return 'The morning shift alarm echoed through the narrow corridors of the ship, its tinny pulse bouncing off bare metal walls. The air tasted of recycled coffee and engine grease -- the same taste every morning, the same taste for the last three years.\n\nFootsteps rang on the deck plates overhead. Someone was already up, already moving, already making the ship live. That was the thing about a working vessel: it never truly slept. Even in the dead hours between shifts, something hummed, something ticked, something breathed.\n\nThe day had begun whether anyone was ready for it or not.';
    }
    return 'The morning shift alarm echoed through the narrow corridors of the ship, its tinny pulse bouncing off bare metal walls. The air tasted of recycled coffee and engine grease -- the same taste every morning, the same taste for the last three years.\n\nFootsteps rang on the deck plates overhead. Someone was already up, already moving, already making the ship live. That was the thing about a working vessel: it never truly slept. Even in the dead hours between shifts, something hummed, something ticked, something breathed.\n\nThe day had begun whether anyone was ready for it or not.';
  }

  // --- Advanced Mode ---

  function buildAdvancedPrompt(step: number): string {
    const world = buildWorldSummary();

    switch (step) {
      case 1:
        return `${world}

=== TASK: SERIES MAP ===
${userInput ? `Author's vision and notes:\n${userInput}\n\n` : ''}Based on the world, characters, and lore established above, generate a high-level series map.

For each book in the series, provide:
- Book title (working title)
- Core question/theme
- Primary POV character(s)
- Central conflict
- Emotional arc
- How it connects to the overall series arc

Format as a structured plan, one section per book.`;

      case 2:
        return `${world}

=== SERIES MAP (ESTABLISHED) ===
${output.seriesMap}

=== TASK: MAJOR EVENTS FOR BOOK ${selectedBook} ===
${userInput ? `Author's notes:\n${userInput}\n\n` : ''}Generate the major turning points for Book ${selectedBook}.

For each major event provide:
- Event name
- When it occurs (early/mid/late in book)
- Characters involved
- Consequence/impact on series arc
- Emotional weight (1-5)

Include: inciting incident, midpoint reversal, dark moment, climax, and resolution.`;

      case 3:
        return `${world}

=== SERIES MAP ===
${output.seriesMap}

=== MAJOR EVENTS FOR BOOK ${selectedBook} ===
${output.majorEvents}

=== TASK: BOOK ${selectedBook} OUTLINE ===
${userInput ? `Author's notes:\n${userInput}\n\n` : ''}Generate a detailed structural outline for Book ${selectedBook}. Include:
- Opening hook
- Act 1 setup
- Act 2 rising action (complications, subplots, midpoint)
- Act 2B descent (consequences, dark moment)
- Act 3 resolution (climax, resolution, new equilibrium)
- Series threads advanced
- Character arcs progressed

Do not generate chapter lists yet.`;

      case 4:
        return `${world}

=== BOOK ${selectedBook} OUTLINE ===
${output.bookOutline}

=== MAJOR EVENTS ===
${output.majorEvents}

=== TASK: CHAPTER LIST FOR BOOK ${selectedBook} ===
${userInput ? `Author's notes:\n${userInput}\n\n` : ''}Generate a complete chapter list. For each chapter provide:
- Chapter number
- Working title
- POV character
- Primary location
- Key events (2-3 bullet points)
- Emotional tone
- Word count target

Aim for 20-30 chapters with natural pacing rhythm.`;

      case 5:
        return `${world}

=== CHAPTER LIST ===
${output.chapterList}

=== BOOK OUTLINE ===
${output.bookOutline}

=== TASK: CHAPTER BRIEFS (BOOK ${selectedBook}, CHAPTERS ${selectedChapter}-${selectedChapter + 4}) ===
${userInput ? `Author's notes:\n${userInput}\n\n` : ''}Generate detailed chapter briefs for chapters ${selectedChapter} through ${Math.min(selectedChapter + 4, 99)}. For each chapter:
- Opening state
- Scene-by-scene breakdown (3-5 scenes per chapter)
- Character goals and obstacles
- Key dialogue beats or reveals
- Closing state / cliffhanger
- Theme advancement

These briefs should be detailed enough that a writer could produce the chapter from them.`;

      case 6:
        return `${world}

=== CHAPTER BRIEF ===
${output.chapterBriefs}

=== TASK: SCENE BREAKDOWN (CHAPTER ${selectedChapter}) ===
${userInput ? `Author's notes:\n${userInput}\n\n` : ''}Generate individual scene cards. For each scene provide:
- Scene title
- POV character
- Location
- Characters present
- Opening beat
- Core conflict/tension
- Key dialogue moments
- Closing beat / transition
- Estimated word count`;

      default:
        return '';
    }
  }

  async function handleAdvancedGenerate() {
    if (!settings || !currentProjectId) {
      setError('No generation settings found. Configure your AI settings first.');
      return;
    }

    setGenerating(true);
    setError('');

    try {
      const prompt = buildAdvancedPrompt(currentStep);
      const result = await generateScene({
        sceneDescription: prompt,
        generationMode: 'outline',
        contextMode: 'minimal',
        worldRichness: 'minimal',
        planningMode: 'creative',
        context: {},
        settings,
      });

      const key = STEPS[currentStep - 1].key;
      setOutput(prev => ({ ...prev, [key]: result }));
    } catch (err: any) {
      setError(err.message || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }

  async function handleAdvancedSave() {
    if (!currentProjectId) return;
    setSaving(true);
    setError('');

    try {
      const key = STEPS[currentStep - 1].key;
      const text = output[key];
      if (!text) return;

      if (currentStep === 3) {
        await supabase.from('outlines').insert({
          project_id: currentProjectId,
          title: `Book ${selectedBook}`,
          synopsis: text,
        });
      } else {
        await supabase.from('story_bible_entries').insert({
          project_id: currentProjectId,
          category: 'series_planning',
          subject: `Book ${selectedBook} - ${STEPS[currentStep - 1].title}${currentStep >= 5 ? ` (Ch ${selectedChapter}-${selectedChapter + 4})` : ''}`,
          fact: text,
          importance: currentStep <= 2 ? 'critical' : currentStep <= 4 ? 'high' : 'medium',
        });
      }
      await loadProjectData();
    } catch (err: any) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleRegenerateSection(key: StepKey) {
    const stepIndex = STEPS.findIndex(s => s.key === key);
    if (stepIndex === -1 || !settings) return;

    setError('');
    const isQuick = mode === 'quick';
    const currentOutput = isQuick ? quickOutput : output;

    // For regeneration in quick mode, we rebuild the prompt using current quick output
    const world = buildWorldSummary();
    const genreText = genre || 'epic genre fiction';
    const endText = endGoal || 'the protagonist achieves their ultimate goal';

    let prompt = '';
    if (isQuick) {
      switch (key) {
        case 'seriesMap':
          prompt = `${world}\n\n=== TASK: SERIES MAP ===\nCreate a ${bookCount}-book series roadmap.\nGenre/Tone: ${genreText}\nSeries End Goal: ${endText}\n\nFor each book provide:\n- Theme\n- Beginning State\n- Ending State\n- Major Events (3-5 key moments)\n- Character Growth\n- World Changes\n\nDo not create chapter outlines. Do not create scene outlines. Focus only on the overall series structure.`;
          break;
        case 'majorEvents':
          prompt = `${world}\n\n=== SERIES MAP (APPROVED) ===\n${currentOutput.seriesMap}\n\n=== TASK: MAJOR EVENTS FOR BOOK 1 ===\nGenerate the major turning points for Book 1.\nGenre/Tone: ${genreText}\n\nInclude: Opening, Inciting Incident, First Turning Point, Midpoint, Major Reversal, Climax, Resolution.\n\nFor each event provide: what happens, characters involved, consequence, and emotional weight.\nDo not generate chapters.`;
          break;
        case 'bookOutline':
          prompt = `${world}\n\n=== SERIES MAP ===\n${currentOutput.seriesMap}\n\n=== BOOK 1 MAJOR EVENTS ===\n${currentOutput.majorEvents}\n\n=== TASK: BOOK 1 OUTLINE ===\nConvert Book 1 major events into a detailed book outline.\nGenre/Tone: ${genreText}\n\nInclude act structure. Do not generate chapter lists yet.`;
          break;
        case 'chapterList':
          prompt = `${world}\n\n=== BOOK 1 OUTLINE ===\n${currentOutput.bookOutline}\n\n=== BOOK 1 MAJOR EVENTS ===\n${currentOutput.majorEvents}\n\n=== TASK: CHAPTER LIST FOR BOOK 1 ===\nGenerate chapters for Book 1.\nGenre/Tone: ${genreText}\n\n20-30 chapters. For each: chapter number, working title, POV character, primary location, key events (2-3 bullet points), emotional tone.\n\nOne paragraph per chapter. No scene breakdowns.`;
          break;
        case 'chapterBriefs':
          prompt = `${world}\n\n=== CHAPTER LIST ===\n${currentOutput.chapterList}\n\n=== BOOK OUTLINE ===\n${currentOutput.bookOutline}\n\n=== TASK: CHAPTER BRIEFS (BOOK 1, CHAPTERS 1-5) ===\nGenerate detailed chapter briefs for chapters 1 through 5. For each chapter:\n- Opening state\n- Scene-by-scene breakdown (3-5 scenes per chapter)\n- Character goals and obstacles\n- Key dialogue beats or reveals\n- Closing state / cliffhanger\n- Theme advancement`;
          break;
        case 'scenes':
          prompt = `${world}\n\n=== CHAPTER BRIEF (CHAPTER 1) ===\n${currentOutput.chapterBriefs}\n\n=== TASK: SCENE BREAKDOWN (CHAPTER 1) ===\nGenerate individual scene cards for Chapter 1. For each scene provide:\n- Scene title\n- POV character\n- Location\n- Characters present\n- Opening beat\n- Core conflict/tension\n- Key dialogue moments\n- Closing beat / transition\n- Estimated word count`;
          break;
        default:
          return;
      }
    } else {
      prompt = buildAdvancedPrompt(stepIndex + 1);
    }

    try {
      if (isQuick) setQuickRunning(true);
      else setGenerating(true);

      const result = await generateScene({
        sceneDescription: prompt,
        generationMode: 'outline',
        contextMode: 'minimal',
        worldRichness: 'minimal',
        planningMode: 'creative',
        context: {},
        settings,
      });

      if (isQuick) {
        setQuickOutput(prev => ({ ...prev, [key]: result }));
        await saveWizardSession({ [`output_${toSnakeCase(key)}`]: result } as any);
      } else {
        setOutput(prev => ({ ...prev, [key]: result }));
      }
    } catch (err: any) {
      setError(err.message || 'Regeneration failed');
    } finally {
      if (isQuick) setQuickRunning(false);
      else setGenerating(false);
    }
  }

  if (!currentProjectId) {
    return (
      <div className="p-8 text-center text-slate-500">
        Select a project first to use the Series Planning Wizard.
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-lg font-semibold text-slate-900">Series Planning Wizard</h1>
          <div className="flex items-center gap-1 bg-slate-100 rounded-md p-0.5">
            <button
              onClick={() => setMode('quick')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${mode === 'quick' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Quick Start
            </button>
            <button
              onClick={() => setMode('advanced')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${mode === 'advanced' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Step-by-Step
            </button>
          </div>
        </div>
        <p className="text-sm text-slate-500">
          {mode === 'quick'
            ? 'Answer 3 questions and generate your full series structure in one run.'
            : 'Generate each planning step individually with full control over inputs and review.'}
        </p>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Job Status Panel */}
        <div className="max-w-4xl mx-auto px-6 pt-4">
          <JobStatusPanel projectId={currentProjectId} />
        </div>

        {mode === 'quick' ? (
          <QuickStartPanel
            bookCount={bookCount}
            setBookCount={setBookCount}
            genre={genre}
            setGenre={setGenre}
            endGoal={endGoal}
            setEndGoal={setEndGoal}
            planningStyle={planningStyle}
            setPlanningStyle={setPlanningStyle}
            reviewFirst={reviewFirst}
            setReviewFirst={setReviewFirst}
            planApproved={planApproved}
            onApprovePlan={handleApprovePlan}
            generationMode={generationMode}
            setGenerationMode={setGenerationMode}
            autoApproveSteps={autoApproveSteps}
            setAutoApproveSteps={setAutoApproveSteps}
            needsReview={needsReview}
            running={quickRunning}
            step={quickStep}
            output={quickOutput}
            error={error}
            settings={settings}
            saving={saving}
            onRun={runQuickStart}
            onAbort={handleAbort}
            onSaveAll={handleQuickSaveAll}
            onRegenerate={handleRegenerateSection}
            onSwitchToAdvanced={handleSwitchToAdvanced}
            projectData={projectData}
          />
        ) : (
          <AdvancedPanel
            currentStep={currentStep}
            setCurrentStep={setCurrentStep}
            generating={generating}
            saving={saving}
            error={error}
            output={output}
            userInput={userInput}
            setUserInput={setUserInput}
            selectedBook={selectedBook}
            setSelectedBook={setSelectedBook}
            selectedChapter={selectedChapter}
            setSelectedChapter={setSelectedChapter}
            settings={settings}
            projectData={projectData}
            onGenerate={handleAdvancedGenerate}
            onSave={handleAdvancedSave}
            onRegenerate={handleRegenerateSection}
          />
        )}
      </div>
    </div>
  );
}

// --- Quick Start Panel ---

function QuickStartPanel({
  bookCount, setBookCount, genre, setGenre, endGoal, setEndGoal,
  planningStyle, setPlanningStyle, reviewFirst, setReviewFirst,
  planApproved, onApprovePlan,
  generationMode, setGenerationMode, autoApproveSteps, setAutoApproveSteps, needsReview,
  running, step, output, error, settings, saving,
  onRun, onAbort, onSaveAll, onRegenerate, onSwitchToAdvanced, projectData,
}: {
  bookCount: number;
  setBookCount: (n: number) => void;
  genre: string;
  setGenre: (s: string) => void;
  endGoal: string;
  setEndGoal: (s: string) => void;
  planningStyle: 'discovery' | 'balanced' | 'architect';
  setPlanningStyle: (s: 'discovery' | 'balanced' | 'architect') => void;
  reviewFirst: boolean;
  setReviewFirst: (b: boolean) => void;
  planApproved: boolean;
  onApprovePlan: () => void;
  generationMode: GenerationMode;
  setGenerationMode: (m: GenerationMode) => void;
  autoApproveSteps: string[];
  setAutoApproveSteps: (s: string[]) => void;
  needsReview: boolean;
  running: boolean;
  step: number;
  output: WizardOutput;
  error: string;
  settings: any;
  saving: boolean;
  onRun: () => void;
  onAbort: () => void;
  onSaveAll: () => void;
  onRegenerate: (key: StepKey) => void;
  onSwitchToAdvanced: () => void;
  projectData: any;
}) {
  const hasOutput = output.seriesMap || output.majorEvents || output.bookOutline || output.chapterList || output.chapterBriefs || output.scenes;
  const allDone = output.seriesMap && output.majorEvents && output.bookOutline && output.chapterList && output.chapterBriefs && output.scenes;
  const hasPartialProgress = hasOutput && !allDone;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Interrupted session notice */}
      {hasPartialProgress && !running && (
        <div className="bg-sky-50 border border-sky-200 rounded-lg p-4 flex items-center justify-between">
          <div>
            <span className="text-sm font-medium text-sky-900">Previous session restored</span>
            <p className="text-xs text-sky-700 mt-0.5">
              Steps already completed are shown below. Click Resume to continue from where you left off.
            </p>
          </div>
        </div>
      )}
      {/* Intake Form */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-800 mb-2">Books in Series</label>
          <div className="grid grid-cols-5 gap-2">
            {[
              { value: 1, label: 'Standalone', sub: '1 book' },
              { value: 3, label: 'Trilogy', sub: '3 books' },
              { value: 5, label: 'Saga', sub: '5 books' },
              { value: 7, label: 'Epic Series', sub: '7 books' },
              { value: 0, label: 'Custom', sub: '' },
            ].map(opt => (
              <button
                key={opt.label}
                onClick={() => {
                  if (opt.value === 0) return;
                  setBookCount(opt.value);
                }}
                className={`flex flex-col items-center px-2 py-2.5 rounded-lg border text-center transition-all ${
                  (opt.value === 0 ? ![1, 3, 5, 7].includes(bookCount) : bookCount === opt.value)
                    ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                }`}
              >
                <span className="text-xs font-semibold">{opt.label}</span>
                {opt.sub && <span className="text-[10px] opacity-70 mt-0.5">{opt.sub}</span>}
              </button>
            ))}
          </div>
          {![1, 3, 5, 7].includes(bookCount) && (
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={20}
                value={bookCount}
                onChange={e => setBookCount(Number(e.target.value) || 1)}
                className="w-20 border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
              <span className="text-xs text-slate-500">books</span>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-800 mb-1.5">What is this series REALLY about?</label>
          <p className="text-xs text-slate-500 mb-2">Not genre tags -- the core truth. What are these people doing, and why does it matter?</p>
          <textarea
            value={genre}
            onChange={e => setGenre(e.target.value)}
            placeholder={"A group of ordinary working spacers slowly discover that history has been manipulated and must decide whether dangerous truths belong to everyone.\n\nFound family. Blue-collar tone. The ship is home."}
            rows={5}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
          <div className="flex flex-wrap gap-1.5 mt-2">
            {['Blue-collar space opera', 'Found family', 'Military fantasy', 'Mystery thriller', 'Epic fantasy', 'Sci-fi noir', 'Slow-burn exploration'].map(preset => (
              <button
                key={preset}
                onClick={() => setGenre(genre ? `${genre}\n\n${preset}.` : `${preset}.`)}
                className="px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded hover:bg-slate-200 transition-colors"
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-800 mb-2">Planning Style</label>
          <div className="grid grid-cols-3 gap-3">
            {([
              { value: 'discovery', label: 'Discovery', desc: 'Loose plans, room for surprises' },
              { value: 'balanced', label: 'Balanced', desc: 'Structured with creative freedom' },
              { value: 'architect', label: 'Architect', desc: 'Tight causality, heavy foreshadowing' },
            ] as const).map(opt => (
              <button
                key={opt.value}
                onClick={() => setPlanningStyle(opt.value)}
                className={`flex flex-col items-start px-3 py-3 rounded-lg border text-left transition-all ${
                  planningStyle === opt.value
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                }`}
              >
                <span className="text-sm font-semibold">{opt.label}</span>
                <span className={`text-xs mt-0.5 ${planningStyle === opt.value ? 'text-slate-300' : 'text-slate-500'}`}>{opt.desc}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-5">
          <label className="block text-sm font-semibold text-slate-900 mb-1">How does the story end?</label>
          <p className="text-xs text-slate-500 mb-3">What must be true by the final chapter? This is the most important input -- it gives the AI a destination to build toward.</p>
          <textarea
            value={endGoal}
            onChange={e => setEndGoal(e.target.value)}
            placeholder={"Benjamin and the crew discover the truth behind the Naughts, the forgotten technology, and their place in galactic history. The crew must ultimately decide what to do with knowledge that could reshape civilization."}
            rows={5}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>
      </div>

      {/* Context Badge */}
      <div className="bg-slate-50 rounded-lg border border-slate-200 p-3">
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="px-2 py-0.5 bg-slate-200 rounded">{projectData.characters.length} characters</span>
          <span className="px-2 py-0.5 bg-slate-200 rounded">{projectData.places.length} places</span>
          <span className="px-2 py-0.5 bg-slate-200 rounded">{projectData.things.length} things</span>
          <span className="px-2 py-0.5 bg-slate-200 rounded">{projectData.technologies.length} technologies</span>
          <span className="px-2 py-0.5 bg-slate-200 rounded">{projectData.storyBible.length} bible entries</span>
          {projectData.manifesto && <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded">Manifesto loaded</span>}
        </div>
      </div>

      {/* Development Mode Selector */}
      <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-800 mb-3">Development Mode</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setGenerationMode('guided')}
              disabled={running}
              className={`flex flex-col items-start px-4 py-3.5 rounded-lg border text-left transition-all ${
                generationMode === 'guided'
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
              } disabled:opacity-60`}
            >
              <span className="text-sm font-semibold">Guided Development</span>
              <span className={`text-xs mt-1 ${generationMode === 'guided' ? 'text-slate-300' : 'text-slate-500'}`}>
                Pauses after each stage for review. Best for live creation.
              </span>
            </button>
            <button
              onClick={() => setGenerationMode('accelerated')}
              disabled={running}
              className={`flex flex-col items-start px-4 py-3.5 rounded-lg border text-left transition-all ${
                generationMode === 'accelerated'
                  ? 'border-amber-700 bg-amber-700 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
              } disabled:opacity-60`}
            >
              <span className="text-sm font-semibold">Accelerated Development</span>
              <span className={`text-xs mt-1 ${generationMode === 'accelerated' ? 'text-amber-200' : 'text-slate-500'}`}>
                Runs unattended. Best for overnight or away generation.
              </span>
            </button>
          </div>
        </div>

        {generationMode === 'guided' && (
          <div className="flex items-center gap-4 pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={reviewFirst}
                onChange={e => setReviewFirst(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
              />
              <span className="text-sm text-slate-700">Show proposed plan first</span>
            </label>
            <span className="text-xs text-slate-500">
              {reviewFirst ? 'Generates Series Map, then pauses for approval' : 'Runs all 6 steps sequentially'}
            </span>
          </div>
        )}

        {generationMode === 'accelerated' && (
          <div className="space-y-3 pt-1">
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
              <p className="text-xs text-amber-800">
                Accelerated mode runs through selected stages without pausing. Output may require cleanup. All completed stages are saved immediately. If any step fails, the pipeline stops and preserves prior work.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-600 uppercase tracking-wider">Auto-approve stages</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'seriesMap', label: 'Series Map' },
                  { key: 'majorEvents', label: 'Major Events' },
                  { key: 'bookOutline', label: 'Book Outline' },
                  { key: 'chapterList', label: 'Chapter List' },
                  { key: 'chapterBriefs', label: 'Chapter Briefs' },
                  { key: 'scenes', label: 'Scene Breakdown' },
                ].map(item => (
                  <label key={item.key} className="flex items-center gap-2 cursor-pointer select-none py-1">
                    <input
                      type="checkbox"
                      checked={autoApproveSteps.includes(item.key)}
                      onChange={e => {
                        if (e.target.checked) {
                          setAutoApproveSteps([...autoApproveSteps, item.key]);
                        } else {
                          setAutoApproveSteps(autoApproveSteps.filter(k => k !== item.key));
                        }
                      }}
                      disabled={running}
                      className="w-3.5 h-3.5 rounded border-slate-300 text-amber-700 focus:ring-amber-400"
                    />
                    <span className="text-sm text-slate-700">{item.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <button
              onClick={() => setAutoApproveSteps(['seriesMap', 'majorEvents', 'bookOutline', 'chapterList', 'chapterBriefs', 'scenes'])}
              disabled={running || autoApproveSteps.length === 6}
              className="px-4 py-2 bg-amber-100 text-amber-800 border border-amber-300 rounded-md text-xs font-medium hover:bg-amber-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Run full backbone unattended
            </button>
          </div>
        )}
      </div>

      {/* Build Button */}
      <div className="flex items-center gap-3">
        {!running ? (
          <button
            onClick={onRun}
            disabled={!settings || !!allDone || (generationMode === 'accelerated' && autoApproveSteps.length === 0)}
            className="px-6 py-3 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {hasPartialProgress ? 'Resume Generation' : generationMode === 'accelerated' ? 'Start Accelerated Build' : 'Build My Series'}
          </button>
        ) : (
          <button
            onClick={onAbort}
            className="px-6 py-3 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors"
          >
            Stop
          </button>
        )}
        {!settings && <span className="text-xs text-amber-600">Configure AI settings first (Settings page)</span>}
        {generationMode === 'accelerated' && autoApproveSteps.length === 0 && settings && (
          <span className="text-xs text-amber-600">Select at least one stage to auto-approve</span>
        )}
      </div>

      {/* Accelerated Running Banner */}
      {running && generationMode === 'accelerated' && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 flex items-start gap-3">
          <div className="w-3 h-3 bg-amber-500 rounded-full animate-pulse mt-0.5 flex-shrink-0" />
          <div>
            <span className="text-sm font-medium text-amber-900 block">
              Accelerated Development is running unattended.
            </span>
            <span className="text-xs text-amber-700 mt-0.5 block">
              Review required before writing canon prose. All completed stages are saved immediately.
            </span>
          </div>
        </div>
      )}

      {/* Progress Indicator */}
      {running && (
        <div className="bg-slate-900 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" />
            <span className="text-sm text-white font-medium">
              Generating Step {step} of 6: {['', 'Series Map', 'Major Events', 'Book Outline', 'Chapter List', 'Chapter Briefs', 'Scene Breakdown'][step]}...
            </span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div
              className="bg-green-400 h-2 rounded-full transition-all duration-500"
              style={{ width: `${(step / 6) * 100}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">{error}</div>
      )}

      {/* Plan Approval Checkpoint */}
      {reviewFirst && output.seriesMap && !planApproved && !running && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-amber-900">Series Map Ready for Review</h3>
            <p className="text-xs text-amber-700 mt-1">
              Review the Series Map below. Once approved, the wizard will generate Major Events, Book Outlines, Chapter Lists, Briefs, and Scene Breakdowns. This can take 20-30 minutes for a full series.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onApprovePlan}
              className="px-5 py-2.5 bg-amber-700 text-white rounded-lg text-sm font-semibold hover:bg-amber-800 transition-colors"
            >
              Accept Series Plan -- Continue Generation
            </button>
            <button
              onClick={() => onRegenerate('seriesMap')}
              className="px-4 py-2 bg-white text-amber-700 border border-amber-300 rounded-lg text-sm font-medium hover:bg-amber-100 transition-colors"
            >
              Regenerate Plan
            </button>
          </div>
        </div>
      )}

      {/* Output Sections */}
      {hasOutput && (
        <div className="space-y-4">
          {needsReview && allDone && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 flex items-start gap-3">
              <span className="px-2 py-0.5 bg-amber-200 text-amber-900 text-xs font-bold rounded flex-shrink-0 mt-0.5">
                NEEDS REVIEW
              </span>
              <div>
                <span className="text-sm font-medium text-amber-900 block">
                  This output was generated in Accelerated Development mode.
                </span>
                <span className="text-xs text-amber-700 mt-0.5 block">
                  Review all stages carefully before committing to canon. Look for hallucinated details, contradictions with established world data, and structural issues.
                </span>
              </div>
            </div>
          )}
          {allDone && (
            <>
              <SeriesAtAGlance output={output} bookCount={bookCount} genre={genre} />
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
                <span className="block text-sm font-medium text-green-800">
                  All 6 steps complete. Review below, save to your project, or switch to Step-by-Step to fine-tune.
                </span>
                <p className="text-xs text-green-700">
                  Saving will also create Book 1 &gt; Chapter 1 &gt; Scene 1 with starter prose so you can immediately test the Write page, TTS, and production pipeline.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={onSaveAll}
                    disabled={saving}
                    className="px-4 py-2 bg-green-700 text-white rounded-md text-sm font-medium hover:bg-green-800 disabled:opacity-50 transition-colors"
                  >
                    {saving ? 'Saving...' : 'Save All to Project'}
                  </button>
                  <button
                    onClick={onSwitchToAdvanced}
                    className="px-4 py-2 bg-slate-700 text-white rounded-md text-sm font-medium hover:bg-slate-600 transition-colors"
                  >
                    Edit in Step-by-Step Mode
                  </button>
                </div>
              </div>
            </>
          )}

          <OutputSection
            title="Step 1: Series Map"
            stepKey="seriesMap"
            content={output.seriesMap}
            running={running}
            onRegenerate={onRegenerate}
            needsReview={needsReview}
          />
          <OutputSection
            title="Step 2: Book 1 Major Events"
            stepKey="majorEvents"
            content={output.majorEvents}
            running={running}
            onRegenerate={onRegenerate}
            needsReview={needsReview}
          />
          <OutputSection
            title="Step 3: Book 1 Outline"
            stepKey="bookOutline"
            content={output.bookOutline}
            running={running}
            onRegenerate={onRegenerate}
            needsReview={needsReview}
          />
          <OutputSection
            title="Step 4: Book 1 Chapter List"
            stepKey="chapterList"
            content={output.chapterList}
            running={running}
            onRegenerate={onRegenerate}
            needsReview={needsReview}
          />
          <OutputSection
            title="Step 5: Chapter Briefs (Ch 1-5)"
            stepKey="chapterBriefs"
            content={output.chapterBriefs}
            running={running}
            onRegenerate={onRegenerate}
            needsReview={needsReview}
          />
          <OutputSection
            title="Step 6: Scene Breakdown (Ch 1)"
            stepKey="scenes"
            content={output.scenes}
            running={running}
            onRegenerate={onRegenerate}
            needsReview={needsReview}
          />
        </div>
      )}
    </div>
  );
}

// --- Series At A Glance ---

function SeriesAtAGlance({ output, bookCount, genre }: {
  output: WizardOutput;
  bookCount: number;
  genre: string;
}) {
  const [expanded, setExpanded] = useState(true);

  const books = parseBooks(output.seriesMap, bookCount);
  const characters = parseCharacters(output.seriesMap, output.chapterList);
  const themes = parseThemes(output.seriesMap, output.bookOutline);
  const chapterCount = countChapters(output.chapterList);
  const primaryCharacter = characters.length > 0 ? characters[0] : null;
  const primaryTheme = themes.length > 0 ? themes[0] : null;

  const completedSteps = [output.seriesMap, output.majorEvents, output.bookOutline, output.chapterList, output.chapterBriefs, output.scenes].filter(Boolean).length;

  return (
    <div className="bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-slate-800 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div>
          <h2 className="text-base font-semibold text-white">Series Dashboard</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {bookCount} {bookCount === 1 ? 'book' : 'books'} | {genre || 'Genre fiction'} | ~{chapterCount * bookCount} estimated total chapters
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-2 py-0.5 text-xs rounded font-medium ${completedSteps === 6 ? 'bg-green-900/50 text-green-300 border border-green-700' : 'bg-amber-900/50 text-amber-300 border border-amber-700'}`}>
            {completedSteps === 6 ? 'Backbone Complete' : `${completedSteps}/6 Steps`}
          </span>
          <span className="text-slate-400 text-sm">{expanded ? '\u25B2' : '\u25BC'}</span>
        </div>
      </div>

      {expanded && (
        <div className="px-5 pb-5 space-y-5">
          {/* Key Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {primaryTheme && (
              <div className="bg-slate-800/60 rounded-md px-3 py-2.5 border border-slate-700">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Primary Theme</div>
                <div className="text-sm text-white font-medium line-clamp-1">{primaryTheme}</div>
              </div>
            )}
            {primaryCharacter && (
              <div className="bg-slate-800/60 rounded-md px-3 py-2.5 border border-slate-700">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Primary Character</div>
                <div className="text-sm text-white font-medium line-clamp-1">{primaryCharacter}</div>
              </div>
            )}
            <div className="bg-slate-800/60 rounded-md px-3 py-2.5 border border-slate-700">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Est. Word Count</div>
              <div className="text-sm text-white font-medium">{formatWordCount(chapterCount * bookCount * 4000)}</div>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Books Planned" value={String(bookCount)} />
            <StatCard label="Book 1 Chapters" value={String(chapterCount)} />
            <StatCard label="Total Chapters" value={String(chapterCount * bookCount)} />
            <StatCard label="Status" value={completedSteps === 6 ? 'Complete' : 'In Progress'} />
          </div>

          {/* Book List */}
          <div>
            <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Series Structure</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {books.map((book, i) => (
                <div key={i} className="bg-slate-800 rounded-md px-3 py-2 border border-slate-700">
                  <div className="text-xs font-semibold text-slate-200">Book {i + 1}</div>
                  <div className="text-xs text-slate-400 mt-0.5 line-clamp-2">{book}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Characters & Themes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {characters.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Characters Mentioned</h3>
                <div className="flex flex-wrap gap-1.5">
                  {characters.slice(0, 15).map((name, i) => (
                    <span key={i} className="px-2 py-0.5 bg-slate-800 text-slate-300 text-xs rounded border border-slate-700">{name}</span>
                  ))}
                  {characters.length > 15 && (
                    <span className="px-2 py-0.5 text-slate-500 text-xs">+{characters.length - 15} more</span>
                  )}
                </div>
              </div>
            )}
            {themes.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Primary Themes</h3>
                <div className="flex flex-wrap gap-1.5">
                  {themes.slice(0, 8).map((theme, i) => (
                    <span key={i} className="px-2 py-0.5 bg-teal-900/50 text-teal-300 text-xs rounded border border-teal-800">{theme}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-800 rounded-md px-3 py-2 border border-slate-700 text-center">
      <div className="text-lg font-bold text-white">{value}</div>
      <div className="text-xs text-slate-400">{label}</div>
    </div>
  );
}

function parseBooks(seriesMap: string, bookCount: number): string[] {
  if (!seriesMap) return Array.from({ length: bookCount }, (_, i) => `Book ${i + 1}`);
  const books: string[] = [];
  const lines = seriesMap.split('\n');
  let currentBook = '';
  for (const line of lines) {
    const bookMatch = line.match(/book\s*(\d+)/i);
    if (bookMatch) {
      if (currentBook) books.push(currentBook.trim());
      const themeLine = lines[lines.indexOf(line) + 1] || '';
      currentBook = line.replace(/^#+\s*/, '').replace(/\*+/g, '').trim();
      if (themeLine && !themeLine.match(/book\s*\d+/i) && themeLine.trim()) {
        currentBook = themeLine.replace(/^[-*]\s*/, '').replace(/theme:?\s*/i, '').trim().slice(0, 80);
      }
    }
  }
  if (currentBook) books.push(currentBook.trim());
  if (books.length === 0) {
    return Array.from({ length: bookCount }, (_, i) => `Book ${i + 1}`);
  }
  return books.slice(0, bookCount);
}

function parseCharacters(seriesMap: string, chapterList: string): string[] {
  const text = `${seriesMap}\n${chapterList}`;
  const names = new Set<string>();
  const patterns = [
    /(?:POV|character|protagonist|antagonist|mentor)[:\s]+([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/g,
    /\b([A-Z][a-z]{2,})\b(?=\s+(?:discovers|learns|fights|meets|arrives|leaves|confronts|reveals|joins|leads|returns))/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const name = match[1].trim();
      if (name.length > 2 && name.length < 30 && !['Chapter', 'Book', 'Scene', 'Act', 'The', 'This'].includes(name)) {
        names.add(name);
      }
    }
  }
  return Array.from(names);
}

function parseThemes(seriesMap: string, outline: string): string[] {
  const text = `${seriesMap}\n${outline}`;
  const themes: string[] = [];
  const lines = text.split('\n');
  for (const line of lines) {
    const themeMatch = line.match(/theme[s]?[:\s]+(.+)/i);
    if (themeMatch) {
      const parts = themeMatch[1].split(/[,;]/).map(t => t.replace(/^[-*\s]+/, '').trim()).filter(t => t.length > 2 && t.length < 50);
      themes.push(...parts);
    }
  }
  return [...new Set(themes)].slice(0, 10);
}

function countChapters(chapterList: string): number {
  if (!chapterList) return 25;
  const matches = chapterList.match(/chapter\s*\d+/gi);
  return matches ? matches.length : 25;
}

function formatWordCount(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${Math.round(count / 1000)}K`;
  return String(count);
}

// --- Output Section with Regenerate ---

function OutputSection({ title, stepKey, content, running, onRegenerate, needsReview }: {
  title: string;
  stepKey: StepKey;
  content: string;
  running: boolean;
  onRegenerate: (key: StepKey) => void;
  needsReview?: boolean;
}) {
  const [expanded, setExpanded] = useState(true);

  if (!content) return null;

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-3 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs text-green-600 font-bold">{'\u2713'}</span>
          <span className="text-sm font-medium text-slate-800">{title}</span>
          {needsReview && (
            <span className="px-1.5 py-0.5 text-[10px] bg-amber-100 text-amber-700 rounded font-medium">
              Needs Review
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={e => { e.stopPropagation(); onRegenerate(stepKey); }}
            disabled={running}
            className="px-2 py-1 text-xs bg-amber-100 text-amber-700 rounded hover:bg-amber-200 disabled:opacity-50 transition-colors"
          >
            Regenerate
          </button>
          <span className="text-xs text-slate-400">{expanded ? '\u25B2' : '\u25BC'}</span>
        </div>
      </div>
      {expanded && (
        <div className="p-4 max-h-96 overflow-y-auto">
          <pre className="text-xs text-slate-700 whitespace-pre-wrap font-mono leading-relaxed">{content}</pre>
        </div>
      )}
    </div>
  );
}

// --- Advanced Panel ---

function AdvancedPanel({
  currentStep, setCurrentStep, generating, saving, error, output,
  userInput, setUserInput, selectedBook, setSelectedBook,
  selectedChapter, setSelectedChapter, settings, projectData,
  onGenerate, onSave, onRegenerate,
}: {
  currentStep: number;
  setCurrentStep: (n: number) => void;
  generating: boolean;
  saving: boolean;
  error: string;
  output: WizardOutput;
  userInput: string;
  setUserInput: (s: string) => void;
  selectedBook: number;
  setSelectedBook: (n: number) => void;
  selectedChapter: number;
  setSelectedChapter: (n: number) => void;
  settings: any;
  projectData: any;
  onGenerate: () => void;
  onSave: () => void;
  onRegenerate: (key: StepKey) => void;
}) {
  const currentKey = STEPS[currentStep - 1].key;
  const currentOutput = output[currentKey];

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Stepper */}
      <div className="flex items-center gap-1 flex-wrap">
        {STEPS.map((step, i) => (
          <div key={step.id} className="flex items-center">
            <button
              onClick={() => setCurrentStep(step.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                currentStep === step.id
                  ? 'bg-slate-900 text-white'
                  : output[step.key]
                  ? 'bg-green-100 text-green-800 hover:bg-green-200'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                currentStep === step.id ? 'bg-white text-slate-900' : output[step.key] ? 'bg-green-600 text-white' : 'bg-slate-300 text-white'
              }`}>
                {output[step.key] ? '\u2713' : step.id}
              </span>
              <span className="hidden lg:inline">{step.title}</span>
            </button>
            {i < STEPS.length - 1 && <div className="w-4 h-px bg-slate-300 mx-0.5" />}
          </div>
        ))}
      </div>

      {/* Step Info */}
      <div className="bg-white rounded-lg border border-slate-200 p-5">
        <h2 className="text-base font-semibold text-slate-900 mb-1">
          Step {currentStep}: {STEPS[currentStep - 1].title}
        </h2>
        <p className="text-sm text-slate-600">{STEPS[currentStep - 1].description}</p>

        {currentStep >= 2 && (
          <div className="flex items-center gap-4 mt-3">
            <label className="text-sm text-slate-700">
              Book:
              <select
                value={selectedBook}
                onChange={e => setSelectedBook(Number(e.target.value))}
                className="ml-2 border border-slate-300 rounded px-2 py-1 text-sm"
              >
                {Array.from({ length: 10 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>Book {i + 1}</option>
                ))}
              </select>
            </label>
            {currentStep >= 5 && (
              <label className="text-sm text-slate-700">
                Starting Chapter:
                <select
                  value={selectedChapter}
                  onChange={e => setSelectedChapter(Number(e.target.value))}
                  className="ml-2 border border-slate-300 rounded px-2 py-1 text-sm"
                >
                  {Array.from({ length: 30 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>Chapter {i + 1}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
        )}
      </div>

      {/* User Notes */}
      <div className="bg-white rounded-lg border border-slate-200 p-5">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Your notes and guidance for this step
        </label>
        <textarea
          value={userInput}
          onChange={e => setUserInput(e.target.value)}
          placeholder="Add directions, themes, constraints, or ideas for the AI..."
          className="w-full h-28 border border-slate-300 rounded-md px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-slate-400"
        />
      </div>

      {/* Context */}
      <div className="bg-slate-50 rounded-lg border border-slate-200 p-3">
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="px-2 py-0.5 bg-slate-200 rounded">{projectData.characters.length} characters</span>
          <span className="px-2 py-0.5 bg-slate-200 rounded">{projectData.places.length} places</span>
          <span className="px-2 py-0.5 bg-slate-200 rounded">{projectData.things.length} things</span>
          <span className="px-2 py-0.5 bg-slate-200 rounded">{projectData.technologies.length} technologies</span>
          <span className="px-2 py-0.5 bg-slate-200 rounded">{projectData.storyBible.length} bible entries</span>
          {projectData.manifesto && <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded">Manifesto</span>}
        </div>
      </div>

      {/* Generate */}
      <div className="flex items-center gap-3">
        <button
          onClick={onGenerate}
          disabled={generating || !settings}
          className="px-5 py-2.5 bg-slate-900 text-white rounded-md text-sm font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {generating ? 'Generating...' : `Generate ${STEPS[currentStep - 1].title}`}
        </button>
        {!settings && <span className="text-xs text-amber-600">Configure AI settings first</span>}
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">{error}</div>}

      {/* Output */}
      {currentOutput && (
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-800">Generated Output</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onRegenerate(currentKey)}
                disabled={generating}
                className="px-3 py-1.5 bg-amber-100 text-amber-700 rounded text-xs font-medium hover:bg-amber-200 disabled:opacity-50 transition-colors"
              >
                Regenerate
              </button>
              <button
                onClick={onSave}
                disabled={saving}
                className="px-3 py-1.5 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving...' : 'Save to Project'}
              </button>
              {currentStep < 6 && (
                <button
                  onClick={() => setCurrentStep(currentStep + 1)}
                  className="px-3 py-1.5 bg-slate-700 text-white rounded text-xs font-medium hover:bg-slate-600 transition-colors"
                >
                  Next Step
                </button>
              )}
            </div>
          </div>
          <pre className="text-xs text-slate-700 whitespace-pre-wrap font-mono leading-relaxed border border-slate-100 rounded-md p-4 bg-slate-50 max-h-[600px] overflow-y-auto">
            {currentOutput}
          </pre>
        </div>
      )}

      {/* Previous Steps */}
      {currentStep > 1 && (
        <div className="border-t border-slate-200 pt-4">
          <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">Previous Steps</h3>
          <div className="space-y-2">
            {STEPS.slice(0, currentStep - 1).map(step => (
              output[step.key] ? (
                <details key={step.key} className="bg-slate-50 rounded border border-slate-200">
                  <summary className="px-3 py-2 text-xs font-medium text-slate-700 cursor-pointer hover:bg-slate-100">
                    Step {step.id}: {step.title}
                  </summary>
                  <div className="px-3 py-2 text-xs text-slate-600 whitespace-pre-wrap max-h-48 overflow-y-auto font-mono">
                    {output[step.key]}
                  </div>
                </details>
              ) : null
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
// --- Job Status Panel ---

function JobStatusPanel({ projectId }: { projectId: string }) {
  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    loadJobs();
    const interval = setInterval(loadJobs, 5000);
    return () => clearInterval(interval);
  }, [projectId]);

  async function loadJobs() {
    const recent = await jobRunner.getRecentJobs(projectId, 5);
    setJobs(recent);
  }

  if (jobs.length === 0) return null;

  const activeJob = jobs.find(j => j.status === 'running' || j.status === 'queued');
  const completedJobs = jobs.filter(j => j.status === 'completed');
  const failedJobs = jobs.filter(j => j.status === 'failed');

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          {activeJob && <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />}
          <span className="text-xs font-medium text-slate-700">
            Generation Jobs
          </span>
          {activeJob && (
            <span className="text-xs text-slate-500">
              -- Step {activeJob.current_step}/{activeJob.total_steps}: {activeJob.step_label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {completedJobs.length > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] bg-green-100 text-green-700 rounded font-medium">
              {completedJobs.length} done
            </span>
          )}
          {failedJobs.length > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] bg-red-100 text-red-700 rounded font-medium">
              {failedJobs.length} failed
            </span>
          )}
          <span className="text-xs text-slate-400">{expanded ? '\u25B2' : '\u25BC'}</span>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 divide-y divide-slate-100">
          {jobs.map(job => (
            <div key={job.id} className="px-4 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <StatusBadge status={job.status} />
                <div>
                  <span className="text-xs font-medium text-slate-700">{job.task_type.replace(/_/g, ' ')}</span>
                  <span className="text-[10px] text-slate-500 ml-2">
                    {job.status === 'running' ? job.step_label : `${job.current_step}/${job.total_steps} steps`}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {job.status === 'running' && (
                  <button
                    onClick={e => { e.stopPropagation(); jobRunner.cancelJob(job.id); loadJobs(); }}
                    className="px-2 py-0.5 text-[10px] bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors"
                  >
                    Cancel
                  </button>
                )}
                <span className="text-[10px] text-slate-400">
                  {formatTimeAgo(job.updated_at)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    queued: 'bg-slate-100 text-slate-600',
    running: 'bg-green-100 text-green-700',
    completed: 'bg-green-50 text-green-600',
    failed: 'bg-red-50 text-red-600',
    cancelled: 'bg-slate-100 text-slate-500',
  };
  return (
    <span className={`px-1.5 py-0.5 text-[10px] rounded font-medium ${styles[status] || styles.queued}`}>
      {status}
    </span>
  );
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}


export default SeriesWizard