'use client';

import { useWorkshopStore } from '@/lib/store';
import { useI18n, localeCode } from '@/lib/i18n';

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
  const { t, lang } = useI18n();

  const completedCount = sessions.filter(s => s.status === 'completed').length;
  const activeCount = sessions.filter(s => s.status === 'active').length;

  function formatDate(ts: number) {
    return new Date(ts).toLocaleDateString(localeCode(lang), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="dashboard">
      <div className="dashboard-hero">
        {/* Badge */}
        <div className="dashboard-badge">
          <span className="dashboard-badge-icon">📊</span>
          {`${sessions.length} ${t('dash.badgeSessions')}`}
        </div>

        <h2>{t('dash.title1')}<br />{t('dash.title2')}</h2>
        <p>{t('dash.subtitle')}</p>

        <div className="dashboard-cta-group">
          <button className="cta-btn" onClick={onStartWorkshop}>
            <span className="cta-btn-icon">✨</span>
            {t('dash.start')} →
          </button>
          {completedCount > 0 && (
            <button className="cta-btn cta-btn-secondary" onClick={onViewDeliverables}>
              <span className="cta-btn-icon">📦</span>
              {t('dash.deliverables')}
            </button>
          )}
        </div>
      </div>

      {/* How it works */}
      <div className="transform-card">
        <div className="transform-card-title">{t('dash.howItWorks')}</div>
        <div className="how-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16, marginBottom: 20 }}>
          {[
            { icon: 'describe', title: t('dash.step1Title'), text: t('dash.step1Text') },
            { icon: 'model', title: t('dash.step2Title'), text: t('dash.step2Text') },
            { icon: 'export', title: t('dash.step3Title'), text: t('dash.step3Text') },
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
            <div className="transform-col-label">{t('dash.youWrite')}</div>
            <div className="transform-before">
              <em style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>{t('dash.example')}</em>
            </div>
          </div>
          <div>
            <div className="transform-col-label">{t('dash.martyGenerates')}</div>
            <div className="transform-after">
              <div className="transform-after-line"><code>8 {t('dash.entities')} (Client, Réclamation…)</code><span className="transform-ok-badge">✓</span></div>
              <div className="transform-after-line"><code>14 relations + FK</code><span className="transform-ok-badge">✓</span></div>
              <div className="transform-after-line"><code>SQL · DBML · dbt · DAD</code><span className="transform-ok-badge">✓</span></div>
            </div>
          </div>
        </div>

        {onViewDocs && (
          <button className="cta-btn cta-btn-secondary" style={{ marginTop: 16 }} onClick={onViewDocs}>
            📖 {t('dash.readDocs')}
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="dashboard-stats">
        <div className="stat-card">
          <div className="stat-value">{sessions.length}</div>
          <div className="stat-label">{t('dash.statTotal')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{activeCount}</div>
          <div className="stat-label">{t('dash.statActive')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{completedCount}</div>
          <div className="stat-label">{t('dash.statCompleted')}</div>
        </div>
      </div>

      {/* Sessions list */}
      {sessions.length > 0 && (
        <div className="sessions-section">
          <h3>{t('dash.recentSessions')}</h3>
          {sessions.map(s => (
            <div key={s.id} className="session-card" onClick={() => onOpenSession(s.id)}>
              <span className={`session-step-badge ${s.status === 'completed' ? 'session-status-completed' : ''}`}>
                {s.status === 'completed' ? `✓ ${t('dash.completed')}` : `${t('dash.step')} ${s.currentStep}/7`}
              </span>
              <div className="session-info">
                <div className="session-name">{s.productName || t('dash.newProduct')}</div>
                <div className="session-meta">
                  {s.domain && `${s.domain} · `}
                  {t('dash.createdOn')} {formatDate(s.createdAt)}
                  {s.entities.length > 0 && ` · ${s.entities.length} ${t('dash.entities')}`}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                <button className="suggested-chip" onClick={() => onOpenSession(s.id)} title={t('dash.workshop')}>🧠 {t('dash.workshop')}</button>
                {s.entities.length > 0 && onOpenDeliverables && (
                  <button className="suggested-chip" onClick={() => onOpenDeliverables(s.id)} title={t('dash.deliverables')}>📦 {t('dash.deliverables')}</button>
                )}
                <button className="session-delete" onClick={() => deleteSession(s.id)} title={t('dp.deleteTitle')}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {sessions.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">🧠</div>
          <div className="empty-state-text">{t('dash.emptyText')}</div>
        </div>
      )}
    </div>
  );
}
