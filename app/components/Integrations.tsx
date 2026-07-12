'use client';

import { useState } from 'react';
import { useWorkshopStore } from '@/lib/store';

type Status = 'soon' | 'planned' | 'vision';

interface Connector {
  name: string;
  cat: 'Import' | 'Export' | 'Gouvernance' | 'Écosystème';
  desc: string;
  status: Status;
  icon: React.ReactNode;
  color: string;
}

const STATUS_META: Record<Status, { label: string; color: string; bg: string }> = {
  soon: { label: 'Bientôt', color: '#047857', bg: 'rgba(4,120,87,0.10)' },
  planned: { label: 'Prévu', color: '#2563EB', bg: 'rgba(37,99,235,0.10)' },
  vision: { label: 'Vision', color: '#7C3AED', bg: 'rgba(124,58,237,0.10)' },
};

// Petites icônes SVG neutres (pas de logos de marque)
const I = {
  db: <><ellipse cx="12" cy="6" rx="7" ry="2.6" /><path d="M5 6v12c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6V6" /><path d="M5 12c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6" /></>,
  git: <><circle cx="6" cy="6" r="2.5" /><circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="8" r="2.5" /><path d="M6 8.5v7M18 10.5a6 6 0 0 1-6 6H8.5" /></>,
  shield: <><path d="M12 3l7 3v5c0 4.2-2.9 7.4-7 9-4.1-1.6-7-4.8-7-9V6l7-3Z" /><path d="M9.2 12l2 2 3.6-3.8" /></>,
  chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
  play: <><ellipse cx="12" cy="6" rx="7" ry="2.6" /><path d="M5 6v12c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6V6" /><path d="M11 12.5v4l3-2Z" /></>,
  store: <><path d="M3 9l1.5-5h15L21 9" /><path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9" /><path d="M9 20v-6h6v6" /></>,
};

const PHASES: { n: number; title: string; sub: string; connectors: Connector[] }[] = [
  {
    n: 1, title: 'Phase 1 — Partir de l’existant, livrer en prod',
    sub: 'Les connecteurs à plus forte valeur : importer un schéma existant et pousser le projet dbt généré.',
    connectors: [
      { name: 'Import de schéma (SQL / Snowflake)', cat: 'Import', color: '#0D9488', icon: I.db, status: 'soon',
        desc: 'Marty lit un schéma existant (base SQL ou Snowflake, en lecture seule) et le reverse-engineer en modèle documenté. Fini la feuille blanche.' },
      { name: 'Push dbt vers Git', cat: 'Export', color: '#D97706', icon: I.git, status: 'soon',
        desc: 'Publie le projet dbt généré (models, schema.yml, tests) directement dans un dépôt Git — le vrai dernier kilomètre vers la prod.' },
    ],
  },
  {
    n: 2, title: 'Phase 2 — Gouvernance & diffusion',
    sub: 'Brancher Marty au catalogue de gouvernance et aux outils de restitution.',
    connectors: [
      { name: 'Collibra', cat: 'Gouvernance', color: '#059669', icon: I.shield, status: 'planned',
        desc: 'Publie entités, dictionnaire, glossaire et lineage dans le catalogue de gouvernance — parfaitement aligné avec le Design Authority (DAD).' },
      { name: 'Exécution DDL Snowflake', cat: 'Export', color: '#2563EB', icon: I.play, status: 'planned',
        desc: 'Exécute le DDL SQL généré sur un environnement Snowflake (dev/bac à sable) pour matérialiser le modèle.' },
      { name: 'Power BI', cat: 'Export', color: '#7C3AED', icon: I.chart, status: 'planned',
        desc: 'Expose le modèle comme dataset Power BI pour accélérer la restitution.' },
    ],
  },
  {
    n: 3, title: 'Phase 3 — Écosystème (vision)',
    sub: 'Pertinent uniquement si Marty s’ouvre à d’autres entités / en SaaS. Sinon on reste sur des intégrations curées.',
    connectors: [
      { name: 'Marketplace de connecteurs', cat: 'Écosystème', color: '#DB2777', icon: I.store, status: 'vision',
        desc: 'Un catalogue où des tiers publient des connecteurs (SDK, sandbox, revue de sécurité). À n’envisager qu’en cas d’ouverture multi-société.' },
    ],
  },
];

