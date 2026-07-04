'use client';

import { useState, useEffect, useRef } from 'react';
import { useWorkshopStore } from '@/lib/store';
import { STEPS } from '@/lib/constants';

type Item = { key: string; text: string };
let uid = 0;
const mkKey = () => `q_${Date.now()}_${uid++}`;

// Page admin : pilotage des questions posées par Marty à chaque étape.
export default function QuestionsAdmin() {
  const { stepQuestions, loadStepQuestions, seedStepQuestions, saveStepQuestions, setCurrentPage } = useWorkshopStore();
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<Item[]>([]);
  const [newText, setNewText] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const dragIndex = useRef<number | null>(null);

  useEffect(() => { loadStepQuestions(); }, [loadStepQuestions]);

  // (Re)charge le brouillon de l'étape courante depuis le store
  useEffect(() => {
    setDraft((stepQuestions[step] || []).map((q) => ({ key: q.id, text: q.text })));
    setDirty(false);
    setSaved(false);
  }, [step, stepQuestions]);

  const def = STEPS.find((s) => s.id === step);
  const hasCustom = (stepQuestions[step]?.length || 0) > 0 || draft.length > 0;

  const mutate = (next: Item[]) => { setDraft(next); setDirty(true); setSaved(false); };

  function onDrop(target: number) {
    const from = dragIndex.current;
    dragIndex.current = null;
    if (from === null || from === target) return;
    const next = [...draft];
    const [moved] = next.splice(from, 1);
    next.splice(target, 0, moved);
    mutate(next);
  }

  async function validate() {
    await saveStepQuestions(step, draft.map((d) => d.text));
    setDirty(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div style={{ padding: 40, overflowY: 'auto', flex: 1, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: 'var(--primary)', marginBottom: 8 }}>Questions de l&apos;atelier</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.6, margin: 0, maxWidth: 640 }}>
            Définissez les questions que <strong>Marty</strong> pose à chaque étape. <strong>Glissez</strong> pour réordonner, puis <strong>Validez</strong>. Elles sont injectées dans le contexte de Marty (prioritaires) et affichées comme suggestions.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button className="suggested-chip" onClick={() => setCurrentPage('dashboard')}>← Accueil</button>
          <button className="suggested-chip" onClick={() => setCurrentPage('products')}>Data Products</button>
        </div>
      </div>

      <div className="context-card" style={{ padding: 28 }}>
        {/* Sélecteur d'étape */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
          {STEPS.map((s) => (
            <button
              key={s.id}
              onClick={() => setStep(s.id)}
              className="suggested-chip"
              style={step === s.id ? { background: 'var(--primary-glow)', borderColor: 'var(--border-active)', color: 'var(--primary-light)', fontWeight: 700 } : {}}
            >
              {s.id}. {s.titleShort}{(stepQuestions[s.id]?.length || 0) > 0 ? ` (${stepQuestions[s.id].length})` : ''}
            </button>
          ))}
        </div>

        <div style={{ fontWeight: 700, marginBottom: 10 }}>{def?.icon} Étape {step} — {def?.title}</div>

        {!hasCustom ? (
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>
              Aucune question personnalisée : Marty utilise les <strong>questions par défaut</strong> ci-dessous.
            </div>
            <ul style={{ paddingLeft: 18, fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.8, margin: '0 0 12px' }}>
              {(def?.questions || []).map((q, i) => <li key={i}>{q}</li>)}
              {(def?.questions || []).length === 0 && <li style={{ listStyle: 'none', color: 'var(--text-muted)' }}>— (étape sans question, ex. Validation)</li>}
            </ul>
            <button className="cta-btn" onClick={() => seedStepQuestions(step, def?.questions || [])} disabled={(def?.questions || []).length === 0}>
              Personnaliser cette étape
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {draft.map((q, i) => (
              <div
                key={q.key}
                draggable
                onDragStart={() => { dragIndex.current = i; }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(i)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-surface)', borderRadius: 8 }}
              >
                <span title="Glisser pour réordonner" style={{ cursor: 'grab', color: 'var(--text-muted)', display: 'flex', flexShrink: 0, paddingLeft: 2 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="8" cy="6" r="1.6" /><circle cx="8" cy="12" r="1.6" /><circle cx="8" cy="18" r="1.6" /><circle cx="15" cy="6" r="1.6" /><circle cx="15" cy="12" r="1.6" /><circle cx="15" cy="18" r="1.6" /></svg>
                </span>
                <span style={{ width: 20, flexShrink: 0, textAlign: 'right', color: 'var(--text-muted)', fontSize: 13 }}>{i + 1}.</span>
                <input
                  value={q.text}
                  onChange={(e) => mutate(draft.map((d, j) => j === i ? { ...d, text: e.target.value } : d))}
                  className="chat-input"
                  style={{ flex: 1, height: 42 }}
                />
                <button onClick={() => mutate(draft.filter((_, j) => j !== i))} title="Supprimer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, flexShrink: 0, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--accent-red)', cursor: 'pointer', fontSize: 18 }}>×</button>
              </div>
            ))}

            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && newText.trim()) { mutate([...draft, { key: mkKey(), text: newText.trim() }]); setNewText(''); } }}
                placeholder="Ajouter une question…"
                className="chat-input"
                style={{ flex: 1, height: 42 }}
              />
              <button className="suggested-chip" onClick={() => { if (newText.trim()) { mutate([...draft, { key: mkKey(), text: newText.trim() }]); setNewText(''); } }} disabled={!newText.trim()} style={{ opacity: newText.trim() ? 1 : 0.5 }}>
                + Ajouter
              </button>
            </div>

            {/* Barre d'action */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <button className="cta-btn" onClick={validate} disabled={!dirty} style={{ opacity: dirty ? 1 : 0.5 }}>Valider</button>
              {saved && <span style={{ fontSize: 13.5, color: 'var(--primary)', fontWeight: 600 }}>✓ Enregistré</span>}
              {dirty && !saved && <span style={{ fontSize: 13, color: 'var(--accent-amber)' }}>Modifications non enregistrées</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
