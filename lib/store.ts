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
  provider: 'google' as const,
  apiKey: '', // vide → utilise la clé plateforme (GEMINI_API_KEY), gratuit pour tous
  model: 'gemini-2.0-flash',
  customBaseUrl: '',
};

// Préférences de profil : stockées PAR UTILISATEUR (clé locale dédiée), jamais
// partagées entre comptes sur un même navigateur.
const DEFAULT_PREFS: import('./types').ProfilePrefs = {
  avatarColor: '#0D9488', avatarEmoji: '', avatarPhoto: '',
  notifShare: true, notifProduct: true, compact: false, defaultMode: 'guided',
};
const PREFS_KEY = (uid: string) => `mart-profile-prefs:${uid}`;
function loadPrefs(uid: string): import('./types').ProfilePrefs {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(PREFS_KEY(uid)) : null;
    if (raw) return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_PREFS };
}
function savePrefs(uid: string, p: import('./types').ProfilePrefs) {
  try { localStorage.setItem(PREFS_KEY(uid), JSON.stringify(p)); } catch { /* ignore */ }
}

// Réglages LLM : stockés PAR UTILISATEUR. Un nouvel utilisateur repart sur le
// défaut (Gemini gratuit), sans hériter de la clé d'un autre compte du navigateur.
const LLM_KEY = (uid: string) => `mart-llm:${uid}`;
function loadLLM(uid: string): import('./types').LLMSettings {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LLM_KEY(uid)) : null;
    if (raw) return { ...defaultLLMSettings, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...defaultLLMSettings };
}
function saveLLM(uid: string, s: import('./types').LLMSettings) {
  try { localStorage.setItem(LLM_KEY(uid), JSON.stringify(s)); } catch { /* ignore */ }
}

// ---- Supabase sync helpers ----------------------------------------------

let saveTimer: ReturnType<typeof setTimeout> | null = null;

