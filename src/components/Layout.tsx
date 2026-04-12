import { Link, useLocation } from 'react-router-dom';

const NAV_ITEMS = [
  { path: '/projects', label: 'Projects' },
  { path: '/dossier', label: 'Dossier' },
  { path: '/world', label: 'World' },
  { path: '/outline', label: 'Outline' },
  { path: '/write', label: 'Write' },
  { path: '/story-bible', label: 'Story Bible' },
  { path: '/style-anchors', label: 'Style' },
  { path: '/prohibited-words', label: 'Words' },
  { path: '/consistency', label: 'Consistency' },
  { path: '/logic-checks', label: 'Logic' },
  { path: '/export', label: 'Export' },
  { path: '/settings', label: 'Settings' },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <Link to="/" className="flex items-center px-2 text-slate-900 font-bold text-xl">
                Novel Writer
              </Link>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-6">
                {NAV_ITEMS.map(item => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                      isActive(item.path)
                        ? 'border-primary-500 text-slate-900'
                        : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
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
      <main>{children}</main>
    </div>
  );
}
