import { useState } from 'react';
import { Link } from 'react-router-dom';

type Section = 'overview' | 'llm' | 'comfyui-images' | 'comfyui-tts' | 'comfyui-animation' | 'comfyui-lipsync' | 'pipeline' | 'files' | 'workflow';

const SECTIONS: { key: Section; label: string }[] = [
  { key: 'overview', label: 'System Overview' },
  { key: 'llm', label: 'LLM Setup' },
  { key: 'comfyui-images', label: 'ComfyUI: Images' },
  { key: 'comfyui-tts', label: 'ComfyUI: TTS' },
  { key: 'comfyui-animation', label: 'ComfyUI: Animation' },
  { key: 'comfyui-lipsync', label: 'ComfyUI: Lip-sync' },
  { key: 'pipeline', label: 'Production Pipeline' },
  { key: 'files', label: 'File Locations' },
  { key: 'workflow', label: 'End-to-End Workflow' },
];

export default function SetupGuide() {
  const [activeSection, setActiveSection] = useState<Section>('overview');

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-slate-900">Setup Guide</h1>
        <Link
          to="/settings"
          className="px-4 py-2 bg-slate-700 text-white text-sm rounded-lg hover:bg-slate-800 transition-colors"
        >
          Go to Settings
        </Link>
      </div>

      <div className="flex gap-6">
        <nav className="w-56 flex-shrink-0">
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
          {activeSection === 'overview' && <OverviewSection />}
          {activeSection === 'llm' && <LlmSection />}
          {activeSection === 'comfyui-images' && <ComfyImageSection />}
          {activeSection === 'comfyui-tts' && <ComfyTtsSection />}
          {activeSection === 'comfyui-animation' && <ComfyAnimationSection />}
          {activeSection === 'comfyui-lipsync' && <ComfyLipsyncSection />}
          {activeSection === 'pipeline' && <PipelineSection />}
          {activeSection === 'files' && <FilesSection />}
          {activeSection === 'workflow' && <WorkflowSection />}
        </div>
      </div>
    </div>
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
      {children}
    </div>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <code className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-sm font-mono">
      {children}
    </code>
  );
}

function OverviewSection() {
  return (
    <>
      <SectionCard>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Story Forge System Overview</h2>
        <p className="text-sm text-slate-600 mb-4">
          Story Forge is a local AI-powered novel writing studio that connects to several services running on your machine.
          Nothing goes to the cloud -- all processing happens locally.
        </p>

        <h3 className="font-semibold text-slate-900 mt-6 mb-3">Services Required</h3>
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
            <span className="w-8 h-8 bg-sky-100 text-sky-700 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0">LLM</span>
            <div>
              <p className="font-medium text-slate-900 text-sm">Local LLM (Required)</p>
              <p className="text-xs text-slate-600">Text generation for writing, scene analysis, and visual moment identification. Runs through LM Studio, text-generation-webui, or any OpenAI-compatible API.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
            <span className="w-8 h-8 bg-emerald-100 text-emerald-700 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0">IMG</span>
            <div>
              <p className="font-medium text-slate-900 text-sm">ComfyUI: Image Generation (Required for pipeline)</p>
              <p className="text-xs text-slate-600">Generates scene illustrations from text prompts using Stable Diffusion models.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
            <span className="w-8 h-8 bg-teal-100 text-teal-700 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0">TTS</span>
            <div>
              <p className="font-medium text-slate-900 text-sm">ComfyUI: TTS (Required for pipeline)</p>
              <p className="text-xs text-slate-600">Text-to-speech narration. Uses a ComfyUI workflow with a TTS node to generate audio.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
            <span className="w-8 h-8 bg-amber-100 text-amber-700 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0">ANI</span>
            <div>
              <p className="font-medium text-slate-900 text-sm">ComfyUI: Animation (Optional)</p>
              <p className="text-xs text-slate-600">Adds subtle motion to still images. Uses workflows like AnimateDiff or other img2vid nodes.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
            <span className="w-8 h-8 bg-rose-100 text-rose-700 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0">LIP</span>
            <div>
              <p className="font-medium text-slate-900 text-sm">ComfyUI: Lip-sync (Optional)</p>
              <p className="text-xs text-slate-600">Generates lip-sync video from a character image + audio. Uses workflows like SadTalker or Wav2Lip nodes.</p>
            </div>
          </div>
        </div>

        <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <h4 className="font-semibold text-amber-900 text-sm mb-1">Important: One ComfyUI Instance</h4>
          <p className="text-xs text-amber-800">
            All ComfyUI workflows (images, TTS, animation, lip-sync) use the same ComfyUI endpoint.
            You load different workflows for different tasks, but they all run on the same ComfyUI server.
            The pipeline runs one job at a time -- it never sends two jobs simultaneously.
          </p>
        </div>
      </SectionCard>
    </>
  );
}

