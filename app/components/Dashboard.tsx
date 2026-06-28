'use client';

import { useWorkshopStore } from '@/lib/store';

interface DashboardProps {
  onStartWorkshop: () => void;
  onOpenSession: (id: string) => void;
  onViewDeliverables: () => void;
}

export default function Dashboard({ onStartWorkshop, onOpenSession, onViewDeliverables }: DashboardProps) {
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

      {/* Transformation Example Card */}
      <div className="transform-card">
        <div className="transform-card-title">Exemple de modélisation</div>
        <div className="transform-example">
          <div>
            <div className="transform-col-label">Entrée utilisateur</div>
            <div className="transform-before">
              <code>
                table_client_contrat<br />
                date_souscription_credit<br />
                montant_capital_restant_du
              </code>
            </div>
          </div>
          <div>
            <div className="transform-col-label">Sortie IA</div>
            <div className="transform-after">
              <div className="transform-after-line">
                <code>CLIENT_CONTRAT</code>
                <span className="transform-ok-badge">OK</span>
              </div>
              <div className="transform-after-line">
                <code>DT_SOUSCRIPTION</code>
                <span className="transform-ok-badge">OK</span>
              </div>
              <div className="transform-after-line">
                <code>MT_CAPITAL_REST_DU</code>
                <span className="transform-ok-badge">OK</span>
              </div>
            </div>
          </div>
        </div>
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
                {s.status === 'completed' ? '✓ Terminé' : `Étape ${s.currentStep}/12`}
              </span>
              <div className="session-info">
                <div className="session-name">{s.productName || 'Nouveau Data Product'}</div>
                <div className="session-meta">
                  {s.domain && `${s.domain} · `}
                  Créé le {formatDate(s.createdAt)}
                  {s.entities.length > 0 && ` · ${s.entities.length} entités`}
                </div>
              </div>
              <button className="session-delete" onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }} title="Supprimer">
                ✕
              </button>
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
