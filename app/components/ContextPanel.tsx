'use client';

import { WorkshopSession } from '@/lib/types';

interface ContextPanelProps {
  session: WorkshopSession;
  onClose: () => void;
}

export default function ContextPanel({ session, onClose }: ContextPanelProps) {
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
        <div className="context-card">
          <div className="context-card-title">🧩 Entités ({session.entities.length})</div>
          <div className="context-card-content">
            {session.entities.map(e => (
              <span key={e.id} className="context-tag">{e.name}</span>
            ))}
          </div>
        </div>
      )}

      {session.relations.length > 0 && (
        <div className="context-card">
          <div className="context-card-title">🔗 Relations ({session.relations.length})</div>
          <div className="context-card-content">
            {session.relations.map(r => (
              <div key={r.id} style={{ fontSize: 12, marginBottom: 4 }}>
                {r.sourceEntityName} → {r.targetEntityName} ({r.type})
              </div>
            ))}
          </div>
        </div>
      )}

      {session.attributes.length > 0 && (
        <div className="context-card">
          <div className="context-card-title">📋 Attributs ({session.attributes.length})</div>
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
        <div className="context-card">
          <div className="context-card-title">📊 KPIs ({session.kpis.length})</div>
          <div className="context-card-content">
            {session.kpis.map(k => (
              <span key={k.id} className="context-tag">{k.name}</span>
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
    </div>
  );
}