function LlmSection() {
  return (
    <>
      <SectionCard>
        <h2 className="text-xl font-bold text-slate-900 mb-4">LLM Setup (Text Generation)</h2>
        <p className="text-sm text-slate-600 mb-4">
          The LLM handles all text generation: writing chapters, analyzing scenes for visual moments,
          generating image prompts, and more. You need an OpenAI-compatible API running locally.
        </p>

        <h3 className="font-semibold text-slate-900 mt-6 mb-3">Option A: LM Studio (Easiest)</h3>
        <ol className="space-y-2 text-sm text-slate-700">
          <li className="flex items-start gap-2">
            <span className="bg-slate-200 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
            <span>Download LM Studio from <strong>lmstudio.ai</strong></span>
          </li>
          <li className="flex items-start gap-2">
            <span className="bg-slate-200 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
            <span>Search for and download a GGUF model (e.g. MythoMax-13B, Mistral-7B)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="bg-slate-200 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
            <span>Click the "Local Server" tab (arrow icon on left sidebar)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="bg-slate-200 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0">4</span>
            <span>Load your model, then click "Start Server"</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="bg-slate-200 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0">5</span>
            <span>The API runs at <CodeBlock>http://localhost:1234/v1/completions</CodeBlock></span>
          </li>
        </ol>

        <h3 className="font-semibold text-slate-900 mt-6 mb-3">Option B: text-generation-webui</h3>
        <ol className="space-y-2 text-sm text-slate-700">
          <li className="flex items-start gap-2">
            <span className="bg-slate-200 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
            <span>Install from <strong>github.com/oobabooga/text-generation-webui</strong></span>
          </li>
          <li className="flex items-start gap-2">
            <span className="bg-slate-200 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
            <span>Download a model (GPTQ or GGUF) into the <CodeBlock>models/</CodeBlock> folder</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="bg-slate-200 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
            <span>Launch with the <CodeBlock>--api</CodeBlock> flag to enable the OpenAI-compatible endpoint</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="bg-slate-200 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0">4</span>
            <span>The API runs at <CodeBlock>http://localhost:5000/v1/completions</CodeBlock></span>
          </li>
        </ol>

        <h3 className="font-semibold text-slate-900 mt-6 mb-3">Settings Configuration</h3>
        <p className="text-sm text-slate-600 mb-2">
          Go to <Link to="/settings" className="text-sky-600 hover:text-sky-700 font-medium">Settings</Link> and set:
        </p>
        <ul className="space-y-1 text-sm text-slate-700">
          <li><strong>API Endpoint</strong> -- your LLM server URL (see above)</li>
          <li><strong>Model Name</strong> -- matches the model identifier shown in your server</li>
          <li><strong>Temperature</strong> -- 0.7-0.8 for creative writing, 0.3 for analysis tasks</li>
          <li><strong>Max Tokens</strong> -- 1500-2000 for writing, 2000-3000 for scene analysis</li>
          <li><strong>Context Length</strong> -- match your model's context window (4096, 8192, etc.)</li>
        </ul>

        <div className="mt-4 p-3 bg-sky-50 border border-sky-200 rounded-lg">
          <p className="text-xs text-sky-800">
            <strong>Vision model (optional):</strong> If you want image analysis for reference photos, load a vision model
            (e.g. LLaVA) in LM Studio on port 1234. Configure the model name in Settings under "Vision / Image Analysis".
          </p>
        </div>
      </SectionCard>
    </>
  );
}

