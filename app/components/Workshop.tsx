'use client';

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useWorkshopStore } from '@/lib/store';
import { STEPS } from '@/lib/constants';
import StepSidebar from '@/app/components/StepSidebar';
import ContextPanel from '@/app/components/ContextPanel';
import VisualEditor from '@/app/components/VisualEditor';

const wsOverlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 210, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 };
const wsModal: React.CSSProperties = { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', width: 'min(460px, 100%)', padding: 26, boxShadow: '0 20px 60px rgba(0,0,0,0.35)' };

export default function Workshop({ onNew }: { onNew?: () => void }) {
  const { session, llmSettings, setCurrentStep, addMessage, updateSessionData, completeSession, setCurrentPage, stepQuestions, undo, redo, past, future } = useWorkshopStore();
  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  // Raccourcis clavier : Cmd/Ctrl+Z (annuler), Cmd/Ctrl+Shift+Z (rétablir),
  // sauf pendant l'édition de texte (on laisse l'annulation native du champ).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || e.key.toLowerCase() !== 'z') return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      e.preventDefault();
      if (e.shiftKey) redo(); else undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showContext, setShowContext] = useState(true);
  const [input, setInput] = useState('');
  const hasInitialized = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [visual, setVisual] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  const currentStep = session?.currentStep || 1;
  const stepDef = STEPS[currentStep - 1];

  const getMessageText = useCallback((message: any) => {
    if (!message || !message.parts) return '';
    return message.parts
      .filter((p: any) => p.type === 'text')
      .map((p: any) => p.text)
      .join('');
  }, []);

  // Create transport that dynamically fetches latest session data from the store
  const transport = useMemo(() => new DefaultChatTransport({
    api: '/api/chat',
    headers: () => {
      const token = useWorkshopStore.getState().accessToken;
      const h: Record<string, string> = {};
      if (token) h.Authorization = `Bearer ${token}`;
      return h;
    },
    body: () => {
      const state = useWorkshopStore.getState();
      const currentSession = state.session;
      const llmSettings = state.llmSettings;
      const step = currentSession?.currentStep || 1;
      const adminQuestions = (state.stepQuestions[step] || []).map((q) => q.text);
      return {
        currentStep: step,
        mode: currentSession?.mode || 'batch',
        adminQuestions,
        llmSettings,
        sessionData: currentSession ? {
          productName: currentSession.productName,
          contextSummary: currentSession.contextSummary,
          entities: currentSession.entities,
          granularity: currentSession.granularity,
          relations: currentSession.relations,
          attributes: currentSession.attributes,
          kpis: currentSession.kpis,
        } : undefined,
      };
    },
  }), []);

  const { messages, setMessages, status, sendMessage, error } = useChat({
    transport,
    onFinish: ({ message }) => {
      if (session) {
        const text = getMessageText(message);
        addMessage({
          id: message.id,
          role: 'assistant',
          content: text,
          timestamp: Date.now(),
          step: currentStep,
        });
        extractData(text);
      }
    },
  });

  const isLoading = status === 'submitted' || status === 'streaming';

  // Initialize with a welcome message when session starts
  useEffect(() => {
    if (session && messages.length === 0 && !hasInitialized.current) {
      hasInitialized.current = true;
      // Restore previous messages
      const savedMessages = session.messages.filter(m => m.step === currentStep);
      if (savedMessages.length > 0) {
        setMessages(savedMessages.map(m => ({
          id: m.id,
          role: m.role as 'user' | 'assistant' | 'system',
          parts: [{ type: 'text', text: m.content }],
        })));
      } else {
        // Trigger initial AI message (adapté au mode choisi)
        const intro = currentStep === 1 ? 'Présente-toi en une phrase, puis' : 'Sans te re-présenter,';
        const modeInstr = session.mode === 'guided'
          ? 'pose UNE SEULE question à la fois (mode guidé) : commence par la première question de cette étape et attends la réponse.'
          : 'affiche directement toutes les questions de cette étape en une seule fois.';
        sendMessage({ text: `[SYSTÈME] Démarre l'étape ${currentStep} sur ${STEPS.length} : "${stepDef.title}". ${intro} ${modeInstr}` });
      }
    }
  }, [session, currentStep]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  const handleTextareaInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }, []);

  // Extract structured data from AI responses
  function extractData(content: string) {
    const jsonRegex = /```json(?::extract)?\n([\s\S]*?)\n```/g;
    let match;
    while ((match = jsonRegex.exec(content)) !== null) {
      try {
        const parsed = JSON.parse(match[1]);
        processExtraction(parsed);
      } catch { /* skip invalid JSON */ }
    }
  }

  function processExtraction(extraction: { type: string; data: Record<string, unknown> }) {
    // Read the LATEST session state from the store, not the stale React closure.
    // This is critical: when one AI message emits several extract blocks, each call
    // must build on the result of the previous one — otherwise only the last block
    // of each type survives (e.g. 6 entities collapse into 1).
    const session = useWorkshopStore.getState().session;
    if (!session) return;
    const { type, data } = extraction;

    switch (type) {
      case 'context':
        updateSessionData({
          productName: (data.productName as string) || session.productName,
          businessProblem: (data.businessProblem as string) || session.businessProblem,
          objective: (data.objective as string) || session.objective,
          domain: (data.domain as string) || session.domain,
          productOwner: (data.productOwner as string) || session.productOwner,
          dataSteward: (data.dataSteward as string) || session.dataSteward,
          contextSummary: (data.summary as string) || session.contextSummary,
        });
        break;
      case 'entity':
        if (data.name) {
          const existing = session.entities.find(e => e.name === data.name);
          if (!existing) {
            updateSessionData({
              entities: [...session.entities, {
                id: `entity_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
                name: data.name as string,
                definition: (data.definition as string) || '',
                description: (data.description as string) || '',
                example: (data.example as string) || '',
                responsible: (data.responsible as string) || '',
                type: (data.type as 'transactional' | 'reference' | 'event' | 'aggregate') || 'transactional',
                lifecycle: (data.lifecycle as 'created' | 'evolving' | 'archived') || 'created',
              }],
            });
          }
        }
        break;
      case 'granularity':
        updateSessionData({
          granularity: {
            observationUnit: (data.observationUnit as string) || '',
            lineRepresents: (data.lineRepresents as string) || '',
            detailLevel: (data.detailLevel as string) || '',
            multipleLinesPerObject: (data.multipleLinesPerObject as boolean) ?? false,
            temporality: (data.temporality as 'daily' | 'monthly' | 'transactional' | 'snapshot' | 'other') || 'transactional',
            isHistorized: (data.isHistorized as boolean) ?? false,
            description: (data.description as string) || '',
          }
        });
        break;
      case 'relation':
        if (data.source && data.target) {
          updateSessionData({
            relations: [...session.relations, {
              id: `rel_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
              sourceEntityId: (data.sourceId as string) || '',
              targetEntityId: (data.targetId as string) || '',
              sourceEntityName: data.source as string,
              targetEntityName: data.target as string,
              type: (data.cardinality as '1:1' | '1:N' | 'N:1' | 'N:N') || '1:N',
              isRequired: (data.required as boolean) ?? true,
              description: (data.description as string) || '',
              isHierarchy: (data.hierarchy as boolean) ?? false,
            }],
          });
        }
        break;
      case 'attribute':
        if (data.name && (data.entityId || data.entityName)) {
          // If entityName is given, try to find matching entity ID
          let targetEntityId = (data.entityId as string) || '';
          if (!targetEntityId && data.entityName) {
            const found = session.entities.find(e => e.name.toLowerCase() === (data.entityName as string).toLowerCase());
            if (found) targetEntityId = found.id;
          }
          // Skip duplicates: same entity + same normalized column name (handles
          // snake_case vs camelCase and the step 2 / step 4 overlap).
          const normName = (data.name as string).replace(/[^a-z0-9]/gi, '').toLowerCase();
          const entityKeys = [targetEntityId, (data.entityName as string) || ''].filter(Boolean).map(k => k.toLowerCase());
          const isDuplicate = session.attributes.some(a => {
            const sameName = a.name.replace(/[^a-z0-9]/gi, '').toLowerCase() === normName;
            const sameEntity = entityKeys.includes((a.entityId || '').toLowerCase());
            return sameName && (sameEntity || entityKeys.length === 0);
          });
          if (isDuplicate) break;
          updateSessionData({
            attributes: [...session.attributes, {
              id: `attr_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
              entityId: targetEntityId,
              name: data.name as string,
              type: (data.type as string) || 'VARCHAR',
              description: (data.description as string) || '',
              isPrimaryKey: (data.isPK as boolean) ?? false,
              isForeignKey: (data.isFK as boolean) ?? false,
              isNaturalKey: (data.isNaturalKey as boolean) ?? false,
              isRequired: (data.required as boolean) ?? true,
              isSensitive: (data.sensitive as boolean) ?? false,
              isHistorized: (data.historized as boolean) ?? false,
            }],
          });
        }
        break;
      case 'kpi':
        if (data.name) {
          const existing = session.kpis.find(k => k.name === data.name);
          if (!existing) {
            updateSessionData({
              kpis: [...session.kpis, {
                id: `kpi_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
                name: data.name as string,
                formula: (data.formula as string) || '',
                frequency: (data.frequency as string) || '',
                aggregationLevels: (data.aggregationLevels as string[]) || [],
                filters: (data.filters as string[]) || [],
                analysisAxes: (data.analysisAxes as string[]) || [],
                description: (data.description as string) || '',
              }]
            });
          }
        }
        break;
      case 'rule':
        if (data.name) {
          const existing = session.businessRules.find(r => r.name === data.name);
          if (!existing) {
            updateSessionData({
              businessRules: [...session.businessRules, {
                id: `rule_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
                name: data.name as string,
                description: (data.description as string) || '',
                type: (data.type as any) || 'validation',
                entities: (data.entities as string[]) || [],
                expression: (data.expression as string) || '',
              }]
            });
          }
        }
        break;
      case 'source':
        if (data.name) {
          const existing = session.dataSources.find(s => s.name === data.name);
          if (!existing) {
            updateSessionData({
              dataSources: [...session.dataSources, {
                id: `src_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
                name: data.name as string,
                system: (data.system as string) || '',
                type: (data.type as any) || 'database',
                isReliable: (data.isReliable as boolean) ?? true,
                isReference: (data.isReference as boolean) ?? false,
                isHistorized: (data.isHistorized as boolean) ?? false,
                loadFrequency: (data.loadFrequency as string) || '',
                entities: (data.entities as string[]) || [],
                description: (data.description as string) || '',
              }]
            });
          }
        }
        break;
      case 'quality':
        if (data.name) {
          const existing = session.qualityRules.find(q => q.name === data.name);
          if (!existing) {
            updateSessionData({
              qualityRules: [...session.qualityRules, {
                id: `qual_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
                name: data.name as string,
                type: (data.type as any) || 'validity',
                columns: (data.columns as string[]) || [],
                threshold: (data.threshold as number) || 100,
                description: (data.description as string) || '',
                anomalyDetection: (data.anomalyDetection as string) || '',
              }]
            });
          }
        }
        break;
      case 'governance':
        updateSessionData({
          governance: {
            dataOwner: (data.dataOwner as string) || '',
            definitionValidator: (data.definitionValidator as string) || '',
            confidentialityLevel: (data.confidentialityLevel as any) || 'internal',
            gdprConstraints: (data.gdprConstraints as string) || '',
            isSensitive: (data.isSensitive as boolean) ?? false,
            retentionPeriod: (data.retentionPeriod as string) || '',
            description: (data.description as string) || '',
          }
        });
        break;
      case 'architecture':
        updateSessionData({
          architecture: {
            datamartObjects: (data.datamartObjects as string[]) || [],
            semanticModelObjects: (data.semanticModelObjects as string[]) || [],
            reportObjects: (data.reportObjects as string[]) || [],
            technicalObjects: (data.technicalObjects as string[]) || [],
            collibraObjects: (data.collibraObjects as string[]) || [],
            description: (data.description as string) || '',
          }
        });
        break;
      case 'maturity':
        updateSessionData({
          maturityScores: {
            businessUnderstanding: (data.businessUnderstanding as number) || 0,
            modeling: (data.modeling as number) || 0,
            documentation: (data.documentation as number) || 0,
            governance: (data.governance as number) || 0,
            dataQuality: (data.dataQuality as number) || 0,
            architecture: (data.architecture as number) || 0,
            dadReadiness: (data.dadReadiness as number) || 0,
          },
        });
        break;
    }
  }

  function hasStepData(stepId: number): boolean {
    if (!session) return false;
    switch (stepId) {
      case 1: return !!session.productName;
      case 2: return session.entities.length > 0;
      case 3: return session.relations.length > 0;
      case 4: return session.attributes.length > 0;
      case 5: return session.kpis.length > 0;      // optionnel
      case 6: return session.businessRules.length > 0; // optionnel
      case 7: return session.maturityScores !== null;
      default: return false;
    }
  }

  function handleStepChange(step: number) {
    hasInitialized.current = false;
    setMessages([]);
    setCurrentStep(step);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    
    if (session) {
      addMessage({
        id: `user_${Date.now()}`,
        role: 'user',
        content: input.trim(),
        timestamp: Date.now(),
        step: currentStep,
      });
    }
    
    sendMessage({ text: input.trim() });
    setInput('');

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit(e as unknown as React.FormEvent);
    }
  }

  // Importer un fichier (SAS / SQL / CSV / Excel) et laisser Marty en déduire le modèle
  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !session) return;
    if (file.size > 3 * 1024 * 1024) {
      setToast('Fichier trop volumineux (max 3 Mo). Conservez l\'essentiel (en-têtes, DATA steps, PROC SQL).');
      e.target.value = '';
      return;
    }
    setImporting(true);
    try {
      let content = '';
      const name = file.name.toLowerCase();
      if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
        const XLSX = await import('xlsx');
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        content = wb.SheetNames.map((sn) => `# Feuille: ${sn}\n${XLSX.utils.sheet_to_csv(wb.Sheets[sn])}`).join('\n\n');
      } else {
        content = await file.text();
      }
      const truncated = content.slice(0, 14000);
      const prompt = `[SYSTÈME] [FICHIER IMPORTÉ: ${file.name}]
Analyse le contenu ci-dessous (script SAS, requête SQL, CSV ou export Excel) et DÉDUIS-EN le modèle de données : les ENTITÉS (tables), leurs ATTRIBUTS (colonnes avec types SQL et clés primaires/étrangères) et les RELATIONS entre tables. Émets les blocs json:extract correspondants (un "entity" par table, un "attribute" par colonne, un "relation" par lien).
- Script SAS : repère les DATA steps, PROC SQL, et les jointures (MERGE ... BY, JOIN ... ON) pour déduire tables et relations.
- CSV / Excel : chaque fichier ou feuille = une entité, chaque colonne = un attribut (déduis le type SQL ; repère les colonnes *_id comme clés).
Termine par une courte synthèse en français de ce que tu as importé.

Contenu:
\`\`\`
${truncated}
\`\`\``;
      sendMessage({ text: prompt });
    } catch {
      setToast('Impossible de lire ce fichier.');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  }

  function resetWorkshop() {
    setShowReset(false);
    setMenuOpen(false);
    setMessages([]);
    hasInitialized.current = false;
    updateSessionData({
      currentStep: 1, status: 'active',
      productName: '', businessProblem: '', objective: '', users: [], domain: '',
      productOwner: '', dataSteward: '', businessDecision: '', frequency: '', existingSimilar: '', contextSummary: '',
      entities: [], granularity: null, relations: [], attributes: [], kpis: [], businessRules: [],
      dataSources: [], qualityRules: [], governance: null, architecture: null, maturityScores: null,
      validationNotes: [], messages: [],
    });
  }

  function deleteWorkshop() {
    const id = session?.id;
    setShowDelete(false);
    setMenuOpen(false);
    if (id) useWorkshopStore.getState().deleteSession(id);
    setCurrentPage('products');
  }

  if (!session) {
    const recent = useWorkshopStore.getState().sessions.slice(0, 4);
    return (
      <div className="welcome-message">
        <div className="welcome-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 6.5 13.7 11l4.5 1.7-4.5 1.7L12 19l-1.7-4.6L5.8 12.7 10.3 11 12 6.5Z" /><path d="M5 4v3M3.5 5.5h3M18 15v3M16.5 16.5h3" />
          </svg>
        </div>
        <h3>Aucune session active</h3>
        <p>Créez un nouvel atelier ou ouvrez un Data Product existant pour commencer la conception avec l&apos;IA.</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 18, flexWrap: 'wrap' }}>
          {onNew && <button className="cta-btn" onClick={onNew}>✨ Nouveau Data Product</button>}
          <button className="cta-btn cta-btn-secondary" onClick={() => setCurrentPage('products')}>Voir les Data Products</button>
        </div>
        {recent.length > 0 && (
          <div style={{ marginTop: 28, width: 'min(420px, 90%)', textAlign: 'left' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>Reprendre récemment</div>
            {recent.map(s => (
              <button
                key={s.id}
                onClick={() => useWorkshopStore.getState().loadSession(s.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', marginBottom: 8, cursor: 'pointer' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="7" ry="2.6" /><path d="M5 5v14c0 1.5 3.1 2.6 7 2.6s7-1.1 7-2.6V5" /><path d="M5 12c0 1.5 3.1 2.6 7 2.6s7-1.1 7-2.6" /></svg>
                <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.productName || 'Nouveau produit'}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.currentStep}/7</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Suggested questions for current step
  // Questions pilotées par l'admin (fallback aux questions par défaut de l'étape).
  const adminQs = (stepQuestions[currentStep] || []).map((q) => q.text);
  const suggestions = (adminQs.length > 0 ? adminQs : stepDef.questions).slice(0, 3);

  // Filter system messages from display
  const displayMessages = messages.filter(m => !getMessageText(m).startsWith('[SYSTÈME]'));

  // Only offer "Valider la réponse" once the user has actually answered in THIS
  // step. Data may already exist (deduced earlier), but we don't want the banner
  // to appear before the user has had a chance to type.
  const userHasMessagedThisStep = displayMessages.some(m => m.role === 'user');
  const isValidation = currentStep === STEPS.length;
  // Validation : bouton toujours dispo. Étape optionnelle : on peut passer.
  // Étape requise : bandeau après que l'utilisateur a répondu et que des données existent.
  const showStepBanner = isValidation || stepDef.optional || (hasStepData(currentStep) && userHasMessagedThisStep);

  return (
    <div className="workshop-layout">
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 200, background: 'var(--bg-code, #1f2430)', color: '#fff', padding: '12px 18px', borderRadius: 10, boxShadow: '0 12px 30px rgba(0,0,0,0.35)', fontSize: 13.5, maxWidth: 'min(520px, 90vw)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></svg>
          <span>{toast}</span>
          <button onClick={() => setToast(null)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 16, marginLeft: 4 }}>✕</button>
        </div>
      )}

      {/* Confirmation : remise à zéro */}
      {showReset && (
        <div onClick={() => setShowReset(false)} style={wsOverlay}>
          <div onClick={e => e.stopPropagation()} style={wsModal}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ color: 'var(--accent-amber)', display: 'flex' }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6" /></svg></span>
              <h3 style={{ fontSize: 17, margin: 0 }}>Remettre l&apos;atelier à zéro ?</h3>
            </div>
            <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
              Toutes les données collectées (contexte, entités, relations, attributs, KPI, règles) et la conversation seront effacées. Vous recommencez de l&apos;étape&nbsp;1. Cette action est irréversible.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button className="suggested-chip" onClick={() => setShowReset(false)}>Annuler</button>
              <button onClick={resetWorkshop} style={{ background: 'var(--accent-amber)', color: '#fff', border: 'none', borderRadius: 9, padding: '10px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Remettre à zéro</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation : supprimer */}
      {showDelete && (
        <div onClick={() => setShowDelete(false)} style={wsOverlay}>
          <div onClick={e => e.stopPropagation()} style={wsModal}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ color: 'var(--accent-red)', display: 'flex' }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" /></svg></span>
              <h3 style={{ fontSize: 17, margin: 0 }}>Supprimer ce Data Product ?</h3>
            </div>
            <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
              «&nbsp;{session?.productName || 'Ce Data Product'}&nbsp;» et toute sa conception seront définitivement supprimés. Cette action est irréversible.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button className="suggested-chip" onClick={() => setShowDelete(false)}>Annuler</button>
              <button onClick={deleteWorkshop} style={{ background: 'var(--accent-red)', color: '#fff', border: 'none', borderRadius: 9, padding: '10px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Supprimer</button>
            </div>
          </div>
        </div>
      )}

      <StepSidebar currentStep={currentStep} onStepChange={handleStepChange} session={session} />

      <div className="chat-panel">
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          padding: '8px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setMenuOpen(o => !o)}
              title="Options de l'atelier"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 12.5 }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>
              Options
            </button>
            {menuOpen && (
              <>
                <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, minWidth: 240, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow-lg)', padding: 6, zIndex: 41 }}>
                  <button className="user-menu-item" onClick={() => { setShowReset(true); setMenuOpen(false); }} style={{ color: 'var(--accent-amber)' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6" /></svg>
                    Remettre à zéro l&apos;atelier
                  </button>
                  <button className="user-menu-item" onClick={() => { setShowDelete(true); setMenuOpen(false); }} style={{ color: 'var(--accent-red)' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" /></svg>
                    Supprimer ce Data Product
                  </button>
                </div>
              </>
            )}
          </div>
          <div style={{ display: 'inline-flex', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: 2, gap: 2 }}>
            <button
              onClick={() => undo()}
              disabled={!canUndo}
              title="Annuler (Cmd/Ctrl+Z)"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: 'none', borderRadius: 6, padding: '5px 9px', cursor: canUndo ? 'pointer' : 'not-allowed', fontSize: 12.5, fontWeight: 600, background: 'transparent', color: canUndo ? 'var(--text-secondary)' : 'var(--text-muted)', opacity: canUndo ? 1 : 0.45 }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14 4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 5 5v0a5 5 0 0 1-5 5H9" /></svg>
              Annuler
            </button>
            <button
              onClick={() => redo()}
              disabled={!canRedo}
              title="Rétablir (Cmd/Ctrl+Shift+Z)"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: 'none', borderRadius: 6, padding: '5px 9px', cursor: canRedo ? 'pointer' : 'not-allowed', fontSize: 12.5, fontWeight: 600, background: 'transparent', color: canRedo ? 'var(--text-secondary)' : 'var(--text-muted)', opacity: canRedo ? 1 : 0.45 }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="m15 14 5-5-5-5" /><path d="M20 9H9a5 5 0 0 0-5 5v0a5 5 0 0 0 5 5h6" /></svg>
              Rétablir
            </button>
          </div>
          </div>
          <div style={{ display: 'inline-flex', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: 2 }}>
            <button
              onClick={() => setVisual(false)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: 'none', borderRadius: 6, padding: '5px 11px', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, background: !visual ? 'var(--bg-surface)' : 'transparent', color: !visual ? 'var(--text)' : 'var(--text-muted)', boxShadow: !visual ? 'var(--shadow)' : 'none' }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-4 4v-4H6a2 2 0 0 1-2-2Z" /></svg>
              Chat
            </button>
            <button
              onClick={() => setVisual(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: 'none', borderRadius: 6, padding: '5px 11px', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, background: visual ? 'var(--bg-surface)' : 'transparent', color: visual ? 'var(--text)' : 'var(--text-muted)', boxShadow: visual ? 'var(--shadow)' : 'none' }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="7" height="7" rx="1.5" /><rect x="14" y="4" width="7" height="7" rx="1.5" /><rect x="8.5" y="14" width="7" height="6" rx="1.5" /></svg>
              Visuel
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Propulsé par</span>
          <span
            title={`Fournisseur : ${llmSettings.provider}`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
              color: 'var(--primary-light)', background: 'var(--primary-glow)',
              border: '1px solid var(--border-active)', borderRadius: 999, padding: '3px 10px',
            }}
          >
            {llmProviderIcon(llmSettings.provider)} {llmLabel(llmSettings.provider, llmSettings.model)}
          </span>
          </div>
        </div>
        {visual ? (
          <VisualEditor session={session} />
        ) : (
        <>
        <div className="chat-messages">
          {displayMessages.length === 0 && !isLoading && (
            <div className="welcome-message">
              <div className="welcome-icon">{stepDef.icon}</div>
              <h3>Étape {currentStep} — {stepDef.title}</h3>
              <p>{stepDef.description}</p>
            </div>
          )}

          {displayMessages.map((message) => {
            const text = getMessageText(message);
            if (!text) return null;
            const isAssistant = message.role === 'assistant';
            const html = formatMarkdown(text);
            // After stripping the json:extract blocks, an assistant message can be
            // visually empty (Marty answered only with extraction). Show a clear
            // confirmation instead of an empty bubble.
            const isEmpty = html.replace(/<[^>]*>/g, '').trim().length === 0;
            return (
              <div key={message.id} className={`chat-message ${message.role}`}>
                <MartyAvatar role={message.role} />
                <div>
                  {isAssistant && (
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', marginBottom: 4 }}>
                      Marty <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>· Assistant Data Architect</span>
                      <span style={{ fontWeight: 600, color: 'var(--primary-light)', marginLeft: 6 }}>
                        · {llmProviderIcon(llmSettings.provider)} {llmLabel(llmSettings.provider, llmSettings.model)}
                      </span>
                    </div>
                  )}
                  {isEmpty && isAssistant ? (
                    <div className="message-bubble" style={{ color: 'var(--primary)', fontWeight: 600 }}>
                      ✓ Informations extraites et enregistrées dans « Données collectées ».
                    </div>
                  ) : (
                    <div className="message-bubble" dangerouslySetInnerHTML={{ __html: html }} />
                  )}
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="chat-message assistant">
              <MartyAvatar role="assistant" />
              <div className="message-bubble">
                <div className="typing-indicator">
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                </div>
              </div>
            </div>
          )}
          {error && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c',
              borderRadius: 'var(--radius)', padding: '12px 16px', margin: '8px 0', fontSize: 13,
            }}>
              <strong>⚠️ Erreur du fournisseur LLM</strong>
              <div style={{ marginTop: 4, fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-word' }}>
                {error.message || String(error)}
              </div>
              <div style={{ marginTop: 6, color: '#7f1d1d' }}>
                Vérifiez votre clé API et vos crédits dans « Configuration LLM ».
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-area">
          {showStepBanner && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--primary-glow)',
              border: '1px solid var(--border-active)',
              padding: '16px 20px',
              borderRadius: 'var(--radius)',
              marginBottom: '16px',
              animation: 'fadeSlideUp 0.3s ease',
              gap: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '20px' }}>{isValidation ? '🏁' : stepDef.optional && !hasStepData(currentStep) ? 'ℹ️' : '✓'}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text)' }}>
                    {isValidation ? 'Prêt à clôturer l\'atelier' : stepDef.optional && !hasStepData(currentStep) ? `Étape optionnelle — ${stepDef.titleShort}` : `Données collectées pour l'étape ${currentStep} !`}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {isValidation
                      ? 'Vous pouvez clore l\'atelier et générer les livrables.'
                      : stepDef.optional && !hasStepData(currentStep)
                        ? 'Renseignez vos données réelles, ou passez cette étape.'
                        : 'Les informations ont été extraites. Vous pouvez valider ou affiner la réponse.'}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="cta-btn cta-btn-secondary"
                  style={{ padding: '10px 16px', fontSize: '13px', whiteSpace: 'nowrap' }}
                  disabled={isLoading}
                  onClick={() => {
                    sendMessage({ text: "Je souhaite donner plus d'informations pour affiner cette étape." });
                  }}
                >
                  Donner plus d&apos;infos 💬
                </button>
                {!isValidation ? (
                  <button
                    type="button"
                    className="cta-btn"
                    style={{ padding: '10px 16px', fontSize: '13px', whiteSpace: 'nowrap' }}
                    onClick={() => handleStepChange(currentStep + 1)}
                  >
                    {stepDef.optional && !hasStepData(currentStep) ? 'Passer ➔' : 'Valider la réponse ➔'}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="cta-btn"
                    style={{ padding: '10px 16px', fontSize: '13px', whiteSpace: 'nowrap', background: 'linear-gradient(135deg, var(--primary), #10B981)' }}
                    onClick={() => {
                      completeSession();
                      setCurrentPage('deliverables');
                    }}
                  >
                    Terminer l&apos;atelier ✓
                  </button>
                )}
              </div>
            </div>
          )}

          {suggestions.length > 0 && displayMessages.length < 3 && (
            <div className="suggested-chips">
              {suggestions.map((q, i) => (
                <button key={i} className="suggested-chip" onClick={() => {
                  if (session) {
                    addMessage({ id: `user_${Date.now()}`, role: 'user', content: q, timestamp: Date.now(), step: currentStep });
                  }
                  sendMessage({ text: q });
                }}>
                  {q}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={onSubmit} className="chat-input-wrapper">
            <input
              ref={fileInputRef}
              type="file"
              accept=".sas,.sql,.csv,.txt,.xlsx,.xls,.json"
              style={{ display: 'none' }}
              onChange={handleImportFile}
            />
            <button
              type="button"
              className="chat-send-btn"
              title="Importer un fichier (SAS, SQL, CSV, Excel) — Marty en déduit le modèle"
              disabled={isLoading || importing}
              onClick={() => fileInputRef.current?.click()}
              style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}
            >
              {importing ? '⏳' : '📎'}
            </button>
            <textarea
              ref={textareaRef}
              className="chat-input"
              value={input}
              onChange={handleTextareaInput}
              onKeyDown={handleKeyDown}
              placeholder="Décrivez votre Data Product, ou importez un fichier (📎)…"
              rows={1}
              disabled={isLoading}
            />
            <button type="submit" className="chat-send-btn" disabled={isLoading || !input.trim()}>
              ➤
            </button>
          </form>
        </div>
        </>
        )}
      </div>

      {showContext && <ContextPanel session={session} onClose={() => setShowContext(false)} />}
      {!showContext && (
        <button
          style={{ position: 'fixed', right: 16, top: 80, zIndex: 5 }}
          className="suggested-chip"
          onClick={() => setShowContext(true)}
        >
          📋 Contexte
        </button>
      )}
    </div>
  );
}

// Friendly label for the active LLM (provider + model)
function llmLabel(provider: string, model: string): string {
  const names: Record<string, string> = {
    'gpt-4o': 'GPT-4o', 'gpt-4o-mini': 'GPT-4o Mini', 'gpt-4-turbo': 'GPT-4 Turbo',
    'claude-opus-4-8': 'Claude Opus 4.8', 'claude-sonnet-4-6': 'Claude Sonnet 4.6',
    'claude-haiku-4-5': 'Claude Haiku 4.5', 'claude-fable-5': 'Claude Fable 5',
    'gemini-1.5-flash': 'Gemini 1.5 Flash', 'gemini-1.5-pro': 'Gemini 1.5 Pro',
    'gemini-2.5-flash': 'Gemini 2.5 Flash', 'gemini-2.5-pro': 'Gemini 2.5 Pro',
  };
  if (model && names[model]) return names[model];
  if (model) return model;
  const providerNames: Record<string, string> = {
    openai: 'OpenAI', anthropic: 'Claude', google: 'Gemini', custom: 'Modèle personnalisé',
  };
  return providerNames[provider] || provider || 'Non configuré';
}

function llmProviderIcon(provider: string): string {
  const icons: Record<string, string> = {
    openai: '🟢', anthropic: '🧠', google: '✦', custom: '⚙️',
  };
  return icons[provider] || '🤖';
}

// Marty — the Crédit Agricole assistant avatar
function MartyAvatar({ role }: { role: string }) {
  if (role !== 'assistant') {
    return <div className="message-avatar">👤</div>;
  }
  return (
    <div
      className="message-avatar"
      style={{ background: '#fff', padding: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)' }}
      title="Marty — Assistant Data Architect"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/marty-avatar.svg" alt="Marty" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </div>
  );
}

// Simple markdown formatter
function formatMarkdown(text: string): string {
  // Sécurité : on échappe le HTML AVANT tout formatage (anti-XSS). Le texte
  // provient du LLM et peut contenir <script>, <img onerror>, etc.
  let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // Remove JSON extract blocks from display (the UI consumes them separately)
  html = html.replace(/```json:extract[\s\S]*?```/g, '');
  // Also drop a generic "Blocs JSON" wrapper heading and any heading that is left
  // empty once its JSON block was stripped (e.g. "#### Maturity" with nothing after).
  html = html.replace(/^#{1,4}\s*Blocs?\s*JSON.*$/gim, '');
  html = html.replace(/^#{1,4}\s*(Maturity|Exemple[^\n]*|JSON[^\n]*)\s*$/gim, '');
  html = html.replace(/\n{3,}/g, '\n\n').trim();

  // Code blocks
  html = html.replace(/```(\w+)?\n([\s\S]*?)\n```/g, '<pre><code>$2</code></pre>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Bold/italic
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  
  // Headers
  html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
  
  // Lists
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>');
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');
  
  // Paragraphs
  html = html.replace(/\n\n/g, '</p><p>');
  html = `<p>${html}</p>`;
  html = html.replace(/<p>\s*<\/p>/g, '');
  
  // Emojis are already native
  return html;
}
