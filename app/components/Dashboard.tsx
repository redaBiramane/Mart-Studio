'use client';

import { useWorkshopStore } from '@/lib/store';

function HowIcon({ name }: { name: string }) {
  const p: Record<string, React.ReactNode> = {
    describe: <><path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-4 4v-4H6a2 2 0 0 1-2-2Z" /><path d="M8 8.5h8" /><path d="M8 12h5" /></>,
    model: <><path d="M12 4.5a3 3 0 0 0-3 3 3 3 0 0 0-1.5 5.6A2.6 2.6 0 0 0 9 18a2.5 2.5 0 0 0 3 .5 2.5 2.5 0 0 0 3-.5 2.6 2.6 0 0 0 1.5-4.9A3 3 0 0 0 15 7.5a3 3 0 0 0-3-3Z" /><path d="M12 5v14" /></>,
    export: <><path d="M21 8l-9-5-9 5 9 5 9-5Z" /><path d="M3 8v8l9 5 9-5V8" /><path d="M12 13v8" /></>,
  };
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {p[name]}
    </svg>
  );
}

interface DashboardProps {
  onStartWorkshop: () => void;
  onOpenSession: (id: string) => void;
  onViewDeliverables: () => void;
  onViewDocs?: () => void;
  onOpenDeliverables?: (id: string) => void;
}

export default function Dashboard({ onStartWorkshop, onOpenSession, onViewDeliverables, onViewDocs, onOpenDeliverables }: DashboardProps) {
  const { sessions, deleteSession } = useWorkshopStore();

  const completedCount = sessions.filter(s => s.status === 'completed').length;
  const activeCount = sessions.filter(s => s.status === 'active').length;

  function formatDate(ts: number) {
    return new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="dashboard">
      <div className="dashboard-hero">
        {/* Badge */}
        <div className="dashboard-badge">
          <span className="dashboard-badge-icon">📊</span>
          {`${sessions.length} session${sessions.length !== 1 ? 's' : ''} dans l'atelier`}
        </div>

        <h2>Plateforme de conception<br />des Data Products</h2>
        <p>
          Concevez automatiquement vos Data Products avec l&apos;accompagnement
          d&apos;un Senior Data Architect IA. Modélisez, documentez et exportez
          en quelques clics.
        </p>

        <div className="dashboard-cta-group">
          <button className="cta-btn" onClick={onStartWorkshop}>
            <span className="cta-btn-icon">✨</span>
            Démarrer un atelier →
          </button>
          {completedCount > 0 && (
            <button className="cta-btn cta-btn-secondary" onClick={onViewDeliverables}>
              <span className="cta-btn-icon">📦</span>
              Livrables
            </button>
          )}
        </div>
      </div>

      {/* How it works */}
      <div className="transform-card">
        <div className="transform-card-title">Comment ça marche</div>
        <div className="how-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16, marginBottom: 20 }}>
          {[
            { icon: 'describe', title: '1. Décrivez', text: 'Expliquez votre besoin métier en langage simple à Marty, votre Data Architect IA.' },
            { icon: 'model', title: '2. Marty modélise', text: 'En étapes guidées, il conçoit entités, relations, attributs, clés, règles et sources.' },
            { icon: 'export', title: '3. Exportez', text: 'Récupérez le MCD, le SQL, le DBML, le schéma dbt, le dictionnaire et le rapport DAD.' },
          ].map(s => (
            <div key={s.title} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
              <div style={{ marginBottom: 8 }}><HowIcon name={s.icon} /></div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{s.title}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{s.text}</div>
            </div>
          ))}
        </div>

        <div className="transform-example">
          <div>
            <div className="transform-col-label">Vous écrivez (langage métier)</div>
            <div className="transform-before">
              <em style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                « Je veux piloter les réclamations clients : volume, statut, délai de résolution, motifs et actions correctives. »
              </em>
            </div>
          </div>
          <div>
            <div className="transform-col-label">Marty génère un modèle complet</div>
            <div className="transform-after">
              <div className="transform-after-line"><code>8 entités (Client, Réclamation…)</code><span className="transform-ok-badge">✓</span></div>
              <div className="transform-after-line"><code>14 relations + clés FK</code><span className="transform-ok-badge">✓</span></div>
              <div className="transform-after-line"><code>SQL · DBML · dbt · DAD</code><span className="transform-ok-badge">✓</span></div>
            </div>
          </div>
        </div>

        {onViewDocs && (
          <button className="cta-btn cta-btn-secondary" style={{ marginTop: 16 }} onClick={onViewDocs}>
            📖 Lire la documentation complète
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="dashboard-stats">
        <div className="stat-card">
          <div className="stat-value">{sessions.length}</div>
          <div className="stat-label">Sessions totales</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{activeCount}</div>
          <div className="stat-label">En cours</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{completedCount}</div>
          <div className="stat-label">Terminées</div>
        </div>
      </div>

      {/* Sessions list */}
      {sessions.length > 0 && (
        <div className="sessions-section">
          <h3>Sessions récentes</h3>
          {sessions.map(s => (
            <div key={s.id} className="session-card" onClick={() => onOpenSession(s.id)}>
              <span className={`session-step-badge ${s.status === 'completed' ? 'session-status-completed' : ''}`}>
                {s.status === 'completed' ? '✓ Terminé' : `Étape ${s.currentStep}/5`}
              </span>
              <div className="session-info">
                <div className="session-name">{s.productName || 'Nouveau Data Product'}</div>
                <div className="session-meta">
                  {s.domain && `${s.domain} · `}
                  Créé le {formatDate(s.createdAt)}
                  {s.entities.length > 0 && ` · ${s.entities.length} entités`}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                <button className="suggested-chip" onClick={() => onOpenSession(s.id)} title="Ouvrir l'atelier">🧠 Atelier</button>
                {s.entities.length > 0 && onOpenDeliverables && (
                  <button className="suggested-chip" onClick={() => onOpenDeliverables(s.id)} title="Voir les livrables">📦 Livrables</button>
                )}
                <button className="session-delete" onClick={() => deleteSession(s.id)} title="Supprimer">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {sessions.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">🧠</div>
          <div className="empty-state-text">
            Aucune session pour le moment. Démarrez votre premier atelier de conception pour créer un Data Product accompagné par l&apos;IA.
          </div>
        </div>
      )}
    </div>
  );
}
