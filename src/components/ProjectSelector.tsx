import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { Database } from '../lib/database.types';

type Project = Database['public']['Tables']['projects']['Row'];

export default function ProjectSelector() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
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

      if (data && data.length > 0 && !currentProjectId) {
        setCurrentProjectId(data[0].id);
      }
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="text-sm text-slate-600">Loading...</div>;

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="project-select" className="text-sm font-medium text-slate-700">
        Project:
      </label>
      <select
        id="project-select"
        value={currentProjectId || ''}
        onChange={(e) => setCurrentProjectId(e.target.value || null)}
        className="block rounded-md border-slate-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
      >
        {projects.length === 0 && <option value="">No projects</option>}
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.title}
          </option>
        ))}
      </select>
    </div>
  );
}