// ---- Historique (undo/redo) ---------------------------------------------
const HISTORY_MAX = 40;
let lastSnapshotAt = 0; // pour regrouper les frappes rapides en un seul pas d'annulation
// Instantané du MODÈLE (tout sauf les messages du chat), pour restaurer sans toucher la conversation.
function modelSnapshot(s: WorkshopSession): Partial<WorkshopSession> {
  const { messages: _messages, ...rest } = s;
  void _messages;
  return rest;
}

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
      past: [],
      future: [],
      currentPage: 'dashboard',
      chatDraft: null,
      seenShared: [],
      profilePrefs: { ...DEFAULT_PREFS },

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
      steps: null,
      sharedInfo: {},

      setCurrentPage: (page) => set({ currentPage: page }),
      setChatDraft: (text) => set({ chatDraft: text }),

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
          get().loadProfilePrefs(sUser.id); get().loadLLMSettings(sUser.id);
          if (prof) set({ profile: prof });
          await get().loadUserSessions();
          await get().loadStepQuestions();
          await get().loadSteps();
          await get().loadMyLogs();
          if (prof?.role === 'admin') await get().loadAdminData();
        }
        supabase.auth.onAuthStateChange((_event, sess) => {
          const u = sess?.user;
          if (u) {
            set({ user: { id: u.id, email: u.email || '' }, accessToken: sess?.access_token ?? null });
            get().loadProfilePrefs(u.id); get().loadLLMSettings(u.id);
          } else {
            set({ user: null, profile: null, accessToken: null, sessions: [], session: null, profilePrefs: { ...DEFAULT_PREFS } });
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
        get().loadProfilePrefs(data.user.id); get().loadLLMSettings(data.user.id);
        if (prof) set({ profile: prof });
        await get().loadUserSessions();
        await get().loadStepQuestions();
        await get().loadSteps();
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
        set({ user: null, accessToken: null, profile: null, session: null, sessions: [], adminProducts: [], adminProfiles: [], activityLogs: [], myLogs: [], currentPage: 'dashboard', profilePrefs: { ...DEFAULT_PREFS }, llmSettings: { ...defaultLLMSettings } });
      },

      loadUserSessions: async () => {
        const { user } = get();
        if (!supabase || !user) return;
        // Produits partagés AVEC MOI (id → rôle/propriétaire)
        const { data: mem } = await supabase
          .from('product_members')
          .select('product_id, role')
          .eq('user_id', user.id);
        const memberRole: Record<string, 'viewer' | 'editor'> = {};
        (mem || []).forEach((m) => { memberRole[m.product_id] = m.role as 'viewer' | 'editor'; });
        const memberIds = new Set(Object.keys(memberRole));

        const { data } = await supabase
          .from('data_products')
          .select('id, owner_id, owner_email, data')
          .order('updated_at', { ascending: false });
        if (!data) return;
        // Les miens + ceux partagés avec moi (RLS renvoie déjà tout pour l'admin ;
        // on filtre côté client pour ne garder QUE mes produits et mes partages).
        const visible = data.filter((r) => r.owner_id === user.id || memberIds.has(r.id));
        const sessions = visible.map((r) => r.data as WorkshopSession);
        const sharedInfo: Record<string, { role: 'viewer' | 'editor'; ownerEmail: string }> = {};
        visible.forEach((r) => {
          if (r.owner_id !== user.id && memberIds.has(r.id)) {
            sharedInfo[r.id] = { role: memberRole[r.id], ownerEmail: r.owner_email || '' };
          }
        });
        set({ sessions, sharedInfo });
      },

      // Partager un produit avec un collègue (par email). Renvoie un code :
      // 'ok' | 'not_found' | 'self' | 'not_owner' | 'error'.
      shareProduct: async (productId, email, role) => {
        if (!supabase) return 'error';
        const { data, error } = await supabase.rpc('share_product', {
          pid: productId, target_email: email, member_role: role,
        });
        if (error) {
          console.error('share_product error:', error);
          // Remonte le message SQL réel (ex. « function share_product does not exist »
          // = migration non exécutée dans Supabase).
          return `err:${error.message || 'inconnue'}`;
        }
        if (data === 'ok') get().loadMyLogs(); // rafraîchit la cloche de l'émetteur
        return (data as string) || 'error';
      },

      listShareableUsers: async () => {
        if (!supabase) return [];
        const { data, error } = await supabase.rpc('list_shareable_users');
        if (error) { console.error('list_shareable_users error:', error); return []; }
        return (data as { id: string; email: string; full_name: string }[]) || [];
      },

      unshareProduct: async (productId, userId) => {
        if (!supabase) return;
        await supabase.from('product_members').delete().eq('product_id', productId).eq('user_id', userId);
      },

      loadProductMembers: async (productId) => {
        if (!supabase) return [];
        const { data } = await supabase
          .from('product_members')
          .select('product_id, user_id, user_email, role, created_at')
          .eq('product_id', productId)
          .order('created_at', { ascending: true });
        return (data as import('./types').ProductMember[]) || [];
      },

      // Un lecteur demande l'accès Éditeur → notifie le propriétaire.
      requestAccess: async (productId) => {
        if (!supabase) return 'error';
        const { data, error } = await supabase.rpc('request_access', { pid: productId });
        if (error) { console.error('request_access error:', error); return `err:${error.message || 'inconnue'}`; }
        return (data as string) || 'error';
      },

      // Le propriétaire accepte/refuse une demande d'accès.
      respondAccess: async (productId, requesterEmail, decision) => {
        if (!supabase) return 'error';
        const { data, error } = await supabase.rpc('respond_access', { pid: productId, requester_email: requesterEmail, decision });
        if (error) { console.error('respond_access error:', error); return `err:${error.message || 'inconnue'}`; }
        await get().loadMyLogs();        // retire la demande traitée de la cloche
        await get().loadUserSessions();  // recharge la liste (le nouveau membre voit son produit)
        return (data as string) || 'error';
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
        const { data } = await supabase.from('data_products').select('status, owner_email, name, data');
        return (data || []).map((r) => {
          const s = r.data as WorkshopSession | undefined;
          const msgSteps = (s?.messages || []).filter((m) => !m.content.startsWith('[SYSTÈME]')).map((m) => m.step);
          const tu = s?.tokenUsage || { input: 0, output: 0, total: 0, requests: 0 };
          return {
            status: (r.status as string) || 'active', currentStep: s?.currentStep || 1, msgSteps,
            ownerEmail: (r.owner_email as string) || '—', name: (r.name as string) || s?.productName || 'Data Product',
            tokens: tu, llmModel: s?.llmModel, llmProvider: s?.llmProvider,
          };
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

      // Étapes de l'atelier configurables par l'admin (fallback = constante STEPS).
      loadSteps: async () => {
        if (!supabase) return;
        const { data } = await supabase.from('app_config').select('value').eq('key', 'workshop_steps').maybeSingle();
        const steps = data?.value;
        if (Array.isArray(steps) && steps.length) set({ steps: steps as import('./types').StepDefinition[] });
      },

      saveSteps: async (steps) => {
        set({ steps });
        if (!supabase) return;
        await supabase.from('app_config').upsert({ key: 'workshop_steps', value: steps, updated_at: new Date().toISOString() });
        await get().logActivity('edit_steps', `${steps.length} étape(s)`);
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

      createSession: (mode: 'batch' | 'guided' | 'expert' = 'batch') => {
        const ls = get().llmSettings;
        const newSession = { ...createEmptySession(), mode, llmModel: ls?.model, llmProvider: ls?.provider };
        lastSnapshotAt = 0;
        set((state) => ({
          session: newSession,
          sessions: [newSession, ...state.sessions],
          past: [],
          future: [],
        }));
        const { user } = get();
        if (user) {
          upsertProduct(newSession, user.id, user.email);
          get().logActivity('create_product', newSession.productName || 'Nouveau produit');
        }
      },

      loadSession: (id: string) => {
        const { sessions, sharedInfo, seenShared } = get();
        const found = sessions.find((s) => s.id === id);
        if (found) {
          lastSnapshotAt = 0;
          // Un produit partagé qu'on ouvre pour la 1re fois n'est plus « nouveau ».
          const markSeen = sharedInfo[id] && !seenShared.includes(id);
          set({
            session: found, past: [], future: [],
            ...(markSeen ? { seenShared: [...seenShared, id] } : {}),
          });
        }
      },

      markSharedSeen: (id: string) => {
        const { seenShared } = get();
        if (!seenShared.includes(id)) set({ seenShared: [...seenShared, id] });
      },

      // Cumule la consommation de tokens sur le Data Product courant (métadonnée,
      // hors historique undo). Sauvegarde différée comme le reste.
      recordTokens: (input, output, total) => {
        set((state) => {
          if (!state.session) return state;
          const tu = state.session.tokenUsage || { input: 0, output: 0, total: 0, requests: 0 };
          const ls = state.llmSettings;
          const updated = {
            ...state.session,
            tokenUsage: {
              input: tu.input + (input || 0),
              output: tu.output + (output || 0),
              total: tu.total + (total || (input || 0) + (output || 0)),
              requests: tu.requests + 1,
            },
            llmModel: ls?.model || state.session.llmModel,
            llmProvider: ls?.provider || state.session.llmProvider,
          };
          return { session: updated, sessions: state.sessions.map((s) => (s.id === updated.id ? updated : s)) };
        });
        scheduleSave(get);
      },

      updateProfilePrefs: (p) => {
        const merged = { ...get().profilePrefs, ...p };
        set({ profilePrefs: merged });
        const uid = get().user?.id;
        if (uid) savePrefs(uid, merged); // persistance PAR utilisateur
      },

      loadProfilePrefs: (userId) => set({ profilePrefs: loadPrefs(userId) }),

      updateProfileName: async (fullName) => {
        const { user } = get();
        if (!supabase || !user) return 'Non connecté.';
        const { error } = await supabase.from('profiles').update({ full_name: fullName }).eq('id', user.id);
        if (error) return error.message;
        set((state) => ({ profile: state.profile ? { ...state.profile, full_name: fullName } : state.profile }));
        return null;
      },

      changePassword: async (newPassword) => {
        if (!supabase) return 'Service indisponible.';
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        return error ? error.message : null;
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
        lastSnapshotAt = 0;
        set((state) => ({
          session: copy,
          sessions: [copy, ...state.sessions],
          past: [],
          future: [],
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
          // Lecture seule : un produit partagé en 'viewer' ne peut pas être modifié
          // (verrou maître : couvre l'éditeur visuel, l'extraction, tout).
          if (state.sharedInfo[state.session.id]?.role === 'viewer') return state;
          // Historique : on capture l'état AVANT modification. Les frappes rapprochées
          // (< 700 ms) sont regroupées en un seul pas d'annulation.
          const now = Date.now();
          let past = state.past;
          if (now - lastSnapshotAt > 700) {
            past = [...state.past, modelSnapshot(state.session)].slice(-HISTORY_MAX);
          }
          lastSnapshotAt = now;
          const updatedSession = { ...state.session, ...data, updatedAt: Date.now() };
          return {
            session: updatedSession,
            sessions: state.sessions.map((s) => (s.id === updatedSession.id ? updatedSession : s)),
            past,
            future: [], // toute nouvelle modification annule le « rétablir »
          };
        });
        scheduleSave(get);
      },

      undo: () => {
        set((state) => {
          if (!state.session || state.past.length === 0) return state;
          const prev = state.past[state.past.length - 1];
          const restored = { ...state.session, ...prev, updatedAt: Date.now() };
          return {
            session: restored,
            sessions: state.sessions.map((s) => (s.id === restored.id ? restored : s)),
            past: state.past.slice(0, -1),
            future: [modelSnapshot(state.session), ...state.future].slice(0, HISTORY_MAX),
          };
        });
        lastSnapshotAt = 0; // la prochaine modification recréera un point d'annulation
        scheduleSave(get);
      },

      redo: () => {
        set((state) => {
          if (!state.session || state.future.length === 0) return state;
          const next = state.future[0];
          const restored = { ...state.session, ...next, updatedAt: Date.now() };
          return {
            session: restored,
            sessions: state.sessions.map((s) => (s.id === restored.id ? restored : s)),
            past: [...state.past, modelSnapshot(state.session)].slice(-HISTORY_MAX),
            future: state.future.slice(1),
          };
        });
        lastSnapshotAt = 0;
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
        const { session, user, sharedInfo } = get();
        if (session && user && sharedInfo[session.id]?.role !== 'viewer') {
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
        set((state) => {
          const merged = { ...state.llmSettings, ...settings };
          const uid = state.user?.id;
          if (uid) saveLLM(uid, merged); // persistance PAR utilisateur
          return { llmSettings: merged };
        });
      },

      loadLLMSettings: (userId) => set({ llmSettings: loadLLM(userId) }),

      setLoading: (loading: boolean) => set({ isLoading: loading }),
      setSending: (sending: boolean) => set({ isSending: sending }),
    }),
    {
      name: 'mart-studio-sessions',
      // v3 : les réglages LLM deviennent PAR UTILISATEUR (clé locale dédiée).
      // Sans fonction migrate, le bump de version fait écarter l'ancien état
      // persisté (dont l'ancienne clé LLM globale) → chacun repart sur Gemini.
      version: 3,
      // En mode Supabase, la base est la source de vérité ; on ne persiste
      // localement que les réglages LLM et le cache des sessions (mode hors-ligne).
      partialize: (state) => ({
        sessions: state.sessions,
        seenShared: state.seenShared,
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
    const { session, user, sharedInfo } = get();
    if (!session || !user) return;
    // Un produit partagé en LECTURE SEULE ne doit jamais être ré-écrit.
    if (sharedInfo[session.id]?.role === 'viewer') return;
    upsertProduct(session, user.id, user.email);
  }, 1200);
}