export default function Integrations() {
  const { logActivity } = useWorkshopStore();
  const [voted, setVoted] = useState<Record<string, boolean>>({});

  const vote = (name: string) => {
    if (voted[name]) return;
    setVoted((v) => ({ ...v, [name]: true }));
    logActivity('integration_interest', name).catch(() => {});
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
      <div style={{ maxWidth: 1040, margin: '0 auto' }}>
        {/* Hero */}
        <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 20, padding: '28px 30px', marginBottom: 22, color: '#fff', background: 'linear-gradient(135deg,#065F46 0%,#047857 45%,#0D9488 100%)', boxShadow: '0 14px 40px rgba(4,120,87,0.28)' }}>
          <div style={{ position: 'absolute', top: -60, right: -40, width: 240, height: 240, borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }} />
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11.5, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', background: 'rgba(255,255,255,0.16)', padding: '4px 11px', borderRadius: 999, marginBottom: 12 }}>Aperçu · feuille de route</div>
            <h2 style={{ fontSize: 26, margin: '0 0 6px', fontWeight: 800, letterSpacing: -0.5 }}>Intégrations & connecteurs</h2>
            <p style={{ fontSize: 14, opacity: 0.92, lineHeight: 1.55, maxWidth: 640, margin: 0 }}>
              Brancher Marty à votre stack data — import depuis l’existant, export vers vos outils. Ceci est une <strong>maquette</strong> pour recueillir votre intérêt : cliquez « Ça m’intéresse » sur ce qui vous serait utile.
            </p>
          </div>
        </div>

        {PHASES.map((ph) => (
          <div key={ph.n} style={{ marginBottom: 30 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
              <span style={{ fontFamily: 'var(--font-mono, ui-monospace, monospace)', fontSize: 12, fontWeight: 700, color: 'var(--primary)', letterSpacing: 0.5 }}>PHASE {ph.n}</span>
              <h3 style={{ fontSize: 18, margin: 0, fontWeight: 700 }}>{ph.title.replace(/^Phase \d+ — /, '')}</h3>
            </div>
            <p style={{ fontSize: 13.5, color: 'var(--text-muted)', margin: '0 0 16px', lineHeight: 1.5, maxWidth: 720 }}>{ph.sub}</p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
              {ph.connectors.map((c) => {
                const st = STATUS_META[c.status];
                const done = voted[c.name];
                return (
                  <div key={c.name} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ width: 42, height: 42, borderRadius: 12, background: c.color + '18', color: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{c.icon}</svg>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.25 }}>{c.name}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{c.cat}</div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999, color: st.color, background: st.bg, whiteSpace: 'nowrap' }}>{st.label}</span>
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0, flex: 1 }}>{c.desc}</p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" disabled style={{ flex: 'none', fontSize: 12.5, fontWeight: 600, padding: '8px 14px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-muted)', cursor: 'not-allowed' }}>Connecter</button>
                      <button type="button" onClick={() => vote(c.name)} disabled={done}
                        style={{ flex: 1, fontSize: 12.5, fontWeight: 700, padding: '8px 14px', borderRadius: 9, cursor: done ? 'default' : 'pointer',
                          border: done ? '1px solid var(--border-active)' : 'none',
                          background: done ? 'var(--primary-glow)' : 'var(--primary)', color: done ? 'var(--primary-light)' : '#fff' }}>
                        {done ? '✓ Intérêt enregistré' : '👍 Ça m’intéresse'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0 20px', lineHeight: 1.5 }}>
          Vos votes sont enregistrés dans l’activité (visibles par l’admin dans la Supervision) — ils servent à prioriser les connecteurs réellement utiles.<br />
          Sécurité : tout connecteur utiliserait des identifiants <strong>côté serveur uniquement</strong>, sur des environnements de dev/bac à sable en premier.
        </div>
      </div>
    </div>
  );
}
