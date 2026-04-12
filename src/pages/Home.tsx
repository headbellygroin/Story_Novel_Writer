import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-slate-900 mb-4">
            Novel Writer
          </h1>
          <p className="text-xl text-slate-600 mb-8">
            AI-Powered Novel Writing Studio - Uncensored Local Models
          </p>
          <Link
            to="/projects"
            className="inline-block px-8 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium text-lg"
          >
            Get Started
          </Link>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-12">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Recommended Models (Uncensored)</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-slate-900 mb-2">Best for Creative Writing</h3>
                <ul className="space-y-2 text-sm text-slate-700">
                  <li className="flex items-start">
                    <span className="text-green-600 mr-2">▸</span>
                    <div><strong>MythoMax 13B</strong> - Creative, uncensored, excellent for fiction (8-16GB VRAM)</div>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-600 mr-2">▸</span>
                    <div><strong>Nous Hermes 2 Yi 34B</strong> - Very coherent, follows outline well (20GB+ VRAM)</div>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-600 mr-2">▸</span>
                    <div><strong>Goliath 120B</strong> - Top tier if you have VRAM (48GB+)</div>
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 mb-2">Budget Options</h3>
                <ul className="space-y-2 text-sm text-slate-700">
                  <li className="flex items-start">
                    <span className="text-blue-600 mr-2">▸</span>
                    <div><strong>Mistral 7B Instruct</strong> - Fast, runs on 6-8GB VRAM</div>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Quick Start</h2>
            <ol className="space-y-3 text-sm text-slate-700">
              <li className="flex items-start">
                <span className="bg-primary-100 text-primary-700 rounded-full w-6 h-6 flex items-center justify-center mr-3 flex-shrink-0 font-semibold text-xs">1</span>
                <div><strong>Download Model:</strong> Use text-generation-webui or LM Studio</div>
              </li>
              <li className="flex items-start">
                <span className="bg-primary-100 text-primary-700 rounded-full w-6 h-6 flex items-center justify-center mr-3 flex-shrink-0 font-semibold text-xs">2</span>
                <div><strong>Create Project:</strong> Set title, genre, and description</div>
              </li>
              <li className="flex items-start">
                <span className="bg-primary-100 text-primary-700 rounded-full w-6 h-6 flex items-center justify-center mr-3 flex-shrink-0 font-semibold text-xs">3</span>
                <div><strong>Build World:</strong> Add characters, places, items, tech/magic</div>
              </li>
              <li className="flex items-start">
                <span className="bg-primary-100 text-primary-700 rounded-full w-6 h-6 flex items-center justify-center mr-3 flex-shrink-0 font-semibold text-xs">4</span>
                <div><strong>Outline Story:</strong> Create synopsis, chapters, scenes</div>
              </li>
              <li className="flex items-start">
                <span className="bg-primary-100 text-primary-700 rounded-full w-6 h-6 flex items-center justify-center mr-3 flex-shrink-0 font-semibold text-xs">5</span>
                <div><strong>Configure AI:</strong> Set endpoint and parameters</div>
              </li>
              <li className="flex items-start">
                <span className="bg-primary-100 text-primary-700 rounded-full w-6 h-6 flex items-center justify-center mr-3 flex-shrink-0 font-semibold text-xs">6</span>
                <div><strong>Write:</strong> Generate with AI or write manually</div>
              </li>
            </ol>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <FeatureCard title="Projects" description="Organize your novels" icon="📚" link="/projects" />
          <FeatureCard title="World Library" description="Characters, places, items, tech/magic" icon="🌍" link="/world" />
          <FeatureCard title="Story Outline" description="Chapter and scene planning" icon="📝" link="/outline" />
          <FeatureCard title="AI Writing" description="Context-aware generation" icon="✨" link="/write" />
        </div>

        <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-white mb-4">Why Local Models?</h2>
          <div className="grid md:grid-cols-3 gap-6 text-sm text-slate-200">
            <div>
              <h3 className="font-semibold text-white mb-2">No Censorship</h3>
              <p>Write mature content, violence, complex themes without refusals or sanitization</p>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-2">Complete Privacy</h3>
              <p>Your novel never leaves your machine. No cloud services or data collection</p>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-2">No Limits</h3>
              <p>Generate unlimited content. No token costs or rate limits</p>
            </div>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
          <h3 className="font-semibold text-amber-900 mb-3">Setup Resources</h3>
          <ul className="space-y-1 text-sm text-amber-800">
            <li>• <strong>text-generation-webui</strong>: github.com/oobabooga/text-generation-webui</li>
            <li>• <strong>LM Studio</strong>: lmstudio.ai (User-friendly)</li>
            <li>• <strong>Models</strong>: huggingface.co (search GGUF models)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ title, description, icon, link }: { title: string; description: string; icon: string; link: string }) {
  return (
    <Link
      to={link}
      className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow"
    >
      <div className="text-4xl mb-3">{icon}</div>
      <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
      <p className="text-sm text-slate-600">{description}</p>
    </Link>
  );
}