function ComfyImageSection() {
  return (
    <>
      <SectionCard>
        <h2 className="text-xl font-bold text-slate-900 mb-4">ComfyUI: Image Generation</h2>
        <p className="text-sm text-slate-600 mb-4">
          ComfyUI generates scene illustrations from text prompts. Story Forge uses either a built-in default
          workflow or a custom one you provide.
        </p>

        <h3 className="font-semibold text-slate-900 mt-6 mb-3">Setup Steps</h3>
        <ol className="space-y-2 text-sm text-slate-700">
          <li className="flex items-start gap-2">
            <span className="bg-slate-200 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
            <span>Install ComfyUI from <strong>github.com/comfyanonymous/ComfyUI</strong></span>
          </li>
          <li className="flex items-start gap-2">
            <span className="bg-slate-200 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
            <span>Place Stable Diffusion checkpoints in <CodeBlock>ComfyUI/models/checkpoints/</CodeBlock></span>
          </li>
          <li className="flex items-start gap-2">
            <span className="bg-slate-200 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
            <span>Start ComfyUI -- it runs at <CodeBlock>http://127.0.0.1:8188</CodeBlock> by default</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="bg-slate-200 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0">4</span>
            <span>In Story Forge Settings, click "Test ComfyUI Connection"</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="bg-slate-200 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0">5</span>
            <span>Select your checkpoint, set image dimensions, steps, CFG scale, sampler</span>
          </li>
        </ol>

        <h3 className="font-semibold text-slate-900 mt-6 mb-3">Custom Workflow (Optional)</h3>
        <p className="text-sm text-slate-600 mb-2">
          If you want to use LoRAs, ControlNet, or a more complex pipeline:
        </p>
        <ol className="space-y-2 text-sm text-slate-700">
          <li className="flex items-start gap-2">
            <span className="bg-slate-200 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
            <span>Build your workflow in ComfyUI's web interface</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="bg-slate-200 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
            <span>Click "Save (API Format)" in ComfyUI to export the JSON</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="bg-slate-200 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
            <span>Paste the JSON into Settings &gt; "Custom Workflow" and click "Import Workflow"</span>
          </li>
        </ol>
        <p className="text-xs text-slate-500 mt-2">
          Story Forge automatically injects the positive/negative prompts, checkpoint, dimensions, steps,
          CFG, and sampler into your workflow. It finds CLIPTextEncode, KSampler, CheckpointLoaderSimple,
          and EmptyLatentImage nodes and fills in the values.
        </p>

        <h3 className="font-semibold text-slate-900 mt-6 mb-3">Where Are Images Stored?</h3>
        <p className="text-sm text-slate-600">
          Generated images live in ComfyUI's output folder: <CodeBlock>ComfyUI/output/</CodeBlock>.
          Story Forge references them via URLs like <CodeBlock>http://127.0.0.1:8188/view?filename=...&type=output</CodeBlock>.
          Keep ComfyUI running and don't delete the output folder while working.
        </p>
      </SectionCard>
    </>
  );
}

