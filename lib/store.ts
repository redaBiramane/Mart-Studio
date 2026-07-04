// ============================================================
// Mart Studio — Zustand Store (auth + sync Supabase + mode local)
// ============================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { WorkshopSession, WorkshopStore, ChatMessage } from './types';
import { supabase, isSupabaseConfigured } from './supabase';

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
    mode: 'batch',
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

const defaultLLMSettings = {
  provider: 'anthropic' as const,
  apiKey: '',
  model: 'claude-opus-4-8',
  customBaseUrl: '',
};

// ---- Supabase sync helpers ----------------------------------------------

let saveTimer: ReturnType<typeof setTimeout> | null = null;

async function upsertProduct(session: WorkshopSession, userId: string, email: string) {
  if (!supabase) return;
  await supabase.from('data_products').upsert({
    id: session.id,
    owner_id: userId,
    owner_email: email,
    name: session.productName || 'Nouveau produit',
    domain: session.domain || null,
    status: session.status,
    data: session,
    updated_at: new Date().toISOString(),
  });
}

export const useWorkshopStore = create<WorkshopStore>()(
  persist(
    (set, get) => ({
      session: null,
      sessions: [],
      llmSettings: defaultLLMSettings,
      isLoading: false,
      isSending: false,
      currentPage: 'dashboard',

      authReady: false,
      user: null,
      accessToken: null,
      profile: null,
      authError: null,
      adminProducts: [],
      adminProfiles: [],
      activityLogs: [],
      myLogs: [],
      stepQuestions: {},

      setCurrentPage: (page) => set({ currentPage: page }),

      // ---- Auth ------------------------------------------------------------

      initAuth: async () => {
        if (!isSupabaseConfigured || !supabase) {
          set({ authReady: true });
          return;
        }
        const { data } = await supabase.auth.getSession();
        const sUser = data.session?.user;
        if (sUser) {
          const { data: prof } = await supabase.from('profiles').select('*').eq('id', sUser.id).single();
          if (prof?.role === 'banned') {
            await supabase.auth.signOut();
            set({ user: null, profile: null, authReady: true });
            return;
          }
          set({ user: { id: sUser.id, email: sUser.email || '' }, accessToken: data.session?.access_token ?? null });
          if (prof) set({ profile: prof });
          await get().loadUserSessions();
          await get().loadStepQuestions();
          await get().loadMyLogs();
          if (prof?.role === 'admin') await get().loadAdminData();
        }
        supabase.auth.onAuthStateChange((_event, sess) => {
          const u = sess?.user;
          if (u) {
            set({ user: { id: u.id, email: u.email || '' }, accessToken: sess?.access_token ?? null });
          } else {
            set({ user: null, profile: null, accessToken: null, sessions: [], session: null });
          }
        });
        set({ authReady: true });
      },

      signIn: async (email, password) => {
        if (!supabase) return false;
        set({ authError: null });
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error || !data.user) {
          set({ authError: error?.message || 'Connexion impossible.' });
          return false;
        }
        const { data: prof } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
        if (prof?.role === 'banned') {
          await supabase.auth.signOut();
          set({ user: null, profile: null, authError: 'Votre compte a été suspendu. Contactez un administrateur.' });
          return false;
        }
        set({ user: { id: data.user.id, email: data.user.email || '' }, accessToken: data.session?.access_token ?? null });
        if (prof) set({ profile: prof });
        await get().loadUserSessions();
        await get().loadStepQuestions();
        await get().loadMyLogs();
        if (prof?.role === 'admin') await get().loadAdminData();
        await get().logActivity('login');
        return true;
      },

      signUp: async (email, password, fullName) => {
        if (!supabase) return 'Supabase non configuré.';
        set({ authError: null });
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (error) {
          set({ authError: error.message });
          return error.message;
        }
        // Si la confirmation email est désactivée, l'utilisateur a une session directe.
        if (data.session?.user) {
          set({ user: { id: data.session.user.id, email: data.session.user.email || '' }, accessToken: data.session.access_token ?? null });
          const { data: prof } = await supabase.from('profiles').select('*').eq('id', data.session.user.id).single();
          if (prof) set({ profile: prof });
          await get().logActivity('signup');
          return null;
        }
        return 'Compte créé. Vérifiez votre email pour confirmer, puis connectez-vous.';
      },

      resetPassword: async (email) => {
        if (!supabase) return 'Supabase non configuré.';
        const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}` : undefined;
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
        if (error) return error.message;
        return null;
      },

      signOut: async () => {
        await get().logActivity('logout');
        if (supabase) await supabase.auth.signOut();
        set({ user: null, accessToken: null, profile: null, session: null, sessions: [], adminProducts: [], adminProfiles: [], activityLogs: [], myLogs: [], currentPage: 'dashboard' });
      },

      loadUserSessions: async () => {
        const { user } = get();
        if (!supabase || !user) return;
        const { data } = await supabase
          .from('data_products')
          .select('id, owner_id, data')
          .order('updated_at', { ascending: false });
        if (!data) return;
        const mine = data.filter((r) => r.owner_id === user.id).map((r) => r.data as WorkshopSession);
        set({ sessions: mine });
      },

      loadAdminData: async () => {
        if (!supabase) return;
        const [{ data: products }, { data: profiles }, { data: logs }] = await Promise.all([
          supabase.from('data_products').select('id, owner_email, name, domain, status, created_at, updated_at').order('updated_at', { ascending: false }),
          supabase.from('profiles').select('*').order('created_at', { ascending: false }),
          supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(200),
        ]);
        set({
          adminProducts: products || [],
          adminProfiles: profiles || [],
          activityLogs: logs || [],
        });
      },

      logActivity: async (action, detail) => {
        const { user } = get();
        if (!supabase || !user) return;
        await supabase.from('activity_logs').insert({
          user_id: user.id,
          user_email: user.email,
          action,
          detail: detail || null,
        });
      },

      // ---- Admin : gestion des utilisateurs --------------------------------

      setUserRole: async (id, role) => {
        if (!supabase) return 'Supabase non configuré.';
        const { error, data } = await supabase.from('profiles').update({ role }).eq('id', id).select();
        if (error) return error.message;
        if (!data || data.length === 0) return 'Aucune ligne modifiée (droits RLS insuffisants ?).';
        await get().logActivity(role === 'banned' ? 'ban_user' : 'set_role', `${id} → ${role}`);
        await get().loadAdminData();
        return null;
      },

      // ---- Admin : consultation d'une conversation (lecture seule) ---------

      fetchConversation: async (productId) => {
        if (!supabase) return [];
        const { data } = await supabase.from('data_products').select('data, name').eq('id', productId).single();
        const msgs = ((data?.data as WorkshopSession | undefined)?.messages || []) as ChatMessage[];
        // Traçabilité : on journalise l'accès admin à une conversation.
        await get().logActivity('view_conversation', (data?.name as string) || productId);
        return msgs;
      },

      // Logs adressés à l'utilisateur courant (ex. réponses à ses idées)
      loadMyLogs: async () => {
        if (!supabase) return;
        const { user } = get();
        if (!user) return;
        const { data } = await supabase.from('activity_logs').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50);
        set({ myLogs: data || [] });
      },

      // Réponse admin à une idée : crée un log ADRESSÉ à l'auteur (il le verra en notif)
      replyToIdea: async (submitterId, submitterEmail, replyText, ideaText) => {
        if (!supabase) return;
        await supabase.from('activity_logs').insert({
          user_id: submitterId,
          user_email: submitterEmail,
          action: 'idea_reply',
          detail: `Réponse à votre idée « ${ideaText.slice(0, 90)} » : ${replyText}`,
        });
        await get().logActivity('reply_idea', submitterEmail || submitterId);
        await get().loadAdminData();
      },

      fetchStatsData: async () => {
        if (!supabase) return [];
        const { data } = await supabase.from('data_products').select('status, data');
        return (data || []).map((r) => {
          const s = r.data as WorkshopSession | undefined;
          const msgSteps = (s?.messages || []).filter((m) => !m.content.startsWith('[SYSTÈME]')).map((m) => m.step);
          return { status: (r.status as string) || 'active', currentStep: s?.currentStep || 1, msgSteps };
        });
      },

      // ---- Questions de l'atelier (pilotées par l'admin) -------------------

      loadStepQuestions: async () => {
        if (!supabase) return;
        const { data } = await supabase.from('step_questions').select('*').order('step').order('position');
        if (!data) return;
        const byStep: Record<number, import('./types').StepQuestion[]> = {};
        data.forEach((q) => { (byStep[q.step] = byStep[q.step] || []).push(q); });
        set({ stepQuestions: byStep });
      },

      addStepQuestion: async (step, text) => {
        if (!supabase) return;
        const pos = get().stepQuestions[step]?.length || 0;
        await supabase.from('step_questions').insert({ step, position: pos, text });
        await get().loadStepQuestions();
        await get().loadMyLogs();
      },

      updateStepQuestion: async (id, text) => {
        if (!supabase) return;
        await supabase.from('step_questions').update({ text }).eq('id', id);
        await get().loadStepQuestions();
        await get().loadMyLogs();
      },

      deleteStepQuestion: async (id) => {
        if (!supabase) return;
        await supabase.from('step_questions').delete().eq('id', id);
        await get().loadStepQuestions();
        await get().loadMyLogs();
      },

      seedStepQuestions: async (step, texts) => {
        if (!supabase) return;
        const rows = texts.map((text, i) => ({ step, position: i, text }));
        if (rows.length) await supabase.from('step_questions').insert(rows);
        await get().loadStepQuestions();
        await get().loadMyLogs();
      },

      // Remplace TOUTES les questions d'une étape par la liste fournie (ordre inclus).
      saveStepQuestions: async (step, texts) => {
        if (!supabase) return;
        await supabase.from('step_questions').delete().eq('step', step);
        const rows = texts.map((t) => t.trim()).filter(Boolean).map((text, i) => ({ step, position: i, text }));
        if (rows.length) await supabase.from('step_questions').insert(rows);
        await get().loadStepQuestions();
        await get().loadMyLogs();
      },

      deleteUser: async (id) => {
        if (!supabase) return;
        // Suppression complète (profil + données + compte Auth) via la route serveur
        // qui détient la clé service_role. Repli client si non configurée.
        let serverOk = false;
        try {
          const { data: sess } = await supabase.auth.getSession();
          const token = sess.session?.access_token;
          if (token) {
            const res = await fetch('/api/admin/delete-user', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ userId: id }),
            });
            serverOk = res.ok;
          }
        } catch { serverOk = false; }

        if (!serverOk) {
          // Repli : retire au moins le profil et ses Data Products (le compte Auth subsiste).
          await supabase.from('data_products').delete().eq('owner_id', id);
          await supabase.from('profiles').delete().eq('id', id);
        }
        await get().logActivity('delete_user', id);
        await get().loadAdminData();
      },

      // ---- Sessions --------------------------------------------------------

      createSession: (mode: 'batch' | 'guided' = 'batch') => {
        const newSession = { ...createEmptySession(), mode };
        set((state) => ({
          session: newSession,
          sessions: [newSession, ...state.sessions],
        }));
        const { user } = get();
        if (user) {
          upsertProduct(newSession, user.id, user.email);
          get().logActivity('create_product', newSession.productName || 'Nouveau produit');
        }
      },

      loadSession: (id: string) => {
        const { sessions } = get();
        const found = sessions.find((s) => s.id === id);
        if (found) {
          set({ session: found });
        }
      },

      duplicateSession: (id: string) => {
        const { sessions } = get();
        const src = sessions.find((s) => s.id === id);
        if (!src) return;
        const now = Date.now();
        const copy: WorkshopSession = {
          ...src,
          id: generateId(),
          createdAt: now,
          updatedAt: now,
          productName: `${src.productName || 'Data Product'} (copie)`,
        };
        set((state) => ({
          session: copy,
          sessions: [copy, ...state.sessions],
        }));
        const { user } = get();
        if (user) {
          upsertProduct(copy, user.id, user.email);
          get().logActivity('duplicate_product', copy.productName);
        }
      },

      setCurrentStep: (step: number) => {
        set((state) => {
          if (!state.session) return state;
          const updatedSession = { ...state.session, currentStep: step, updatedAt: Date.now() };
          return {
            session: updatedSession,
            sessions: state.sessions.map((s) => (s.id === updatedSession.id ? updatedSession : s)),
          };
        });
        scheduleSave(get);
      },

      addMessage: (message: ChatMessage) => {
        set((state) => {
          if (!state.session) return state;
          const updatedSession = { ...state.session, messages: [...state.session.messages, message], updatedAt: Date.now() };
          return {
            session: updatedSession,
            sessions: state.sessions.map((s) => (s.id === updatedSession.id ? updatedSession : s)),
          };
        });
        scheduleSave(get);
      },

      updateSessionData: (data: Partial<WorkshopSession>) => {
        set((state) => {
          if (!state.session) return state;
          const updatedSession = { ...state.session, ...data, updatedAt: Date.now() };
          return {
            session: updatedSession,
            sessions: state.sessions.map((s) => (s.id === updatedSession.id ? updatedSession : s)),
          };
        });
        scheduleSave(get);
      },

      completeSession: () => {
        set((state) => {
          if (!state.session) return state;
          const updatedSession = { ...state.session, status: 'completed' as const, updatedAt: Date.now() };
          return {
            session: updatedSession,
            sessions: state.sessions.map((s) => (s.id === updatedSession.id ? updatedSession : s)),
          };
        });
        const { session, user } = get();
        if (session && user) {
          upsertProduct(session, user.id, user.email);
          get().logActivity('complete_product', session.productName || '');
        }
      },

      deleteSession: (id: string) => {
        set((state) => ({
          session: state.session?.id === id ? null : state.session,
          sessions: state.sessions.filter((s) => s.id !== id),
        }));
        const { user } = get();
        if (supabase && user) {
          supabase.from('data_products').delete().eq('id', id).then(() => {});
          get().logActivity('delete_product', id);
        }
      },

      updateLLMSettings: (settings) => {
        set((state) => ({ llmSettings: { ...state.llmSettings, ...settings } }));
      },

      setLoading: (loading: boolean) => set({ isLoading: loading }),
      setSending: (sending: boolean) => set({ isSending: sending }),
    }),
    {
      name: 'mart-studio-sessions',
      // En mode Supabase, la base est la source de vérité ; on ne persiste
      // localement que les réglages LLM et le cache des sessions (mode hors-ligne).
      partialize: (state) => ({
        sessions: state.sessions,
        llmSettings: state.llmSettings,
      }),
    }
  )
);

// Debounced save of the active session to Supabase (avoids flooding writes
// while data is extracted step by step).
function scheduleSave(get: () => WorkshopStore) {
  if (!isSupabaseConfigured) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const { session, user } = get();
    if (session && user) upsertProduct(session, user.id, user.email);
  }, 1200);
}
