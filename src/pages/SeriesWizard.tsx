import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { generateScene } from '../services/aiService';

const STEPS = [
  { id: 1, title: 'Series Map', description: 'Generate a high-level map of your entire series arc across all books.' },
  { id: 2, title: 'Major Events', description: 'Define the major events and turning points for each book.' },
  { id: 3, title: 'Book Outline', description: 'Generate a detailed outline for a selected book.' },
  { id: 4, title: 'Chapter List', description: 'Generate the chapter breakdown for the selected book.' },
  { id: 5, title: 'Chapter Briefs', description: 'Generate detailed briefs for each chapter.' },
  { id: 6, title: 'Scene Breakdown', description: 'Generate scene cards for each chapter.' },
];

interface WizardState {
  seriesMap: string;
  majorEvents: string;
  bookOutline: string;
  chapterList: string;
  chapterBriefs: string;
  scenes: string;
}

export default function SeriesWizard() {
  const { currentProjectId } = useStore();
  const [currentStep, setCurrentStep] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [output, setOutput] = useState<WizardState>({
    seriesMap: '',
    majorEvents: '',
    bookOutline: '',
    chapterList: '',
    chapterBriefs: '',
    scenes: '',
  });
  const [userInput, setUserInput] = useState('');
  const [selectedBook, setSelectedBook] = useState(1);
  const [selectedChapter, setSelectedChapter] = useState(1);
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

  function buildPromptForStep(step: number): string {
    const worldContext = buildWorldSummary();

    switch (step) {
      case 1:
        return `${worldContext}

=== TASK: SERIES MAP ===
Based on the world, characters, and lore established above, generate a high-level series map.

${userInput ? `Author's vision and notes:\n${userInput}\n\n` : ''}For each book in the series, provide:
- Book title (working title)
- Core question/theme
- Primary POV character(s)
- Central conflict
- Emotional arc
- How it connects to the overall series arc

Format as a structured plan, one section per book. Focus on escalation, character growth across books, and how mysteries/reveals unfold over time.`;

      case 2:
        return `${worldContext}

=== SERIES MAP (ESTABLISHED) ===
${output.seriesMap}

=== TASK: MAJOR EVENTS FOR BOOK ${selectedBook} ===
${userInput ? `Author's notes:\n${userInput}\n\n` : ''}Based on the series map above, generate the major events and turning points for Book ${selectedBook}.

For each major event provide:
- Event name
- When it occurs (early/mid/late in book)
- Characters involved
- Consequence/impact on series arc
- Emotional weight (1-5)

Include: inciting incident, midpoint reversal, dark moment, climax, and resolution. Also note any series-level reveals or setup moments.`;

      case 3:
        return `${worldContext}

=== SERIES MAP ===
${output.seriesMap}

=== MAJOR EVENTS FOR BOOK ${selectedBook} ===
${output.majorEvents}

=== TASK: BOOK ${selectedBook} OUTLINE ===
${userInput ? `Author's notes:\n${userInput}\n\n` : ''}Generate a detailed structural outline for Book ${selectedBook}. Include:
- Opening hook
- Act 1 setup (world state, character introductions, inciting incident)
- Act 2 rising action (complications, subplots, midpoint)
- Act 2B descent (consequences, dark moment, all-is-lost)
- Act 3 resolution (climax, resolution, new equilibrium)
- Series threads advanced
- Character arcs completed/progressed

Format as a structured narrative outline with clear act breaks.`;

      case 4:
        return `${worldContext}

=== BOOK ${selectedBook} OUTLINE ===
${output.bookOutline}

=== MAJOR EVENTS ===
${output.majorEvents}

=== TASK: CHAPTER LIST FOR BOOK ${selectedBook} ===
${userInput ? `Author's notes:\n${userInput}\n\n` : ''}Based on the book outline above, generate a complete chapter list. For each chapter provide:
- Chapter number
- Working title
- POV character
- Primary location
- Key events (2-3 bullet points)
- Emotional tone
- Word count target

Aim for a natural pacing rhythm. Include quieter character chapters between action beats.`;

      case 5:
        return `${worldContext}

=== CHAPTER LIST ===
${output.chapterList}

=== BOOK OUTLINE ===
${output.bookOutline}

=== TASK: CHAPTER BRIEFS (BOOK ${selectedBook}, CHAPTERS ${selectedChapter}-${selectedChapter + 4}) ===
${userInput ? `Author's notes:\n${userInput}\n\n` : ''}Generate detailed chapter briefs for chapters ${selectedChapter} through ${Math.min(selectedChapter + 4, 99)}. For each chapter:
- Opening state (where characters are emotionally/physically)
- Scene-by-scene breakdown (3-5 scenes per chapter)
- Character goals and obstacles
- Key dialogue beats or reveals
- Closing state / cliffhanger
- Theme advancement
- Worldbuilding details to weave in

These briefs should be detailed enough that a writer could produce the chapter from them.`;

      case 6:
        return `${worldContext}

=== CHAPTER BRIEF ===
${output.chapterBriefs}

=== TASK: SCENE BREAKDOWN (CHAPTER ${selectedChapter}) ===
${userInput ? `Author's notes:\n${userInput}\n\n` : ''}Based on the chapter brief above, generate individual scene cards. For each scene provide:
- Scene title
- POV character
- Location
- Characters present
- Opening beat
- Core conflict/tension
- Key dialogue moments
- Closing beat / transition to next scene
- Estimated word count

Each scene should have a clear dramatic purpose and advance either plot, character, or both.`;

      default:
        return '';
    }
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

  async function handleGenerate() {
    if (!settings || !currentProjectId) {
      setError('No generation settings found. Configure your AI settings first.');
      return;
    }

    setGenerating(true);
    setError('');

    try {
      const prompt = buildPromptForStep(currentStep);

      const result = await generateScene({
        sceneDescription: prompt,
        generationMode: 'outline',
        contextMode: 'minimal',
        worldRichness: 'minimal',
        planningMode: 'creative',
        context: {},
        settings,
      });

      const keys: (keyof WizardState)[] = ['seriesMap', 'majorEvents', 'bookOutline', 'chapterList', 'chapterBriefs', 'scenes'];
      setOutput(prev => ({ ...prev, [keys[currentStep - 1]]: result }));
    } catch (err: any) {
      setError(err.message || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }

  async function handleSaveToProject() {
    if (!currentProjectId) return;
    setSaving(true);
    setError('');

    try {
      switch (currentStep) {
        case 1: {
          // Save series map as a story bible entry
          await supabase.from('story_bible_entries').insert({
            project_id: currentProjectId,
            category: 'series_planning',
            subject: 'Series Map',
            fact: output.seriesMap,
            importance: 'critical',
          });
          break;
        }
        case 2: {
          await supabase.from('story_bible_entries').insert({
            project_id: currentProjectId,
            category: 'series_planning',
            subject: `Book ${selectedBook} - Major Events`,
            fact: output.majorEvents,
            importance: 'high',
          });
          break;
        }
        case 3: {
          // Save as an outline (= book)
          const { error: outlineErr } = await supabase.from('outlines').insert({
            project_id: currentProjectId,
            title: `Book ${selectedBook}`,
            synopsis: output.bookOutline,
          });
          if (outlineErr) throw outlineErr;
          await loadProjectData();
          break;
        }
        case 4: {
          await supabase.from('story_bible_entries').insert({
            project_id: currentProjectId,
            category: 'series_planning',
            subject: `Book ${selectedBook} - Chapter List`,
            fact: output.chapterList,
            importance: 'high',
          });
          break;
        }
        case 5: {
          await supabase.from('story_bible_entries').insert({
            project_id: currentProjectId,
            category: 'series_planning',
            subject: `Book ${selectedBook} - Chapter Briefs (${selectedChapter}-${selectedChapter + 4})`,
            fact: output.chapterBriefs,
            importance: 'medium',
          });
          break;
        }
        case 6: {
          await supabase.from('story_bible_entries').insert({
            project_id: currentProjectId,
            category: 'series_planning',
            subject: `Book ${selectedBook} Ch${selectedChapter} - Scene Breakdown`,
            fact: output.scenes,
            importance: 'medium',
          });
          break;
        }
      }
    } catch (err: any) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const currentOutput = (() => {
    const keys: (keyof WizardState)[] = ['seriesMap', 'majorEvents', 'bookOutline', 'chapterList', 'chapterBriefs', 'scenes'];
    return output[keys[currentStep - 1]];
  })();

  if (!currentProjectId) {
    return (
      <div className="p-8 text-center text-slate-500">
        Select a project first to use the Series Planning Wizard.
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Stepper Header */}
      <div className="flex-shrink-0 bg-white border-b border-slate-200 px-6 py-4">
        <h1 className="text-lg font-semibold text-slate-900 mb-3">Series Planning Wizard</h1>
        <div className="flex items-center gap-1">
          {STEPS.map((step, i) => (
            <div key={step.id} className="flex items-center">
              <button
                onClick={() => setCurrentStep(step.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  currentStep === step.id
                    ? 'bg-slate-900 text-white'
                    : output[(['seriesMap', 'majorEvents', 'bookOutline', 'chapterList', 'chapterBriefs', 'scenes'] as (keyof WizardState)[])[i]]
                    ? 'bg-green-100 text-green-800 hover:bg-green-200'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                  currentStep === step.id ? 'bg-white text-slate-900' : 'bg-slate-300 text-white'
                }`}>
                  {output[(['seriesMap', 'majorEvents', 'bookOutline', 'chapterList', 'chapterBriefs', 'scenes'] as (keyof WizardState)[])[i]] ? '\u2713' : step.id}
                </span>
                <span className="hidden lg:inline">{step.title}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div className="w-4 h-px bg-slate-300 mx-0.5" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-6 space-y-6">
          {/* Step Description */}
          <div className="bg-white rounded-lg border border-slate-200 p-5">
            <h2 className="text-base font-semibold text-slate-900 mb-1">
              Step {currentStep}: {STEPS[currentStep - 1].title}
            </h2>
            <p className="text-sm text-slate-600">{STEPS[currentStep - 1].description}</p>

            {/* Book/Chapter selector for steps 2+ */}
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
              Your notes and guidance for this step (optional)
            </label>
            <textarea
              value={userInput}
              onChange={e => setUserInput(e.target.value)}
              placeholder="Add any specific directions, themes, constraints, or ideas you want the AI to incorporate..."
              className="w-full h-28 border border-slate-300 rounded-md px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </div>

          {/* Context Preview */}
          <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Available Context</span>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="px-2 py-0.5 bg-slate-200 rounded">{projectData.characters.length} characters</span>
              <span className="px-2 py-0.5 bg-slate-200 rounded">{projectData.places.length} places</span>
              <span className="px-2 py-0.5 bg-slate-200 rounded">{projectData.things.length} things</span>
              <span className="px-2 py-0.5 bg-slate-200 rounded">{projectData.technologies.length} technologies</span>
              <span className="px-2 py-0.5 bg-slate-200 rounded">{projectData.storyBible.length} bible entries</span>
              {projectData.manifesto && <span className="px-2 py-0.5 bg-green-100 rounded text-green-700">Manifesto loaded</span>}
              {projectData.outlines.length > 0 && <span className="px-2 py-0.5 bg-sky-100 rounded text-sky-700">{projectData.outlines.length} books</span>}
            </div>
          </div>

          {/* Generate Button */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleGenerate}
              disabled={generating || !settings}
              className="px-5 py-2.5 bg-slate-900 text-white rounded-md text-sm font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {generating ? 'Generating...' : `Generate ${STEPS[currentStep - 1].title}`}
            </button>
            {!settings && (
              <span className="text-xs text-amber-600">Configure AI settings first (Settings page)</span>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Output */}
          {currentOutput && (
            <div className="bg-white rounded-lg border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-800">Generated Output</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSaveToProject}
                    disabled={saving}
                    className="px-3 py-1.5 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {saving ? 'Saving...' : 'Save to Project'}
                  </button>
                  <button
                    onClick={() => {
                      if (currentStep < 6) setCurrentStep(currentStep + 1);
                    }}
                    disabled={currentStep >= 6}
                    className="px-3 py-1.5 bg-slate-700 text-white rounded text-xs font-medium hover:bg-slate-600 disabled:opacity-50 transition-colors"
                  >
                    Next Step
                  </button>
                </div>
              </div>
              <div className="prose prose-sm max-w-none text-slate-700 whitespace-pre-wrap border border-slate-100 rounded-md p-4 bg-slate-50 max-h-[600px] overflow-y-auto font-mono text-xs leading-relaxed">
                {currentOutput}
              </div>
            </div>
          )}

          {/* Previous Steps Summary */}
          {currentStep > 1 && (
            <div className="border-t border-slate-200 pt-4">
              <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">Previous Steps</h3>
              <div className="space-y-2">
                {(['seriesMap', 'majorEvents', 'bookOutline', 'chapterList', 'chapterBriefs', 'scenes'] as (keyof WizardState)[])
                  .slice(0, currentStep - 1)
                  .map((key, i) => (
                    output[key] ? (
                      <details key={key} className="bg-slate-50 rounded border border-slate-200">
                        <summary className="px-3 py-2 text-xs font-medium text-slate-700 cursor-pointer hover:bg-slate-100">
                          Step {i + 1}: {STEPS[i].title}
                        </summary>
                        <div className="px-3 py-2 text-xs text-slate-600 whitespace-pre-wrap max-h-48 overflow-y-auto font-mono">
                          {output[key]}
                        </div>
                      </details>
                    ) : null
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