function ComfyTtsSection() {
  return (
    <>
      <SectionCard>
        <h2 className="text-xl font-bold text-slate-900 mb-4">ComfyUI: Text-to-Speech (TTS)</h2>
        <p className="text-sm text-slate-600 mb-4">
          TTS generates narration audio from your chapter text. This requires a ComfyUI TTS node
          installed and a workflow that accepts text input and produces audio output.
        </p>

        <h3 className="font-semibold text-slate-900 mt-6 mb-3">Setup Steps</h3>
        <ol className="space-y-2 text-sm text-slate-700">
          <li className="flex items-start gap-2">
            <span className="bg-slate-200 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
            <span>Install a ComfyUI TTS node pack (e.g. ComfyUI-XTTS, ComfyUI-Coqui-TTS, or similar)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="bg-slate-200 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
            <span>Build a workflow in ComfyUI with a text input node connected to TTS, outputting audio</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="bg-slate-200 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
            <span>Export the workflow as API format (click "Save (API Format)" in ComfyUI)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="bg-slate-200 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0">4</span>
            <span>In Story Forge Settings &gt; "Text-to-Speech (ComfyUI TTS)", paste the JSON and click "Import TTS Workflow"</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="bg-slate-200 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0">5</span>
            <span>Set the Speaker/Voice name (depends on your TTS model, e.g. "narrator", "en_speaker_0")</span>
          </li>
        </ol>

        <h3 className="font-semibold text-slate-900 mt-6 mb-3">How It Works</h3>
        <p className="text-sm text-slate-600">
          Story Forge finds text/prompt input nodes in your workflow and injects the chapter text.
          It also injects the speaker name. The TTS node generates audio (.wav, .mp3, .flac, or .ogg)
          which is saved in ComfyUI's output folder and referenced by URL.
        </p>

        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs text-amber-800">
            <strong>Chunking:</strong> Long chapters are automatically split into chunks (~1000 characters each)
            at sentence boundaries. Each chunk is a separate TTS generation. This prevents timeouts and keeps
            audio quality consistent.
          </p>
        </div>
      </SectionCard>
    </>
  );
}

function ComfyAnimationSection() {
  return (
    <>
      <SectionCard>
        <h2 className="text-xl font-bold text-slate-900 mb-4">ComfyUI: Image Animation</h2>
        <p className="text-sm text-slate-600 mb-4">
          Animation adds subtle motion to still images -- glowing lights, swaying trees, flickering flames,
          breathing effects. This makes the litRPG video more engaging than static images.
        </p>

        <h3 className="font-semibold text-slate-900 mt-6 mb-3">Setup Steps</h3>
        <ol className="space-y-2 text-sm text-slate-700">
          <li className="flex items-start gap-2">
            <span className="bg-slate-200 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
            <span>Install an animation node pack in ComfyUI (e.g. AnimateDiff, Stable Video Diffusion nodes)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="bg-slate-200 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
            <span>Build a workflow that takes an <strong>input image</strong> and a <strong>text prompt</strong>, outputs an animated video/GIF</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="bg-slate-200 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
            <span>Export as API format from ComfyUI</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="bg-slate-200 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0">4</span>
            <span>In Story Forge Settings &gt; "Image Animation (ComfyUI)", paste and import the workflow</span>
          </li>
        </ol>

        <h3 className="font-semibold text-slate-900 mt-6 mb-3">How Injection Works</h3>
        <p className="text-sm text-slate-600 mb-2">
          Story Forge scans your workflow nodes and fills in these fields:
        </p>
        <ul className="space-y-1 text-sm text-slate-700">
          <li><strong>Image source</strong> -- fills <CodeBlock>image</CodeBlock>, <CodeBlock>url</CodeBlock>, or <CodeBlock>image_path</CodeBlock> inputs with the generated image URL</li>
          <li><strong>Animation description</strong> -- fills <CodeBlock>text</CodeBlock> or <CodeBlock>prompt</CodeBlock> inputs with what to animate (e.g. "glowing engine lights pulsing")</li>
        </ul>

        <div className="mt-4 p-3 bg-sky-50 border border-sky-200 rounded-lg">
          <p className="text-xs text-sky-800">
            <strong>Tip:</strong> Keep animations simple. The LLM generates animation prompts like
            "flickering torchlight on stone walls" or "gentle wind through hair". These are meant for
            subtle img2vid motion, not full cinematic sequences.
          </p>
        </div>
      </SectionCard>
    </>
  );
}

