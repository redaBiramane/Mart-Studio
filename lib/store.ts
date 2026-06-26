// ============================================================
// Mart Studio — Zustand Store
// ============================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { WorkshopSession, WorkshopStore, ChatMessage } from './types';

function generateId(): string {
  return `ws_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function createEmptySession(): WorkshopSession {
  const now = Date.now();
  return {
    id: generateId(),
    createdAt: now,
    updatedAt: now,
    currentStep: 1,
    status: 'active',
    productName: '',
    businessProblem: '',
    objective: '',
    users: [],
    domain: '',
    productOwner: '',
    dataSteward: '',
    businessDecision: '',
    frequency: '',
    existingSimilar: '',
    contextSummary: '',
    entities: [],
    granularity: null,
    relations: [],
    attributes: [],
    kpis: [],
    businessRules: [],
    dataSources: [],
    qualityRules: [],
    governance: null,
    architecture: null,
    maturityScores: null,
    validationNotes: [],
    messages: [],
  };
}

export const useWorkshopStore = create<WorkshopStore>()(
  persist(
    (set, get) => ({
      session: null,
      sessions: [],
      isLoading: false,
      isSending: false,

      createSession: () => {
        const newSession = createEmptySession();
        set((state) => ({
          session: newSession,
          sessions: [newSession, ...state.sessions],
        }));
      },

      loadSession: (id: string) => {
        const { sessions } = get();
        const found = sessions.find((s) => s.id === id);
        if (found) {
          set({ session: found });
        }
      },

      setCurrentStep: (step: number) => {
        set((state) => {
          if (!state.session) return state;
          const updatedSession = {
            ...state.session,
            currentStep: step,
            updatedAt: Date.now(),
          };
          return {
            session: updatedSession,
            sessions: state.sessions.map((s) =>
              s.id === updatedSession.id ? updatedSession : s
            ),
          };
        });
      },

      addMessage: (message: ChatMessage) => {
        set((state) => {
          if (!state.session) return state;
          const updatedSession = {
            ...state.session,
            messages: [...state.session.messages, message],
            updatedAt: Date.now(),
          };
          return {
            session: updatedSession,
            sessions: state.sessions.map((s) =>
              s.id === updatedSession.id ? updatedSession : s
            ),
          };
        });
      },

      updateSessionData: (data: Partial<WorkshopSession>) => {
        set((state) => {
          if (!state.session) return state;
          const updatedSession = {
            ...state.session,
            ...data,
            updatedAt: Date.now(),
          };
          return {
            session: updatedSession,
            sessions: state.sessions.map((s) =>
              s.id === updatedSession.id ? updatedSession : s
            ),
          };
        });
      },

      completeSession: () => {
        set((state) => {
          if (!state.session) return state;
          const updatedSession = {
            ...state.session,
            status: 'completed' as const,
            updatedAt: Date.now(),
          };
          return {
            session: updatedSession,
            sessions: state.sessions.map((s) =>
              s.id === updatedSession.id ? updatedSession : s
            ),
          };
        });
      },

      deleteSession: (id: string) => {
        set((state) => ({
          session: state.session?.id === id ? null : state.session,
          sessions: state.sessions.filter((s) => s.id !== id),
        }));
      },

      setLoading: (loading: boolean) => set({ isLoading: loading }),
      setSending: (sending: boolean) => set({ isSending: sending }),
    }),
    {
      name: 'mart-studio-sessions',
      partialize: (state) => ({
        sessions: state.sessions,
      }),
    }
  )
);
