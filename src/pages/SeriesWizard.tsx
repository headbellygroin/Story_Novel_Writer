import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { generateScene } from '../services/aiService';

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

export default function SeriesWizard() {
  const { currentProjectId } = useStore();
  const [mode, setMode] = useState<WizardMode>('quick');

  // Quick Start state
  const [bookCount, setBookCount] = useState(7);
  const [genre, setGenre] = useState('');
  const [endGoal, setEndGoal] = useState('');
  const [quickRunning, setQuickRunning] = useState(false);
  const [quickStep, setQuickStep] = useState(0);
  const [quickOutput, setQuickOutput] = useState<WizardOutput>({
    seriesMap: '', majorEvents: '', bookOutline: '', chapterList: '', chapterBriefs: '', scenes: '',
  });
  const abortRef = useRef(false);

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

  useEffect(() => {
    if (!currentProjectId) return;
    loadProjectData();
  }, [currentProjectId]);

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

  async function runQuickStart() {
    if (!settings || !currentProjectId) {
      setError('No generation settings found. Configure your AI settings first.');
      return;
    }
    setQuickRunning(true);
    setError('');
    abortRef.current = false;
    setQuickOutput({ seriesMap: '', majorEvents: '', bookOutline: '', chapterList: '', chapterBriefs: '', scenes: '' });

    const world = buildWorldSummary();
    const genreText = genre || 'epic genre fiction';
    const endText = endGoal || 'the protagonist achieves their ultimate goal';

    const canonRule = world.trim()
      ? `\n\n=== STRICT CANON RULE ===\nYou MUST use ONLY the characters, places, things, and technologies listed above. Do NOT invent new characters, locations, or world elements. Do NOT hallucinate motivations, backstories, or relationships that are not established in the world data. If the world data is sparse, keep your output proportionally focused on what IS established. Expand only where the existing data logically implies structure.\n`
      : '';

    try {
      // Step 1: Series Map
      setQuickStep(1);
      const seriesPrompt = `${world}${canonRule}
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

      // Step 2: Book 1 Major Events
      setQuickStep(2);
      const eventsPrompt = `${world}${canonRule}
=== SERIES MAP (APPROVED) ===
${seriesMap}

=== TASK: MAJOR EVENTS FOR BOOK 1 ===
Generate the major turning points for Book 1.
Genre/Tone: ${genreText}

Include:
- Opening
- Inciting Incident
- First Turning Point
- Midpoint
- Major Reversal
- Climax
- Resolution

For each event provide: what happens, characters involved, consequence, and emotional weight.
Do not generate chapters.`;

      const majorEvents = await generateScene({
        sceneDescription: eventsPrompt,
        generationMode: 'outline',
        contextMode: 'minimal',
        worldRichness: 'minimal',
        planningMode: 'creative',
        context: {},
        settings,
      });
      if (abortRef.current) return;
      setQuickOutput(prev => ({ ...prev, majorEvents }));

      // Step 3: Book 1 Outline
      setQuickStep(3);
      const outlinePrompt = `${world}${canonRule}
=== SERIES MAP ===
${seriesMap}

=== BOOK 1 MAJOR EVENTS ===
${majorEvents}

=== TASK: BOOK 1 OUTLINE ===
Convert Book 1 major events into a detailed book outline.
Genre/Tone: ${genreText}

Include:
- Act 1 setup (world state, character introductions, inciting incident)
- Act 2 rising action (complications, subplots, midpoint)
- Act 2B descent (consequences, dark moment)
- Act 3 resolution (climax, resolution, new equilibrium)
- Series threads advanced
- Character arcs progressed

Do not generate chapter lists yet.`;

      const bookOutline = await generateScene({
        sceneDescription: outlinePrompt,
        generationMode: 'outline',
        contextMode: 'minimal',
        worldRichness: 'minimal',
        planningMode: 'creative',
        context: {},
        settings,
      });
      if (abortRef.current) return;
      setQuickOutput(prev => ({ ...prev, bookOutline }));

      // Step 4: Chapter List
      setQuickStep(4);
      const chapterPrompt = `${world}${canonRule}
=== BOOK 1 OUTLINE ===
${bookOutline}

=== BOOK 1 MAJOR EVENTS ===
${majorEvents}

=== TASK: CHAPTER LIST FOR BOOK 1 ===
Generate chapters for Book 1.
Genre/Tone: ${genreText}

20-30 chapters. For each chapter provide:
- Chapter number
- Working title
- POV character
- Primary location
- Key events (2-3 bullet points)
- Emotional tone

One paragraph per chapter. No scene breakdowns.`;

      const chapterList = await generateScene({
        sceneDescription: chapterPrompt,
        generationMode: 'outline',
        contextMode: 'minimal',
        worldRichness: 'minimal',
        planningMode: 'creative',
        context: {},
        settings,
      });
      if (abortRef.current) return;
      setQuickOutput(prev => ({ ...prev, chapterList }));

      // Step 5: Chapter Briefs (first 5 chapters)
      setQuickStep(5);
      const briefsPrompt = `${world}${canonRule}
=== CHAPTER LIST ===
${chapterList}

=== BOOK OUTLINE ===
${bookOutline}

=== TASK: CHAPTER BRIEFS (BOOK 1, CHAPTERS 1-5) ===
Generate detailed chapter briefs for chapters 1 through 5. For each chapter:
- Opening state
- Scene-by-scene breakdown (3-5 scenes per chapter)
- Character goals and obstacles
- Key dialogue beats or reveals
- Closing state / cliffhanger
- Theme advancement

These briefs should be detailed enough that a writer could produce the chapter from them.`;

      const chapterBriefs = await generateScene({
        sceneDescription: briefsPrompt,
        generationMode: 'outline',
        contextMode: 'minimal',
        worldRichness: 'minimal',
        planningMode: 'creative',
        context: {},
        settings,
      });
      if (abortRef.current) return;
      setQuickOutput(prev => ({ ...prev, chapterBriefs }));

      // Step 6: Scene Breakdown (Chapter 1)
      setQuickStep(6);
      const scenesPrompt = `${world}${canonRule}
=== CHAPTER BRIEF (CHAPTER 1) ===
${chapterBriefs}

=== TASK: SCENE BREAKDOWN (CHAPTER 1) ===
Generate individual scene cards for Chapter 1. For each scene provide:
- Scene title
- POV character
- Location
- Characters present
- Opening beat
- Core conflict/tension
- Key dialogue moments
- Closing beat / transition
- Estimated word count`;

      const scenes = await generateScene({
        sceneDescription: scenesPrompt,
        generationMode: 'outline',
        contextMode: 'minimal',
        worldRichness: 'minimal',
        planningMode: 'creative',
        context: {},
        settings,
      });
      if (abortRef.current) return;
      setQuickOutput(prev => ({ ...prev, scenes }));

      // Feed results into advanced mode
      setOutput({ seriesMap, majorEvents, bookOutline, chapterList, chapterBriefs, scenes });
      setQuickStep(7);
    } catch (err: any) {
      setError(err.message || 'Generation failed');
    } finally {
      setQuickRunning(false);
    }
  }

  function handleAbort() {
    abortRef.current = true;
    setQuickRunning(false);
  }

  function handleSwitchToAdvanced() {
    setOutput({ ...quickOutput });
    setMode('advanced');
  }

  async function handleQuickSaveAll() {
    if (!currentProjectId) return;
    setSaving(true);
    setError('');

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

      // Create outline + chapter + scene so the user can immediately test TTS/pipeline
      if (quickOutput.bookOutline) {
        const { data: outlineData, error: outlineErr } = await supabase.from('outlines').insert({
          project_id: currentProjectId,
          title: 'Book 1',
          synopsis: quickOutput.bookOutline,
        }).select().single();
        if (outlineErr) throw outlineErr;

        if (outlineData) {
          const { data: chapterData, error: chapterErr } = await supabase.from('chapters').insert({
            project_id: currentProjectId,
            outline_id: outlineData.id,
            title: 'Chapter 1',
            summary: extractChapter1Summary(quickOutput.chapterList),
            order_index: 0,
          }).select().single();
          if (chapterErr) throw chapterErr;

          if (chapterData) {
            const sceneContent = generatePlaceholderScene(quickOutput.scenes, quickOutput.chapterBriefs);
            await supabase.from('scenes').insert({
              project_id: currentProjectId,
              chapter_id: chapterData.id,
              title: 'Scene 1',
              description: 'Opening scene - generated by Quick Start wizard',
              content: sceneContent,
              order_index: 0,
              status: 'draft',
            });
          }
        }
      }

      await loadProjectData();
    } catch (err: any) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
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
        {mode === 'quick' ? (
          <QuickStartPanel
            bookCount={bookCount}
            setBookCount={setBookCount}
            genre={genre}
            setGenre={setGenre}
            endGoal={endGoal}
            setEndGoal={setEndGoal}
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
  running, step, output, error, settings, saving,
  onRun, onAbort, onSaveAll, onRegenerate, onSwitchToAdvanced, projectData,
}: {
  bookCount: number;
  setBookCount: (n: number) => void;
  genre: string;
  setGenre: (s: string) => void;
  endGoal: string;
  setEndGoal: (s: string) => void;
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

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Intake Form */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-800 mb-1.5">How many books in the series?</label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={1}
              max={20}
              value={bookCount}
              onChange={e => setBookCount(Number(e.target.value) || 7)}
              className="w-20 border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
            <span className="text-xs text-slate-500">Default: 7</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-800 mb-1.5">Describe your story</label>
          <p className="text-xs text-slate-500 mb-2">Genre, tone, characters, premise -- write naturally. One thought per line works well.</p>
          <textarea
            value={genre}
            onChange={e => setGenre(e.target.value)}
            placeholder={"Blue-collar space opera.\n\nFound family.\n\nIndependent cargo crew.\n\nThe crew travels the galaxy taking jobs while gradually uncovering forgotten history."}
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

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-5">
          <label className="block text-sm font-semibold text-slate-900 mb-1">Series End State</label>
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

      {/* Build Button */}
      <div className="flex items-center gap-3">
        {!running ? (
          <button
            onClick={onRun}
            disabled={!settings}
            className="px-6 py-3 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Build My Series
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
      </div>

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

      {/* Output Sections */}
      {hasOutput && (
        <div className="space-y-4">
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
          />
          <OutputSection
            title="Step 2: Book 1 Major Events"
            stepKey="majorEvents"
            content={output.majorEvents}
            running={running}
            onRegenerate={onRegenerate}
          />
          <OutputSection
            title="Step 3: Book 1 Outline"
            stepKey="bookOutline"
            content={output.bookOutline}
            running={running}
            onRegenerate={onRegenerate}
          />
          <OutputSection
            title="Step 4: Book 1 Chapter List"
            stepKey="chapterList"
            content={output.chapterList}
            running={running}
            onRegenerate={onRegenerate}
          />
          <OutputSection
            title="Step 5: Chapter Briefs (Ch 1-5)"
            stepKey="chapterBriefs"
            content={output.chapterBriefs}
            running={running}
            onRegenerate={onRegenerate}
          />
          <OutputSection
            title="Step 6: Scene Breakdown (Ch 1)"
            stepKey="scenes"
            content={output.scenes}
            running={running}
            onRegenerate={onRegenerate}
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

  return (
    <div className="bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-slate-800 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div>
          <h2 className="text-base font-semibold text-white">Series At A Glance</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {bookCount} books | {genre || 'Genre fiction'} | ~{chapterCount * bookCount} estimated total chapters
          </p>
        </div>
        <span className="text-slate-400 text-sm">{expanded ? '\u25B2' : '\u25BC'}</span>
      </div>

      {expanded && (
        <div className="px-5 pb-5 space-y-5">
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

          {/* Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Books Planned" value={String(bookCount)} />
            <StatCard label="Ch 1 Chapters" value={String(chapterCount)} />
            <StatCard label="Est. Total Chapters" value={String(chapterCount * bookCount)} />
            <StatCard label="Est. Word Count" value={formatWordCount(chapterCount * bookCount * 4000)} />
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

function OutputSection({ title, stepKey, content, running, onRegenerate }: {
  title: string;
  stepKey: StepKey;
  content: string;
  running: boolean;
  onRegenerate: (key: StepKey) => void;
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