function ComfyLipsyncSection() {
  return (
    <>
      <SectionCard>
        <h2 className="text-xl font-bold text-slate-900 mb-4">ComfyUI: Lip-sync Video</h2>
        <p className="text-sm text-slate-600 mb-4">
          Lip-sync generates a video of a character "reading" the narration. Takes a face image + audio,
          outputs a video with lip movement synced to the speech.
        </p>

        <h3 className="font-semibold text-slate-900 mt-6 mb-3">Setup Steps</h3>
        <ol className="space-y-2 text-sm text-slate-700">
          <li className="flex items-start gap-2">
            <span className="bg-slate-200 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
            <span>Install a lip-sync node pack in ComfyUI (e.g. SadTalker, Wav2Lip, MuseTalk nodes)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="bg-slate-200 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
            <span>Build a workflow that takes a <strong>face/character image</strong> and an <strong>audio file</strong>, outputs a video</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="bg-slate-200 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
            <span>Export as API format from ComfyUI</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="bg-slate-200 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0">4</span>
            <span>In Story Forge Settings &gt; "Lip-sync (ComfyUI)", paste and import the workflow</span>
          </li>
        </ol>

        <h3 className="font-semibold text-slate-900 mt-6 mb-3">How Injection Works</h3>
        <p className="text-sm text-slate-600 mb-2">
          Story Forge scans your workflow and fills:
        </p>
        <ul className="space-y-1 text-sm text-slate-700">
          <li><strong>Face image</strong> -- fills <CodeBlock>image</CodeBlock>, <CodeBlock>image_path</CodeBlock>, <CodeBlock>face_image</CodeBlock>, or <CodeBlock>reference_image</CodeBlock></li>
          <li><strong>Audio</strong> -- fills <CodeBlock>audio</CodeBlock>, <CodeBlock>audio_path</CodeBlock>, <CodeBlock>audio_file</CodeBlock>, or <CodeBlock>driven_audio</CodeBlock></li>
        </ul>

        <h3 className="font-semibold text-slate-900 mt-6 mb-3">Output Naming</h3>
        <p className="text-sm text-slate-600">
          Lip-sync chunks are tracked with sequential filenames: <CodeBlock>ch01_lipsync_001.mp4</CodeBlock>,
          <CodeBlock>ch01_lipsync_002.mp4</CodeBlock>, etc. This naming ensures you can assemble them in the
          correct order using your external stitching tool.
        </p>
      </SectionCard>
    </>
  );
}

function PipelineSection() {
  return (
    <>
      <SectionCard>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Production Pipeline</h2>
        <p className="text-sm text-slate-600 mb-4">
          The pipeline converts a finished chapter into production-ready litRPG content.
          It runs one stage at a time with review gates between each step.
        </p>

        <div className="space-y-4">
          <StageGuide
            number={1}
            title="Analyze & Generate Images"
            color="sky"
            description="The LLM reads your chapter and identifies key visual moments -- action scenes, dramatic reveals, new locations, emotional peaks. It decides how many images are needed (3-12 depending on the content) and generates a Stable Diffusion prompt for each. Then ComfyUI generates the images one at a time."
            reviewNote="Review all generated images. If any are wrong, you can start a new run."
          />
          <StageGuide
            number={2}
            title="Animate Images"
            color="teal"
            description="Each generated image is sent to ComfyUI with a motion description derived from the same scene analysis. Subtle animations like glowing lights, swaying foliage, flickering flames, or breathing movement. One image at a time."
            reviewNote="Review animations. This stage is optional -- skip it if you want to use still images."
          />
          <StageGuide
            number={3}
            title="Generate TTS Audio"
            color="sky"
            description="The chapter text is split into chunks at sentence boundaries and sent to the TTS workflow. Each chunk produces a separate audio file. The pipeline tracks which text each audio segment corresponds to."
            reviewNote="Listen to the audio. Check for mispronunciations or artifacts."
          />
          <StageGuide
            number={4}
            title="Video Assembly Data"
            color="emerald"
            description="Exports a JSON file containing all image/animation URLs, all audio URLs, and the text anchors that map images to narration passages. This is the data you use to assemble the final litRPG video externally -- images change on screen when the narration reaches the matching text."
            reviewNote="This is an export step, not a ComfyUI job. You assemble the video outside Story Forge."
          />
          <StageGuide
            number={5}
            title="Lip-sync Generation"
            color="rose"
            description="You select a character face image. The system takes each TTS audio chunk and generates a lip-sync video through ComfyUI. Output files are named sequentially (ch01_lipsync_001.mp4, ch01_lipsync_002.mp4) for easy assembly."
            reviewNote="Stitch the lip-sync clips together using your external tool, in filename order."
          />
        </div>
      </SectionCard>
    </>
  );
}

