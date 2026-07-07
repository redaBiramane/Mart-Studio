'use client';

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useWorkshopStore } from '@/lib/store';
import { STEPS, stepHasData } from '@/lib/constants';
import StepSidebar from '@/app/components/StepSidebar';
import ContextPanel from '@/app/components/ContextPanel';
import VisualEditor from '@/app/components/VisualEditor';
import { useI18n } from '@/lib/i18n';

// Types minimaux pour l'API Web Speech (reconnaissance vocale du navigateur).
type SpeechResultEvent = { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> };
type SpeechRec = { lang: string; continuous: boolean; interimResults: boolean; onresult: ((e: SpeechResultEvent) => void) | null; onend: (() => void) | null; onerror: (() => void) | null; start: () => void; stop: () => void };

const wsOverlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 210, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 };
const wsModal: React.CSSProperties = { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', width: 'min(460px, 100%)', padding: 26, boxShadow: '0 20px 60px rgba(0,0,0,0.35)' };

export default function Workshop({ onNew }: { onNew?: () => void }) {
  const { session, llmSettings, setCurrentStep, addMessage, updateSessionData, completeSession, setCurrentPage, stepQuestions, steps, undo, redo, past, future } = useWorkshopStore();
  const effSteps = steps && steps.length ? steps : STEPS; // étapes configurées par l'admin, sinon défaut
  const canUndo = past.length > 0;
  const canRedo = future.length > 0;
  const [lastChange, setLastChange] = useState<{ entities: number; attributes: number; relations: number; kpis: number; rules: number; context: boolean } | null>(null);

  // Le résumé des changements de Marty disparaît tout seul au bout de 14 s.
  useEffect(() => {
    if (!lastChange) return;
    const t = setTimeout(() => setLastChange(null), 14000);
    return () => clearTimeout(t);
  }, [lastChange]);

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
  const [pendingImages, setPendingImages] = useState<{ url: string; name: string; mediaType: string }[]>([]);
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);
  const MAX_IMAGES = 4;
  const { lang } = useI18n();
  const [micSupported, setMicSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRec | null>(null);

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    setMicSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  // Saisie vocale : la parole est transcrite en direct dans le champ de message.
  const toggleMic = useCallback(() => {
    if (listening) { recognitionRef.current?.stop(); return; }
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = lang === 'en' ? 'en-US' : 'fr-FR';
    rec.continuous = true;
    rec.interimResults = true;
    let base = '';
    setInput((cur) => { base = cur ? cur.trim() + ' ' : ''; return cur; });
    let finalText = base;
    rec.onresult = (e: SpeechResultEvent) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript + ' '; else interim += r[0].transcript;
      }
      setInput((finalText + interim).replace(/\s+/g, ' ').trimStart());
      const el = textareaRef.current;
      if (el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 160) + 'px'; }
    };
    rec.onend = () => { setListening(false); recognitionRef.current = null; };
    rec.onerror = () => { setListening(false); };
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  }, [listening, lang]);
  const hasInitialized = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportText, setReportText] = useState('');
  const [reportIncludeMsg, setReportIncludeMsg] = useState(true);
  const [reportSent, setReportSent] = useState(false);

  async function submitReport() {
    const txt = reportText.trim();
    if (!txt || !session) return;
    const lastMarty = [...displayMessages].reverse().find(m => m.role === 'assistant');
    const ctx = `[${session.productName || 'Data Product'} · étape ${currentStep}/${effSteps.length}]`;
    const extra = reportIncludeMsg && lastMarty ? ` | Dernier message IA: ${getMessageText(lastMarty).replace(/```json:extract[\s\S]*?```/g, '').replace(/\s+/g, ' ').trim().slice(0, 300)}` : '';
    try { await useWorkshopStore.getState().logActivity('report_ai', `${ctx} ${txt}${extra}`); } catch { /* mode local : ignore */ }
    setReportSent(true);
    setReportText('');
    setTimeout(() => { setShowReport(false); setReportSent(false); }, 1600);
  }
  const [visual, setVisual] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  // Borne l'étape courante au nombre d'étapes configuré (l'admin a pu en retirer).
  const currentStep = Math.min(Math.max(session?.currentStep || 1, 1), effSteps.length);
  const stepDef = effSteps[currentStep - 1];

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
      // Questions injectées à Marty : celles de l'étape configurée par l'admin,
      // sinon l'ancienne surcharge (step_questions). Sinon rien (Marty libre).
      const cfgSteps = state.steps;
      const effList = cfgSteps && cfgSteps.length ? cfgSteps : STEPS;
      const adminQuestions = cfgSteps && cfgSteps.length
        ? (cfgSteps[step - 1]?.questions ?? [])
        : (state.stepQuestions[step] || []).map((q) => q.text);
      return {
        currentStep: step,
        stepKey: effList[step - 1]?.key,
        totalSteps: effList.length,
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
        // Aperçu des changements de Marty : on mesure le modèle avant/après extraction
        // pour proposer un résumé + une annulation en un clic (l'extraction = 1 pas d'undo).
        const before = useWorkshopStore.getState().session;
        extractData(text);
        const after = useWorkshopStore.getState().session;
        if (before && after) {
          const diff = {
            entities: after.entities.length - before.entities.length,
            attributes: after.attributes.length - before.attributes.length,
            relations: after.relations.length - before.relations.length,
            kpis: after.kpis.length - before.kpis.length,
            rules: after.businessRules.length - before.businessRules.length,
            context: after.contextSummary !== before.contextSummary || after.productName !== before.productName || after.objective !== before.objective,
          };
          if (diff.entities || diff.attributes || diff.relations || diff.kpis || diff.rules || diff.context) {
            setLastChange(diff);
          }
        }
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
        sendMessage({ text: `[SYSTÈME] Démarre l'étape ${currentStep} sur ${effSteps.length} : "${stepDef.title}". ${intro} ${modeInstr}` });
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
    return stepHasData(effSteps[stepId - 1], session);
  }

  function handleStepChange(step: number) {
    hasInitialized.current = false;
    setMessages([]);
    setCurrentStep(step);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if ((!input.trim() && pendingImages.length === 0) || isLoading) return;

    const userText = input.trim();
    const imgs = pendingImages;
    // Si des images sont attachées, on ajoute une consigne d'analyse et on les joint.
    const note = imgs.length > 1
      ? `J'ai joint ${imgs.length} images d'un modèle existant (MCD / ERD / schémas) : analyse-les TOUTES et déduis-en les entités, leurs attributs (types SQL, PK/FK) et les relations (cardinalités), puis émets les blocs json:extract. N'invente rien qui ne soit pas visible.`
      : 'J\'ai joint une image d\'un modèle existant (MCD / ERD / schéma) : analyse-la et déduis-en les entités, leurs attributs (types SQL, PK/FK) et les relations (cardinalités), puis émets les blocs json:extract. N\'invente rien qui ne soit pas visible.';
    const text = imgs.length ? (userText ? `${userText}\n\n${note}` : note) : userText;

    if (session) {
      addMessage({ id: `user_${Date.now()}`, role: 'user', content: text, timestamp: Date.now(), step: currentStep });
    }

    if (imgs.length) {
      sendMessage({ text, files: imgs.map((im) => ({ type: 'file', mediaType: im.mediaType, url: im.url, filename: im.name })) });
      setPendingImages([]);
      setPreviewIdx(null);
    } else {
      sendMessage({ text });
    }
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit(e as unknown as React.FormEvent);
    }
  }

  const isImageFile = (f: File) => f.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp)$/i.test(f.name);

  // Importer un ou plusieurs fichiers (SAS/SQL/CSV/Excel ou images d'anciens MCD).
  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length || !session) return;
    const images = files.filter(isImageFile);
    setImporting(true);
    try {
      // Images (captures d'anciens MCD / ERD / schémas) : on les ATTACHE (plusieurs
      // possibles) ; l'utilisateur ajoute un message puis envoie lui-même.
      if (images.length) {
        const room = MAX_IMAGES - pendingImages.length;
        if (room <= 0) { setToast(`Maximum ${MAX_IMAGES} images par message.`); e.target.value = ''; setImporting(false); return; }
        const toAdd = images.slice(0, room).filter((f) => f.size <= 3 * 1024 * 1024);
        const skipped = images.length - toAdd.length;
        const read = await Promise.all(toAdd.map((f) => new Promise<{ url: string; name: string; mediaType: string }>((res, rej) => {
          const r = new FileReader();
          r.onload = () => res({ url: r.result as string, name: f.name, mediaType: f.type || 'image/png' });
          r.onerror = rej;
          r.readAsDataURL(f);
        })));
        setPendingImages((prev) => [...prev, ...read]);
        setToast(skipped > 0 ? `${read.length} image(s) attachée(s) — ${skipped} ignorée(s) (trop lourdes ou > ${MAX_IMAGES}).` : `${read.length} image(s) attachée(s) — ajoutez un message si besoin, puis envoyez.`);
        textareaRef.current?.focus();
        e.target.value = '';
        setImporting(false);
        return;
      }
      const file = files[0];
      if (file.size > 3 * 1024 * 1024) {
        setToast('Fichier trop volumineux (max 3 Mo). Conservez l\'essentiel (en-têtes, DATA steps, PROC SQL).');
        e.target.value = ''; setImporting(false); return;
      }
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

  // Suggestions de questions pour l'étape courante. Si l'admin a configuré des
  // étapes, on utilise leurs questions ; sinon, l'éventuelle surcharge héritée
  // (step_questions) ou les questions par défaut de l'étape.
  const legacyQs = (stepQuestions[currentStep] || []).map((q) => q.text);
  const suggestions = (steps && steps.length ? stepDef.questions : (legacyQs.length > 0 ? legacyQs : stepDef.questions)).slice(0, 3);

  // Filter system messages from display
  const displayMessages = messages.filter(m => !getMessageText(m).startsWith('[SYSTÈME]'));

  // Horodatage par message : les messages en direct (useChat) n'ont pas de date,
  // on la récupère depuis la session persistée (par id). Sinon, « maintenant ».
  const tsById = useMemo(() => {
    const m: Record<string, number> = {};
    (session?.messages || []).forEach((x) => { if (x.id) m[x.id] = x.timestamp; });
    return m;
  }, [session?.messages]);
  const fmtDateTime = (ts: number) => new Date(ts).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  // Only offer "Valider la réponse" once the user has actually answered in THIS
  // step. Data may already exist (deduced earlier), but we don't want the banner
  // to appear before the user has had a chance to type.
  const userHasMessagedThisStep = displayMessages.some(m => m.role === 'user');
  const isValidation = currentStep === effSteps.length;
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

      {/* Signalement d'un problème IA (hallucination / comportement inattendu) */}
      {showReport && (
        <div onClick={() => setShowReport(false)} style={wsOverlay}>
          <div onClick={e => e.stopPropagation()} style={{ ...wsModal, width: 'min(520px, 100%)' }}>
            {reportSent ? (
              <div style={{ textAlign: 'center', padding: '10px 0' }}>
                <div style={{ fontSize: 30, marginBottom: 8 }}>✓</div>
                <div style={{ fontWeight: 700 }}>Signalement envoyé</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Merci — l&apos;équipe l&apos;examinera pour améliorer Marty.</div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ color: 'var(--primary)', display: 'flex' }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></svg></span>
                  <h3 style={{ fontSize: 17, margin: 0 }}>Signaler un problème IA</h3>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, margin: '0 0 12px' }}>
                  Marty a inventé une information (hallucination), donné une réponse fausse ou eu un comportement inattendu ? Décrivez ce qui ne va pas — c&apos;est transmis à l&apos;équipe pour améliorer la qualité.
                </p>
                <textarea
                  autoFocus
                  value={reportText}
                  onChange={e => setReportText(e.target.value)}
                  placeholder="Ex. : Marty a créé une table « YASSIN » qui n'existe pas dans mon besoin / a affirmé une règle Bâle inexacte…"
                  style={{ width: '100%', minHeight: 110, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-elevated)', color: 'var(--text)', fontSize: 13.5, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 12.5, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={reportIncludeMsg} onChange={e => setReportIncludeMsg(e.target.checked)} />
                  Joindre le dernier message de Marty (aide au diagnostic)
                </label>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
                  <button className="suggested-chip" onClick={() => setShowReport(false)}>Annuler</button>
                  <button onClick={submitReport} disabled={!reportText.trim()} className="cta-btn" style={{ opacity: reportText.trim() ? 1 : 0.5 }}>Envoyer le signalement</button>
                </div>
              </>
            )}
          </div>
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
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap',
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
                  <button className="user-menu-item" onClick={() => { setShowReport(true); setMenuOpen(false); }} title="Signaler une réponse fausse, inventée (hallucination) ou un comportement inattendu de l'IA — envoyé à l'équipe" style={{ color: 'var(--primary)' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></svg>
                    Signaler un problème IA
                  </button>
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
              title={canUndo ? 'Annuler la dernière modification du modèle (Cmd/Ctrl+Z)' : 'Rien à annuler — aucune modification du modèle pour l\'instant'}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: 'none', borderRadius: 6, padding: '5px 9px', cursor: canUndo ? 'pointer' : 'not-allowed', fontSize: 12.5, fontWeight: 600, background: 'transparent', color: canUndo ? 'var(--text-secondary)' : 'var(--text-muted)', opacity: canUndo ? 1 : 0.45 }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14 4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 5 5v0a5 5 0 0 1-5 5H9" /></svg>
              Annuler
            </button>
            <button
              onClick={() => redo()}
              disabled={!canRedo}
              title={canRedo ? 'Rétablir (Cmd/Ctrl+Shift+Z)' : 'Rien à rétablir'}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span className="ws-poweredby" style={{ fontSize: 11, color: 'var(--text-muted)' }}>Propulsé par</span>
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
        {lastChange && (() => {
          const parts: string[] = [];
          if (lastChange.entities) parts.push(`${lastChange.entities > 0 ? '+' : ''}${lastChange.entities} table(s)`);
          if (lastChange.attributes) parts.push(`${lastChange.attributes > 0 ? '+' : ''}${lastChange.attributes} colonne(s)`);
          if (lastChange.relations) parts.push(`${lastChange.relations > 0 ? '+' : ''}${lastChange.relations} relation(s)`);
          if (lastChange.kpis) parts.push(`${lastChange.kpis > 0 ? '+' : ''}${lastChange.kpis} KPI`);
          if (lastChange.rules) parts.push(`${lastChange.rules > 0 ? '+' : ''}${lastChange.rules} règle(s)`);
          if (lastChange.context) parts.push('contexte mis à jour');
          return (
            <div style={{ position: 'absolute', top: 66, left: '50%', transform: 'translateX(-50%)', zIndex: 20, display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-surface)', border: '1px solid var(--border-active)', borderLeft: '3px solid var(--primary)', borderRadius: 10, padding: '10px 14px', boxShadow: 'var(--shadow-lg)', maxWidth: 'calc(100% - 40px)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M12 2a10 10 0 1 0 10 10" /><path d="M22 4 12 14.01l-3-3" /></svg>
              <div style={{ fontSize: 13, color: 'var(--text)' }}><strong>Marty a mis à jour le modèle</strong> — {parts.join(' · ')}.</div>
              <button onClick={() => { undo(); setLastChange(null); }} style={{ whiteSpace: 'nowrap', background: 'var(--primary-glow)', border: '1px solid var(--border-active)', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, color: 'var(--primary-light)' }}>↶ Annuler</button>
              <button onClick={() => setLastChange(null)} title="Fermer" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 15, flexShrink: 0 }}>✕</button>
            </div>
          );
        })()}
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
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 4, textAlign: isAssistant ? 'left' : 'right' }}>
                    {fmtDateTime(tsById[message.id] ?? Date.now())}
                  </div>
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

          {pendingImages.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '0 0 8px', alignItems: 'center' }}>
              {pendingImages.map((im, idx) => (
                <div key={idx} style={{ position: 'relative' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={im.url} alt={im.name} onClick={() => setPreviewIdx(idx)} title={`${im.name} — cliquer pour agrandir`} style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border-active)', cursor: 'zoom-in', display: 'block' }} />
                  <button type="button" onClick={() => setPendingImages((prev) => prev.filter((_, i) => i !== idx))} title="Retirer" style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: 'var(--accent-red)', color: '#fff', border: '2px solid var(--bg-surface)', cursor: 'pointer', fontSize: 11, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                </div>
              ))}
              <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{pendingImages.length}/{MAX_IMAGES} image(s) — envoyez pour que Marty les analyse</span>
            </div>
          )}
          {previewIdx !== null && pendingImages[previewIdx] && (
            <div onClick={() => setPreviewIdx(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, cursor: 'zoom-out' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pendingImages[previewIdx].url} alt={pendingImages[previewIdx].name} style={{ maxWidth: '92vw', maxHeight: '88vh', objectFit: 'contain', borderRadius: 8, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }} />
              <button type="button" onClick={() => setPreviewIdx(null)} title="Fermer" style={{ position: 'fixed', top: 20, right: 24, background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', width: 40, height: 40, borderRadius: '50%', cursor: 'pointer', fontSize: 20 }}>✕</button>
            </div>
          )}

          <form onSubmit={onSubmit} className="chat-input-wrapper">
            <input
              ref={fileInputRef}
              type="file"
              accept=".sas,.sql,.csv,.txt,.xlsx,.xls,.json,image/*,.png,.jpg,.jpeg,.webp"
              multiple
              style={{ display: 'none' }}
              onChange={handleImportFile}
            />
            <button
              type="button"
              className="chat-send-btn"
              title="Importer un fichier (SAS, SQL, CSV, Excel) ou une image d'un ancien MCD/ERD — Marty en déduit le modèle"
              disabled={isLoading || importing}
              onClick={() => fileInputRef.current?.click()}
              style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}
            >
              {importing ? '⏳' : '📎'}
            </button>
            {micSupported && (
              <button
                type="button"
                className="chat-send-btn"
                title={listening ? 'Arrêter la dictée' : 'Parler à Marty (saisie vocale)'}
                disabled={isLoading}
                onClick={toggleMic}
                style={{ background: listening ? 'var(--accent-red)' : 'var(--bg-input)', color: listening ? '#fff' : 'var(--text-secondary)', animation: listening ? 'micPulse 1.3s ease-in-out infinite' : 'none' }}
              >
                {listening ? (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                ) : (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
                )}
              </button>
            )}
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
            <button type="submit" className="chat-send-btn" disabled={isLoading || (!input.trim() && pendingImages.length === 0)}>
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
