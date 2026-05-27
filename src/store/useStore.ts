import { create } from 'zustand';

export interface BackgroundTask {
  id: string;
  label: string;
  status: 'running' | 'complete' | 'error';
  progress?: string;
  startedAt: number;
  completedAt?: number;
}

export interface VoiceChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface AppState {
  currentProjectId: string | null;
  setCurrentProjectId: (id: string | null) => void;
  currentOutlineId: string | null;
  setCurrentOutlineId: (id: string | null) => void;
  backgroundTasks: BackgroundTask[];
  addBackgroundTask: (task: Omit<BackgroundTask, 'startedAt'>) => void;
  updateBackgroundTask: (id: string, updates: Partial<BackgroundTask>) => void;
  removeBackgroundTask: (id: string) => void;
  dismissCompletedTasks: () => void;
  voiceChatMessages: VoiceChatMessage[];
  addVoiceChatMessage: (msg: VoiceChatMessage) => void;
  clearVoiceChatMessages: () => void;
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
  backgroundTasks: [],
  addBackgroundTask: (task) =>
    set((state) => ({
      backgroundTasks: [...state.backgroundTasks, { ...task, startedAt: Date.now() }],
    })),
  updateBackgroundTask: (id, updates) =>
    set((state) => ({
      backgroundTasks: state.backgroundTasks.map((t) =>
        t.id === id ? { ...t, ...updates } : t
      ),
    })),
  removeBackgroundTask: (id) =>
    set((state) => ({
      backgroundTasks: state.backgroundTasks.filter((t) => t.id !== id),
    })),
  dismissCompletedTasks: () =>
    set((state) => ({
      backgroundTasks: state.backgroundTasks.filter((t) => t.status === 'running'),
    })),
  voiceChatMessages: [],
  addVoiceChatMessage: (msg) =>
    set((state) => ({
      voiceChatMessages: [...state.voiceChatMessages, msg],
    })),
  clearVoiceChatMessages: () => set({ voiceChatMessages: [] }),
}));
