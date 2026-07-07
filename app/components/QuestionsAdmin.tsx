'use client';

import { useEffect, useState } from 'react';
import { useWorkshopStore } from '@/lib/store';
import { STEPS } from '@/lib/constants';
import type { StepDefinition } from '@/lib/types';

// Rôles sémantiques d'une étape : déterminent si l'étape est « bloquante »
// (données attendues) et ce que Marty collecte. « custom » = guidage libre.
const KEY_OPTIONS: { value: string; label: string }[] = [
  { value: 'context', label: 'Contexte (produit)' },
  { value: 'concepts', label: 'Entités (tables)' },
  { value: 'relations', label: 'Relations' },
  { value: 'attributes', label: 'Attributs / clés' },
  { value: 'kpis', label: 'KPI' },
  { value: 'rules', label: 'Règles métier' },
  { value: 'validation', label: 'Validation (livrables)' },
  { value: 'custom', label: 'Personnalisée (libre)' },
];

const clone = (s: StepDefinition[]): StepDefinition[] => s.map((x, i) => ({ ...x, id: i + 1, questions: [...x.questions] }));

export default function QuestionsAdmin() {
  const { steps, loadSteps, saveSteps, setCurrentPage } = useWorkshopStore();
  const [draft, setDraft] = useState<StepDefinition[]>(() => clone(STEPS));
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadSteps(); }, [loadSteps]);
  useEffect(() => { setDraft(clone(steps && steps.length ? steps : STEPS)); setDirty(false); }, [steps]);

  const mutate = (next: StepDefinition[]) => { setDraft(next.map((s, i) => ({ ...s, id: i + 1 }))); setDirty(true); setSaved(false); };
  const patch = (i: number, p: Partial<StepDefinition>) => mutate(draft.map((s, idx) => (idx === i ? { ...s, ...p } : s)));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir; if (j < 0 || j >= draft.length) return;
    const next = [...draft]; [next[i], next[j]] = [next[j], next[i]]; mutate(next);
  };
  const removeStep = (i: number) => mutate(draft.filter((_, idx) => idx !== i));
  const addStep = () => mutate([...draft, { id: draft.length + 1, key: 'custom', title: 'Nouvelle étape', titleShort: 'Étape', icon: '📝', description: '', questions: [''], optional: true }]);

  const setQ = (i: number, qi: number, text: string) => patch(i, { questions: draft[i].questions.map((q, k) => (k === qi ? text : q)) });
  const addQ = (i: number) => patch(i, { questions: [...draft[i].questions, ''] });
  const delQ = (i: number, qi: number) => patch(i, { questions: draft[i].questions.filter((_, k) => k !== qi) });

  async function save() {
    setSaving(true);
    const cleaned = draft
      .filter((s) => (s.titleShort || s.title).trim())
      .map((s, i) => ({ ...s, id: i + 1, questions: s.questions.map((q) => q.trim()).filter(Boolean) }));
    await saveSteps(cleaned);
    setSaving(false); setDirty(false); setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }
  function resetDefault() {
    if (!confirm('Rétablir les 7 étapes par défaut ? Vos étapes personnalisées seront remplacées.')) return;
    mutate(clone(STEPS));
  }

  const inp: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-elevated)', color: 'var(--text)', fontSize: 13, padding: '7px 10px', outline: 'none' };
  const iconBtn: React.CSSProperties = { width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', borderRadius: 7, background: 'var(--bg-surface)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 };

  return (
    <div style={{ padding: 40, overflowY: 'auto', flex: 1, maxWidth: 920, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: 'var(--primary)', marginBottom: 8 }}>Étapes &amp; questions de l&apos;atelier</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14.5, lineHeight: 1.6, margin: 0, maxWidth: 680 }}>
            Décidez du <strong>nombre d&apos;étapes</strong> et de leur contenu : ajoutez, supprimez, réordonnez, et définissez les <strong>questions</strong> que <strong>Marty</strong> pose à chacune. Les questions sont injectées dans le contexte de Marty (prioritaires) et affichées comme suggestions.
          </p>
        </div>
        <button onClick={() => setCurrentPage('dashboard')} style={{ ...iconBtn, width: 'auto', padding: '6px 12px', fontSize: 12.5 }}>✕ Fermer</button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="cta-btn" onClick={save} disabled={!dirty || saving} style={{ opacity: dirty && !saving ? 1 : 0.5 }}>{saving ? 'Enregistrement…' : 'Enregistrer les étapes'}</button>
        <button className="suggested-chip" onClick={resetDefault}>↺ Rétablir par défaut</button>
        <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{draft.length} étape(s)</span>
        {saved && <span style={{ fontSize: 12.5, color: 'var(--accent-emerald)', fontWeight: 600 }}>✓ Enregistré — appliqué à tous les ateliers</span>}
        {dirty && !saved && <span style={{ fontSize: 12.5, color: 'var(--accent-amber)' }}>Modifications non enregistrées</span>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {draft.map((s, i) => (
          <div key={i} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
              <span style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--primary-glow)', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, flexShrink: 0 }}>{i + 1}</span>
              <input value={s.icon} onChange={(e) => patch(i, { icon: e.target.value })} title="Icône (emoji)" style={{ ...inp, width: 46, textAlign: 'center', fontSize: 16 }} />
              <input value={s.titleShort} onChange={(e) => patch(i, { titleShort: e.target.value })} placeholder="Nom court" style={{ ...inp, width: 150 }} />
              <input value={s.title} onChange={(e) => patch(i, { title: e.target.value })} placeholder="Titre complet" style={{ ...inp, flex: 1, minWidth: 180 }} />
              <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
                <button style={iconBtn} title="Monter" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
                <button style={iconBtn} title="Descendre" onClick={() => move(i, 1)} disabled={i === draft.length - 1}>↓</button>
                <button style={{ ...iconBtn, color: 'var(--accent-red)' }} title="Supprimer l'étape" onClick={() => removeStep(i)}>✕</button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                Rôle
                <select value={s.key} onChange={(e) => patch(i, { key: e.target.value })} style={{ ...inp, padding: '6px 8px' }} title="Détermine les données attendues à cette étape">
                  {KEY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
              <label style={{ fontSize: 12.5, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!s.optional} onChange={(e) => patch(i, { optional: e.target.checked })} /> Optionnelle
              </label>
              <input value={s.description} onChange={(e) => patch(i, { description: e.target.value })} placeholder="Description de l'étape" style={{ ...inp, flex: 1, minWidth: 220 }} />
            </div>

            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>Questions posées par Marty</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {s.questions.map((q, qi) => (
                <div key={qi} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{qi + 1}.</span>
                  <input value={q} onChange={(e) => setQ(i, qi, e.target.value)} placeholder="Question…" style={{ ...inp, flex: 1 }} />
                  <button style={{ ...iconBtn, color: 'var(--accent-red)' }} title="Supprimer" onClick={() => delQ(i, qi)}>✕</button>
                </div>
              ))}
              <button className="suggested-chip" onClick={() => addQ(i)} style={{ alignSelf: 'flex-start', marginTop: 2 }}>+ Ajouter une question</button>
            </div>
          </div>
        ))}
      </div>

      <button onClick={addStep} style={{ marginTop: 16, width: '100%', padding: '12px 0', border: '1px dashed var(--border-active)', borderRadius: 10, background: 'var(--primary-glow)', color: 'var(--primary-light)', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>+ Ajouter une étape</button>

      <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
        <button className="cta-btn" onClick={save} disabled={!dirty || saving} style={{ opacity: dirty && !saving ? 1 : 0.5 }}>{saving ? 'Enregistrement…' : 'Enregistrer les étapes'}</button>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>
        Astuce : la <strong>dernière étape</strong> clôture l&apos;atelier (bouton « Terminer ») et génère les livrables. Les étapes de rôle <strong>Entités / Relations / Attributs</strong> affichent « Données collectées » quand le modèle contient ces éléments.
      </p>
    </div>
  );
}
