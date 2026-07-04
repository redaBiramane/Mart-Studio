'use client';

import { useState, useEffect } from 'react';
import { useWorkshopStore } from '@/lib/store';
import { STEPS } from '@/lib/constants';

// Page admin : pilotage des questions posées par Marty à chaque étape.
export default function QuestionsAdmin() {
  const { stepQuestions, loadStepQuestions, addStepQuestion, updateStepQuestion, deleteStepQuestion, seedStepQuestions } = useWorkshopStore();
  const [step, setStep] = useState(1);
  const [newText, setNewText] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => { loadStepQuestions(); }, [loadStepQuestions]);

  const def = STEPS.find((s) => s.id === step);
  const qs = stepQuestions[step] || [];
  const hasCustom = qs.length > 0;

  return (
    <div style={{ padding: 40, overflowY: 'auto', flex: 1, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 28, fontWeight: 800, color: 'var(--primary)', marginBottom: 8 }}>Questions de l&apos;atelier</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.6 }}>
          Définissez les questions que <strong>Marty</strong> pose à chaque étape. Elles sont enregistrées côté serveur, <strong>injectées dans le contexte de Marty</strong> (prioritaires sur les questions par défaut) et affichées comme suggestions dans l&apos;atelier.
        </p>
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
            {qs.map((q, i) => (
              <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 22, flexShrink: 0, textAlign: 'right', color: 'var(--text-muted)', fontSize: 13 }}>{i + 1}.</span>
                <input
                  value={drafts[q.id] ?? q.text}
                  onChange={(e) => setDrafts({ ...drafts, [q.id]: e.target.value })}
                  onBlur={() => {
                    const v = (drafts[q.id] ?? q.text).trim();
                    if (v && v !== q.text) updateStepQuestion(q.id, v);
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                  className="chat-input"
                  style={{ flex: 1, height: 42 }}
                />
                <button onClick={() => deleteStepQuestion(q.id)} title="Supprimer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, flexShrink: 0, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--accent-red)', cursor: 'pointer', fontSize: 18 }}>×</button>
              </div>
            ))}

            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && newText.trim()) { addStepQuestion(step, newText.trim()); setNewText(''); } }}
                placeholder="Ajouter une question…"
                className="chat-input"
                style={{ flex: 1, height: 42 }}
              />
              <button className="cta-btn" onClick={() => { if (newText.trim()) { addStepQuestion(step, newText.trim()); setNewText(''); } }} disabled={!newText.trim()} style={{ opacity: newText.trim() ? 1 : 0.5 }}>
                + Ajouter
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