function StageGuide({ number, title, color, description, reviewNote }: {
  number: number;
  title: string;
  color: string;
  description: string;
  reviewNote: string;
}) {
  const colorClasses: Record<string, string> = {
    sky: 'bg-sky-100 text-sky-700 border-sky-200',
    teal: 'bg-teal-100 text-teal-700 border-teal-200',
    emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    rose: 'bg-rose-100 text-rose-700 border-rose-200',
  };

  return (
    <div className={`p-4 rounded-lg border ${colorClasses[color] || colorClasses.sky}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="font-bold text-lg">Stage {number}:</span>
        <span className="font-semibold">{title}</span>
      </div>
      <p className="text-sm opacity-90 mb-2">{description}</p>
      <p className="text-xs opacity-75">
        <strong>Review gate:</strong> {reviewNote}
      </p>
    </div>
  );
}

function FilesSection() {
  return (
    <>
      <SectionCard>
        <h2 className="text-xl font-bold text-slate-900 mb-4">File Locations & How URLs Work</h2>
        <p className="text-sm text-slate-600 mb-4">
          All generated files live on your ComfyUI server. Story Forge never copies or moves files --
          it stores URLs pointing to ComfyUI's output directory.
        </p>

        <h3 className="font-semibold text-slate-900 mt-6 mb-3">Where Files Are Stored</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left py-2 pr-4 text-slate-600 font-medium">Content Type</th>
              <th className="text-left py-2 text-slate-600 font-medium">Location on Disk</th>
            </tr>
          </thead>
          <tbody className="text-slate-700">
            <tr className="border-b border-slate-100">
              <td className="py-2 pr-4">Scene images</td>
              <td className="py-2"><CodeBlock>ComfyUI/output/</CodeBlock></td>
            </tr>
            <tr className="border-b border-slate-100">
              <td className="py-2 pr-4">TTS audio</td>
              <td className="py-2"><CodeBlock>ComfyUI/output/</CodeBlock></td>
            </tr>
            <tr className="border-b border-slate-100">
              <td className="py-2 pr-4">Animated images</td>
              <td className="py-2"><CodeBlock>ComfyUI/output/</CodeBlock></td>
            </tr>
            <tr className="border-b border-slate-100">
              <td className="py-2 pr-4">Lip-sync videos</td>
              <td className="py-2"><CodeBlock>ComfyUI/output/</CodeBlock></td>
            </tr>
            <tr>
              <td className="py-2 pr-4">Entity reference images</td>
              <td className="py-2">Supabase Storage (cloud)</td>
            </tr>
          </tbody>
        </table>

        <h3 className="font-semibold text-slate-900 mt-6 mb-3">URL Format</h3>
        <p className="text-sm text-slate-600 mb-2">
          Every generated file is accessed via ComfyUI's <CodeBlock>/view</CodeBlock> endpoint:
        </p>
        <div className="bg-slate-100 rounded-lg p-3 font-mono text-xs text-slate-700 break-all">
          http://127.0.0.1:8188/view?filename=scene_00001.png&subfolder=&type=output
        </div>

        <div className="mt-6 space-y-3">
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-xs text-red-800">
              <strong>Do NOT clear ComfyUI's output folder</strong> between pipeline stages. The next stage needs
              the files from the previous stage. URLs become broken if you delete the output folder.
            </p>
          </div>
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs text-amber-800">
              <strong>Keep ComfyUI running</strong> while working in Story Forge. Files are served through ComfyUI's
              HTTP server -- if ComfyUI is stopped, images/audio/video won't display. The files are still on disk
              and will work again when ComfyUI restarts.
            </p>
          </div>
          <div className="p-3 bg-sky-50 border border-sky-200 rounded-lg">
            <p className="text-xs text-sky-800">
              <strong>Finding files manually:</strong> Look in <CodeBlock>ComfyUI/output/</CodeBlock> on your machine.
              The filenames match what's in the URL. For lip-sync, the pipeline page shows the tracked filename
              for each chunk (e.g. ch01_lipsync_001.mp4) though ComfyUI may use its own internal naming.
            </p>
          </div>
        </div>
      </SectionCard>
    </>
  );
}

function WorkflowSection() {
  return (
    <>
      <SectionCard>
        <h2 className="text-xl font-bold text-slate-900 mb-4">End-to-End Workflow</h2>
        <p className="text-sm text-slate-600 mb-4">
          Complete walkthrough of creating a litRPG YouTube video from scratch.
        </p>

        <div className="space-y-4">
          <WorkflowStep
            phase="Writing Phase"
            steps={[
              'Create a project with genre set (Projects page)',
              'Build your world: characters, places, things, technologies (World page)',
              'Write the story dossier with braindump and genre tropes (Dossier page)',
              'Create an outline with chapters and scenes (Outline page)',
              'Write each scene -- AI generates using full context from world/outline (Write page)',
              'Run editing passes and logic checks to polish (Write page sidebar)',
              'Mark the chapter as complete when satisfied',
            ]}
          />
          <WorkflowStep
            phase="Production Phase"
            steps={[
              'Go to Pipeline page, select your finished chapter',
              'Stage 1: Click "Start Analysis & Image Generation" -- LLM picks visual moments, ComfyUI generates images',
              'REVIEW: Check all generated images, start a new run if needed',
              'Stage 2: Click "Animate All Images" -- ComfyUI adds subtle motion to each image',
              'REVIEW: Check animations, skip this stage if you prefer still images',
              'Stage 3: Click "Generate TTS Audio" -- ComfyUI TTS narrates the chapter text',
              'REVIEW: Listen to the audio for quality',
              'Stage 4: Click "Export Assembly Data" -- saves JSON with image/audio/text timing',
              'Assemble the litRPG video externally using the JSON data (images + TTS)',
            ]}
          />
          <WorkflowStep
            phase="Lip-sync Phase"
            steps={[
              'Stage 5: Paste the character face image URL in the Pipeline page',
              'Click "Generate Lip-sync Videos" -- one clip per TTS chunk',
              'Stitch the lip-sync clips together (external tool, in filename order)',
              'Layer the assembled litRPG video inside the lip-sync video as a smaller window',
              'Mute the litRPG video audio (the lip-sync uses the same TTS audio)',
            ]}
          />
          <WorkflowStep
            phase="Final Product"
            steps={[
              'Lip-sync character reading the story in the main frame',
              'Story images appearing in an overlay window, changing at the right moments',
              'TTS narration audio playing throughout',
              'Upload to YouTube as a litRPG audiobook with visuals',
            ]}
          />
        </div>
      </SectionCard>

      <SectionCard>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Pre-Written Stories</h2>
        <p className="text-sm text-slate-600 mb-4">
          If you have an already-written story, you can still use the full production pipeline:
        </p>
        <ol className="space-y-2 text-sm text-slate-700">
          <li className="flex items-start gap-2">
            <span className="bg-slate-200 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
            <span>Create a project and outline with chapters</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="bg-slate-200 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
            <span>Paste your story text into the scene content fields on the Write page</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="bg-slate-200 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
            <span>Run the pipeline as normal -- the LLM analyzes your text just the same</span>
          </li>
        </ol>
      </SectionCard>
    </>
  );
}

function WorkflowStep({ phase, steps }: { phase: string; steps: string[] }) {
  return (
    <div className="border border-slate-200 rounded-lg p-4">
      <h3 className="font-semibold text-slate-900 mb-3">{phase}</h3>
      <ol className="space-y-1.5">
        {steps.map((step, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
            <span className="text-slate-400 font-mono text-xs mt-0.5 flex-shrink-0">
              {String(i + 1).padStart(2, '0')}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
