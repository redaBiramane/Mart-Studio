'use client';

import { useState } from 'react';
import { WorkshopSession } from '@/lib/types';

interface ContextPanelProps {
  session: WorkshopSession;
  onClose: () => void;
}

type DetailKey = 'entities' | 'relations' | 'attributes' | 'kpis' | 'rules' | 'sources' | 'maturity' | null;

export default function ContextPanel({ session, onClose }: ContextPanelProps) {
  const [detail, setDetail] = useState<DetailKey>(null);

  const cardStyle: React.CSSProperties = { cursor: 'pointer' };
  const clickHint = (
    <span style={{ float: 'right', fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>voir tout ›</span>
  );

  return (
    <div className="context-panel slide-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
          Données collectées
        </span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16 }}>✕</button>
      </div>

      {session.productName && (
        <div className="context-card">
          <div className="context-card-title">🎯 Produit</div>
          <div className="context-card-content">
            <strong>{session.productName}</strong>
            {session.domain && <div style={{ marginTop: 4 }}>Domaine: {session.domain}</div>}
            {session.productOwner && <div>PO: {session.productOwner}</div>}
            {session.dataSteward && <div>Data Steward: {session.dataSteward}</div>}
          </div>
        </div>
      )}

      {session.contextSummary && (
        <div className="context-card">
          <div className="context-card-title">📝 Contexte</div>
          <div className="context-card-content">{session.contextSummary}</div>
        </div>
      )}

      {session.entities.length > 0 && (
        <div className="context-card" style={cardStyle} onClick={() => setDetail('entities')}>
          <div className="context-card-title">🧩 Entités ({session.entities.length}) {clickHint}</div>
          <div className="context-card-content">
            {session.entities.map(e => (
              <span key={e.id} className="context-tag">{e.name}</span>
            ))}
          </div>
        </div>
      )}

      {session.relations.length > 0 && (
        <div className="context-card" style={cardStyle} onClick={() => setDetail('relations')}>
          <div className="context-card-title">🔗 Relations ({session.relations.length}) {clickHint}</div>
          <div className="context-card-content">
            {session.relations.slice(0, 6).map(r => (
              <div key={r.id} style={{ fontSize: 12, marginBottom: 4 }}>
                {r.sourceEntityName} → {r.targetEntityName} ({r.type})
              </div>
            ))}
            {session.relations.length > 6 && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>+{session.relations.length - 6} autres</span>
            )}
          </div>
        </div>
      )}

      {session.attributes.length > 0 && (
        <div className="context-card" style={cardStyle} onClick={() => setDetail('attributes')}>
          <div className="context-card-title">📋 Attributs ({session.attributes.length}) {clickHint}</div>
          <div className="context-card-content">
            {session.attributes.slice(0, 10).map(a => (
              <span key={a.id} className="context-tag">
                {a.name} {a.isPrimaryKey ? '🔑' : ''}
              </span>
            ))}
            {session.attributes.length > 10 && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}> +{session.attributes.length - 10} autres</span>
            )}
          </div>
        </div>
      )}

      {session.kpis.length > 0 && (
        <div className="context-card" style={cardStyle} onClick={() => setDetail('kpis')}>
          <div className="context-card-title">📊 KPIs ({session.kpis.length}) {clickHint}</div>
          <div className="context-card-content">
            {session.kpis.map(k => (
              <span key={k.id} className="context-tag">{k.name}</span>
            ))}
          </div>
        </div>
      )}

      {session.businessRules.length > 0 && (
        <div className="context-card" style={cardStyle} onClick={() => setDetail('rules')}>
          <div className="context-card-title">⚖️ Règles métier ({session.businessRules.length}) {clickHint}</div>
          <div className="context-card-content">
            {session.businessRules.map(r => (
              <span key={r.id} className="context-tag">{r.name}</span>
            ))}
          </div>
        </div>
      )}

      {session.dataSources.length > 0 && (
        <div className="context-card" style={cardStyle} onClick={() => setDetail('sources')}>
          <div className="context-card-title">🗄️ Sources ({session.dataSources.length}) {clickHint}</div>
          <div className="context-card-content">
            {session.dataSources.map(s => (
              <span key={s.id} className="context-tag">{s.name}</span>
            ))}
          </div>
        </div>
      )}

      {session.maturityScores && (
        <div className="context-card">
          <div className="context-card-title">🏁 Score de maturité</div>
          <div className="context-card-content">
            {Object.entries(session.maturityScores).map(([key, value]) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                <span>{key}</span>
                <span style={{ fontWeight: 700, color: value >= 70 ? 'var(--accent-emerald)' : value >= 40 ? 'var(--accent-amber)' : 'var(--accent-red)' }}>
                  {value}/100
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!session.productName && session.entities.length === 0 && (
        <div className="empty-state" style={{ padding: 24 }}>
          <div className="empty-state-icon" style={{ fontSize: 28 }}>📋</div>
          <div className="empty-state-text" style={{ fontSize: 12 }}>
            Les données collectées pendant l&apos;atelier apparaîtront ici au fur et à mesure de la conversation.
          </div>
        </div>
      )}

      {detail && <DetailModal session={session} detail={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

function DetailModal({ session, detail, onClose }: { session: WorkshopSession; detail: Exclude<DetailKey, null>; onClose: () => void }) {
  const titles: Record<string, string> = {
    entities: '🧩 Entités',
    relations: '🔗 Relations',
    attributes: '📋 Attributs',
    kpis: '📊 KPIs',
    rules: '⚖️ Règles métier',
    sources: '🗄️ Sources de données',
    maturity: '🏁 Maturité',
  };

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', width: 'min(720px, 100%)', maxHeight: '82vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}
      >
        <div style={{ position: 'sticky', top: 0, background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 16, margin: 0 }}>{titles[detail]}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>
        <div style={{ padding: 20 }}>
          {detail === 'entities' && session.entities.map(e => (
            <DetailItem key={e.id} title={`${e.name}`} badge={e.type}>
              {e.definition && <p>{e.definition}</p>}
              {e.example && <p style={{ color: 'var(--text-muted)' }}>Ex : {e.example}</p>}
            </DetailItem>
          ))}

          {detail === 'relations' && session.relations.map(r => (
            <DetailItem key={r.id} title={`${r.sourceEntityName} → ${r.targetEntityName}`} badge={r.type}>
              <p>{r.description || 'Relation'}</p>
              <p style={{ color: 'var(--text-muted)' }}>
                {r.isRequired ? 'Obligatoire' : 'Optionnelle'}{r.isHierarchy ? ' · Hiérarchique' : ''}
              </p>
            </DetailItem>
          ))}

          {detail === 'attributes' && session.entities.map(entity => {
            const attrs = session.attributes.filter(a => a.entityId === entity.id || a.entityId === entity.name);
            const pkName = entity.name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').toLowerCase() + '_id';
            return (
              <div key={entity.id} style={{ marginBottom: 18 }}>
                <div style={{ fontWeight: 700, color: 'var(--primary-light)', marginBottom: 6 }}>{entity.name}</div>
                {attrs.length === 0 ? (
                  <div style={{ fontSize: 13, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                    <strong>{pkName}</strong> <span style={{ color: 'var(--accent-blue)' }}>BIGINT</span> <span title="Clé primaire">🔑</span>
                    <span style={{ color: 'var(--text-muted)' }}> — clé primaire (par défaut, attributs non détaillés)</span>
                  </div>
                ) : attrs.map(a => (
                  <div key={a.id} style={{ fontSize: 13, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                    <strong>{a.name}</strong> <span style={{ color: 'var(--accent-blue)' }}>{a.type}</span>{' '}
                    {a.isPrimaryKey && <span title="Clé primaire">🔑</span>}
                    {a.isForeignKey && <span title="Clé étrangère">🔗</span>}
                    {a.isSensitive && <span title="Sensible">🔒</span>}
                    {a.description && <span style={{ color: 'var(--text-muted)' }}> — {a.description}</span>}
                  </div>
                ))}
              </div>
            );
          })}

          {detail === 'kpis' && session.kpis.map(k => (
            <DetailItem key={k.id} title={k.name}>
              {k.formula && <p>Formule : <code>{k.formula}</code></p>}
              {k.frequency && <p style={{ color: 'var(--text-muted)' }}>Fréquence : {k.frequency}</p>}
              {k.analysisAxes?.length > 0 && <p style={{ color: 'var(--text-muted)' }}>Axes : {k.analysisAxes.join(', ')}</p>}
              {k.description && <p>{k.description}</p>}
            </DetailItem>
          ))}

          {detail === 'rules' && session.businessRules.map(r => (
            <DetailItem key={r.id} title={r.name} badge={r.type}>
              {r.description && <p>{r.description}</p>}
              {r.expression && <p>Expression : <code>{r.expression}</code></p>}
              {r.entities?.length > 0 && <p style={{ color: 'var(--text-muted)' }}>Entités : {r.entities.join(', ')}</p>}
            </DetailItem>
          ))}

          {detail === 'sources' && session.dataSources.map(s => (
            <DetailItem key={s.id} title={s.name} badge={s.type}>
              {s.system && <p>Système : {s.system}</p>}
              {s.loadFrequency && <p style={{ color: 'var(--text-muted)' }}>Fréquence de chargement : {s.loadFrequency}</p>}
              {s.entities?.length > 0 && <p style={{ color: 'var(--text-muted)' }}>Alimente : {s.entities.join(', ')}</p>}
              {s.description && <p>{s.description}</p>}
            </DetailItem>
          ))}
        </div>
      </div>
    </div>
  );
}

function DetailItem({ title, badge, children }: { title: string; badge?: string; children?: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>
        {title}
        {badge && (
          <span style={{ marginLeft: 8, fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'var(--primary-glow)', color: 'var(--primary-light)', fontWeight: 600 }}>{badge}</span>
        )}
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.5 }}>{children}</div>
    </div>
  );
}
