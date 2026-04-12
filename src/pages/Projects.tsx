import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { Database } from '../lib/database.types';

type Project = Database['public']['Tables']['projects']['Row'];

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ title: '', description: '', genre: '' });
  const { currentProjectId, setCurrentProjectId } = useStore();

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  }

  async function createProject() {
    try {
      const { data, error } = await supabase
        .from('projects')
        .insert([formData])
        .select()
        .single();

      if (error) throw error;

      setProjects([data, ...projects]);
      setCurrentProjectId(data.id);
      setShowForm(false);
      setFormData({ title: '', description: '', genre: '' });
    } catch (error) {
      console.error('Error creating project:', error);
    }
  }

  async function deleteProject(id: string) {
    if (!confirm('Are you sure? This will delete all associated data.')) return;

    try {
      const { error } = await supabase.from('projects').delete().eq('id', id);

      if (error) throw error;
      setProjects(projects.filter((p) => p.id !== id));
    } catch (error) {
      console.error('Error deleting project:', error);
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center text-slate-600">Loading projects...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Projects</h1>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          New Project
        </button>
      </div>

      {showForm && (
        <div className="mb-8 bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-semibold mb-4">Create New Project</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Title
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="My Epic Novel"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Genre
              </label>
              <input
                type="text"
                value={formData.genre}
                onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Fantasy, Sci-Fi, Mystery..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="A brief description of your novel..."
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={createProject}
                disabled={!formData.title}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Create
              </button>
              <button
                onClick={() => {
                  setShowForm(false);
                  setFormData({ title: '', description: '', genre: '' });
                }}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => {
          const isActive = currentProjectId === project.id;
          return (
            <div
              key={project.id}
              className={`bg-white rounded-lg shadow-sm border-2 p-6 hover:shadow-md transition-all ${
                isActive ? 'border-primary-500 ring-1 ring-primary-200' : 'border-slate-200'
              }`}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-semibold text-slate-900">{project.title}</h3>
                  {isActive && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-primary-100 text-primary-700 rounded-full">
                      Active
                    </span>
                  )}
                </div>
                <button
                  onClick={() => deleteProject(project.id)}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  Delete
                </button>
              </div>
              {project.genre && (
                <div className="text-sm text-primary-600 mb-2">{project.genre}</div>
              )}
              {project.description && (
                <p className="text-slate-600 text-sm mb-4 line-clamp-3">{project.description}</p>
              )}
              <div className="flex justify-between items-center mt-4">
                <div className="text-xs text-slate-500">
                  Updated {new Date(project.updated_at).toLocaleDateString()}
                </div>
                {!isActive && (
                  <button
                    onClick={() => setCurrentProjectId(project.id)}
                    className="px-3 py-1.5 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-primary-50 hover:text-primary-700 transition-colors"
                  >
                    Select
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {projects.length === 0 && !showForm && (
        <div className="text-center py-12">
          <p className="text-slate-600 mb-4">No projects yet. Create your first novel project!</p>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Create Project
          </button>
        </div>
      )}
    </div>
  );
}
