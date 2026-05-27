import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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

export type ConnStatus = 'unchecked' | 'connected' | 'disconnected' | 'checking';

interface VoiceChatState {
  voice: string;
  rate: number;
  pitch: number;
  autoListen: boolean;
  isProcessing: boolean;
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
  voiceChatState: VoiceChatState;
  setVoiceChatState: (updates: Partial<VoiceChatState>) => void;
  aiConnStatus: ConnStatus;
  visionConnStatus: ConnStatus;
  comfyConnStatus: ConnStatus;
  setAiConnStatus: (s: ConnStatus) => void;
  setVisionConnStatus: (s: ConnStatus) => void;
  setComfyConnStatus: (s: ConnStatus) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      currentProjectId: null,
      setCurrentProjectId: (id) => set({ currentProjectId: id }),
      currentOutlineId: null,
      setCurrentOutlineId: (id) => set({ currentOutlineId: id }),
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
          voiceChatMessages: [...state.voiceChatMessages, msg].slice(-100),
        })),
      clearVoiceChatMessages: () => set({ voiceChatMessages: [] }),
      voiceChatState: { voice: '', rate: 1.0, pitch: 1.0, autoListen: false, isProcessing: false },
      setVoiceChatState: (updates) =>
        set((state) => ({
          voiceChatState: { ...state.voiceChatState, ...updates },
        })),
      aiConnStatus: 'unchecked',
      visionConnStatus: 'unchecked',
      comfyConnStatus: 'unchecked',
      setAiConnStatus: (s) => set({ aiConnStatus: s }),
      setVisionConnStatus: (s) => set({ visionConnStatus: s }),
      setComfyConnStatus: (s) => set({ comfyConnStatus: s }),
    }),
    {
      name: 'story-forge-store',
      partialize: (state) => ({
        currentProjectId: state.currentProjectId,
        currentOutlineId: state.currentOutlineId,
        voiceChatMessages: state.voiceChatMessages,
        voiceChatState: state.voiceChatState,
      }),
    }
  )
);
