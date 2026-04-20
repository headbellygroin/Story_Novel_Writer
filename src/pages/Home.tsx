import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-slate-900 mb-2">
            Story Forge
          </h1>
          <p className="text-lg text-slate-500 mb-4">
            AI-Powered Novel Writing & Production Studio
          </p>
          <p className="text-xl text-slate-600 mb-8 max-w-2xl mx-auto">
            Write with uncensored local models, generate illustrations, create audiobook narration,
            and produce YouTube-ready litRPG content -- all from one workspace.
          </p>
          <div className="flex justify-center gap-4">
            <Link
              to="/projects"
              className="inline-block px-8 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors font-medium text-lg"
            >
              Get Started
            </Link>
            <Link
              to="/setup-guide"
              className="inline-block px-8 py-3 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors font-medium text-lg"
            >
              Setup Guide
            </Link>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-3">Writing</h2>
            <p className="text-sm text-slate-600 mb-4">
              Build your world, outline chapters, and write with context-aware AI that understands
              your characters, settings, and plot.
            </p>
            <div className="space-y-2 text-sm text-slate-700">
              <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-sky-500 rounded-full" /> World library & dossier</div>
              <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-sky-500 rounded-full" /> Outline & scene planning</div>
              <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-sky-500 rounded-full" /> AI writing with full context</div>
              <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-sky-500 rounded-full" /> Story bible & consistency</div>
              <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-sky-500 rounded-full" /> Editing passes & logic checks</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-3">Production</h2>
            <p className="text-sm text-slate-600 mb-4">
              Convert finished chapters into YouTube-ready litRPG content with automated image,
              audio, and video generation.
            </p>
            <div className="space-y-2 text-sm text-slate-700">
              <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> LLM-driven visual moment analysis</div>
              <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> ComfyUI image generation</div>
              <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> Image animation (subtle motion)</div>
              <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> TTS audiobook narration</div>
              <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> Video assembly data export</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-3">Lip-sync</h2>
            <p className="text-sm text-slate-600 mb-4">
              Generate lip-sync video of a character reading the story. Combine with the
              litRPG video for a complete YouTube product.
            </p>
            <div className="space-y-2 text-sm text-slate-700">
              <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-rose-500 rounded-full" /> Character face selection</div>
              <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-rose-500 rounded-full" /> Audio-driven lip-sync via ComfyUI</div>
              <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-rose-500 rounded-full" /> Sequential file naming for assembly</div>
              <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-rose-500 rounded-full" /> One job at a time, never concurrent</div>
              <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-rose-500 rounded-full" /> Review gates between every stage</div>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-12">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Quick Start</h2>
            <ol className="space-y-3 text-sm text-slate-700">
              <li className="flex items-start">
                <span className="bg-slate-200 text-slate-700 rounded-full w-6 h-6 flex items-center justify-center mr-3 flex-shrink-0 font-semibold text-xs">1</span>
                <div><strong>Start LM Studio</strong> with your writing model and enable the local server</div>
              </li>
              <li className="flex items-start">
                <span className="bg-slate-200 text-slate-700 rounded-full w-6 h-6 flex items-center justify-center mr-3 flex-shrink-0 font-semibold text-xs">2</span>
                <div><strong>Start ComfyUI</strong> with your Stable Diffusion checkpoint loaded</div>
              </li>
              <li className="flex items-start">
                <span className="bg-slate-200 text-slate-700 rounded-full w-6 h-6 flex items-center justify-center mr-3 flex-shrink-0 font-semibold text-xs">3</span>
                <div><strong>Configure Settings</strong> -- set API endpoint, test connections, import workflows</div>
              </li>
              <li className="flex items-start">
                <span className="bg-slate-200 text-slate-700 rounded-full w-6 h-6 flex items-center justify-center mr-3 flex-shrink-0 font-semibold text-xs">4</span>
                <div><strong>Create a Project</strong> -- set genre, build world, outline chapters</div>
              </li>
              <li className="flex items-start">
                <span className="bg-slate-200 text-slate-700 rounded-full w-6 h-6 flex items-center justify-center mr-3 flex-shrink-0 font-semibold text-xs">5</span>
                <div><strong>Write your chapter</strong> -- AI generates with full context from your world</div>
              </li>
              <li className="flex items-start">
                <span className="bg-slate-200 text-slate-700 rounded-full w-6 h-6 flex items-center justify-center mr-3 flex-shrink-0 font-semibold text-xs">6</span>
                <div><strong>Run the Pipeline</strong> -- images, animation, TTS, lip-sync (one stage at a time)</div>
              </li>
            </ol>
            <div className="mt-4">
              <Link
                to="/setup-guide"
                className="text-sm text-sky-600 hover:text-sky-700 font-medium"
              >
                Full setup guide with detailed instructions --&gt;
              </Link>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Services You Need Running</h2>
            <div className="space-y-3">
              <ServiceStatus
                label="LLM Server"
                detail="LM Studio or text-generation-webui"
                required
              />
              <ServiceStatus
                label="ComfyUI"
                detail="Image generation, TTS, animation, lip-sync"
                required
              />
              <div className="pt-3 border-t border-slate-100">
                <p className="text-xs text-slate-500">
                  All workflows run through the same ComfyUI instance. Import different workflows
                  in Settings for each task (images, TTS, animation, lip-sync). The pipeline
                  runs one job at a time.
                </p>
              </div>
            </div>

            <h3 className="font-semibold text-slate-900 mt-6 mb-2">Recommended Models</h3>
            <div className="space-y-2 text-sm text-slate-700">
              <div><strong>Writing LLM:</strong> MythoMax 13B, Nous Hermes 2 Yi 34B, Mistral 7B</div>
              <div><strong>Image Gen:</strong> Any SD 1.5 / SDXL checkpoint</div>
              <div><strong>TTS:</strong> XTTS, Coqui TTS, or Bark (via ComfyUI nodes)</div>
              <div><strong>Animation:</strong> AnimateDiff, Stable Video Diffusion</div>
              <div><strong>Lip-sync:</strong> SadTalker, Wav2Lip, MuseTalk (via ComfyUI nodes)</div>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4 mb-12">
          <NavCard title="Projects" link="/projects" />
          <NavCard title="World" link="/world" />
          <NavCard title="Outline" link="/outline" />
          <NavCard title="Write" link="/write" />
          <NavCard title="Pipeline" link="/pipeline" />
        </div>

        <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-white mb-4">Why Local?</h2>
          <div className="grid md:grid-cols-3 gap-6 text-sm text-slate-200">
            <div>
              <h3 className="font-semibold text-white mb-2">No Censorship</h3>
              <p>Write any content without refusals or sanitization. Complete creative freedom.</p>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-2">Complete Privacy</h3>
              <p>Everything runs on your machine. No cloud services, no data collection.</p>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-2">No Limits</h3>
              <p>Unlimited generation. No token costs, rate limits, or subscription fees.</p>
            </div>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
          <h3 className="font-semibold text-amber-900 mb-3">External Resources</h3>
          <ul className="space-y-1 text-sm text-amber-800">
            <li>LM Studio: <strong>lmstudio.ai</strong></li>
            <li>text-generation-webui: <strong>github.com/oobabooga/text-generation-webui</strong></li>
            <li>ComfyUI: <strong>github.com/comfyanonymous/ComfyUI</strong></li>
            <li>Models: <strong>huggingface.co</strong> (search for GGUF or safetensors)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function ServiceStatus({ label, detail, required }: { label: string; detail: string; required?: boolean }) {
  return (
    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
      <div>
        <span className="font-medium text-slate-900 text-sm">{label}</span>
        <p className="text-xs text-slate-500">{detail}</p>
      </div>
      {required && (
        <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">Required</span>
      )}
    </div>
  );
}

function NavCard({ title, link }: { title: string; link: string }) {
  return (
    <Link
      to={link}
      className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 hover:shadow-md hover:border-slate-300 transition-all text-center"
    >
      <h3 className="font-semibold text-slate-900">{title}</h3>
    </Link>
  );
}
