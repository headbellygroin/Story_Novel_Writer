import { useState } from 'react';
import { Link } from 'react-router-dom';

type Section =
  | 'overview'
  | 'services'
  | 'writing'
  | 'world'
  | 'consistency'
  | 'pipeline'
  | 'audiobook'
  | 'export'
  | 'files'
  | 'workflow';

const SECTIONS: { key: Section; label: string }[] = [
  { key: 'overview',    label: 'Overview' },
  { key: 'services',    label: 'Services & Settings' },
  { key: 'writing',     label: 'Writing Tools' },
  { key: 'world',       label: 'World & Characters' },
  { key: 'consistency', label: 'Consistency & Checks' },
  { key: 'pipeline',    label: 'Production Pipeline' },
  { key: 'audiobook',   label: 'Audiobook' },
  { key: 'export',      label: 'Export' },
  { key: 'files',       label: 'Files & Storage' },
  { key: 'workflow',    label: 'End-to-End Workflow' },
];

export default function SetupGuide() {
  const [activeSection, setActiveSection] = useState<Section>('overview');

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-slate-900">Documentation</h1>
        <Link
          to="/settings"
          className="px-4 py-2 bg-slate-700 text-white text-sm rounded-lg hover:bg-slate-800 transition-colors"
        >
          Go to Settings
        </Link>
      </div>

      <div className="flex gap-6">
        <nav className="w-52 flex-shrink-0">
          <div className="sticky top-4 space-y-1">
            {SECTIONS.map((s) => (
              <button
                key={s.key}
                onClick={() => setActiveSection(s.key)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  activeSection === s.key
                    ? 'bg-slate-900 text-white font-medium'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </nav>

        <div className="flex-1 min-w-0">
          {activeSection === 'overview'    && <OverviewSection />}
          {activeSection === 'services'    && <ServicesSection />}
          {activeSection === 'writing'     && <WritingSection />}
          {activeSection === 'world'       && <WorldSection />}
          {activeSection === 'consistency' && <ConsistencySection />}
          {activeSection === 'pipeline'    && <PipelineSection />}
          {activeSection === 'audiobook'   && <AudiobookSection />}
          {activeSection === 'export'      && <ExportSection />}
          {activeSection === 'files'       && <FilesSection />}
          {activeSection === 'workflow'    && <WorkflowSection />}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
      {children}
    </div>
  );
}

function Code({ children }: { children: string }) {
  return (
    <code className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-sm font-mono">
      {children}
    </code>
  );
}

function Note({ color = 'sky', children }: { color?: 'sky' | 'amber' | 'red' | 'emerald'; children: React.ReactNode }) {
  const classes = {
    sky:     'bg-sky-50 border-sky-200 text-sky-900',
    amber:   'bg-amber-50 border-amber-200 text-amber-900',
    red:     'bg-red-50 border-red-200 text-red-900',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  };
  return (
    <div className={`p-3 rounded-lg border text-xs ${classes[color]}`}>
      {children}
    </div>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xl font-bold text-slate-900 mb-4">{children}</h2>;
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="font-semibold text-slate-900 mt-6 mb-3">{children}</h3>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-slate-600 mb-3">{children}</p>;
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function OverviewSection() {
  return (
    <>
      <Card>
        <H2>What is Story Forge?</H2>
        <P>
          Story Forge is a self-hosted AI novel writing and production studio. It connects to two services
          running on your AI machine — LM Studio for text generation and ComfyUI for all media generation —
          and uses a Supabase database to store your project data. Nothing is sent to any third-party AI cloud.
        </P>
        <P>
          The application covers the full authoring lifecycle: brainstorming, world-building, outlining,
          scene-by-scene writing with AI assistance, consistency checking, and then a full production pipeline
          that turns finished chapters into audiobook-style video content.
        </P>

        <H3>The Two Services</H3>
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="w-10 h-10 bg-sky-100 text-sky-700 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">LM</span>
            <div>
              <p className="font-semibold text-slate-900 text-sm">LM Studio — Text Generation</p>
              <p className="text-xs text-slate-600 mt-0.5">
                Handles all writing and analysis: generating scene content, summarising scenes, building image
                prompts, running logic audits, analysing reference images, and powering voice chat. Runs on
                your AI machine and exposes an OpenAI-compatible API on port 1234.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">CUI</span>
            <div>
              <p className="font-semibold text-slate-900 text-sm">ComfyUI — Media Generation</p>
              <p className="text-xs text-slate-600 mt-0.5">
                Handles all four media types: scene images (Stable Diffusion), animated GIFs (LTX 2.3
                Text2Video), TTS narration audio, and lip-sync video (LTX 2.3 LipSync). All four use the
                same ComfyUI endpoint with built-in workflows — no workflow files to manage. Story Forge
                sends each job, polls for completion, and retrieves the output file automatically.
              </p>
            </div>
          </div>
        </div>

        <H3>Feature Map</H3>
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          {[
            { group: 'Planning',    items: ['Projects', 'Dossier', 'Outline'] },
            { group: 'World',       items: ['World Library (Characters, Places, Things, Technologies)', 'Story Bible', 'Style Anchors', 'Prohibited Words'] },
            { group: 'Writing',     items: ['Write (scene editor)', 'Voice Chat'] },
            { group: 'Quality',     items: ['Consistency Tracking', 'Logic Checks'] },
            { group: 'Production',  items: ['Pipeline (5 stages)', 'Audiobook TTS'] },
            { group: 'Output',      items: ['Export (HTML / Markdown / Text)', 'Save & Load (JSON backup)'] },
          ].map(({ group, items }) => (
            <div key={group} className="border border-slate-200 rounded-lg p-3">
              <p className="font-medium text-slate-800 text-xs uppercase tracking-wide mb-2">{group}</p>
              <ul className="space-y-1">
                {items.map((item) => (
                  <li key={item} className="text-xs text-slate-600 flex items-start gap-1.5">
                    <span className="text-slate-300 mt-0.5">—</span>{item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

function ServicesSection() {
  return (
    <>
      <Card>
        <H2>Services & Settings</H2>
        <P>
          Both services are assumed to be running on your AI machine before you use Story Forge.
          Go to <Link to="/settings" className="text-sky-600 hover:text-sky-700 font-medium">Settings</Link> to
          enter the endpoints and test the connections. All settings are saved per-project to the database.
        </P>

        <H3>LM Studio</H3>
        <ul className="space-y-2 text-sm text-slate-700 mb-4">
          <li className="flex gap-2"><span className="text-slate-400 flex-shrink-0">—</span><span>Start LM Studio on your AI machine, load a model, and enable the local server on port 1234.</span></li>
          <li className="flex gap-2"><span className="text-slate-400 flex-shrink-0">—</span><span>In Settings, set the <strong>API Endpoint</strong> to <Code>http://your-ai-machine:1234/v1/chat/completions</Code> and the <strong>Model Name</strong> to match the Model ID shown in LM Studio's Local Server tab.</span></li>
          <li className="flex gap-2"><span className="text-slate-400 flex-shrink-0">—</span><span>Click <strong>Test AI Connection</strong> to verify. A green dot means Story Forge can reach the server.</span></li>
          <li className="flex gap-2"><span className="text-slate-400 flex-shrink-0">—</span><span>For image analysis of reference photos, load a vision model (e.g. LLaVA) in LM Studio and set the <strong>Vision Model Name</strong> in Settings.</span></li>
        </ul>
        <Note color="sky">
          <strong>Context Length</strong> — set this to match your loaded model's actual context window (e.g. 4096, 8192, 32768).
          Story Forge uses this value to manage how much context is passed to the model during writing and analysis.
        </Note>

        <H3>ComfyUI</H3>
        <ul className="space-y-2 text-sm text-slate-700 mb-4">
          <li className="flex gap-2"><span className="text-slate-400 flex-shrink-0">—</span><span>Start ComfyUI on your AI machine. It runs at port 8188 by default.</span></li>
          <li className="flex gap-2"><span className="text-slate-400 flex-shrink-0">—</span><span>In Settings, set the <strong>ComfyUI Endpoint</strong> to <Code>http://your-ai-machine:8188</Code>.</span></li>
          <li className="flex gap-2"><span className="text-slate-400 flex-shrink-0">—</span><span>Click <strong>Test ComfyUI</strong>. A successful test also loads your available checkpoints and queue status.</span></li>
          <li className="flex gap-2"><span className="text-slate-400 flex-shrink-0">—</span><span>Select a <strong>Checkpoint</strong> from the dropdown — this is the Stable Diffusion model used for scene image generation.</span></li>
        </ul>
        <Note color="amber">
          <strong>One endpoint, all workflows.</strong> The same ComfyUI endpoint handles images, animation, TTS,
          and lip-sync. Story Forge sends built-in workflows for each type — you never need to export or paste
          workflow JSON. The pipeline runs one job at a time and never submits two jobs simultaneously.
        </Note>

        <H3>Generation Settings</H3>
        <P>Beyond the endpoints, Settings lets you tune:</P>
        <div className="space-y-3 text-sm text-slate-700">
          <div><strong>LLM parameters</strong> — Temperature, Max Tokens, Top P, Top K, Repetition Penalty, Presence/Frequency Penalty. Sensible defaults work for most models; lower temperature (0.3–0.5) for analysis tasks, higher (0.7–0.9) for creative writing.</div>
          <div><strong>System Prompt & Style Guide</strong> — A base persona and per-project writing style instructions injected into every generation request.</div>
          <div><strong>Style Rules</strong> — Toggle switches for common writing guidance (show don't tell, vary sentence length, avoid filter words, etc.). Active rules are injected automatically.</div>
          <div><strong>Image orientation</strong> — Portrait / Landscape / Square preset, applied to all scene image generation.</div>
          <div><strong>Image noise seed</strong> — Random (unique image each run) or Fixed (reproducible output from the same prompt).</div>
          <div><strong>Positive conditioning prompts</strong> — Background, Foreground, and Characters fields that feed the image generation workflow alongside the AI-generated scene prompt.</div>
          <div><strong>Art Style Presets</strong> — Named presets that override checkpoint, prompt prefix/suffix, negative prompt, sampler, steps, and CFG for different visual styles. Select a preset per scene during image generation.</div>
          <div><strong>TTS Speaker & Sample Rate</strong> — The voice/speaker name passed to the TTS model, and the output sample rate (default 24000 Hz).</div>
          <div><strong>Animation prompt fields</strong> — Background and Foreground motion descriptions passed to the LTX animation workflow.</div>
          <div><strong>Lip-sync orientation & seed</strong> — Output orientation and noise seed for lip-sync video generation.</div>
          <div><strong>Voice Chat settings</strong> — Browser TTS voice, speech rate, and pitch for in-app voice chat.</div>
        </div>
      </Card>
    </>
  );
}

function WritingSection() {
  return (
    <>
      <Card>
        <H2>Writing Tools</H2>

        <H3>Projects</H3>
        <P>
          Every piece of content in Story Forge belongs to a project. Create a project with a title, genre,
          and optional description. The active project is shown in the top-right corner of every page — switch
          projects from there or from the Projects page. All settings, world data, outlines, scenes, and
          pipeline output are scoped to the active project.
        </P>

        <H3>Dossier</H3>
        <P>
          The Dossier is your pre-writing planning tool. Paste a free-form brain dump of your story idea
          and a list of genre tropes you want to include, then click Generate. The AI produces a structured
          story dossier covering premise, themes, tone, major characters, and key plot beats. Edit and save
          the result. The dossier is included in downstream AI context so the model understands what kind
          of story you're writing.
        </P>

        <H3>Outline</H3>
        <P>
          Build your story structure here. Create one or more outlines (e.g. one per story arc) with a
          title, synopsis, act structure, and themes. Add chapters to each outline with a summary, key
          events, POV character, and primary setting. Chapters created here appear as options on the Write
          page and Pipeline page.
        </P>

        <H3>Write</H3>
        <P>
          The scene editor is the core of Story Forge. Select a chapter, then a scene within it. The AI
          generates scene content using a deep context package that includes:
        </P>
        <ul className="space-y-1 text-sm text-slate-700 mb-4">
          {[
            'Story dossier and outline summary',
            'Active Style Anchors (reference passages)',
            'Active Prohibited Words',
            'Active Style Rules',
            'World Library entries (characters, places, things, technologies)',
            'Story Bible facts',
            'Character States for the current scene',
            'Story Events tracking',
            'Referenced scenes (scenes you explicitly tag as context)',
            'Scene Brief (what should happen in this scene)',
            'Context tags (custom tags to focus generation)',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="text-slate-300 flex-shrink-0 mt-0.5">—</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <P>
          The right sidebar gives access to: Scene Brief, Context Tags, Scene Summary, Scene Image (attach or
          generate a ComfyUI image for the scene), Editing Passes (AI-assisted refinement passes like "tighten
          pacing" or "strengthen dialogue"), and Scene References.
        </P>
        <Note color="sky">
          You can also paste pre-written text directly into the editor. The AI generation features are optional —
          you can use Story Forge as a structured editor for existing writing and still run the full production pipeline.
        </Note>

        <H3>Voice Chat</H3>
        <P>
          An interactive voice assistant for discussing your story. Uses browser speech recognition to
          capture your voice and browser TTS to speak responses. Configure the response voice, rate, and
          pitch in Settings. The AI has full access to your project context and can answer questions,
          brainstorm ideas, or help work through plot problems.
        </P>
      </Card>
    </>
  );
}

function WorldSection() {
  return (
    <>
      <Card>
        <H2>World & Characters</H2>

        <H3>World Library</H3>
        <P>
          The central database for everything that exists in your story's world. Divided into four entity types:
        </P>
        <div className="space-y-3 mb-4">
          {[
            { label: 'Characters', desc: 'Physical description, personality, background, role, relationships, motivations, secrets. Includes Hero\'s Journey stage tracking (which narrative arc stage each character is in) and personality sliders (introversion/extroversion, chaotic/lawful, etc.) that influence how the AI writes them.' },
            { label: 'Places',     desc: 'Name, type, physical description, history, atmosphere, significance. Used to ground scene generation in the correct setting.' },
            { label: 'Things',     desc: 'Objects, artefacts, weapons, vehicles, and other significant items. Includes properties, origin, and current ownership.' },
            { label: 'Technologies', desc: 'Magic systems, technologies, scientific concepts, or any other rules-based system. Includes how it works, its limits, and who can use it.' },
          ].map(({ label, desc }) => (
            <div key={label} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <p className="font-semibold text-slate-900 text-sm mb-1">{label}</p>
              <p className="text-xs text-slate-600">{desc}</p>
            </div>
          ))}
        </div>
        <P>
          Any entity can have a reference image attached. The image is uploaded to Supabase Storage and
          can be analysed by the vision model to automatically extract descriptions.
        </P>

        <H3>Story Bible</H3>
        <P>
          Canonical facts that the AI must always know and respect. Each fact has a category (Character,
          World Rule, Timeline, Relationship, Plot Point, General), an importance level (Critical, High,
          Medium, Low), and optional tags. Active Story Bible entries are injected into every generation
          prompt. Use this for hard rules: "magic cannot bring the dead back to life", "the war ended in
          Year 412", "Elena is left-handed".
        </P>

        <H3>Style Anchors</H3>
        <P>
          Reference passages that define the writing voice you want. Paste excerpts from your own writing,
          a published author you're emulating, or AI-generated passages you liked. Mark up to 2–3 anchors
          as active — they are included in every AI writing prompt so the model matches the style.
        </P>

        <H3>Prohibited Words</H3>
        <P>
          A blocklist of words and phrases the AI must not use. Includes a one-click loader for a curated
          preset of common AI writing tics (e.g. "tapestry of", "in the realm of", "a testament to"),
          genre clichés, and overused words. Organise entries by category: AI-isms, Clichés, Overused,
          or Custom. All active prohibited words are injected into every writing prompt.
        </P>
      </Card>
    </>
  );
}

function ConsistencySection() {
  return (
    <>
      <Card>
        <H2>Consistency & Quality Checks</H2>

        <H3>Consistency Tracking</H3>
        <P>Three tools for maintaining continuity across a long story:</P>
        <div className="space-y-3 mb-4">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <p className="font-semibold text-slate-900 text-sm mb-1">Story Events</p>
            <p className="text-xs text-slate-600">
              A log of important plot events that have happened, tagged by chapter. The AI can reference
              these during generation to avoid contradicting established events or repeating them.
            </p>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <p className="font-semibold text-slate-900 text-sm mb-1">Character States</p>
            <p className="text-xs text-slate-600">
              Track how a character's physical condition, emotional state, and knowledge change from
              scene to scene. Each state entry specifies which chapter it applies to. The AI uses
              the most recent applicable state when writing a character.
            </p>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <p className="font-semibold text-slate-900 text-sm mb-1">Scene References</p>
            <p className="text-xs text-slate-600">
              Tag specific earlier scenes that the current scene should be aware of. These scenes are
              included in full as context when generating the current scene — useful for callbacks,
              consequences, or continuity-critical moments.
            </p>
          </div>
        </div>

        <H3>Logic Checks</H3>
        <P>
          An AI-powered audit tool. Select what to audit — Dossier, Outline/Synopsis, a specific Chapter,
          Characters, or Worldbuilding — and the AI reads the relevant content and produces a detailed
          report highlighting logical inconsistencies, internal contradictions, plot holes, timeline
          problems, and character behaviour inconsistencies. Previous audit reports are stored and can
          be reviewed at any time.
        </P>
        <Note color="amber">
          Logic Checks consume significant context. Use a model with a large context window (32K+) for
          best results, especially when auditing full chapters.
        </Note>
      </Card>
    </>
  );
}

function PipelineSection() {
  return (
    <>
      <Card>
        <H2>Production Pipeline</H2>
        <P>
          The Pipeline converts a finished chapter into all the media assets needed for an audiobook-style
          video. Select a chapter, then run the five stages in order. Each stage has a review gate — you
          inspect the output before proceeding. All output files are stored in ComfyUI's output folder
          and referenced by URL.
        </P>

        <div className="space-y-4 mt-6">
          <StageCard
            number={1}
            color="sky"
            title="Analyse & Generate Images"
            what="The LLM reads your chapter and identifies the key visual moments — dramatic reveals, location changes, action peaks, emotional beats. It decides how many images are needed (typically 3–12) and generates a Stable Diffusion prompt for each moment. ComfyUI then generates those images one at a time using your configured checkpoint, orientation, and conditioning prompts."
            review="Review all images before proceeding. If the results are poor, adjust the conditioning prompts in Settings or re-run. You can select an Art Style Preset per image to override the checkpoint and style for individual scenes."
          />
          <StageCard
            number={2}
            color="teal"
            title="Animate Images"
            what="Each generated scene image is sent to ComfyUI with the built-in LTX 2.3 Text2Video workflow. The animation prompt (configured in Settings) guides what kind of motion is added — flickering light, swaying foliage, atmospheric haze, subtle character movement. Output is a .gif at 30 fps / 5 seconds per image."
            review="Review the animations. This stage is optional — if you prefer still images, skip it and proceed to Stage 3."
          />
          <StageCard
            number={3}
            color="sky"
            title="Generate TTS Audio"
            what="The chapter text is split into chunks at sentence boundaries (approximately 1000 characters per chunk). Each chunk is sent to ComfyUI with the built-in TTS workflow using your configured speaker voice and sample rate. Each chunk produces a separate audio file. The pipeline tracks which text each audio segment corresponds to."
            review="Listen to the audio chunks for quality. Check for mispronunciations of character or place names — add phonetic spellings to the chapter text if needed."
          />
          <StageCard
            number={4}
            color="emerald"
            title="Export Assembly Data"
            what="Exports a structured JSON file containing all image/animation URLs, all TTS audio URLs in order, and the text anchors that map each image to the narration passage it illustrates. This is the data file you use to assemble the final video outside Story Forge."
            review="This is a data export step, not a ComfyUI job. Use the JSON to drive your video assembly tool — images change on screen when the narration reaches the matched text passage."
          />
          <StageCard
            number={5}
            color="rose"
            title="Lip-sync Generation"
            what="You select a character face image. The system takes each TTS audio chunk and sends it to ComfyUI with the built-in LTX 2.3 LipSync workflow along with the character image. Each chunk produces a lip-sync video clip. Output files are tracked sequentially (ch01_lipsync_001.mp4, ch01_lipsync_002.mp4, etc.)."
            review="Stitch the clips together in filename order using an external tool. The assembled lip-sync video shows the character speaking the narration throughout the chapter."
          />
        </div>

        <div className="mt-6 space-y-2">
          <Note color="red">
            <strong>Do not clear ComfyUI's output folder between stages.</strong> Stage 2 needs Stage 1's images.
            Stage 5 needs Stage 3's audio. Deleting output files will break the pipeline.
          </Note>
          <Note color="amber">
            <strong>Sequential processing.</strong> Story Forge sends one job to ComfyUI at a time and waits
            for completion before sending the next. Never start a second pipeline run while one is in progress.
          </Note>
        </div>
      </Card>
    </>
  );
}

function StageCard({ number, color, title, what, review }: {
  number: number;
  color: 'sky' | 'teal' | 'emerald' | 'rose';
  title: string;
  what: string;
  review: string;
}) {
  const colors = {
    sky:     'border-sky-200 bg-sky-50',
    teal:    'border-teal-200 bg-teal-50',
    emerald: 'border-emerald-200 bg-emerald-50',
    rose:    'border-rose-200 bg-rose-50',
  };
  const numColors = {
    sky:     'bg-sky-200 text-sky-800',
    teal:    'bg-teal-200 text-teal-800',
    emerald: 'bg-emerald-200 text-emerald-800',
    rose:    'bg-rose-200 text-rose-800',
  };
  return (
    <div className={`rounded-lg border p-4 ${colors[color]}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${numColors[color]}`}>
          {number}
        </span>
        <span className="font-semibold text-slate-900 text-sm">{title}</span>
      </div>
      <p className="text-sm text-slate-700 mb-2">{what}</p>
      <p className="text-xs text-slate-500"><strong>Review gate:</strong> {review}</p>
    </div>
  );
}

function AudiobookSection() {
  return (
    <>
      <Card>
        <H2>Audiobook</H2>
        <P>
          The Audiobook page provides standalone TTS generation outside the Pipeline. Select a chapter,
          and Story Forge splits the text into sentence-boundary chunks and lets you generate audio for
          each chunk individually or all at once via ComfyUI's TTS workflow.
        </P>
        <P>
          Each chunk's audio URL is saved to the database once generated. You can preview playback
          inline. This page is useful for narrating chapters that aren't going through the full production
          pipeline, or for re-generating specific chunks with different voice settings.
        </P>
        <Note color="sky">
          The same TTS workflow and speaker/sample-rate settings from the Settings page are used here.
          Change the speaker or sample rate in Settings before generating if you want a different voice.
        </Note>
      </Card>
    </>
  );
}

function ExportSection() {
  return (
    <>
      <Card>
        <H2>Export</H2>
        <P>
          Export your finished story in three formats:
        </P>
        <div className="space-y-3 mb-4">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <p className="font-semibold text-slate-900 text-sm mb-1">HTML</p>
            <p className="text-xs text-slate-600">
              A styled, self-contained HTML document. Scene images can be embedded as base64 data (no
              external dependencies) or linked by URL. Suitable for reading in a browser or sharing as
              a single file.
            </p>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <p className="font-semibold text-slate-900 text-sm mb-1">Markdown</p>
            <p className="text-xs text-slate-600">
              Standard Markdown with image references. Compatible with Obsidian, Notion, GitHub, and
              most writing tools that accept Markdown.
            </p>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <p className="font-semibold text-slate-900 text-sm mb-1">Plain Text</p>
            <p className="text-xs text-slate-600">
              Clean text only, no formatting or images. Useful for pasting into publishing platforms
              or further processing.
            </p>
          </div>
        </div>
        <P>
          All formats let you choose whether to include scene images and scene descriptions/notes.
          A preview is shown before downloading.
        </P>

        <H3>Save & Load (JSON Backup)</H3>
        <P>
          The Save/Load page exports the entire project as a JSON file — all scenes, chapters, characters,
          world elements, story bible, settings, and dossier. Use this to back up your work, transfer a
          project between machines, or restore from a previous state. Generated media files (images, audio,
          video) are not included in the backup, only the text data and URLs.
        </P>
        <Note color="amber">
          Importing a backup creates a new project. It does not overwrite an existing one.
        </Note>
      </Card>
    </>
  );
}

function FilesSection() {
  return (
    <>
      <Card>
        <H2>Files & Storage</H2>

        <H3>Where Generated Files Live</H3>
        <P>
          All media generated by ComfyUI (images, animated GIFs, TTS audio, lip-sync video) is saved
          to ComfyUI's output directory on your AI machine. Story Forge never copies these files — it
          stores the URL that points to each file through ComfyUI's HTTP server.
        </P>

        <table className="w-full text-sm mb-4">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left py-2 pr-4 text-slate-600 font-medium">Content</th>
              <th className="text-left py-2 text-slate-600 font-medium">Location</th>
            </tr>
          </thead>
          <tbody className="text-slate-700">
            {[
              ['Scene images',          'ComfyUI/output/'],
              ['Animated GIFs',         'ComfyUI/output/'],
              ['TTS audio',             'ComfyUI/output/'],
              ['Lip-sync video',        'ComfyUI/output/'],
              ['Entity reference images', 'Supabase Storage (cloud)'],
              ['All text data',         'Supabase database (cloud)'],
            ].map(([type, loc]) => (
              <tr key={type} className="border-b border-slate-100">
                <td className="py-2 pr-4">{type}</td>
                <td className="py-2 font-mono text-xs text-slate-600">{loc}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <H3>URL Format</H3>
        <P>Every ComfyUI-generated file is accessed via ComfyUI's <Code>/view</Code> endpoint:</P>
        <div className="bg-slate-100 rounded-lg p-3 font-mono text-xs text-slate-700 break-all mb-4">
          http://your-ai-machine:8188/view?filename=ComfyUI_00001_.png&subfolder=&type=output
        </div>

        <div className="space-y-2">
          <Note color="red">
            <strong>Never clear ComfyUI/output/ mid-pipeline.</strong> The animation, TTS, and lip-sync
            stages depend on files produced by earlier stages. Deleting output files breaks those references permanently.
          </Note>
          <Note color="amber">
            <strong>Keep ComfyUI running while working.</strong> Files are served through ComfyUI's HTTP
            server. If ComfyUI stops, images and audio will not display in Story Forge — but the files
            remain on disk and will work again once ComfyUI restarts.
          </Note>
          <Note color="sky">
            <strong>Lip-sync filenames.</strong> The Pipeline page tracks the expected output filename for
            each lip-sync chunk (e.g. <Code>ch01_lipsync_001.mp4</Code>). Use these names to stitch clips
            together in the correct order in your external video tool.
          </Note>
        </div>
      </Card>
    </>
  );
}

function WorkflowSection() {
  return (
    <>
      <Card>
        <H2>End-to-End Workflow</H2>
        <P>Complete walkthrough from a blank project to a finished audiobook video chapter.</P>

        <div className="space-y-4">
          {[
            {
              phase: '1 — Project Setup',
              steps: [
                'Create a project (Projects page) with title, genre, and description.',
                'Go to Settings, enter your LM Studio and ComfyUI endpoints, and test both connections.',
                'Select your ComfyUI checkpoint and configure image orientation and conditioning prompts.',
                'Set your TTS speaker voice and sample rate.',
              ],
            },
            {
              phase: '2 — World Building',
              steps: [
                'Add your main characters in the World Library with physical descriptions, personalities, and backstory.',
                'Add key places, important objects, and any magic/technology systems.',
                'Add canonical facts to the Story Bible — rules the AI must never break.',
                'Paste reference writing passages into Style Anchors and activate 1–3.',
                'Load the prohibited words preset and add any project-specific terms to avoid.',
              ],
            },
            {
              phase: '3 — Planning',
              steps: [
                'Open the Dossier page, paste your story brain dump and genre tropes, and generate the dossier.',
                'Build your outline — create chapters with summaries, key events, POV character, and setting.',
              ],
            },
            {
              phase: '4 — Writing',
              steps: [
                'Open the Write page, select a chapter and scene.',
                'Fill in the Scene Brief (what needs to happen), then generate content.',
                'Edit the generated text directly in the editor.',
                'Use the Editing Passes sidebar to run targeted refinement passes (pacing, dialogue, description, etc.).',
                'Attach a scene image if desired — either generate one via ComfyUI or upload your own.',
                'Update Character States and Story Events on the Consistency page as the story progresses.',
                'Repeat for each scene until the chapter is complete.',
              ],
            },
            {
              phase: '5 — Quality Review',
              steps: [
                'Run a Logic Check on the chapter to catch inconsistencies or continuity errors.',
                'Fix any identified issues in the Write page.',
                'Re-run the check until it passes cleanly.',
              ],
            },
            {
              phase: '6 — Production Pipeline',
              steps: [
                'Open the Pipeline page and select the finished chapter.',
                'Stage 1: Generate Images — review all images before continuing.',
                'Stage 2: Animate Images — review animations, or skip if you prefer stills.',
                'Stage 3: Generate TTS Audio — listen to all chunks for quality.',
                'Stage 4: Export Assembly Data — download the JSON for video assembly.',
                'Stage 5: Generate Lip-sync — select a character face image, generate all clips.',
                'Stitch the lip-sync clips together in filename order using an external video tool.',
              ],
            },
            {
              phase: '7 — Final Assembly (External)',
              steps: [
                'Use the Assembly Data JSON to drive scene image changes in sync with the narration.',
                'Place the scene video (images + audio) in a smaller overlay window.',
                'Place the stitched lip-sync video in the main frame.',
                'Mute the overlay video — the lip-sync carries the same TTS audio.',
                'Add chapter title cards, intro/outro, and background music as desired.',
                'Export and upload to YouTube.',
              ],
            },
          ].map(({ phase, steps }) => (
            <div key={phase} className="border border-slate-200 rounded-lg p-4">
              <h3 className="font-semibold text-slate-900 mb-3 text-sm">{phase}</h3>
              <ol className="space-y-1.5">
                {steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="text-slate-400 font-mono text-xs mt-0.5 flex-shrink-0 w-4">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <H2>Using Pre-Written Stories</H2>
        <P>
          You can run the full production pipeline on an existing story without using the AI writing tools:
        </P>
        <ol className="space-y-2 text-sm text-slate-700">
          <li className="flex items-start gap-2">
            <span className="bg-slate-200 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
            <span>Create a project and an outline with chapters matching your story's structure.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="bg-slate-200 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
            <span>On the Write page, paste your existing text into each scene's content field.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="bg-slate-200 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
            <span>Run the Pipeline — the LLM analyses your text exactly as it would for AI-written content.</span>
          </li>
        </ol>
      </Card>
    </>
  );
}
