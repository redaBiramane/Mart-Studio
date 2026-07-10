'use client';

import { useState, useMemo, useEffect } from 'react';
import { useWorkshopStore } from '@/lib/store';
import { WorkshopSession, Entity } from '@/lib/types';
import { MATURITY_DIMENSIONS } from '@/lib/constants';
import { lintModel, applyPatches, qualityScore, type Finding, type Severity, type LinterPatch } from '@/lib/linter';
import MermaidDiagram from './MermaidDiagram';
import { transformMany } from '@/lib/naming';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

type Tab = 'overview' | 'semantic' | 'quality' | 'report' | 'mcd' | 'dimensional' | 'dbml' | 'sql' | 'dbt' | 'dictionary' | 'dad';

export default function Deliverables() {
  const { session } = useWorkshopStore();
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  if (!session || session.entities.length === 0) {
    return (
      <div className="empty-state" style={{ flex: 1 }}>
        <div className="empty-state-icon">📦</div>
        <div className="empty-state-text">
          Complétez au moins les premières étapes de l&apos;atelier pour générer des livrables.
        </div>
      </div>
    );
  }

  const data = enrichSession(session);

  // Contrôle qualité pour la « validation avant génération » (onglets code).
  const gateFindings = lintModel(session).filter((f) => !(session.dismissedFindings || []).includes(f.id));
  const gateScore = qualityScore(gateFindings);
  const gateErrors = gateFindings.filter((f) => f.severity === 'error').length;
  const gateWarnings = gateFindings.filter((f) => f.severity === 'warning').length;
  const genTabs: Tab[] = ['mcd', 'dimensional', 'dbml', 'sql', 'dbt'];
  const showGate = genTabs.includes(activeTab) && (gateErrors > 0 || gateScore < 70);

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'overview', label: 'Vue d\'ensemble', icon: 'overview' },
    { key: 'semantic', label: 'Semantic Layer', icon: 'semantic' },
    { key: 'quality', label: 'Qualité', icon: 'quality' },
    { key: 'report', label: 'Rapport détaillé (PDF)', icon: 'report' },
    { key: 'mcd', label: 'MCD / ERD', icon: 'mcd' },
    { key: 'dimensional', label: 'Étoile / Flocon', icon: 'dimensional' },
    { key: 'dbml', label: 'DBML (dbdiagram.io)', icon: 'dbml' },
    { key: 'sql', label: 'SQL DDL', icon: 'sql' },
    { key: 'dbt', label: 'dbt YAML', icon: 'dbt' },
    { key: 'dictionary', label: 'Dictionnaire', icon: 'dictionary' },
  ];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, padding: '12px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)', overflowX: 'auto' }}>
        {tabs.map(t => (
          <button key={t.key} className={`suggested-chip ${activeTab === t.key ? 'active' : ''}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, ...(activeTab === t.key ? { background: 'var(--primary-glow)', borderColor: 'var(--border-active)', color: 'var(--primary-light)' } : {}) }}
            onClick={() => setActiveTab(t.key)}>
            <DIcon name={t.icon} size={15} /> {t.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        {showGate && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', background: gateErrors > 0 ? 'rgba(220,38,38,0.07)' : 'rgba(217,119,6,0.07)', border: `1px solid ${gateErrors > 0 ? 'var(--accent-red)' : 'var(--accent-amber)'}`, borderRadius: 10, padding: '12px 16px', marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 240 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={gateErrors > 0 ? 'var(--accent-red)' : 'var(--accent-amber)'} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></svg>
              <div style={{ fontSize: 13, lineHeight: 1.45 }}>
                <strong>Qualité insuffisante avant génération</strong> — score {gateScore}/100 · {gateErrors} erreur(s), {gateWarnings} avertissement(s).{' '}
                {gateErrors > 0 ? 'Corrigez les erreurs pour un livrable fiable.' : 'Le modèle peut être amélioré avant export.'}
              </div>
            </div>
            <button className="cta-btn" style={{ whiteSpace: 'nowrap' }} onClick={() => setActiveTab('quality')}>Voir l&apos;onglet Qualité →</button>
          </div>
        )}
        {activeTab === 'overview' && <OverviewTab session={data} />}
        {activeTab === 'semantic' && <SemanticTab session={data} />}
        {activeTab === 'quality' && <QualityTab />}
        {activeTab === 'report' && <ReportTab session={data} />}
        {activeTab === 'mcd' && <MCDTab session={data} />}
        {activeTab === 'dimensional' && <DimensionalTab session={data} />}
        {activeTab === 'dbml' && <DbmlTab session={data} />}
        {activeTab === 'sql' && <SQLTab session={data} />}
        {activeTab === 'dbt' && <DbtTab session={data} />}
        {activeTab === 'dictionary' && <DictionaryTab session={data} />}
        {activeTab === 'dad' && <DADTab session={data} />}
      </div>
    </div>
  );
}

// Icônes SVG (remplacent les emojis) — cohérentes avec le reste du site.
function DIcon({ name, size = 16 }: { name: string; size?: number }) {
  const p: Record<string, React.ReactNode> = {
    overview: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
    semantic: <><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" /><path d="M8 10h8M8 13.5h5" /></>,
    quality: <><path d="M12 3l7 3v5c0 4.2-2.9 7.4-7 9-4.1-1.6-7-4.8-7-9V6l7-3Z" /><path d="M9.2 12l2 2 3.6-3.8" /></>,
    report: <><path d="M14 3v5h5" /><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M8 13h8M8 17h5" /></>,
    mcd: <><rect x="3" y="4" width="8" height="6" rx="1" /><rect x="13" y="14" width="8" height="6" rx="1" /><path d="M7 10v2a2 2 0 0 0 2 2h4" /></>,
    dimensional: <><path d="M12 2v20M2 12h20M4.9 4.9l14.2 14.2M19.1 4.9 4.9 19.1" /></>,
    dbml: <><path d="M8 8l-4 4 4 4M16 8l4 4-4 4" /></>,
    sql: <><ellipse cx="12" cy="6" rx="7" ry="2.6" /><path d="M5 6v12c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6V6" /><path d="M5 12c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6" /></>,
    dbt: <><circle cx="12" cy="12" r="3.2" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M19.4 4.6l-2.1 2.1M6.7 17.3l-2.1 2.1" /></>,
    dictionary: <><path d="M6.5 2H18a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" /><path d="M8 7h8M8 11h6" /></>,
    dad: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4h6v3H9z" /><path d="M8 12l2 2 4-4" /></>,
    entities: <><rect x="3" y="4" width="7" height="7" rx="1.5" /><rect x="14" y="4" width="7" height="7" rx="1.5" /><rect x="8.5" y="14" width="7" height="6" rx="1.5" /></>,
    relations: <><circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><circle cx="18" cy="6" r="2.5" /><path d="M8.5 6H15M6 8.5V15a3 3 0 0 0 3 3h6.5" /></>,
    attributes: <><path d="M20.5 11 13 3.5 4 4l-.5 9L11 20.5Z" /><circle cx="8" cy="8" r="1.3" /></>,
    kpis: <><path d="M3 12h4l2.5-7 5 14 2.5-7H21" /></>,
    rules: <><path d="M12 3v18M5 21h14M6.5 6.5l-3 6a3 3 0 0 0 6 0Zm11 0-3 6a3 3 0 0 0 6 0ZM9 5.5l6-1" /></>,
    sources: <><rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" /><path d="M10 12h4" /></>,
    star: <><path d="M12 3l2.5 5.3 5.5.7-4 3.9 1 5.6L12 18.9 7 21.5l1-5.6-4-3.9 5.5-.7Z" /></>,
    cube: <><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9Z" /><path d="M12 3v18M4 7.5l8 4.5 8-4.5" /></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: '-3px', flexShrink: 0 }}>
      {p[name] || <circle cx="12" cy="12" r="9" />}
    </svg>
  );
}

function Donut({ pct, label, sub, color }: { pct: number; label: string; sub: string; color: string }) {
  const r = 34, c = 2 * Math.PI * r;
  const off = c - (Math.max(0, Math.min(100, pct)) / 100) * c;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg width="92" height="92" viewBox="0 0 92 92">
        <circle cx="46" cy="46" r={r} fill="none" stroke="var(--border)" strokeWidth="9" />
        <circle cx="46" cy="46" r={r} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 46 46)" />
        <text x="46" y="51" textAnchor="middle" fontSize="19" fontWeight="800" fill="var(--text)">{Math.round(pct)}%</text>
      </svg>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', textAlign: 'center' }}>{label}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sub}</div>
    </div>
  );
}

function BarRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
      <div style={{ width: 130, fontSize: 12, color: 'var(--text-secondary)', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
      <div style={{ flex: 1, background: 'var(--bg-elevated)', borderRadius: 6, height: 16 }}>
        <div style={{ width: `${pct}%`, background: color, height: '100%', borderRadius: 6, minWidth: value > 0 ? 4 : 0, transition: 'width .3s' }} />
      </div>
      <div style={{ width: 26, fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{value}</div>
    </div>
  );
}

// Grande tuile KPI cliquable, avec halo coloré et effet de survol.
function KpiTile({ icon, value, label, color, onClick }: { icon: string; value: number; label: string; color: string; onClick?: () => void }) {
  const [hover, setHover] = useState(false);
  const clickable = !!onClick;
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative', overflow: 'hidden', background: 'var(--bg-surface)',
        border: `1px solid ${hover && clickable ? color : 'var(--border)'}`, borderRadius: 16, padding: '18px 18px',
        cursor: clickable ? 'pointer' : 'default', transition: 'transform .18s ease, box-shadow .18s ease, border-color .18s',
        transform: hover && clickable ? 'translateY(-3px)' : 'none',
        boxShadow: hover && clickable ? '0 12px 30px rgba(0,0,0,0.10)' : '0 1px 2px rgba(0,0,0,0.03)',
      }}
    >
      <div style={{ position: 'absolute', top: -22, right: -22, width: 84, height: 84, borderRadius: '50%', background: color, opacity: hover && clickable ? 0.12 : 0.06, transition: 'opacity .18s' }} />
      <div style={{ width: 42, height: 42, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: color + '1A', color, marginBottom: 12 }}>
        <DIcon name={icon} size={22} />
      </div>
      <div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1, color: 'var(--text)', letterSpacing: -0.5 }}>{value}</div>
      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}>
        {label}{clickable && <span style={{ transition: 'transform .18s', transform: hover ? 'translateX(3px)' : 'none', color, fontWeight: 700 }}>→</span>}
      </div>
    </div>
  );
}

// Petite tuile d'indicateur de santé, avec barre d'accent à gauche.
function HealthTile({ value, label, color, hint, onClick }: { value: string | number; label: string; color: string; hint?: string; onClick?: () => void }) {
  const [hover, setHover] = useState(false);
  const clickable = !!onClick;
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={hint}
      style={{
        position: 'relative', overflow: 'hidden', background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: 12, padding: '13px 14px 13px 18px', cursor: clickable ? 'pointer' : 'default',
        transition: 'transform .15s, box-shadow .15s', transform: hover && clickable ? 'translateY(-2px)' : 'none',
        boxShadow: hover && clickable ? '0 8px 20px rgba(0,0,0,0.08)' : 'none',
      }}
    >
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: color }} />
      <div style={{ fontSize: 23, fontWeight: 800, color, letterSpacing: -0.3 }}>{value}</div>
      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.3 }}>{label}</div>
    </div>
  );
}

function OverviewTab({ session }: { session: WorkshopSession }) {
  const [detail, setDetail] = useState<OverviewDetailKey | null>(null);

  const { facts, dims } = classifyDimensional(session);
  const nbEnt = session.entities.length;
  const attrsOf = (e: Entity) => session.attributes.filter(a => a.entityId === e.id || a.entityId === e.name);
  const entWithAttrs = session.entities.filter(e => attrsOf(e).length > 0).length;
  const entWithPk = session.entities.filter(e => attrsOf(e).some(a => a.isPrimaryKey)).length;
  const pkCount = session.attributes.filter(a => a.isPrimaryKey).length;
  const fkCount = session.attributes.filter(a => a.isForeignKey).length;
  const factRatio = nbEnt > 0 ? (facts.length / nbEnt) * 100 : 0;
  const avgScore = session.maturityScores ? Math.round(Object.values(session.maturityScores).reduce((a, b) => a + b, 0) / 7) : 0;

  // Métriques de couverture / qualité
  const nbAttr = session.attributes.length;
  const sensitiveCount = session.attributes.filter(a => a.isSensitive).length;
  const historizedCount = session.attributes.filter(a => a.isHistorized).length;
  const naturalKeyCount = session.attributes.filter(a => a.isNaturalKey).length;
  const requiredCount = session.attributes.filter(a => a.isRequired).length;
  const nnRel = session.relations.filter(r => r.type === 'N:N').length;
  const hierRel = session.relations.filter(r => r.isHierarchy).length;
  const entWithoutPk = nbEnt - entWithPk;
  const docPct = nbEnt ? Math.round((entWithAttrs / nbEnt) * 100) : 0;
  const requiredPct = nbAttr ? Math.round((requiredCount / nbAttr) * 100) : 0;

  const cards: { key: OverviewDetailKey; label: string; value: number; icon: string; color: string }[] = [
    { key: 'entities', label: 'Entités', value: nbEnt, icon: 'entities', color: '#059669' },
    { key: 'relations', label: 'Relations', value: session.relations.length, icon: 'relations', color: '#2563EB' },
    { key: 'attributes', label: 'Attributs', value: session.attributes.length, icon: 'attributes', color: '#7C3AED' },
    { key: 'kpis', label: 'KPIs', value: session.kpis.length, icon: 'kpis', color: '#D97706' },
    { key: 'rules', label: 'Règles', value: session.businessRules.length, icon: 'rules', color: '#DB2777' },
    { key: 'sources', label: 'Sources', value: session.dataSources.length, icon: 'sources', color: '#0D9488' },
  ];

  const topEntities = [...session.entities].map(e => ({ name: e.name, n: attrsOf(e).length })).sort((a, b) => b.n - a.n).slice(0, 8);
  const maxAttr = Math.max(1, ...topEntities.map(e => e.n));
  const cardBox: React.CSSProperties = { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 };

  // Verdict parlant selon la maturité et les manques structurels.
  const matColor = avgScore >= 70 ? '#059669' : avgScore >= 40 ? '#D97706' : '#DC2626';
  const verdict = avgScore >= 75 ? 'Modèle solide, prêt pour l’exploitation.'
    : avgScore >= 50 ? 'Bon modèle — quelques finitions possibles.'
    : avgScore >= 25 ? 'Modèle en cours de structuration.'
    : 'Modèle au démarrage.';
  const alerts: string[] = [];
  if (entWithoutPk > 0) alerts.push(`${entWithoutPk} entité(s) sans clé primaire`);
  if (docPct < 100 && nbEnt > 0) alerts.push(`${nbEnt - entWithAttrs} entité(s) sans attribut`);
  if (session.relations.length === 0 && nbEnt > 1) alerts.push('aucune relation définie');

  const c = 2 * Math.PI * 52;
  const off = c - (Math.max(0, Math.min(100, avgScore)) / 100) * c;

  return (
    <div className="fade-in">
      {/* ── HERO : identité produit + jauge de maturité + verdict ── */}
      <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 20, padding: '26px 28px', marginBottom: 20, color: '#fff', background: 'linear-gradient(135deg, #065F46 0%, #047857 45%, #0D9488 100%)', boxShadow: '0 14px 40px rgba(4,120,87,0.28)' }}>
        <div style={{ position: 'absolute', top: -60, right: -40, width: 260, height: 260, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ position: 'absolute', bottom: -80, left: 120, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
        <div style={{ position: 'relative', display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 11.5, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', background: 'rgba(255,255,255,0.16)', padding: '4px 11px', borderRadius: 999, marginBottom: 12 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: session.status === 'completed' ? '#34D399' : '#FCD34D' }} />
              {session.status === 'completed' ? 'Terminé' : `En cours · étape ${session.currentStep}/7`}
            </div>
            <h2 style={{ fontSize: 27, margin: '0 0 6px', fontWeight: 800, letterSpacing: -0.5, lineHeight: 1.1 }}>{session.productName || 'Data Product'}</h2>
            <div style={{ fontSize: 13.5, opacity: 0.9, lineHeight: 1.5, maxWidth: 560 }}>{session.objective || session.businessProblem || 'Tableau de bord synthétique du modèle de données.'}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
              {[
                session.domain && { l: 'Domaine', v: session.domain },
                session.productOwner && { l: 'PO', v: session.productOwner },
                session.dataSteward && { l: 'Data Steward', v: session.dataSteward },
                session.frequency && { l: 'Fréquence', v: session.frequency },
              ].filter(Boolean).map((m, i) => {
                const it = m as { l: string; v: string };
                return (
                  <span key={i} style={{ fontSize: 12, padding: '5px 11px', borderRadius: 8, background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(4px)' }}>
                    <span style={{ opacity: 0.75 }}>{it.l} : </span><strong>{it.v}</strong>
                  </span>
                );
              })}
            </div>
          </div>
          {/* Jauge de maturité */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, minWidth: 190 }}>
            <svg width="132" height="132" viewBox="0 0 132 132">
              <circle cx="66" cy="66" r="52" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="11" />
              <circle cx="66" cy="66" r="52" fill="none" stroke="#fff" strokeWidth="11" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 66 66)" style={{ transition: 'stroke-dashoffset .8s ease' }} />
              <text x="66" y="62" textAnchor="middle" fontSize="34" fontWeight="800" fill="#fff">{avgScore}</text>
              <text x="66" y="83" textAnchor="middle" fontSize="12" fill="rgba(255,255,255,0.85)">/ 100</text>
            </svg>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12.5, fontWeight: 700 }}>Maturité globale</div>
              <div style={{ fontSize: 11.5, opacity: 0.9, maxWidth: 200, marginTop: 2 }}>{verdict}</div>
            </div>
          </div>
        </div>
        {alerts.length > 0 && (
          <div style={{ position: 'relative', marginTop: 18, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {alerts.map((a, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '5px 11px', borderRadius: 8, background: 'rgba(253,224,71,0.18)', border: '1px solid rgba(253,224,71,0.35)' }}>
                <span>⚠</span> {a}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Indicateurs clés (cliquables) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 14 }}>
        {cards.map(s => (
          <KpiTile key={s.label} icon={s.icon} value={s.value} label={s.label} color={s.color} onClick={s.value > 0 ? () => setDetail(s.key) : undefined} />
        ))}
      </div>

      {/* ── Santé & couverture ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
        <HealthTile value={`${docPct}%`} label="Entités documentées" color="#059669" />
        <HealthTile value={entWithoutPk} label="Entités sans clé primaire" color={entWithoutPk > 0 ? '#D97706' : '#059669'} hint="Cliquez pour voir les entités" onClick={() => setDetail('entities')} />
        <HealthTile value={nnRel} label="Relations N:N" color="#2563EB" hint="Cliquez pour voir les relations" onClick={session.relations.length ? () => setDetail('relations') : undefined} />
        <HealthTile value={hierRel} label="Hiérarchies" color="#7C3AED" />
        <HealthTile value={sensitiveCount} label="Attributs sensibles (RGPD)" color={sensitiveCount > 0 ? '#E11D48' : '#94A3B8'} hint="Cliquez pour voir les attributs" onClick={() => setDetail('attributes')} />
        <HealthTile value={historizedCount} label="Attributs historisés" color="#2563EB" />
        <HealthTile value={naturalKeyCount} label="Clés naturelles" color="#059669" />
        <HealthTile value={`${requiredPct}%`} label="Attributs obligatoires" color="#059669" />
      </div>

      {/* ── Complétude + faits/dimensions ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginBottom: 20 }}>
        <div style={cardBox}>
          <div style={{ fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ color: 'var(--primary)' }}><DIcon name="quality" size={17} /></span> Complétude du modèle</div>
          <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: 12 }}>
            <Donut pct={nbEnt ? (entWithAttrs / nbEnt) * 100 : 0} label="Entités documentées" sub={`${entWithAttrs}/${nbEnt}`} color="#059669" />
            <Donut pct={nbEnt ? (entWithPk / nbEnt) * 100 : 0} label="Clés primaires" sub={`${entWithPk}/${nbEnt}`} color="#2563EB" />
            <Donut pct={avgScore} label="Maturité globale" sub={`${avgScore}/100`} color={matColor} />
          </div>
        </div>

        <div style={cardBox}>
          <div style={{ fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ color: '#D97706' }}><DIcon name="star" size={17} /></span> Répartition faits / dimensions</div>
          <div style={{ display: 'flex', height: 30, borderRadius: 8, overflow: 'hidden', marginBottom: 12, background: 'var(--bg-elevated)' }}>
            {facts.length > 0 && <div style={{ width: `${factRatio}%`, background: 'linear-gradient(90deg,#F59E0B,#D97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12.5, fontWeight: 700, transition: 'width .5s' }}>{facts.length}</div>}
            {dims.length > 0 && <div style={{ width: `${100 - factRatio}%`, background: 'linear-gradient(90deg,#059669,#0D9488)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12.5, fontWeight: 700, transition: 'width .5s' }}>{dims.length}</div>}
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 12.5, flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ display: 'inline-block', width: 10, height: 10, background: '#F59E0B', borderRadius: 2 }} /> Faits : <strong>{facts.length}</strong></span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ display: 'inline-block', width: 10, height: 10, background: '#059669', borderRadius: 2 }} /> Dimensions : <strong>{dims.length}</strong></span>
          </div>
          <div style={{ display: 'flex', gap: 22, marginTop: 18, flexWrap: 'wrap' }}>
            <div><div style={{ fontSize: 25, fontWeight: 800, color: '#059669' }}>{pkCount}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>clés primaires</div></div>
            <div><div style={{ fontSize: 25, fontWeight: 800, color: '#2563EB' }}>{fkCount}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>clés étrangères</div></div>
            <div><div style={{ fontSize: 25, fontWeight: 800, color: 'var(--text)' }}>{nbEnt ? Math.round(session.attributes.length / nbEnt) : 0}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>attributs / entité</div></div>
          </div>
        </div>
      </div>

      {/* ── Attributs par entité ── */}
      {topEntities.length > 0 && (
        <div style={{ ...cardBox, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ color: '#7C3AED' }}><DIcon name="attributes" size={17} /></span> Attributs par entité {session.entities.length > 8 && <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>(top 8)</span>}</div>
          {topEntities.map(e => <BarRow key={e.name} label={e.name} value={e.n} max={maxAttr} color="#7C3AED" />)}
        </div>
      )}

      {detail && <OverviewDetailModal session={session} detail={detail} onClose={() => setDetail(null)} />}

      {session.maturityScores && (
        <div style={cardBox}>
          <div style={{ fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ color: 'var(--primary)' }}><DIcon name="overview" size={17} /></span> Score de maturité par dimension</div>
          <div className="maturity-scores">
            {MATURITY_DIMENSIONS.map(dim => {
              const score = session.maturityScores![dim.key as keyof typeof session.maturityScores];
              return (
                <div key={dim.key} className="maturity-score-item">
                  <span className="maturity-score-label">{dim.label}</span>
                  <div className="maturity-score-bar">
                    <div className="maturity-score-fill" style={{ width: `${score}%`, background: dim.color }} />
                  </div>
                  <span className="maturity-score-value" style={{ color: dim.color }}>{score}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Onglet Qualité (linter MCD : version actuelle → améliorée, au choix) ----
const SEV_META: Record<Severity, { label: string; color: string; bg: string }> = {
  error: { label: 'Erreur', color: 'var(--accent-red)', bg: 'rgba(220,38,38,0.08)' },
  warning: { label: 'Avertissement', color: 'var(--accent-amber)', bg: 'rgba(217,119,6,0.08)' },
  info: { label: 'Info', color: 'var(--accent-blue)', bg: 'rgba(37,99,235,0.08)' },
};

function QualityTab() {
  const { session, updateSessionData } = useWorkshopStore();
  const [tick, setTick] = useState(0);
  const ignored = useMemo(() => new Set(session?.dismissedFindings ?? []), [session?.dismissedFindings]);
  const allFindings: Finding[] = useMemo(() => (session ? lintModel(session) : []), [session, tick]);
  const findings = allFindings.filter(f => !ignored.has(f.id));

  const score = qualityScore(allFindings);
  const nErr = findings.filter(f => f.severity === 'error').length;
  const nWarn = findings.filter(f => f.severity === 'warning').length;
  const nInfo = findings.filter(f => f.severity === 'info').length;
  const fixable = findings.filter(f => f.patch);

  function applyPatchList(patches: LinterPatch[]) {
    if (!session || !patches.length) return;
    const { entities, attributes } = applyPatches(session, patches);
    updateSessionData({ entities, attributes });
    setTick(t => t + 1);
  }
  const validateOne = (f: Finding) => f.patch && applyPatchList([f.patch]);
  const validateAll = () => applyPatchList(fixable.map(f => f.patch!));
  const ignoreOne = (id: string) => updateSessionData({ dismissedFindings: [...ignored, id] });

  const scoreColor = score >= 80 ? 'var(--accent-emerald)' : score >= 50 ? 'var(--accent-amber)' : 'var(--accent-red)';

  return (
    <div className="fade-in">
      <h2 style={{ fontSize: 22, marginBottom: 4 }}>Contrôle qualité du modèle</h2>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>Pour chaque suggestion, comparez votre version à la version améliorée, puis <strong>Valider</strong> pour appliquer ou <strong>Ignorer</strong>.</p>

      {/* Score + résumé */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 20px' }}>
          <div style={{ fontSize: 34, fontWeight: 800, color: scoreColor }}>{score}<span style={{ fontSize: 16, color: 'var(--text-muted)' }}>/100</span></div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Score de qualité</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{nErr} erreur(s) · {nWarn} avertissement(s) · {nInfo} info(s)</div>
          </div>
        </div>
        {fixable.length > 0 && (
          <div style={{ marginLeft: 'auto' }}>
            <button className="cta-btn" onClick={validateAll}>Tout valider ({fixable.length})</button>
          </div>
        )}
      </div>

      {findings.length === 0 ? (
        <div className="context-card" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 30, marginBottom: 8 }}>✓</div>
          <div style={{ fontWeight: 700 }}>Aucun problème détecté</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Votre modèle respecte les bonnes pratiques vérifiées.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {findings.map(f => {
            const sev = SEV_META[f.severity];
            return (
              <div key={f.id} style={{ display: 'flex', gap: 14, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderLeft: `3px solid ${sev.color}`, borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: sev.color, background: sev.bg, borderRadius: 5, padding: '1px 7px' }}>{sev.label}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{f.category}</span>
                    <span style={{ fontSize: 11.5, fontWeight: 600 }}>{f.entityName}{f.target ? ` · ${f.target}` : ''}</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.45 }}>{f.message}</div>
                  {(f.current || f.suggested) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, fontSize: 12.5, flexWrap: 'wrap' }}>
                      <span style={{ color: 'var(--accent-red)', textDecoration: 'line-through', background: 'rgba(220,38,38,0.06)', padding: '2px 8px', borderRadius: 6 }}>{f.current}</span>
                      <span style={{ color: 'var(--text-muted)' }}>→</span>
                      <span style={{ color: 'var(--primary)', fontWeight: 700, background: 'var(--primary-glow)', padding: '2px 8px', borderRadius: 6 }}>{f.suggested}</span>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  {f.patch && (
                    <button onClick={() => validateOne(f)} style={{ cursor: 'pointer', border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 12.5, fontWeight: 700, color: '#fff', background: 'var(--primary)' }}>Valider</button>
                  )}
                  <button onClick={() => ignoreOne(f.id)} style={{ cursor: 'pointer', borderRadius: 8, padding: '7px 16px', fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', background: 'transparent', border: '1px solid var(--border)' }}>Ignorer</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

type OverviewDetailKey = 'entities' | 'relations' | 'attributes' | 'kpis' | 'rules' | 'sources';

function OverviewDetailModal({ session, detail, onClose }: { session: WorkshopSession; detail: OverviewDetailKey; onClose: () => void }) {
  const titles: Record<OverviewDetailKey, string> = {
    entities: '🧩 Entités', relations: '🔗 Relations', attributes: '📋 Attributs',
    kpis: '📊 KPIs', rules: '⚖️ Règles métier', sources: '🗄️ Sources de données',
  };
  const row: React.CSSProperties = { padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 };
  const itemTitle: React.CSSProperties = { fontWeight: 700, marginBottom: 2 };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', width: 'min(760px, 100%)', maxHeight: '82vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}>
        <div style={{ position: 'sticky', top: 0, background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 16, margin: 0 }}>{titles[detail]}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>
        <div style={{ padding: 20 }}>
          {detail === 'entities' && session.entities.map(e => (
            <div key={e.id} style={row}><div style={itemTitle}>{e.name} <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>{e.type}</span></div>{e.definition && <div style={{ color: 'var(--text-secondary)' }}>{e.definition}</div>}</div>
          ))}
          {detail === 'relations' && session.relations.map(r => (
            <div key={r.id} style={row}><div style={itemTitle}>{r.sourceEntityName} → {r.targetEntityName} <span style={{ fontSize: 11, color: 'var(--accent-blue)' }}>({r.type})</span></div>{r.description && <div style={{ color: 'var(--text-secondary)' }}>{r.description}</div>}</div>
          ))}
          {detail === 'attributes' && session.entities.map(entity => {
            const attrs = session.attributes.filter(a => a.entityId === entity.id || a.entityId === entity.name);
            if (attrs.length === 0) return null;
            return (
              <div key={entity.id} style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 700, color: 'var(--primary-light)', marginBottom: 6 }}>{entity.name}</div>
                {attrs.map(a => (
                  <div key={a.id} style={row}>
                    <strong>{a.name}</strong> <span style={{ color: 'var(--accent-blue)' }}>{a.type}</span>{' '}
                    {a.isPrimaryKey && '🔑'}{a.isForeignKey && '🔗'}{a.isSensitive && '🔒'}
                    {a.description && <span style={{ color: 'var(--text-muted)' }}> — {a.description}</span>}
                  </div>
                ))}
              </div>
            );
          })}
          {detail === 'kpis' && session.kpis.map(k => (
            <div key={k.id} style={row}><div style={itemTitle}>{k.name}</div>{k.formula && <div>Formule : <code>{k.formula}</code></div>}{k.description && <div style={{ color: 'var(--text-secondary)' }}>{k.description}</div>}</div>
          ))}
          {detail === 'rules' && session.businessRules.map(r => (
            <div key={r.id} style={row}><div style={itemTitle}>{r.name} <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.type}</span></div>{r.description && <div style={{ color: 'var(--text-secondary)' }}>{r.description}</div>}{r.expression && <div>Expression : <code>{r.expression}</code></div>}</div>
          ))}
          {detail === 'sources' && session.dataSources.map(s => (
            <div key={s.id} style={row}><div style={itemTitle}>{s.name} <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.type}</span></div>{s.system && <div>Système : {s.system}</div>}{s.loadFrequency && <div style={{ color: 'var(--text-secondary)' }}>Fréquence : {s.loadFrequency}</div>}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ReportTab({ session }: { session: WorkshopSession }) {
  const attrsOf = (e: Entity) => session.attributes.filter(a => a.entityId === e.id || a.entityId === e.name);
  const card: React.CSSProperties = { marginBottom: 20 };
  const h: React.CSSProperties = { fontSize: 16, margin: '0 0 10px', color: 'var(--primary)' };
  const th: React.CSSProperties = { textAlign: 'left', padding: '6px 10px', borderBottom: '2px solid var(--border)', color: 'var(--text-muted)', fontSize: 12 };
  const td: React.CSSProperties = { padding: '6px 10px', borderBottom: '1px solid var(--border)', fontSize: 13 };

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <h2 style={{ fontSize: 22, margin: 0 }}>Rapport détaillé — {session.productName || 'Data Product'}</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="cta-btn" onClick={() => downloadReportPdf(session)}>📄 Télécharger en PDF</button>
          <button className="cta-btn cta-btn-secondary" onClick={() => downloadReportWord(session)}>📝 Télécharger en Word</button>
          <button className="cta-btn cta-btn-secondary" onClick={() => downloadReportExcel(session)}>📊 Télécharger en Excel</button>
        </div>
      </div>

      <div className="context-card" style={card}>
        <h3 style={h}>🎯 Contexte</h3>
        <div style={{ fontSize: 14, lineHeight: 1.7 }}>
          <div><strong>Produit :</strong> {session.productName || '—'}</div>
          <div><strong>Domaine :</strong> {session.domain || '—'}</div>
          <div><strong>Product Owner :</strong> {session.productOwner || '—'}</div>
          <div><strong>Data Steward :</strong> {session.dataSteward || '—'}</div>
          {session.objective && <div><strong>Objectif :</strong> {session.objective}</div>}
          {session.contextSummary && <div style={{ marginTop: 6 }}>{session.contextSummary}</div>}
        </div>
      </div>

      <div className="context-card" style={card}>
        <h3 style={h}>🧩 Entités &amp; attributs ({session.entities.length})</h3>
        {session.entities.map(e => (
          <div key={e.id} style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{e.name} {e.definition && <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 12 }}>— {e.definition}</span>}</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={th}>Attribut</th><th style={th}>Type</th><th style={th}>Clé</th><th style={th}>Description</th></tr></thead>
              <tbody>
                {attrsOf(e).map(a => (
                  <tr key={a.id}>
                    <td style={td}>{a.name}</td>
                    <td style={{ ...td, color: 'var(--accent-blue)' }}>{a.type}</td>
                    <td style={td}>{a.isPrimaryKey ? 'PK' : a.isForeignKey ? 'FK' : ''}{a.isSensitive ? ' 🔒' : ''}</td>
                    <td style={{ ...td, color: 'var(--text-secondary)' }}>{a.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {session.relations.length > 0 && (
        <div className="context-card" style={card}>
          <h3 style={h}>🔗 Relations ({session.relations.length})</h3>
          {session.relations.map(r => (
            <div key={r.id} style={{ fontSize: 13, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
              <strong>{r.sourceEntityName} → {r.targetEntityName}</strong> <span style={{ color: 'var(--accent-blue)' }}>({r.type})</span>
              {r.description && <span style={{ color: 'var(--text-muted)' }}> — {r.description}</span>}
            </div>
          ))}
        </div>
      )}

      {session.kpis.length > 0 && (
        <div className="context-card" style={card}>
          <h3 style={h}>📊 KPIs ({session.kpis.length})</h3>
          {session.kpis.map(k => (
            <div key={k.id} style={{ fontSize: 13, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
              <strong>{k.name}</strong>{k.formula && <span> — <code>{k.formula}</code></span>}{k.description && <span style={{ color: 'var(--text-muted)' }}> · {k.description}</span>}
            </div>
          ))}
        </div>
      )}

      {session.businessRules.length > 0 && (
        <div className="context-card" style={card}>
          <h3 style={h}>⚖️ Règles métier ({session.businessRules.length})</h3>
          {session.businessRules.map(r => (
            <div key={r.id} style={{ fontSize: 13, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
              <strong>{r.name}</strong> <span style={{ color: 'var(--text-muted)' }}>{r.type}</span>{r.description && <span> — {r.description}</span>}
            </div>
          ))}
        </div>
      )}

      {session.dataSources.length > 0 && (
        <div className="context-card" style={card}>
          <h3 style={h}>🗄️ Sources de données ({session.dataSources.length})</h3>
          {session.dataSources.map(s => (
            <div key={s.id} style={{ fontSize: 13, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
              <strong>{s.name}</strong>{s.system && <span> — {s.system}</span>}{s.loadFrequency && <span style={{ color: 'var(--text-muted)' }}> · {s.loadFrequency}</span>}
            </div>
          ))}
        </div>
      )}

      {session.maturityScores && (
        <div className="context-card" style={card}>
          <h3 style={h}>🏁 Score de maturité</h3>
          {MATURITY_DIMENSIONS.map(dim => {
            const v = session.maturityScores![dim.key as keyof typeof session.maturityScores];
            return <div key={dim.key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0' }}><span>{dim.label}</span><strong>{v}/100</strong></div>;
          })}
        </div>
      )}
    </div>
  );
}

// ── Couche sémantique : lecture en français clair du modèle ──────────────
// Traduit entités, clés et relations en phrases lisibles par un métier, pour
// qu'il repère les affirmations fausses (ex. « un client a plusieurs comptes »)
// et demande un ajustement à Marty.
function relationClause(source: string, target: string, type: string): string {
  switch (type) {
    case '1:1':
      return `Chaque « ${source} » est associé à un seul « ${target} », et réciproquement.`;
    case 'N:1':
      return `Plusieurs « ${source} » peuvent partager le même « ${target} ». Chaque « ${source} » référence un seul « ${target} ».`;
    case 'N:N':
      return `Un même « ${source} » peut être lié à plusieurs « ${target} », et un même « ${target} » à plusieurs « ${source} ».`;
    case '1:N':
    default:
      return `Un même « ${source} » peut être associé à plusieurs « ${target} ». À l'inverse, chaque « ${target} » est rattaché à un seul « ${source} ».`;
  }
}

function CardAction({ onClick, done, icon, label, doneLabel }: { onClick: () => void; done?: boolean; icon: 'copy' | 'marty'; label: string; doneLabel?: string }) {
  const isMarty = icon === 'marty';
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
        padding: '5px 10px', borderRadius: 7, cursor: 'pointer',
        border: isMarty ? '1px solid var(--border-active)' : '1px solid var(--border)',
        background: isMarty ? 'var(--primary-glow)' : 'transparent',
        color: isMarty ? 'var(--primary-light)' : 'var(--text-secondary)',
      }}
    >
      {done ? (
        <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>{doneLabel || label}</>
      ) : icon === 'copy' ? (
        <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></svg>{label}</>
      ) : (
        <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" /></svg>{label}</>
      )}
    </button>
  );
}

