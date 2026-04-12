import { create } from 'zustand';

interface AppState {
  currentProjectId: string | null;
  setCurrentProjectId: (id: string | null) => void;
  currentOutlineId: string | null;
  setCurrentOutlineId: (id: string | null) => void;
}

const stored = {
  projectId: localStorage.getItem('currentProjectId'),
  outlineId: localStorage.getItem('currentOutlineId'),
};

export const useStore = create<AppState>((set) => ({
  currentProjectId: stored.projectId,
  setCurrentProjectId: (id) => {
    if (id) localStorage.setItem('currentProjectId', id);
    else localStorage.removeItem('currentProjectId');
    set({ currentProjectId: id });
  },
  currentOutlineId: stored.outlineId,
  setCurrentOutlineId: (id) => {
    if (id) localStorage.setItem('currentOutlineId', id);
    else localStorage.removeItem('currentOutlineId');
    set({ currentOutlineId: id });
  },
}));
