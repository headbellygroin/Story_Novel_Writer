import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { getEndpointConfig } from '../lib/endpointResolver';

const NAV_ITEMS = [
  { path: '/projects', label: 'Projects' },
  { path: '/manifesto', label: 'Manifesto' },
  { path: '/dossier', label: 'Dossier' },
  { path: '/world', label: 'World' },
  { path: '/series-wizard', label: 'Wizard' },
  { path: '/outline', label: 'Outline' },
  { path: '/write', label: 'Write' },
  { path: '/story-bible', label: 'Story Bible' },
  { path: '/style-anchors', label: 'Style' },
  { path: '/prohibited-words', label: 'Words' },
  { path: '/reveals', label: 'Reveals' },
  { path: '/consistency', label: 'Consistency' },
  { path: '/logic-checks', label: 'Logic' },
  { path: '/voice-chat', label: 'Voice' },
  { path: '/audiobook', label: 'Audio' },
  { path: '/pipeline', label: 'Pipeline' },
  { path: '/save-load', label: 'Save/Load' },
  { path: '/export', label: 'Export' },
  { path: '/settings', label: 'Settings' },
  { path: '/setup-guide', label: 'Guide' },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { backgroundTasks, removeBackgroundTask } = useStore();

  // Pre-resolve endpoints on mount so image URLs resolve correctly
  useEffect(() => { getEndpointConfig(); }, []);

  const isActive = (path: string) => location.pathname === path;
  const activeTasks = backgroundTasks.filter((t) => t.status === 'running');
  const completedTasks = backgroundTasks.filter(
    (t) => t.status === 'complete' || t.status === 'error'
  );

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">
      <nav className="flex-shrink-0 bg-white border-b border-slate-200 z-40 relative">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14">
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
              <Link to="/" className="flex-shrink-0 flex items-center px-2 text-slate-900 font-bold text-lg">
                Story Forge
              </Link>
              <div className="flex items-center gap-0.5 ml-4">
                {NAV_ITEMS.map(item => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex-shrink-0 inline-flex items-center px-2 py-1 rounded text-sm font-medium transition-colors ${
                      isActive(item.path)
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {(activeTasks.length > 0 || completedTasks.length > 0) && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
          {activeTasks.map((task) => (
            <div
              key={task.id}
              className="bg-white border border-slate-200 shadow-lg rounded-lg px-4 py-3 flex items-center gap-3"
            >
              <div className="w-2 h-2 bg-teal-500 rounded-full animate-pulse flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{task.label}</p>
                {task.progress && (
                  <p className="text-xs text-slate-500">{task.progress}</p>
                )}
              </div>
            </div>
          ))}
          {completedTasks.map((task) => (
            <div
              key={task.id}
              className={`border shadow-lg rounded-lg px-4 py-3 flex items-center gap-3 ${
                task.status === 'complete'
                  ? 'bg-green-50 border-green-200'
                  : 'bg-red-50 border-red-200'
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  task.status === 'complete' ? 'bg-green-500' : 'bg-red-500'
                }`}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">
                  {task.label} -- {task.status === 'complete' ? 'Done' : 'Failed'}
                </p>
              </div>
              <button
                onClick={() => removeBackgroundTask(task.id)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}

      <main className="flex-1 min-h-0 overflow-auto">{children}</main>
    </div>
  );
}
