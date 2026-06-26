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
        <h2>Concevez votre Data Product avec l&apos;IA</h2>
        <p>
          Un Senior Data Architect IA vous accompagne à travers 12 étapes structurées pour produire un modèle conceptuel cohérent et une documentation de qualité.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', position: 'relative' }}>
          <button className="cta-btn" onClick={onStartWorkshop}>
            ✨ Démarrer un atelier
          </button>
          {completedCount > 0 && (
            <button className="cta-btn cta-btn-secondary" onClick={onViewDeliverables}>
              📦 Voir les livrables
            </button>
          )}
        </div>
      </div>

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
