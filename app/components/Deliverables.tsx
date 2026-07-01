'use client';

import { useState } from 'react';
import { useWorkshopStore } from '@/lib/store';
import { WorkshopSession, Entity } from '@/lib/types';
import { MATURITY_DIMENSIONS } from '@/lib/constants';
import MermaidDiagram from './MermaidDiagram';
import { transformMany } from '@/lib/naming';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

type Tab = 'overview' | 'report' | 'mcd' | 'dimensional' | 'dbml' | 'sql' | 'dbt' | 'dictionary' | 'dad';

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

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'overview', label: 'Vue d\'ensemble', icon: '📊' },
    { key: 'report', label: 'Rapport détaillé (PDF)', icon: '📄' },
    { key: 'mcd', label: 'MCD / ERD', icon: '🗺️' },
    { key: 'dimensional', label: 'Étoile / Flocon', icon: '❄️' },
    { key: 'dbml', label: 'DBML (dbdiagram.io)', icon: '🧬' },
    { key: 'sql', label: 'SQL DDL', icon: '💾' },
    { key: 'dbt', label: 'dbt YAML', icon: '🔧' },
    { key: 'dictionary', label: 'Dictionnaire', icon: '📖' },
    { key: 'dad', label: 'Rapport DAD', icon: '📋' },
  ];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, padding: '12px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)', overflowX: 'auto' }}>
        {tabs.map(t => (
          <button key={t.key} className={`suggested-chip ${activeTab === t.key ? 'active' : ''}`}
            style={activeTab === t.key ? { background: 'var(--primary-glow)', borderColor: 'var(--border-active)', color: 'var(--primary-light)' } : {}}
            onClick={() => setActiveTab(t.key)}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        {activeTab === 'overview' && <OverviewTab session={data} />}
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

  const cards: { key: OverviewDetailKey; label: string; value: number; icon: string }[] = [
    { key: 'entities', label: 'Entités', value: nbEnt, icon: '🧩' },
    { key: 'relations', label: 'Relations', value: session.relations.length, icon: '🔗' },
    { key: 'attributes', label: 'Attributs', value: session.attributes.length, icon: '📋' },
    { key: 'kpis', label: 'KPIs', value: session.kpis.length, icon: '📊' },
    { key: 'rules', label: 'Règles', value: session.businessRules.length, icon: '⚖️' },
    { key: 'sources', label: 'Sources', value: session.dataSources.length, icon: '🗄️' },
  ];

  const topEntities = [...session.entities].map(e => ({ name: e.name, n: attrsOf(e).length })).sort((a, b) => b.n - a.n).slice(0, 8);
  const maxAttr = Math.max(1, ...topEntities.map(e => e.n));
  const cardBox: React.CSSProperties = { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 20 };

  return (
    <div className="fade-in">
      <h2 style={{ fontSize: 22, marginBottom: 4 }}>{session.productName || 'Data Product'} — Tableau de bord</h2>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>Vue synthétique du modèle. Cliquez sur un indicateur pour le détail.</p>

      {/* Indicateurs clés */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
        {cards.map(s => (
          <div key={s.label} className="stat-card" style={{ cursor: s.value > 0 ? 'pointer' : 'default' }} onClick={() => s.value > 0 && setDetail(s.key)}>
            <div style={{ fontSize: 22, marginBottom: 2 }}>{s.icon}</div>
            <div className="stat-value" style={{ fontSize: 26 }}>{s.value}</div>
            <div className="stat-label">{s.label}{s.value > 0 && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}> ›</span>}</div>
          </div>
        ))}
      </div>

      {/* Jauges de complétude + faits/dimensions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginBottom: 20 }}>
        <div style={cardBox}>
          <div style={{ fontWeight: 700, marginBottom: 16 }}>Complétude du modèle</div>
          <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: 12 }}>
            <Donut pct={nbEnt ? (entWithAttrs / nbEnt) * 100 : 0} label="Entités documentées" sub={`${entWithAttrs}/${nbEnt}`} color="var(--primary)" />
            <Donut pct={nbEnt ? (entWithPk / nbEnt) * 100 : 0} label="Clés primaires" sub={`${entWithPk}/${nbEnt}`} color="var(--accent-blue)" />
            <Donut pct={avgScore} label="Maturité globale" sub={`${avgScore}/100`} color={avgScore >= 70 ? 'var(--accent-emerald)' : avgScore >= 40 ? 'var(--accent-amber)' : 'var(--accent-red)'} />
          </div>
        </div>

        <div style={cardBox}>
          <div style={{ fontWeight: 700, marginBottom: 16 }}>Répartition faits / dimensions</div>
          <div style={{ display: 'flex', height: 26, borderRadius: 8, overflow: 'hidden', marginBottom: 12, background: 'var(--bg-elevated)' }}>
            {facts.length > 0 && <div style={{ width: `${factRatio}%`, background: '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700 }}>{facts.length}</div>}
            {dims.length > 0 && <div style={{ width: `${100 - factRatio}%`, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700 }}>{dims.length}</div>}
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 12.5 }}>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#F59E0B', borderRadius: 2, marginRight: 6 }} />⭐ Faits : <strong>{facts.length}</strong></span>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--primary)', borderRadius: 2, marginRight: 6 }} />🧩 Dimensions : <strong>{dims.length}</strong></span>
          </div>
          <div style={{ display: 'flex', gap: 24, marginTop: 16, fontSize: 13 }}>
            <div><div style={{ fontSize: 24, fontWeight: 800, color: 'var(--primary)' }}>{pkCount}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>clés primaires</div></div>
            <div><div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent-blue)' }}>{fkCount}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>clés étrangères</div></div>
            <div><div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)' }}>{nbEnt ? Math.round(session.attributes.length / nbEnt) : 0}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>attributs / entité</div></div>
          </div>
        </div>
      </div>

      {/* Attributs par entité */}
      {topEntities.length > 0 && (
        <div style={{ ...cardBox, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, marginBottom: 16 }}>Attributs par entité {session.entities.length > 8 && <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>(top 8)</span>}</div>
          {topEntities.map(e => <BarRow key={e.name} label={e.name} value={e.n} max={maxAttr} color="var(--primary)" />)}
        </div>
      )}

      {detail && <OverviewDetailModal session={session} detail={detail} onClose={() => setDetail(null)} />}

      {session.maturityScores && (
        <div style={cardBox}>
          <div style={{ fontWeight: 700, marginBottom: 16 }}>Score de maturité par dimension</div>
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
        <button className="cta-btn" onClick={() => downloadReportPdf(session)}>📄 Télécharger en PDF</button>
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

function downloadTextFile(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// Boutons d'action proéminents (comme l'onglet DBML) : Copier + Télécharger.
function DeliverableActions({ code, filename, copyLabel }: { code: string; filename: string; copyLabel: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
      <button className="cta-btn" onClick={() => { navigator.clipboard.writeText(code).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
        📋 {copyLabel}
      </button>
      <button className="cta-btn cta-btn-secondary" onClick={() => downloadTextFile(code, filename)}>⬇ Télécharger {filename}</button>
      {copied && <span style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 600 }}>✓ Copié dans le presse-papier</span>}
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
        <button className="cta-btn cta-btn-secondary" onClick={onTranslate} disabled={translating}>
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
      <DeliverableActions code={sql} filename="schema.sql" copyLabel="Copier le DDL SQL" />
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
      <DeliverableActions code={yaml} filename="schema.yml" copyLabel="Copier le YAML" />
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
        columnName: `${srcTable}_${srcPk}`,
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
        columnName: `${tgtTable}_${tgtPk}`,
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
        columnName: `${srcTable}_${srcPk}`,
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

  entitiesToGenerate.forEach(entity => {
    const codeName = cleanEntityName(entity.name);
    // Use the same deduplicated column resolution as the SQL/dbt generators so the
    // diagram never shows duplicate attributes or columns.
    const cols = getTableColumns(entity, session, entitiesToGenerate, mermaidFkMap);
    if (cols.length > 0) {
      code += `    ${codeName} {\n`;
      cols.forEach(c => {
        const pkTag = c.isPk ? 'PK' : c.referencedTable ? 'FK' : '';
        const mermaidType = mapSqlType(c.type).replace(/\(.*\)/, '').toLowerCase();
        code += `        ${mermaidType} ${c.name}${pkTag ? ` "${pkTag}"` : ''}\n`;
      });
      code += `    }\n`;
    } else {
      code += `    ${codeName} {\n        bigint id "PK"\n    }\n`;
    }
  });

  session.relations.forEach(rel => {
    const src = cleanEntityName(rel.sourceEntityName);
    const tgt = cleanEntityName(rel.targetEntityName);
    const card = rel.type === '1:1' ? '||--||' : rel.type === '1:N' ? '||--o{' : rel.type === 'N:1' ? '}o--||' : '}o--o{';
    code += `    ${src} ${card} ${tgt} : "${rel.description || 'lié à'}"\n`;
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

async function downloadReportPdf(session: WorkshopSession) {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  let y = margin;

  const ensure = (needed: number) => {
    if (y + needed > pageH - margin) { doc.addPage(); y = margin; }
  };
  const para = (text: string, size = 10, color = 40) => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(size); doc.setTextColor(color);
    const lines = doc.splitTextToSize(text, pageW - margin * 2) as string[];
    ensure(lines.length * (size + 2));
    doc.text(lines, margin, y);
    y += lines.length * (size + 2) + 2;
  };
  const sectionTitle = (t: string) => {
    y += 8; ensure(28);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(0, 107, 79);
    doc.text(t, margin, y); y += 6;
    doc.setDrawColor(220); doc.line(margin, y, pageW - margin, y); y += 14;
  };
  const bullets = (title: string, items: string[]) => {
    if (!items.length) return;
    sectionTitle(title);
    items.forEach(it => para('•  ' + it, 10, 30));
  };

  // En-tête
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(0, 107, 79);
  doc.text(session.productName || 'Data Product', margin, y); y += 22;
  para(`Domaine : ${session.domain || '—'}`, 10, 70);
  para(`Product Owner : ${session.productOwner || '—'}    |    Data Steward : ${session.dataSteward || '—'}`, 10, 70);
  if (session.objective) para(`Objectif : ${session.objective}`, 10, 70);
  if (session.contextSummary) para(session.contextSummary, 10, 70);

  // Entités & attributs
  sectionTitle(`Entités & attributs (${session.entities.length})`);
  session.entities.forEach(e => {
    ensure(40);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(20);
    doc.text(e.name, margin, y); y += 4;
    const attrs = session.attributes.filter(a => a.entityId === e.id || a.entityId === e.name);
    autoTable(doc, {
      startY: y + 2,
      head: [['Attribut', 'Type', 'Clé', 'Description']],
      body: attrs.map(a => [a.name, a.type, a.isPrimaryKey ? 'PK' : a.isForeignKey ? 'FK' : '', a.description || '']),
      margin: { left: margin, right: margin },
      styles: { fontSize: 8.5, cellPadding: 3, overflow: 'linebreak' },
      headStyles: { fillColor: [0, 107, 79] },
      columnStyles: { 0: { cellWidth: 120 }, 1: { cellWidth: 70 }, 2: { cellWidth: 40 } },
      theme: 'grid',
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14;
  });

  bullets(`Relations (${session.relations.length})`, session.relations.map(r => `${r.sourceEntityName} -> ${r.targetEntityName} (${r.type})${r.description ? ' — ' + r.description : ''}`));
  bullets(`KPIs (${session.kpis.length})`, session.kpis.map(k => `${k.name}${k.formula ? ' — ' + k.formula : ''}`));
  bullets(`Règles métier (${session.businessRules.length})`, session.businessRules.map(r => `${r.name} (${r.type})${r.description ? ' — ' + r.description : ''}`));
  bullets(`Sources de données (${session.dataSources.length})`, session.dataSources.map(s => `${s.name}${s.system ? ' — ' + s.system : ''}${s.loadFrequency ? ' · ' + s.loadFrequency : ''}`));
  if (session.maturityScores) {
    bullets('Score de maturité', MATURITY_DIMENSIONS.map(d => `${d.label} : ${session.maturityScores![d.key as keyof typeof session.maturityScores]}/100`));
  }

  // Pied de page sur chaque page
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(150);
    doc.text(`Mart Studio — Crédit Agricole PF&M   ·   page ${i}/${pages}`, margin, pageH - 20);
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
  entities.forEach(entity => {
    const codeName = dimFactName(entity.name, factNames);
    const cols = getTableColumns(entity, session, entities, fkMap);
    if (cols.length > 0) {
      code += `    ${codeName} {\n`;
      cols.forEach(c => {
        const pkTag = c.isPk ? 'PK' : c.referencedTable ? 'FK' : '';
        const t = mapSqlType(c.type).replace(/\(.*\)/, '').toLowerCase();
        code += `        ${t} ${c.name}${pkTag ? ` "${pkTag}"` : ''}\n`;
      });
      code += `    }\n`;
    } else {
      code += `    ${codeName} {\n        bigint id "PK"\n    }\n`;
    }
  });
  relations.forEach(rel => {
    const src = dimFactName(rel.sourceEntityName, factNames);
    const tgt = dimFactName(rel.targetEntityName, factNames);
    const card = rel.type === '1:1' ? '||--||' : rel.type === '1:N' ? '||--o{' : rel.type === 'N:1' ? '}o--||' : '}o--o{';
    code += `    ${src} ${card} ${tgt} : "${(rel.description || 'lié à').replace(/"/g, '')}"\n`;
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
  const t = (type || 'varchar').toLowerCase();
  if (t.includes('int')) return 'BIGINT';
  if (t.includes('decimal') || t.includes('float') || t.includes('numeric')) return 'DECIMAL(18,4)';
  if (t.includes('date') && t.includes('time')) return 'TIMESTAMP';
  if (t.includes('date')) return 'DATE';
  if (t.includes('bool')) return 'BOOLEAN';
  if (t.includes('text')) return 'TEXT';
  return 'VARCHAR(255)';
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

function CodeBlock({ title, language, code }: { title: string; language: string; code: string }) {
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
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="copy-btn" onClick={copyCode}>{copied ? '✓ Copié' : '📋 Copier'}</button>
          <button className="copy-btn" onClick={downloadCode}>⬇ Télécharger</button>
        </div>
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