function SemanticTab({ session }: { session: WorkshopSession }) {
  const [copied, setCopied] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const setChatDraft = useWorkshopStore(s => s.setChatDraft);
  const setCurrentPage = useWorkshopStore(s => s.setCurrentPage);
  const attrsOf = (e: Entity) => session.attributes.filter(a => a.entityId === e.id || a.entityId === e.name);

  const copyOne = async (key: string, text: string) => {
    try { await navigator.clipboard.writeText(text); setCopiedKey(key); setTimeout(() => setCopiedKey(k => (k === key ? null : k)), 1600); } catch { /* ignore */ }
  };
  // Envoie le texte vers le chat Marty (pré-rempli, curseur à la fin pour compléter).
  const askMarty = (draft: string) => { setChatDraft(draft); setCurrentPage('workshop'); };

  const entityLines = session.entities.map((e) => {
    const attrs = attrsOf(e);
    const pks = attrs.filter(a => a.isPrimaryKey).map(a => a.name);
    const sensitive = attrs.filter(a => a.isSensitive).map(a => a.name);
    const descriptive = attrs.filter(a => !a.isPrimaryKey && !a.isForeignKey).map(a => a.name);
    const def = e.definition || e.description || '';
    let readable = `${e.name}${def ? ` — ${def}` : ''}`;
    if (pks.length) readable += ` Identifié de façon unique par : ${pks.join(', ')}.`;
    if (descriptive.length) readable += ` Décrit notamment par : ${descriptive.slice(0, 8).join(', ')}${descriptive.length > 8 ? '…' : ''}.`;
    if (sensitive.length) readable += ` Contient des données personnelles : ${sensitive.join(', ')}.`;
    return { e, attrs, pks, sensitive, descriptive, readable };
  });

  const relLines = session.relations.map((r) => ({
    r,
    text: relationClause(r.sourceEntityName, r.targetEntityName, r.type),
  }));

  // Version texte brut (pour copier / partager à un métier ou à Marty).
  const plain = useMemo(() => {
    const L: string[] = [];
    L.push(`SEMANTIC LAYER — ${session.productName || 'Data Product'}`);
    if (session.objective) L.push(`Objectif : ${session.objective}`);
    L.push('');
    L.push('LES OBJETS MÉTIER');
    entityLines.forEach(({ e, pks, sensitive, descriptive }) => {
      const def = e.definition || e.description || '';
      let line = `• ${e.name}${def ? ` — ${def}` : ''}`;
      if (pks.length) line += ` Identifié de façon unique par : ${pks.join(', ')}.`;
      if (descriptive.length) line += ` Décrit notamment par : ${descriptive.slice(0, 8).join(', ')}${descriptive.length > 8 ? '…' : ''}.`;
      if (sensitive.length) line += ` ⚠ Contient des données personnelles : ${sensitive.join(', ')}.`;
      L.push(line);
    });
    L.push('');
    L.push('COMMENT ILS SONT RELIÉS');
    if (relLines.length === 0) L.push('• (Aucune relation définie pour le moment.)');
    relLines.forEach(({ r, text }) => {
      L.push(`• ${text}${r.description ? ` (${r.description})` : ''}`);
    });
    return L.join('\n');
  }, [session, entityLines, relLines]);

  const copyAll = async () => {
    try { await navigator.clipboard.writeText(plain); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* ignore */ }
  };

  return (
    <div style={{ maxWidth: 860 }}>
      {/* Bandeau d'explication */}
      <div style={{ background: 'var(--primary-glow)', border: '1px solid var(--border-active)', borderRadius: 12, padding: '14px 16px', marginBottom: 20, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <DIcon name="semantic" size={20} />
        <div style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
          Voici, <strong>en langage courant</strong>, ce que dit le modèle que vous avez construit — sans jargon technique.
          Relisez chaque phrase&nbsp;: si une affirmation est <strong>fausse</strong> (par ex. «&nbsp;un client peut avoir plusieurs comptes&nbsp;» alors qu'un client n'en a qu'un),
          demandez simplement à <strong>Marty</strong> de corriger la cardinalité — il ajustera le modèle et les livrables.
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Les objets métier</h3>
        <button type="button" className="suggested-chip" onClick={copyAll} style={{ fontSize: 12 }}>
          {copied ? '✓ Copié' : 'Copier tout le texte'}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 26 }}>
        {entityLines.map(({ e, pks, sensitive, descriptive, readable }) => (
          <div key={e.id} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: 14.5, lineHeight: 1.55, color: 'var(--text-secondary)' }}>
              <strong style={{ color: 'var(--text-primary)' }}>{e.name}</strong>
              {(e.definition || e.description) ? ` — ${e.definition || e.description}` : ''}
              {pks.length > 0 && <> Il est identifié de façon unique par <strong>{pks.join(', ')}</strong>.</>}
              {descriptive.length > 0 && <> On en connaît notamment : {descriptive.slice(0, 8).join(', ')}{descriptive.length > 8 ? '…' : ''}.</>}
            </div>
            {sensitive.length > 0 && (
              <div style={{ marginTop: 6, fontSize: 12.5, color: 'var(--accent-amber)' }}>
                ⚠ Contient des données personnelles : {sensitive.join(', ')}.
              </div>
            )}
            <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
              <CardAction onClick={() => copyOne(`e-${e.id}`, readable)} done={copiedKey === `e-${e.id}`} icon="copy" label="Copier" doneLabel="Copié" />
              <CardAction onClick={() => askMarty(`Concernant l'objet « ${e.name} » (${readable}).\n\nCorrection souhaitée : `)} icon="marty" label="Corriger avec Marty" />
            </div>
          </div>
        ))}
      </div>

      <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>Comment ils sont reliés</h3>
      {relLines.length === 0 ? (
        <div style={{ fontSize: 14, color: 'var(--text-muted)', fontStyle: 'italic' }}>
          Aucune relation n'est encore définie. Décrivez à Marty comment vos objets se relient (ex. «&nbsp;un compte appartient à un client&nbsp;»).
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {relLines.map(({ r, text }) => (
            <div key={r.id} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ color: 'var(--primary-light)', fontWeight: 700, flexShrink: 0 }}>{r.type}</span>
                <div style={{ fontSize: 14.5, lineHeight: 1.55, color: 'var(--text-secondary)' }}>
                  {text}
                  {r.description && <span style={{ color: 'var(--text-muted)' }}> {`— ${r.description}`}</span>}
                </div>
              </div>
              <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                <CardAction onClick={() => copyOne(`r-${r.id}`, text)} done={copiedKey === `r-${r.id}`} icon="copy" label="Copier" doneLabel="Copié" />
                <CardAction onClick={() => askMarty(`Concernant la relation « ${r.sourceEntityName} » → « ${r.targetEntityName} » (aujourd'hui « ${r.type} » : ${text}).\n\nCorrection souhaitée : `)} icon="marty" label="Corriger avec Marty" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MCDTab({ session }: { session: WorkshopSession }) {
  const mermaidCode = generateMermaidERD(session);

  return (
    <div className="fade-in">
      <h3 style={{ fontSize: 18, marginBottom: 16 }}>Architecture visuelle du Data Product (MCD)</h3>
      <MermaidDiagram code={mermaidCode} />
      <details style={{ marginTop: 16 }}>
        <summary style={{ cursor: 'pointer', fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
          Voir / copier le code source (Mermaid)
        </summary>
        <div style={{ marginTop: 8 }}>
          <CodeBlock title="ERD Mermaid" language="mermaid" code={mermaidCode} />
        </div>
      </details>
    </div>
  );
}

function DimensionalTab({ session }: { session: WorkshopSession }) {
  const { facts, dims } = classifyDimensional(session);
  const star = generateStarSchema(session, facts, dims);
  const snowflake = generateSnowflakeSchema(session, facts, dims);

  if (facts.length === 0) {
    return (
      <div className="empty-state" style={{ padding: 40 }}>
        <div className="empty-state-icon">❄️</div>
        <div className="empty-state-text">
          Aucune table de faits détectée. Marquez au moins une entité comme transactionnelle / événement (mesures) pour générer le modèle dimensionnel.
        </div>
      </div>
    );
  }

  const chip = (color: string, bg: string): React.CSSProperties => ({
    display: 'inline-block', fontSize: 12, fontWeight: 600, padding: '4px 10px',
    borderRadius: 999, color, background: bg, margin: '0 6px 6px 0',
  });

  return (
    <div className="fade-in">
      <h3 style={{ fontSize: 18, marginBottom: 8 }}>Modèle dimensionnel (Étoile &amp; Flocon)</h3>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
        Classification automatique des entités en <strong>faits</strong> (mesures) et <strong>dimensions</strong> (axes d&apos;analyse).
      </p>

      <div className="context-card" style={{ marginBottom: 20 }}>
        <div style={{ marginBottom: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>⭐ TABLES DE FAITS ({facts.length})</span><br />
          {facts.map(f => <span key={f.id} style={chip('#92400e', '#fde68a')}>{f.name} · fact_{stripDimFactAffix(cleanTableName(f.name))}</span>)}
        </div>
        <div>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>🧩 DIMENSIONS ({dims.length})</span><br />
          {dims.map(d => <span key={d.id} style={chip('var(--primary-light)', 'var(--primary-glow)')}>{d.name} · dim_{stripDimFactAffix(cleanTableName(d.name))}</span>)}
        </div>
      </div>

      <h4 style={{ fontSize: 15, margin: '8px 0' }}>⭐ Schéma en étoile (Star schema)</h4>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Dimensions reliées directement aux faits (dénormalisées).</p>
      <MermaidDiagram code={star} />

      <h4 style={{ fontSize: 15, margin: '20px 0 8px' }}>❄️ Schéma en flocon (Snowflake schema)</h4>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Dimensions normalisées : les hiérarchies sont éclatées en sous-dimensions reliées.</p>
      <MermaidDiagram code={snowflake} />

      <details style={{ marginTop: 16 }}>
        <summary style={{ cursor: 'pointer', fontSize: 13, color: 'var(--text-muted)' }}>Voir / copier le code Mermaid</summary>
        <div style={{ marginTop: 8 }}>
          <CodeBlock title="Star schema (Mermaid)" language="mermaid" code={star} />
          <div style={{ marginTop: 12 }}>
            <CodeBlock title="Snowflake schema (Mermaid)" language="mermaid" code={snowflake} />
          </div>
        </div>
      </details>
    </div>
  );
}

function DbmlTab({ session }: { session: WorkshopSession }) {
  const dbml = generateDBML(session);
  const [opened, setOpened] = useState(false);

  function copyAndOpen() {
    navigator.clipboard.writeText(dbml).catch(() => {});
    window.open('https://dbdiagram.io/d', '_blank', 'noopener,noreferrer');
    setOpened(true);
    setTimeout(() => setOpened(false), 6000);
  }

  return (
    <div className="fade-in">
      <h3 style={{ fontSize: 18, marginBottom: 16 }}>DBML — Diagramme interactif (dbdiagram.io)</h3>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <button className="cta-btn" onClick={copyAndOpen}>🧬 Copier + ouvrir dbdiagram.io</button>
        {opened && (
          <span style={{ fontSize: 13, color: 'var(--primary)' }}>
            ✓ Code copié — collez-le (Cmd/Ctrl+V) dans l&apos;éditeur dbdiagram.io qui vient de s&apos;ouvrir.
          </span>
        )}
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
        💡 Le diagramme visuel est aussi disponible directement dans l&apos;onglet <strong>MCD / ERD</strong> (sans rien copier).
        dbdiagram.io sert à obtenir une version interactive et déplaçable.
      </p>

      <CodeBlock title="schema.dbml" language="dbml" code={dbml} />
    </div>
  );
}

// Hook de standardisation — indépendant par onglet.
function useStandardization(session: WorkshopSession) {
  const [naming, setNaming] = useState<Record<string, string> | null>(null);
  const [translating, setTranslating] = useState(false);
  async function translate() {
    setTranslating(true);
    try { setNaming(await transformMany(collectModelKeywords(session))); }
    finally { setTranslating(false); }
  }
  return { naming, translating, translate, reset: () => setNaming(null) };
}

function NamingToolbar({ naming, translating, onTranslate, onReset, alias, onAlias }: {
  naming: Record<string, string> | null; translating: boolean; onTranslate: () => void; onReset: () => void;
  alias?: boolean; onAlias?: (v: boolean) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
      {!naming ? (
        <button className="cta-btn" onClick={onTranslate} disabled={translating}>
          {translating ? '⏳ Standardisation…' : '🔤 Standardiser les noms (dictionnaire)'}
        </button>
      ) : (
        <>
          <span style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 600 }}>✓ Noms standardisés</span>
          {onAlias && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', color: 'var(--text-secondary)' }}>
              <input type="checkbox" checked={!!alias} onChange={(e) => onAlias(e.target.checked)} />
              Noms standardisés en ALIAS (AS)
            </label>
          )}
          <button className="suggested-chip" onClick={onReset}>↩ Noms d&apos;origine</button>
        </>
      )}
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>via dictionnaire fieldmapper.space</span>
    </div>
  );
}

function SQLTab({ session }: { session: WorkshopSession }) {
  const std = useStandardization(session);
  const [alias, setAlias] = useState(false);
  let sql: string;
  if (std.naming && alias) {
    sql = generateSQL(applyAliasComments(session, std.naming));
  } else if (std.naming) {
    sql = generateSQL(translateSession(session, std.naming));
  } else {
    sql = generateSQL(session);
  }
  return (
    <div className="fade-in">
      <h3 style={{ fontSize: 18, marginBottom: 16 }}>SQL — Création des tables</h3>
      <NamingToolbar naming={std.naming} translating={std.translating} onTranslate={std.translate} onReset={std.reset} alias={alias} onAlias={setAlias} />
      {std.naming && alias && (
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', background: 'var(--primary-glow)', border: '1px solid var(--border-active)', borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>
          ℹ️ Mode ALIAS : les colonnes gardent leur nom d&apos;origine, annotées inline avec leur nom standardisé <code>[AS NOM_STD]</code>.
        </div>
      )}
      <CodeBlock title="DDL SQL" language="sql" code={sql} />
    </div>
  );
}

function DbtTab({ session }: { session: WorkshopSession }) {
  const std = useStandardization(session);
  const yaml = std.naming ? generateDbtYaml(translateSession(session, std.naming)) : generateDbtYaml(session);
  return (
    <div className="fade-in">
      <h3 style={{ fontSize: 18, marginBottom: 16 }}>dbt — Schema YAML</h3>
      <NamingToolbar naming={std.naming} translating={std.translating} onTranslate={std.translate} onReset={std.reset} />
      <CodeBlock title="schema.yml" language="yaml" code={yaml} />
    </div>
  );
}

function DictionaryTab({ session }: { session: WorkshopSession }) {
  return (
    <div className="fade-in">
      <h3 style={{ fontSize: 18, marginBottom: 16 }}>Dictionnaire de données</h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              {['Entité', 'Attribut', 'Type', 'PK', 'FK', 'Requis', 'Sensible', 'Description'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {session.entities.map(entity => {
              const attrs = session.attributes.filter(a => a.entityId === entity.id || a.entityId === entity.name);
              if (attrs.length === 0) {
                return (
                  <tr key={entity.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--primary-light)' }}>{entity.name}</td>
                    <td colSpan={7} style={{ padding: '8px 12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Attributs non définis</td>
                  </tr>
                );
              }
              return attrs.map((attr, i) => (
                <tr key={attr.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 12px', fontWeight: i === 0 ? 600 : 400, color: i === 0 ? 'var(--primary-light)' : 'var(--text)' }}>
                    {i === 0 ? entity.name : ''}
                  </td>
                  <td style={{ padding: '8px 12px' }}>{attr.name}</td>
                  <td style={{ padding: '8px 12px', color: 'var(--accent-blue)' }}>{attr.type}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'center' }}>{attr.isPrimaryKey ? '🔑' : ''}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'center' }}>{attr.isForeignKey ? '🔗' : ''}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'center' }}>{attr.isRequired ? '✓' : ''}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'center' }}>{attr.isSensitive ? '🔒' : ''}</td>
                  <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{attr.description}</td>
                </tr>
              ));
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DADTab({ session }: { session: WorkshopSession }) {
  const avgScore = session.maturityScores
    ? Math.round(Object.values(session.maturityScores).reduce((a, b) => a + b, 0) / 7)
    : 0;

  return (
    <div className="fade-in">
      <h3 style={{ fontSize: 18, marginBottom: 16 }}>Rapport de préparation DAD</h3>

      <div className="context-card" style={{ marginBottom: 16 }}>
        <div className="context-card-title">📊 Score global</div>
        <div style={{ fontSize: 48, fontWeight: 800, color: avgScore >= 70 ? 'var(--accent-emerald)' : avgScore >= 40 ? 'var(--accent-amber)' : 'var(--accent-red)', textAlign: 'center', padding: 16 }}>
          {avgScore}/100
        </div>
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>
          {avgScore >= 70 ? '✅ Prêt pour la DAD' : avgScore >= 40 ? '⚠️ Quelques points à finaliser' : '❌ Conception à approfondir'}
        </div>
      </div>

      <div className="context-card" style={{ marginBottom: 16 }}>
        <div className="context-card-title">📋 Synthèse</div>
        <div className="context-card-content">
          <p><strong>Produit :</strong> {session.productName || 'Non défini'}</p>
          <p><strong>Domaine :</strong> {session.domain || 'Non défini'}</p>
          <p><strong>Entités :</strong> {session.entities.length}</p>
          <p><strong>Relations :</strong> {session.relations.length}</p>
          <p><strong>Attributs :</strong> {session.attributes.length}</p>
          <p><strong>KPIs :</strong> {session.kpis.length}</p>
        </div>
      </div>

      <div className="context-card">
        <div className="context-card-title">⚠️ Points de vigilance</div>
        <div className="context-card-content">
          <ul style={{ paddingLeft: 16 }}>
            {session.entities.length === 0 && <li>Aucune entité définie</li>}
            {session.relations.length === 0 && <li>Aucune relation définie</li>}
            {session.attributes.length === 0 && <li>Aucun attribut défini</li>}
            {!session.granularity && <li>Granularité non définie</li>}
            {session.kpis.length === 0 && <li>Aucun KPI défini</li>}
            {!session.governance && <li>Gouvernance non documentée</li>}
            {session.qualityRules.length === 0 && <li>Aucune règle qualité définie</li>}
            {session.entities.length > 0 && session.relations.length === 0 && <li>Relations manquantes entre les entités</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ---- Generators ----

interface ForeignKey {
  columnName: string;
  referencedTable: string;
  referencedColumn: string;
  isUnique: boolean;
  isRequired: boolean;
  relationDescription?: string;
}

interface ColumnDefinition {
  name: string;
  type: string;
  description: string;
  isPk: boolean;
  isRequired: boolean;
  isUnique: boolean;
  referencedTable?: string;
  referencedColumn?: string;
  relationDescription?: string;
}

function cleanEntityName(name: string): string {
  return name.trim().replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '').toUpperCase();
}

function cleanTableName(name: string): string {
  return name.trim().replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '').toLowerCase();
}

// Nom de colonne de clé étrangère. Évite le doublon « client_client_id » quand la
// clé primaire référencée contient déjà le nom de la table (ex. client → client_id).
function fkColName(refTable: string, refPk: string): string {
  const t = refTable.toLowerCase(), p = refPk.toLowerCase();
  if (p === `${t}_id` || p.startsWith(`${t}_`)) return refPk;
  return `${refTable}_${refPk}`;
}

function getPrimaryKeyOfEntity(
  nameOrId: string,
  session: WorkshopSession,
  entitiesToGenerate: Entity[]
): string {
  const ent = entitiesToGenerate.find(e => e.id === nameOrId || cleanEntityName(e.name) === cleanEntityName(nameOrId));
  if (ent) {
    const pkAttr = session.attributes.find(a => (a.entityId === ent.id || a.entityId === ent.name) && a.isPrimaryKey);
    if (pkAttr) {
      return pkAttr.name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_').toLowerCase();
    }
  }
  return 'id';
}

function buildFkMap(session: WorkshopSession, entitiesToGenerate: Entity[]): Map<string, ForeignKey[]> {
  const fkMap = new Map<string, ForeignKey[]>();
  
  session.relations.forEach(rel => {
    const srcTable = cleanTableName(rel.sourceEntityName);
    const tgtTable = cleanTableName(rel.targetEntityName);
    
    const srcPk = getPrimaryKeyOfEntity(rel.sourceEntityName, session, entitiesToGenerate);
    const tgtPk = getPrimaryKeyOfEntity(rel.targetEntityName, session, entitiesToGenerate);
    
    if (rel.type === '1:N') {
      const ent = entitiesToGenerate.find(e => e.id === rel.targetEntityId || cleanEntityName(e.name) === cleanEntityName(rel.targetEntityName));
      const key = ent ? ent.id : rel.targetEntityName;
      const existing = fkMap.get(key) || [];
      existing.push({
        columnName: fkColName(srcTable, srcPk),
        referencedTable: srcTable,
        referencedColumn: srcPk,
        isUnique: false,
        isRequired: rel.isRequired,
        relationDescription: rel.description
      });
      fkMap.set(key, existing);
    } else if (rel.type === 'N:1') {
      const ent = entitiesToGenerate.find(e => e.id === rel.sourceEntityId || cleanEntityName(e.name) === cleanEntityName(rel.sourceEntityName));
      const key = ent ? ent.id : rel.sourceEntityName;
      const existing = fkMap.get(key) || [];
      existing.push({
        columnName: fkColName(tgtTable, tgtPk),
        referencedTable: tgtTable,
        referencedColumn: tgtPk,
        isUnique: false,
        isRequired: rel.isRequired,
        relationDescription: rel.description
      });
      fkMap.set(key, existing);
    } else if (rel.type === '1:1') {
      const ent = entitiesToGenerate.find(e => e.id === rel.targetEntityId || cleanEntityName(e.name) === cleanEntityName(rel.targetEntityName));
      const key = ent ? ent.id : rel.targetEntityName;
      const existing = fkMap.get(key) || [];
      existing.push({
        columnName: fkColName(srcTable, srcPk),
        referencedTable: srcTable,
        referencedColumn: srcPk,
        isUnique: true,
        isRequired: rel.isRequired,
        relationDescription: rel.description
      });
      fkMap.set(key, existing);
    }
  });
  
  return fkMap;
}

function getTableColumns(
  entity: Entity,
  session: WorkshopSession,
  entitiesToGenerate: Entity[],
  fkMap: Map<string, ForeignKey[]>
): ColumnDefinition[] {
  const attrs = session.attributes.filter(a => a.entityId === entity.id || a.entityId === entity.name);
  const columns: ColumnDefinition[] = [];
  
  const hasExplicitPk = attrs.some(a => a.isPrimaryKey);
  const hasIdAttr = attrs.some(a => a.name.toLowerCase() === 'id');
  const needsDefaultId = !hasExplicitPk && !hasIdAttr;
  
  if (needsDefaultId) {
    columns.push({
      name: 'id',
      type: 'BIGINT',
      description: 'Clé primaire auto-générée',
      isPk: true,
      isRequired: true,
      isUnique: true
    });
  }
  
  attrs.forEach(a => {
    const isPk = a.isPrimaryKey || (!hasExplicitPk && a.name.toLowerCase() === 'id');
    columns.push({
      name: a.name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_').toLowerCase(),
      type: a.type,
      description: a.description || a.name,
      isPk: isPk,
      isRequired: a.isRequired || isPk,
      isUnique: isPk
    });
  });
  
  const fks = fkMap.get(entity.id) || fkMap.get(entity.name) || [];
  fks.forEach(fk => {
    const existing = columns.find(c => c.name === fk.columnName);
    if (existing) {
      existing.referencedTable = fk.referencedTable;
      existing.referencedColumn = fk.referencedColumn;
      if (fk.isUnique) existing.isUnique = true;
      if (fk.isRequired) existing.isRequired = true;
      if (fk.relationDescription) {
        existing.relationDescription = fk.relationDescription;
        existing.description += ` (Ref: ${fk.referencedTable}.${fk.referencedColumn} - ${fk.relationDescription})`;
      }
    } else {
      columns.push({
        name: fk.columnName,
        type: 'BIGINT',
        description: fk.relationDescription || `Clé étrangère pointant vers ${fk.referencedTable}`,
        isPk: false,
        isRequired: fk.isRequired,
        isUnique: fk.isUnique,
        referencedTable: fk.referencedTable,
        referencedColumn: fk.referencedColumn,
        relationDescription: fk.relationDescription
      });
    }
  });

  return dedupeColumns(columns);
}

// Make column lists valid no matter what the AI emitted:
// 1. Merge columns whose names are the same once normalized (e.g. "sinistre_id"
//    and "sinistreId" -> "sinistreid"), OR-combining their flags. This removes
//    exact and near-duplicate columns.
// 2. Enforce a single PRIMARY KEY per table (keep the first, demote the rest to
//    a regular NOT NULL column) so the DDL is not rejected by the database.
function dedupeColumns(columns: ColumnDefinition[]): ColumnDefinition[] {
  const seen = new Map<string, ColumnDefinition>();
  for (const col of columns) {
    const key = col.name.replace(/[^a-z0-9]/gi, '').toLowerCase();
    const prev = seen.get(key);
    if (!prev) {
      seen.set(key, { ...col });
    } else {
      prev.isPk = prev.isPk || col.isPk;
      prev.isRequired = prev.isRequired || col.isRequired;
      prev.isUnique = prev.isUnique || col.isUnique;
      if (!prev.referencedTable && col.referencedTable) {
        prev.referencedTable = col.referencedTable;
        prev.referencedColumn = col.referencedColumn;
        prev.relationDescription = col.relationDescription;
      }
    }
  }

  let pkAssigned = false;
  return Array.from(seen.values()).map((col) => {
    if (col.isPk) {
      if (pkAssigned) {
        return { ...col, isPk: false, isRequired: true, isUnique: false };
      }
      pkAssigned = true;
    }
    return col;
  });
}

// Identifiant sûr pour Mermaid : Mermaid ER refuse un nom vide ou commençant par
// un chiffre (« Syntax error »). On nettoie, et on préfixe si nécessaire.
function mmdIdent(raw: string, fallback: string): string {
  let s = (raw || '').replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  if (!s) s = fallback;
  if (/^[0-9]/.test(s)) s = 'n_' + s;
  return s;
}

function generateMermaidERD(session: WorkshopSession): string {
  let code = 'erDiagram\n';
  
  // Resolve all entities (including implicit ones from relations)
  const entitiesToGenerate = [...session.entities];
  const existingEntityNames = new Set(session.entities.map(e => cleanEntityName(e.name)));
  
  session.relations.forEach(rel => {
    const src = cleanEntityName(rel.sourceEntityName);
    const tgt = cleanEntityName(rel.targetEntityName);
    if (!existingEntityNames.has(src)) {
      entitiesToGenerate.push({
        id: rel.sourceEntityName,
        name: rel.sourceEntityName,
        definition: `Entité implicite générée à partir des relations`,
        description: `Entité implicite générée à partir des relations`,
        example: '',
        responsible: '',
        type: 'reference',
        lifecycle: 'created'
      });
      existingEntityNames.add(src);
    }
    if (!existingEntityNames.has(tgt)) {
      entitiesToGenerate.push({
        id: rel.targetEntityName,
        name: rel.targetEntityName,
        definition: `Entité implicite générée à partir des relations`,
        description: `Entité implicite générée à partir des relations`,
        example: '',
        responsible: '',
        type: 'reference',
        lifecycle: 'created'
      });
      existingEntityNames.add(tgt);
    }
  });

  const mermaidFkMap = buildFkMap(session, entitiesToGenerate);

  entitiesToGenerate.forEach((entity, i) => {
    const codeName = mmdIdent(cleanEntityName(entity.name), `ENTITE_${i + 1}`);
    // Use the same deduplicated column resolution as the SQL/dbt generators so the
    // diagram never shows duplicate attributes or columns.
    const cols = getTableColumns(entity, session, entitiesToGenerate, mermaidFkMap);
    if (cols.length > 0) {
      code += `    ${codeName} {\n`;
      cols.forEach((c, ci) => {
        const pkTag = c.isPk ? 'PK' : c.referencedTable ? 'FK' : '';
        const mermaidType = mmdIdent(mapSqlType(c.type).replace(/\(.*\)/, '').toLowerCase(), 'varchar');
        const colName = mmdIdent(c.name, `col_${ci + 1}`);
        code += `        ${mermaidType} ${colName}${pkTag ? ` "${pkTag}"` : ''}\n`;
      });
      code += `    }\n`;
    } else {
      code += `    ${codeName} {\n        bigint id "PK"\n    }\n`;
    }
  });

  const entityCodeNames = new Set(entitiesToGenerate.map((e, i) => mmdIdent(cleanEntityName(e.name), `ENTITE_${i + 1}`)));
  session.relations.forEach(rel => {
    const src = mmdIdent(cleanEntityName(rel.sourceEntityName), '');
    const tgt = mmdIdent(cleanEntityName(rel.targetEntityName), '');
    // Une relation vers une entité inexistante casserait le diagramme : on l'ignore.
    if (!entityCodeNames.has(src) || !entityCodeNames.has(tgt)) return;
    const card = rel.type === '1:1' ? '||--||' : rel.type === '1:N' ? '||--o{' : rel.type === 'N:1' ? '}o--||' : '}o--o{';
    const label = (rel.description || 'lié à').replace(/["\n\r]/g, ' ').replace(/\s+/g, ' ').trim() || 'lié à';
    code += `    ${src} ${card} ${tgt} : "${label}"\n`;
  });
  return code;
}

function resolveEntitiesToGenerate(session: WorkshopSession): Entity[] {
  const entitiesToGenerate = [...session.entities];
  const existingEntityNames = new Set(session.entities.map(e => cleanEntityName(e.name)));
  session.relations.forEach(rel => {
    [rel.sourceEntityName, rel.targetEntityName].forEach(rawName => {
      const clean = cleanEntityName(rawName);
      if (!existingEntityNames.has(clean)) {
        entitiesToGenerate.push({
          id: rawName,
          name: rawName,
          definition: 'Entité implicite générée à partir des relations',
          description: 'Entité implicite générée à partir des relations',
          example: '',
          responsible: '',
          type: 'reference',
          lifecycle: 'created',
        });
        existingEntityNames.add(clean);
      }
    });
  });
  return entitiesToGenerate;
}

function dbmlType(type: string): string {
  return mapSqlType(type).toLowerCase();
}

// Garantit que CHAQUE entité possède au moins une clé primaire, même si l'IA
// n'a pas généré ses attributs. Évite les tables vides dans les livrables.
function enrichSession(session: WorkshopSession): WorkshopSession {
  const attributes = [...session.attributes];
  session.entities.forEach(e => {
    const hasAttrs = attributes.some(a => a.entityId === e.id || a.entityId === e.name);
    if (!hasAttrs) {
      const pkName = toSnake(e.name) + '_id';
      attributes.push({
        id: `auto_${e.id}`,
        entityId: e.id,
        name: pkName,
        type: 'BIGINT',
        description: `Clé primaire de ${e.name}`,
        isPrimaryKey: true,
        isForeignKey: false,
        isNaturalKey: false,
        isRequired: true,
        isSensitive: false,
        isHistorized: false,
      });
    }
  });
  return { ...session, attributes };
}

// ---- Rapport détaillé PDF (jsPDF, téléchargement direct) -----------------

// Export Word (.doc) : on génère un document HTML compatible Word (aucune
// dépendance, ouvert nativement par Word et entièrement éditable).
// Export Excel (.xlsx) mis en forme : classeur multi-feuilles avec en-têtes
// stylés (couleurs de la marque), largeurs de colonnes, bordures et volet figé.
async function downloadReportExcel(session: WorkshopSession) {
  const ExcelJS = (await import('exceljs')).default;
  const attrsOf = (e: Entity) => session.attributes.filter(a => a.entityId === e.id || a.entityId === e.name);
  const key = (a: WorkshopSession['attributes'][number]) => (a.isPrimaryKey ? 'PK' : a.isForeignKey ? 'FK' : '');

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Mart Studio';
  wb.created = new Date();
  const GREEN = 'FF006B4F', LIGHT = 'FFEFF5F2', BORDER = 'FFD0D5DD';
  const thin = { style: 'thin' as const, color: { argb: BORDER } };
  const border = { top: thin, left: thin, bottom: thin, right: thin };

  const sheet = (name: string, headers: string[], rows: (string | number)[][], widths: number[]) => {
    const ws = wb.addWorksheet(name.slice(0, 31), { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = headers.map((h, i) => ({ header: h, width: widths[i] || 20 }));
    const hr = ws.getRow(1);
    hr.height = 22;
    hr.eachCell((c) => {
      c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } };
      c.alignment = { vertical: 'middle', horizontal: 'left' };
      c.border = border;
    });
    rows.forEach((r, ri) => {
      const row = ws.addRow(r);
      row.eachCell((c) => {
        c.alignment = { vertical: 'top', wrapText: true };
        c.border = border;
        if (ri % 2 === 1) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT } };
      });
    });
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
  };

  sheet('Contexte', ['Champ', 'Valeur'], [
    ['Produit', session.productName || '—'],
    ['Domaine', session.domain || '—'],
    ['Product Owner', session.productOwner || '—'],
    ['Data Steward', session.dataSteward || '—'],
    ['Objectif', session.objective || '—'],
    ['Résumé', session.contextSummary || '—'],
  ], [22, 100]);

  sheet('Entités', ['Entité', 'Type', 'Définition', 'Nb attributs'],
    session.entities.map(e => [e.name, e.type, e.definition || '', attrsOf(e).length]), [26, 16, 70, 12]);

  sheet('Dictionnaire', ['Entité', 'Attribut', 'Type SQL', 'Clé', 'Sensible (RGPD)', 'Requis', 'Description'],
    session.entities.flatMap(e => attrsOf(e).map(a => [
      e.name, a.name, mapSqlType(a.type), key(a), a.isSensitive ? 'Oui' : '', a.isRequired ? 'Oui' : '', a.description || '',
    ])), [24, 26, 18, 8, 15, 9, 55]);

  if (session.relations.length) sheet('Relations', ['Source', 'Cardinalité', 'Cible', 'Description'],
    session.relations.map(r => [r.sourceEntityName, r.type, r.targetEntityName, r.description || '']), [26, 14, 26, 60]);
  if (session.kpis.length) sheet('KPI', ['Nom', 'Formule', 'Fréquence', 'Description'],
    session.kpis.map(k => [k.name, k.formula || '', k.frequency || '', k.description || '']), [28, 40, 18, 50]);
  if (session.businessRules.length) sheet('Règles métier', ['Nom', 'Type', 'Description'],
    session.businessRules.map(r => [r.name, r.type || '', r.description || '']), [30, 18, 60]);
  if (session.dataSources.length) sheet('Sources', ['Nom', 'Système', 'Fréquence de chargement'],
    session.dataSources.map(s => [s.name, s.system || '', s.loadFrequency || '']), [30, 24, 26]);
  if (session.maturityScores) sheet('Maturité', ['Dimension', 'Score /100'],
    MATURITY_DIMENSIONS.map(d => [d.label, session.maturityScores![d.key as keyof typeof session.maturityScores]]), [40, 12]);

  const base = (session.productName || 'data_product').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '') || 'data_product';
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Dictionnaire_${base}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadReportWord(session: WorkshopSession) {
  const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const attrsOf = (e: Entity) => session.attributes.filter(a => a.entityId === e.id || a.entityId === e.name);
  const GREEN = '#006B4F';
  const rows = (arr: string[][]) => arr.map(r => `<tr>${r.map((c, i) => `<td style="border:1px solid #d0d5dd;padding:5px 8px;font-size:10.5pt;${i === 1 ? 'color:#2563EB;' : ''}">${c}</td>`).join('')}</tr>`).join('');

  let body = `<h1 style="color:${GREEN};font-size:20pt;margin:0 0 4pt;">Rapport détaillé — ${esc(session.productName || 'Data Product')}</h1>`;
  body += `<p style="color:#667085;font-size:9pt;margin:0 0 16pt;">Généré par Mart Studio le ${esc(new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }))}</p>`;

  // Contexte
  body += `<h2 style="color:${GREEN};font-size:14pt;border-bottom:2px solid ${GREEN};padding-bottom:3pt;">Contexte</h2>`;
  body += `<p style="font-size:11pt;line-height:1.5;">
    <b>Produit :</b> ${esc(session.productName || '—')}<br/>
    <b>Domaine :</b> ${esc(session.domain || '—')}<br/>
    <b>Product Owner :</b> ${esc(session.productOwner || '—')}<br/>
    <b>Data Steward :</b> ${esc(session.dataSteward || '—')}<br/>
    ${session.objective ? `<b>Objectif :</b> ${esc(session.objective)}<br/>` : ''}
  </p>`;
  if (session.contextSummary) body += `<p style="font-size:11pt;line-height:1.5;">${esc(session.contextSummary)}</p>`;

  // Entités & attributs
  body += `<h2 style="color:${GREEN};font-size:14pt;border-bottom:2px solid ${GREEN};padding-bottom:3pt;">Entités &amp; attributs (${session.entities.length})</h2>`;
  session.entities.forEach(e => {
    body += `<p style="font-size:12pt;margin:12pt 0 4pt;"><b>${esc(e.name)}</b>${e.definition ? ` <span style="color:#667085;font-size:10pt;">— ${esc(e.definition)}</span>` : ''}</p>`;
    body += `<table style="border-collapse:collapse;width:100%;">
      <tr>${['Attribut', 'Type', 'Clé', 'Description'].map(hh => `<th style="border:1px solid #d0d5dd;background:#f2f4f7;padding:5px 8px;text-align:left;font-size:10pt;">${hh}</th>`).join('')}</tr>
      ${rows(attrsOf(e).map(a => [esc(a.name), esc(a.type), `${a.isPrimaryKey ? 'PK' : a.isForeignKey ? 'FK' : ''}${a.isSensitive ? ' (sensible)' : ''}`, esc(a.description)]))}
    </table>`;
  });

  // Relations
  if (session.relations.length) {
    body += `<h2 style="color:${GREEN};font-size:14pt;border-bottom:2px solid ${GREEN};padding-bottom:3pt;">Relations (${session.relations.length})</h2><ul style="font-size:11pt;line-height:1.5;">`;
    session.relations.forEach(r => { body += `<li><b>${esc(r.sourceEntityName)} → ${esc(r.targetEntityName)}</b> (${esc(r.type)})${r.description ? ` — ${esc(r.description)}` : ''}</li>`; });
    body += `</ul>`;
  }
  // KPIs
  if (session.kpis.length) {
    body += `<h2 style="color:${GREEN};font-size:14pt;border-bottom:2px solid ${GREEN};padding-bottom:3pt;">KPIs (${session.kpis.length})</h2><ul style="font-size:11pt;line-height:1.5;">`;
    session.kpis.forEach(k => { body += `<li><b>${esc(k.name)}</b>${k.formula ? ` — ${esc(k.formula)}` : ''}${k.description ? ` · ${esc(k.description)}` : ''}</li>`; });
    body += `</ul>`;
  }
  // Règles métier
  if (session.businessRules.length) {
    body += `<h2 style="color:${GREEN};font-size:14pt;border-bottom:2px solid ${GREEN};padding-bottom:3pt;">Règles métier (${session.businessRules.length})</h2><ul style="font-size:11pt;line-height:1.5;">`;
    session.businessRules.forEach(r => { body += `<li><b>${esc(r.name)}</b> <i>${esc(r.type)}</i>${r.description ? ` — ${esc(r.description)}` : ''}</li>`; });
    body += `</ul>`;
  }
  // Sources
  if (session.dataSources.length) {
    body += `<h2 style="color:${GREEN};font-size:14pt;border-bottom:2px solid ${GREEN};padding-bottom:3pt;">Sources de données (${session.dataSources.length})</h2><ul style="font-size:11pt;line-height:1.5;">`;
    session.dataSources.forEach(s => { body += `<li><b>${esc(s.name)}</b>${s.system ? ` — ${esc(s.system)}` : ''}${s.loadFrequency ? ` · ${esc(s.loadFrequency)}` : ''}</li>`; });
    body += `</ul>`;
  }
  // Maturité
  if (session.maturityScores) {
    body += `<h2 style="color:${GREEN};font-size:14pt;border-bottom:2px solid ${GREEN};padding-bottom:3pt;">Score de maturité</h2><table style="border-collapse:collapse;width:100%;">`;
    MATURITY_DIMENSIONS.forEach(dim => {
      const v = session.maturityScores![dim.key as keyof typeof session.maturityScores];
      body += `<tr><td style="border:1px solid #d0d5dd;padding:5px 8px;font-size:10.5pt;">${esc(dim.label)}</td><td style="border:1px solid #d0d5dd;padding:5px 8px;font-size:10.5pt;text-align:right;"><b>${esc(v)}/100</b></td></tr>`;
    });
    body += `</table>`;
  }

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${esc(session.productName || 'Rapport')}</title></head><body style="font-family:Calibri,Arial,sans-serif;color:#101828;">${body}</body></html>`;
  const blob = new Blob(['﻿', html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Rapport_${(session.productName || 'data_product').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '') || 'data_product'}.doc`;
  a.click();
  URL.revokeObjectURL(url);
}

async function downloadReportPdf(session: WorkshopSession) {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentW = pageW - margin * 2;
  const INK = 26, MUTED = 120;
  let y = 0;

  const ensure = (needed: number) => {
    if (y + needed > pageH - 46) { doc.addPage(); y = margin; }
  };
  const para = (text: string, size = 10, color = 55) => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(size); doc.setTextColor(color);
    const lines = doc.splitTextToSize(text, contentW) as string[];
    ensure(lines.length * (size + 3));
    doc.text(lines, margin, y);
    y += lines.length * (size + 3) + 2;
  };
  const sectionTitle = (t: string) => {
    y += 10; ensure(30);
    doc.setFillColor(0, 107, 79); doc.roundedRect(margin, y - 1, 3.5, 15, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(0, 107, 79);
    doc.text(t, margin + 12, y + 11); y += 26;
  };
  const bullets = (title: string, items: string[]) => {
    if (!items.length) return;
    sectionTitle(title);
    items.forEach(it => para('•  ' + it, 10, 45));
  };

  // ---- Bandeau de couverture (couleur primaire) ----
  doc.setFillColor(0, 107, 79); doc.rect(0, 0, pageW, 100, 'F');
  // Pastille "S" (favicon)
  doc.setFillColor(62, 227, 211); doc.roundedRect(margin, 30, 34, 34, 8, 8, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(19, 50, 79);
  doc.text('S', margin + 11, 54);
  // Titre + eyebrow
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
  doc.text('MART STUDIO  ·  RAPPORT DATA PRODUCT', margin + 46, 40);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(19);
  const titleLines = doc.splitTextToSize(session.productName || 'Data Product', contentW - 46) as string[];
  doc.text(titleLines[0], margin + 46, 62);
  // Date à droite
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  doc.text(new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }), pageW - margin, 40, { align: 'right' });

  y = 122;

  // ---- Méta produit (hauteur dynamique pour éviter le chevauchement) ----
  const colW = contentW / 3;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(0, 107, 79);
  doc.text('Domaine', margin, y);
  doc.text('Product Owner', margin + colW, y);
  doc.text('Data Steward', margin + colW * 2, y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(INK);
  const metaVals = [session.domain || '—', session.productOwner || '—', session.dataSteward || '—'];
  let metaMaxLines = 1;
  metaVals.forEach((v, i) => {
    const lines = doc.splitTextToSize(v, colW - 12) as string[];
    doc.text(lines, margin + colW * i, y + 15);
    metaMaxLines = Math.max(metaMaxLines, lines.length);
  });
  y += 15 + metaMaxLines * 12 + 8;
  if (session.objective) { para(`Objectif : ${session.objective}`, 10, 55); }
  if (session.contextSummary) { para(session.contextSummary, 9.5, 90); }

  // ---- Bandeau KPI ----
  const avg = session.maturityScores ? Math.round(Object.values(session.maturityScores).reduce((a, b) => a + b, 0) / 7) : 0;
  const kpis: [string, string | number][] = [
    ['Entités', session.entities.length],
    ['Relations', session.relations.length],
    ['Attributs', session.attributes.length],
    ['KPIs', session.kpis.length],
    ['Règles', session.businessRules.length],
    ['Maturité', `${avg}%`],
  ];
  y += 6; ensure(64);
  const gap = 8; const boxW = (contentW - gap * (kpis.length - 1)) / kpis.length;
  kpis.forEach((k, i) => {
    const x = margin + i * (boxW + gap);
    doc.setFillColor(244, 246, 250); doc.roundedRect(x, y, boxW, 52, 6, 6, 'F');
    doc.setTextColor(0, 107, 79); doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
    doc.text(String(k[1]), x + boxW / 2, y + 26, { align: 'center' });
    doc.setTextColor(MUTED); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
    doc.text(String(k[0]), x + boxW / 2, y + 42, { align: 'center' });
  });
  y += 64;

  // ---- Entités & attributs ----
  sectionTitle(`Entités & attributs (${session.entities.length})`);
  session.entities.forEach(e => {
    ensure(50);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(19, 50, 79);
    doc.text(e.name, margin, y); y += 4;
    const attrs = session.attributes.filter(a => a.entityId === e.id || a.entityId === e.name);
    autoTable(doc, {
      startY: y + 2,
      head: [['Attribut', 'Type', 'Clé', 'Description']],
      body: attrs.map(a => [a.name, a.type, a.isPrimaryKey ? 'PK' : a.isForeignKey ? 'FK' : '', a.description || '']),
      margin: { left: margin, right: margin },
      styles: { fontSize: 8.5, cellPadding: 4, overflow: 'linebreak', lineColor: [230, 232, 236], lineWidth: 0.5, textColor: INK },
      headStyles: { fillColor: [0, 107, 79], textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
      alternateRowStyles: { fillColor: [246, 248, 250] },
      columnStyles: { 0: { cellWidth: 135, fontStyle: 'bold' }, 1: { cellWidth: 72 }, 2: { cellWidth: 38, halign: 'center' } },
      theme: 'grid',
      didParseCell: (d) => {
        if (d.section === 'body' && d.column.index === 2) {
          if (d.cell.raw === 'PK') { d.cell.styles.textColor = [176, 120, 0]; d.cell.styles.fontStyle = 'bold'; }
          if (d.cell.raw === 'FK') { d.cell.styles.textColor = [37, 99, 235]; d.cell.styles.fontStyle = 'bold'; }
        }
      },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16;
  });

  // Relations : table (bien plus lisible que des puces)
  if (session.relations.length) {
    sectionTitle(`Relations (${session.relations.length})`);
    ensure(30);
    autoTable(doc, {
      startY: y,
      head: [['Source', 'Card.', 'Cible', 'Description']],
      body: session.relations.map(r => [r.sourceEntityName, r.type, r.targetEntityName, r.description || '']),
      margin: { left: margin, right: margin },
      styles: { fontSize: 8.5, cellPadding: 4, overflow: 'linebreak', lineColor: [230, 232, 236], lineWidth: 0.5, textColor: INK },
      headStyles: { fillColor: [0, 107, 79], textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
      alternateRowStyles: { fillColor: [246, 248, 250] },
      columnStyles: {
        0: { cellWidth: 115, fontStyle: 'bold' },
        1: { cellWidth: 46, halign: 'center', textColor: [0, 107, 79], fontStyle: 'bold' },
        2: { cellWidth: 115, fontStyle: 'bold' },
      },
      theme: 'grid',
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16;
  }

  bullets(`KPIs (${session.kpis.length})`, session.kpis.map(k => `${k.name}${k.formula ? ' — ' + k.formula : ''}`));
  bullets(`Règles métier (${session.businessRules.length})`, session.businessRules.map(r => `${r.name} (${r.type})${r.description ? ' — ' + r.description : ''}`));
  bullets(`Sources de données (${session.dataSources.length})`, session.dataSources.map(s => `${s.name}${s.system ? ' — ' + s.system : ''}${s.loadFrequency ? ' · ' + s.loadFrequency : ''}`));
  if (session.maturityScores) {
    bullets('Score de maturité', MATURITY_DIMENSIONS.map(d => `${d.label} : ${session.maturityScores![d.key as keyof typeof session.maturityScores]}/100`));
  }

  // ---- Pied de page (filet + branding) sur chaque page ----
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(0, 107, 79); doc.setLineWidth(0.6);
    doc.line(margin, pageH - 30, pageW - margin, pageH - 30);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(MUTED);
    doc.text('Mart Studio · Sofinco — Personal Finance & Mobility', margin, pageH - 17);
    doc.text(`Page ${i} / ${pages}`, pageW - margin, pageH - 17, { align: 'right' });
  }

  const fileName = (session.productName || 'data-product').replace(/[^a-z0-9]+/gi, '_').toLowerCase();
  doc.save(`${fileName}.pdf`);
}

// ---- Standardisation des noms via Naming Studio --------------------------

// Convertit "ContratTravail" / "montant salaire" -> "contrat_travail" / "montant_salaire"
// (format attendu par l'API du dictionnaire).
function toSnake(name: string): string {
  return (name || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase();
}

// Liste tous les noms (entités + colonnes) à standardiser.
function collectModelKeywords(session: WorkshopSession): string[] {
  const kws = new Set<string>();
  session.entities.forEach(e => kws.add(toSnake(e.name)));
  session.relations.forEach(r => { kws.add(toSnake(r.sourceEntityName)); kws.add(toSnake(r.targetEntityName)); });
  session.attributes.forEach(a => kws.add(toSnake(a.name)));
  return Array.from(kws).filter(Boolean);
}

// Renvoie une copie de la session avec les noms standardisés. Les générateurs
// (SQL/dbt) tournent ensuite dessus sans modification : les FK restent cohérentes
// car entités, attributs et relations sont renommés de façon coordonnée.
function translateSession(session: WorkshopSession, naming: Record<string, string>): WorkshopSession {
  const tr = (raw: string) => naming[toSnake(raw)] || raw;
  const entityNameMap = new Map(session.entities.map(e => [e.name, tr(e.name)]));
  return {
    ...session,
    entities: session.entities.map(e => ({ ...e, name: tr(e.name) })),
    attributes: session.attributes.map(a => ({
      ...a,
      name: tr(a.name),
      entityId: entityNameMap.get(a.entityId) ?? a.entityId,
    })),
    relations: session.relations.map(r => ({
      ...r,
      sourceEntityName: tr(r.sourceEntityName),
      targetEntityName: tr(r.targetEntityName),
    })),
  };
}

function generateDBML(session: WorkshopSession): string {
  let dbml = `// ============================================\n// ${session.productName || 'Data Product'} — DBML\n// Généré par Mart Studio — à coller sur dbdiagram.io\n// ============================================\n\n`;

  const entitiesToGenerate = resolveEntitiesToGenerate(session);
  const fkMap = buildFkMap(session, entitiesToGenerate);
  const refs: string[] = [];

  entitiesToGenerate.forEach(entity => {
    const tableName = cleanTableName(entity.name);
    const cols = getTableColumns(entity, session, entitiesToGenerate, fkMap);

    dbml += `Table ${tableName} {\n`;
    cols.forEach(c => {
      const settings: string[] = [];
      if (c.isPk) settings.push('pk');
      if (c.isUnique && !c.isPk) settings.push('unique');
      if (c.isRequired && !c.isPk) settings.push('not null');
      const note = sanitizeComment(c.description);
      if (note) settings.push(`note: '${note.replace(/'/g, "\\'")}'`);
      const settingStr = settings.length ? ` [${settings.join(', ')}]` : '';
      dbml += `  ${c.name} ${dbmlType(c.type)}${settingStr}\n`;

      if (c.referencedTable && c.referencedColumn) {
        refs.push(`Ref: ${tableName}.${c.name} > ${c.referencedTable}.${c.referencedColumn}`);
      }
    });
    if (entity.definition) {
      dbml += `  Note: '${sanitizeComment(entity.definition).replace(/'/g, "\\'")}'\n`;
    }
    dbml += `}\n\n`;
  });

  // N:N join tables
  const processedNn = new Set<string>();
  session.relations.forEach(rel => {
    if (rel.type !== 'N:N') return;
    const srcTable = cleanTableName(rel.sourceEntityName);
    const tgtTable = cleanTableName(rel.targetEntityName);
    const key = [srcTable, tgtTable].sort().join('_');
    if (processedNn.has(key)) return;
    processedNn.add(key);

    const srcPk = getPrimaryKeyOfEntity(rel.sourceEntityName, session, entitiesToGenerate);
    const tgtPk = getPrimaryKeyOfEntity(rel.targetEntityName, session, entitiesToGenerate);
    const joinTable = `${srcTable}_${tgtTable}`;
    dbml += `Table ${joinTable} {\n`;
    dbml += `  ${srcTable}_${srcPk} bigint [not null]\n`;
    dbml += `  ${tgtTable}_${tgtPk} bigint [not null]\n`;
    dbml += `  indexes {\n    (${srcTable}_${srcPk}, ${tgtTable}_${tgtPk}) [pk]\n  }\n`;
    dbml += `}\n\n`;
    refs.push(`Ref: ${joinTable}.${srcTable}_${srcPk} > ${srcTable}.${srcPk}`);
    refs.push(`Ref: ${joinTable}.${tgtTable}_${tgtPk} > ${tgtTable}.${tgtPk}`);
  });

  if (refs.length) {
    dbml += `// Relations\n${refs.join('\n')}\n`;
  }

  return dbml;
}

// ---- Modèle dimensionnel (étoile / flocon) -------------------------------

function isFactEntity(e: Entity): boolean {
  return e.type === 'transactional' || e.type === 'event' || e.type === 'aggregate';
}

// Le nom de l'entité indique-t-il déjà un fait / une dimension ?
function nameSaysFact(name: string): boolean {
  return /^(fact|fct|faits?)[_\s-]/i.test((name || '').trim());
}
function nameSaysDim(name: string): boolean {
  return /^(dim|dimension)[_\s-]/i.test((name || '').trim());
}
// Retire un préfixe fact_/dim_/… déjà présent pour ne pas le doubler.
function stripDimFactAffix(cleanName: string): string {
  return cleanName.replace(/^(fact|fct|faits?|dim|dimension)_+/i, '') || cleanName;
}

// Sépare les entités en faits (mesures) et dimensions (axes). On respecte le
// préfixe du nom (Fact_/Dim_) s'il existe, sinon on se base sur le type, puis
// en dernier recours sur l'entité la plus reliée.
function classifyDimensional(session: WorkshopSession): { facts: Entity[]; dims: Entity[] } {
  const entities = session.entities;
  let facts = entities.filter(e => nameSaysFact(e.name) || (isFactEntity(e) && !nameSaysDim(e.name)));

  if (facts.length === 0 && entities.length > 0) {
    const incoming: Record<string, number> = {};
    session.relations.forEach(r => {
      const tgt = cleanEntityName(r.targetEntityName);
      incoming[tgt] = (incoming[tgt] || 0) + 1;
    });
    let best: Entity | null = null;
    let bestCount = 0;
    entities.forEach(e => {
      const c = incoming[cleanEntityName(e.name)] || 0;
      if (c > bestCount) { bestCount = c; best = e; }
    });
    if (best) facts = [best];
  }

  const factNames = new Set(facts.map(f => cleanEntityName(f.name)));
  const dims = entities.filter(e => !factNames.has(cleanEntityName(e.name)));
  return { facts, dims };
}

// Nom technique préfixé (convention Kimball) : fact_ pour les faits, dim_ pour
// les dimensions, en snake_case minuscule. Tout préfixe existant est retiré
// pour éviter les doublons (Fact_Appels -> fact_appels, pas fact_fact_appels).
function dimFactName(rawName: string, factNames: Set<string>): string {
  const prefix = factNames.has(cleanEntityName(rawName)) ? 'fact_' : 'dim_';
  return prefix + stripDimFactAffix(cleanTableName(rawName));
}

function buildDimensionalErd(session: WorkshopSession, entities: Entity[], relations: WorkshopSession['relations'], factNames: Set<string>): string {
  let code = 'erDiagram\n';
  const fkMap = buildFkMap(session, entities);
  const declared = new Set<string>();
  entities.forEach((entity, i) => {
    const codeName = mmdIdent(dimFactName(entity.name, factNames), `TABLE_${i + 1}`);
    declared.add(codeName);
    const cols = getTableColumns(entity, session, entities, fkMap);
    if (cols.length > 0) {
      code += `    ${codeName} {\n`;
      cols.forEach((c, ci) => {
        const pkTag = c.isPk ? 'PK' : c.referencedTable ? 'FK' : '';
        const t = mmdIdent(mapSqlType(c.type).replace(/\(.*\)/, '').toLowerCase(), 'varchar');
        const colName = mmdIdent(c.name, `col_${ci + 1}`);
        code += `        ${t} ${colName}${pkTag ? ` "${pkTag}"` : ''}\n`;
      });
      code += `    }\n`;
    } else {
      code += `    ${codeName} {\n        bigint id "PK"\n    }\n`;
    }
  });
  relations.forEach(rel => {
    const src = mmdIdent(dimFactName(rel.sourceEntityName, factNames), '');
    const tgt = mmdIdent(dimFactName(rel.targetEntityName, factNames), '');
    // On n'émet une relation que si ses deux extrémités sont des tables déclarées.
    if (!declared.has(src) || !declared.has(tgt)) return;
    const card = rel.type === '1:1' ? '||--||' : rel.type === '1:N' ? '||--o{' : rel.type === 'N:1' ? '}o--||' : '}o--o{';
    const dlabel = (rel.description || 'lié à').replace(/["\n\r]/g, ' ').replace(/\s+/g, ' ').trim() || 'lié à';
    code += `    ${src} ${card} ${tgt} : "${dlabel}"\n`;
  });
  return code;
}

function generateStarSchema(session: WorkshopSession, facts: Entity[], dims: Entity[]): string {
  const factNames = new Set(facts.map(f => cleanEntityName(f.name)));
  const dimNames = new Set(dims.map(d => cleanEntityName(d.name)));
  // Étoile : uniquement les liens fait <-> dimension (dimensions dénormalisées).
  const starRels = session.relations.filter(r => {
    const s = cleanEntityName(r.sourceEntityName);
    const t = cleanEntityName(r.targetEntityName);
    return (factNames.has(s) && dimNames.has(t)) || (factNames.has(t) && dimNames.has(s));
  });
  return buildDimensionalErd(session, [...facts, ...dims], starRels, factNames);
}

function generateSnowflakeSchema(session: WorkshopSession, facts: Entity[], dims: Entity[]): string {
  const factNames = new Set(facts.map(f => cleanEntityName(f.name)));
  // Flocon : tous les liens, y compris dimension <-> dimension (hiérarchies normalisées).
  return buildDimensionalErd(session, [...facts, ...dims], session.relations, factNames);
}

// Mode "AS alias" : garde les noms de colonnes d'origine dans le DDL et annote
// chaque colonne, inline dans le code, avec son nom standardisé (AS NOM_STD).
function applyAliasComments(session: WorkshopSession, naming: Record<string, string>): WorkshopSession {
  const attributes = session.attributes.map((a) => {
    const std = naming[toSnake(a.name)];
    if (std && std.toLowerCase() !== a.name.toLowerCase()) {
      const base = a.description ? `${a.description} ` : '';
      return { ...a, description: `${base}[AS ${std}]` };
    }
    return a;
  });
  return { ...session, attributes };
}

function generateSQL(session: WorkshopSession): string {
  let sql = `-- ============================================\n-- ${session.productName || 'Data Product'} — DDL\n-- Généré par Mart Studio\n-- ============================================\n\n`;
  
  // Resolve all entities (including implicit ones from relations)
  const entitiesToGenerate = [...session.entities];
  const existingEntityNames = new Set(session.entities.map(e => cleanEntityName(e.name)));
  
  session.relations.forEach(rel => {
    const src = cleanEntityName(rel.sourceEntityName);
    const tgt = cleanEntityName(rel.targetEntityName);
    if (!existingEntityNames.has(src)) {
      entitiesToGenerate.push({
        id: rel.sourceEntityName,
        name: rel.sourceEntityName,
        definition: `Entité implicite générée à partir des relations`,
        description: `Entité implicite générée à partir des relations`,
        example: '',
        responsible: '',
        type: 'reference',
        lifecycle: 'created'
      });
      existingEntityNames.add(src);
    }
    if (!existingEntityNames.has(tgt)) {
      entitiesToGenerate.push({
        id: rel.targetEntityName,
        name: rel.targetEntityName,
        definition: `Entité implicite générée à partir des relations`,
        description: `Entité implicite générée à partir des relations`,
        example: '',
        responsible: '',
        type: 'reference',
        lifecycle: 'created'
      });
      existingEntityNames.add(tgt);
    }
  });

  const fkMap = buildFkMap(session, entitiesToGenerate);
  
  entitiesToGenerate.forEach(entity => {
    const tableName = cleanTableName(entity.name);
    const cols = getTableColumns(entity, session, entitiesToGenerate, fkMap);
    
    sql += `-- ${entity.definition || entity.name}\nCREATE TABLE ${tableName} (\n`;

    // Build each item as { definition, comment } so the separating comma is placed
    // BEFORE the inline "--" comment. Otherwise the comma ends up inside the comment
    // and the whole CREATE TABLE statement becomes invalid.
    const items: { def: string; comment: string }[] = [];

    cols.forEach(c => {
      let def = `    ${c.name} ${mapSqlType(c.type)}`;
      if (c.isPk) def += ' PRIMARY KEY';
      if (c.isRequired && !c.isPk) def += ' NOT NULL';
      items.push({ def, comment: sanitizeComment(c.description) });
    });

    cols.forEach(c => {
      if (c.referencedTable && c.referencedColumn) {
        items.push({
          def: `    CONSTRAINT fk_${tableName}_${c.name} FOREIGN KEY (${c.name}) REFERENCES ${c.referencedTable}(${c.referencedColumn})`,
          comment: '',
        });
      }
    });

    sql += items
      .map((item, i) => {
        const comma = i < items.length - 1 ? ',' : '';
        return `${item.def}${comma}${item.comment ? ` -- ${item.comment}` : ''}`;
      })
      .join('\n');
    sql += `\n);\n\n`;
  });
  
  // Generate N:N Join tables
  const processedNnRelations = new Set<string>();
  session.relations.forEach(rel => {
    if (rel.type === 'N:N') {
      const srcTable = cleanTableName(rel.sourceEntityName);
      const tgtTable = cleanTableName(rel.targetEntityName);
      
      const relationKey = [srcTable, tgtTable].sort().join('_');
      if (processedNnRelations.has(relationKey)) return;
      processedNnRelations.add(relationKey);
      
      const srcPk = getPrimaryKeyOfEntity(rel.sourceEntityName, session, entitiesToGenerate);
      const tgtPk = getPrimaryKeyOfEntity(rel.targetEntityName, session, entitiesToGenerate);
      const joinTableName = `${srcTable}_${tgtTable}`;
      
      sql += `-- Table de jointure pour la relation N:N entre ${rel.sourceEntityName} et ${rel.targetEntityName}\n`;
      sql += `-- Description : ${rel.description || 'Association N:N'}\n`;
      sql += `CREATE TABLE ${joinTableName} (\n`;
      sql += `    ${srcTable}_${srcPk} BIGINT NOT NULL,\n`;
      sql += `    ${tgtTable}_${tgtPk} BIGINT NOT NULL,\n`;
      sql += `    PRIMARY KEY (${srcTable}_${srcPk}, ${tgtTable}_${tgtPk}),\n`;
      sql += `    CONSTRAINT fk_${joinTableName}_${srcTable} FOREIGN KEY (${srcTable}_${srcPk}) REFERENCES ${srcTable}(${srcPk}),\n`;
      sql += `    CONSTRAINT fk_${joinTableName}_${tgtTable} FOREIGN KEY (${tgtTable}_${tgtPk}) REFERENCES ${tgtTable}(${tgtPk})\n`;
      sql += `);\n\n`;
    }
  });
  
  return sql;
}

// Inline SQL comments run to end of line, so any newline inside a description
// would break the statement. Collapse whitespace to keep the comment on one line.
function sanitizeComment(text: string): string {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function mapSqlType(type: string): string {
  const raw = (type || '').trim();
  if (!raw) return 'VARCHAR(255)';
  // Sépare le type de base de sa taille : ex. « varchar(10) » → base=varchar, args=(10).
  const m = raw.match(/^([a-zA-Z_]+)\s*(\(\s*\d+\s*(?:,\s*\d+\s*)?\))?/);
  if (!m) return raw.toUpperCase();
  const base = m[1].toLowerCase();
  const args = m[2] ? m[2].replace(/\s+/g, '') : '';   // « (10) » ou « (18,4) », taille SAISIE conservée
  const U = m[1].toUpperCase();
  // Chaînes : on conserve la longueur choisie par l'utilisateur, sinon défaut.
  if (['varchar', 'char', 'string', 'nvarchar', 'nchar', 'character'].includes(base))
    return args ? `${base === 'string' ? 'VARCHAR' : U}${args}` : (base === 'char' ? 'CHAR(1)' : 'VARCHAR(255)');
  // Numériques décimaux : on conserve (précision, échelle) saisies, sinon défaut.
  if (['decimal', 'numeric', 'number'].includes(base))
    return args ? `${base === 'number' ? 'NUMBER' : U}${args}` : 'DECIMAL(18,4)';
  if (['int', 'integer', 'bigint', 'smallint', 'tinyint', 'byteint', 'serial', 'int2', 'int4', 'int8'].includes(base)) return 'BIGINT';
  if (['float', 'double', 'real', 'float4', 'float8'].includes(base)) return 'FLOAT';
  if (base === 'datetime' || base === 'timestamp' || (base === 'date' && raw.toLowerCase().includes('time'))) return 'TIMESTAMP';
  if (base === 'date') return 'DATE';
  if (base === 'time') return 'TIME';
  if (base === 'bool' || base === 'boolean') return 'BOOLEAN';
  if (base === 'text') return 'TEXT';
  if (base === 'variant') return 'VARIANT';
  return U + args; // type inconnu : on le laisse tel quel (avec sa taille éventuelle)
}

function generateDbtYaml(session: WorkshopSession): string {
  let yaml = `version: 2\n\nmodels:\n`;
  
  // Resolve all entities (including implicit ones from relations)
  const entitiesToGenerate = [...session.entities];
  const existingEntityNames = new Set(session.entities.map(e => cleanEntityName(e.name)));
  
  session.relations.forEach(rel => {
    const src = cleanEntityName(rel.sourceEntityName);
    const tgt = cleanEntityName(rel.targetEntityName);
    if (!existingEntityNames.has(src)) {
      entitiesToGenerate.push({
        id: rel.sourceEntityName,
        name: rel.sourceEntityName,
        definition: `Entité implicite générée à partir des relations`,
        description: `Entité implicite générée à partir des relations`,
        example: '',
        responsible: '',
        type: 'reference',
        lifecycle: 'created'
      });
      existingEntityNames.add(src);
    }
    if (!existingEntityNames.has(tgt)) {
      entitiesToGenerate.push({
        id: rel.targetEntityName,
        name: rel.targetEntityName,
        definition: `Entité implicite générée à partir des relations`,
        description: `Entité implicite générée à partir des relations`,
        example: '',
        responsible: '',
        type: 'reference',
        lifecycle: 'created'
      });
      existingEntityNames.add(tgt);
    }
  });

  const fkMap = buildFkMap(session, entitiesToGenerate);
  
  entitiesToGenerate.forEach(entity => {
    const modelName = cleanTableName(entity.name);
    yaml += `  - name: ${modelName}\n`;
    yaml += `    description: "${(entity.definition || entity.description || entity.name).replace(/"/g, '\\"')}"\n`;
    yaml += `    columns:\n`;
    
    const cols = getTableColumns(entity, session, entitiesToGenerate, fkMap);
    
    cols.forEach(c => {
      yaml += `      - name: ${c.name}\n`;
      yaml += `        description: "${c.description.replace(/"/g, '\\"')}"\n`;
      
      const tests: string[] = [];
      if (c.isPk) {
        tests.push('unique');
        tests.push('not_null');
      } else if (c.isRequired) {
        tests.push('not_null');
      }
      
      const hasTests = tests.length > 0;
      const hasRelation = c.referencedTable && c.referencedColumn;
      
      if (hasTests || hasRelation) {
        yaml += `        tests:\n`;
        tests.forEach(t => {
          yaml += `          - ${t}\n`;
        });
        if (hasRelation) {
          yaml += `          - relationships:\n`;
          yaml += `              to: ref('${c.referencedTable}')\n`;
          yaml += `              field: ${c.referencedColumn}\n`;
        }
      }
    });
    
    yaml += `\n`;
  });

  // N:N relations to define join tables
  const processedNnRelations = new Set<string>();
  session.relations.forEach(rel => {
    if (rel.type === 'N:N') {
      const srcTable = cleanTableName(rel.sourceEntityName);
      const tgtTable = cleanTableName(rel.targetEntityName);
      
      const relationKey = [srcTable, tgtTable].sort().join('_');
      if (processedNnRelations.has(relationKey)) return;
      processedNnRelations.add(relationKey);
      
      const srcPk = getPrimaryKeyOfEntity(rel.sourceEntityName, session, entitiesToGenerate);
      const tgtPk = getPrimaryKeyOfEntity(rel.targetEntityName, session, entitiesToGenerate);
      const joinTableName = `${srcTable}_${tgtTable}`;
      
      yaml += `  - name: ${joinTableName}\n`;
      yaml += `    description: "Table de jointure N:N reliant les entités ${rel.sourceEntityName} et ${rel.targetEntityName}. Description : ${(rel.description || '').replace(/"/g, '\\"')}"\n`;
      yaml += `    columns:\n`;
      
      // Column 1
      yaml += `      - name: ${srcTable}_${srcPk}\n`;
      yaml += `        description: "Clé étrangère composite vers ${srcTable}"\n`;
      yaml += `        tests:\n`;
      yaml += `          - not_null\n`;
      yaml += `          - relationships:\n`;
      yaml += `              to: ref('${srcTable}')\n`;
      yaml += `              field: ${srcPk}\n`;
      
      // Column 2
      yaml += `      - name: ${tgtTable}_${tgtPk}\n`;
      yaml += `        description: "Clé étrangère composite vers ${tgtTable}"\n`;
      yaml += `        tests:\n`;
      yaml += `          - not_null\n`;
      yaml += `          - relationships:\n`;
      yaml += `              to: ref('${tgtTable}')\n`;
      yaml += `              field: ${tgtPk}\n`;
      
      yaml += `\n`;
    }
  });
  
  return yaml;
}

// ---- Code Block ----

function CodeBlock({ title, language, code, hideActions }: { title: string; language: string; code: string; hideActions?: boolean }) {
  const [copied, setCopied] = useState(false);

  function copyCode() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadCode() {
    const ext = language === 'sql' ? '.sql' : language === 'yaml' ? '.yml' : language === 'dbml' ? '.dbml' : '.txt';
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${title.replace(/\s/g, '_').toLowerCase()}${ext}`;
    a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div className="code-preview">
      <div className="code-preview-header">
        <span className="code-preview-title">{title}</span>
        {!hideActions && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="copy-btn" onClick={copyCode}>{copied ? '✓ Copié' : '📋 Copier'}</button>
            <button className="copy-btn" onClick={downloadCode}>⬇ Télécharger</button>
          </div>
        )}
      </div>
      <div className="code-preview-body">
        <SyntaxHighlighter
          language={language === 'yaml' ? 'yaml' : language === 'dbml' ? 'sql' : language === 'mermaid' ? 'text' : 'sql'}
          style={oneLight}
          customStyle={{ margin: 0, background: '#F8FAFC', color: '#1f2937', fontSize: 12.5, padding: 16, borderRadius: 8, border: '1px solid #E5E7EB' }}
          codeTagProps={{ style: { background: 'transparent', fontFamily: "'Fira Code','Cascadia Code',monospace" } }}
          wrapLongLines
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
