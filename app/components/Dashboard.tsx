'use client';

import { useMemo, useState } from 'react';
import { useWorkshopStore } from '@/lib/store';
import { useI18n, localeCode } from '@/lib/i18n';
import { lintModel, qualityScore } from '@/lib/linter';
import { VSCODE_EXTENSION } from '@/lib/constants';
import ModelShowcase from './ModelShowcase';

// Carte « Extension VSCode » posée dans l'espace libre à droite du hero.
// Sous 900px, elle repasse dans le flux (sous le texte) au lieu de le chevaucher.
const HERO_CSS = `
.dash-vsix { position: absolute; top: 28px; right: 28px; width: 236px; z-index: 2;
  display: block; padding: 16px 18px; border-radius: 16px; color: #fff; text-decoration: none;
  background: rgba(255,255,255,0.13); border: 1px solid rgba(255,255,255,0.30);
  backdrop-filter: blur(6px); transition: transform .18s ease, background .18s ease; }
.dash-vsix:hover { background: rgba(255,255,255,0.20); transform: translateY(-2px); }
.dash-vsix-btn { background: #fff; color: #065F46; border-radius: 9px; padding: 8px 12px;
  font-weight: 800; font-size: 12.5px; text-align: center; }
.dash-hero-main { max-width: calc(100% - 270px); }
@media (max-width: 900px) {
  .dash-vsix { position: static; width: 100%; margin-top: 20px; backdrop-filter: none; }
  .dash-hero-main { max-width: 100%; }
}
`;

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

function DashTile({ value, label, emoji, color, onClick, active }: { value: React.ReactNode; label: string; emoji: string; color: string; onClick?: () => void; active?: boolean }) {
  const [hover, setHover] = useState(false);
  const clickable = !!onClick;
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative', overflow: 'hidden', background: 'var(--bg-surface)',
        border: `1px solid ${active || (hover && clickable) ? color : 'var(--border)'}`, borderRadius: 16, padding: '18px 20px',
        cursor: clickable ? 'pointer' : 'default', transition: 'transform .18s, box-shadow .18s, border-color .18s',
        transform: hover && clickable ? 'translateY(-3px)' : 'none',
        boxShadow: (hover && clickable) ? '0 12px 30px rgba(0,0,0,0.10)' : '0 1px 2px rgba(0,0,0,0.03)',
      }}
    >
      <div style={{ position: 'absolute', top: -20, right: -20, width: 78, height: 78, borderRadius: '50%', background: color, opacity: active ? 0.13 : 0.06 }} />
      <div style={{ width: 40, height: 40, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', background: color + '1A', fontSize: 20, marginBottom: 10 }}>{emoji}</div>
      <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -0.5, color: 'var(--text)' }}>{value}</div>
      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4, fontWeight: 500 }}>{label}{clickable && <span style={{ color, fontWeight: 700 }}> ›</span>}</div>
    </div>
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
  const { sessions, deleteSession, duplicateSession } = useWorkshopStore();
  const { t, lang } = useI18n();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

  const en = lang === 'en';
  const L = {
    resume: en ? 'Resume' : 'Reprendre', newWorkshop: en ? 'New workshop' : 'Nouvel atelier',
    search: en ? 'Search a Data Product…' : 'Rechercher un Data Product…',
    all: en ? 'All' : 'Tous', active: en ? 'In progress' : 'En cours', done: en ? 'Completed' : 'Terminés',
    quality: en ? 'Quality' : 'Qualité', avgQuality: en ? 'Avg. quality' : 'Qualité moy.',
    tables: en ? 'tables' : 'tables', cols: en ? 'cols' : 'col.', rels: en ? 'relations' : 'relations',
    modified: en ? 'modified' : 'modifié', noResult: en ? 'No Data Product matches.' : 'Aucun Data Product ne correspond.',
    duplicate: en ? 'Duplicate' : 'Dupliquer',
  };

  const completedCount = sessions.filter(s => s.status === 'completed').length;
  const activeCount = sessions.filter(s => s.status === 'active').length;

  // Dernier produit actif (le plus récemment modifié) → bouton « Reprendre ».
  const lastActive = useMemo(() => {
    return [...sessions].filter(s => s.status === 'active').sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0] || null;
  }, [sessions]);

  // Score qualité par session (mémoïsé) + moyenne.
  const scoreOf = useMemo(() => {
    const m: Record<string, number> = {};
    sessions.forEach(s => { if (s.entities.length) m[s.id] = qualityScore(lintModel(s)); });
    return m;
  }, [sessions]);
  const scored = Object.values(scoreOf);
  const avgScore = scored.length ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length) : null;

  const visibleSessions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sessions
      .filter(s => filter === 'all' || s.status === filter)
      .filter(s => !q || `${s.productName} ${s.domain}`.toLowerCase().includes(q))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }, [sessions, query, filter]);

  function formatDate(ts: number) {
    return new Date(ts).toLocaleDateString(localeCode(lang), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  function relTime(ts: number) {
    const diff = Date.now() - (ts || 0);
    const min = 60000, h = 3600000, d = 86400000;
    if (diff < 2 * min) return en ? 'just now' : 'à l\'instant';
    if (diff < h) return en ? `${Math.round(diff / min)}m ago` : `il y a ${Math.round(diff / min)} min`;
    if (diff < d) return en ? `${Math.round(diff / h)}h ago` : `il y a ${Math.round(diff / h)} h`;
    if (diff < 30 * d) return en ? `${Math.round(diff / d)}d ago` : `il y a ${Math.round(diff / d)} j`;
    return formatDate(ts);
  }
  const scoreColor = (n: number) => (n >= 80 ? 'var(--accent-emerald)' : n >= 50 ? 'var(--accent-amber)' : 'var(--accent-red)');

  return (
    <div className="dashboard">
      <style dangerouslySetInnerHTML={{ __html: HERO_CSS }} />
      {/* Hero dégradé */}
      <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 22, padding: '30px 32px', marginBottom: 18, color: '#fff', background: 'linear-gradient(135deg, #065F46 0%, #047857 45%, #0D9488 100%)', boxShadow: '0 16px 44px rgba(4,120,87,0.28)' }}>
        <div style={{ position: 'absolute', top: -70, right: -50, width: 300, height: 300, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ position: 'absolute', bottom: -90, left: 160, width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />

        <div style={{ position: 'relative' }} className="dash-hero-main">
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, letterSpacing: 0.3, background: 'rgba(255,255,255,0.16)', padding: '5px 12px', borderRadius: 999, marginBottom: 16 }}>
            <span>📊</span> {`${sessions.length} ${t('dash.badgeSessions')}`}
          </div>
          <h2 style={{ fontSize: 30, margin: '0 0 8px', fontWeight: 800, letterSpacing: -0.6, lineHeight: 1.12 }}>{t('dash.title1')} {t('dash.title2')}</h2>
          <p style={{ fontSize: 14.5, opacity: 0.92, lineHeight: 1.55, margin: 0, maxWidth: 620 }}>{t('dash.subtitle')}</p>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 20 }}>
            {lastActive ? (
              <button onClick={() => onOpenSession(lastActive.id)} title={lastActive.productName || ''}
                style={{ background: '#fff', color: '#065F46', border: 'none', borderRadius: 11, padding: '11px 20px', fontWeight: 800, fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, boxShadow: '0 6px 18px rgba(0,0,0,0.16)' }}>
                ▶ {L.resume} : {(lastActive.productName || t('dash.newProduct')).slice(0, 28)} — {lastActive.currentStep}/7
              </button>
            ) : (
              <button onClick={onStartWorkshop}
                style={{ background: '#fff', color: '#065F46', border: 'none', borderRadius: 11, padding: '11px 22px', fontWeight: 800, fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, boxShadow: '0 6px 18px rgba(0,0,0,0.16)' }}>
                ✨ {t('dash.start')} →
              </button>
            )}
            {lastActive && (
              <button onClick={onStartWorkshop}
                style={{ background: 'rgba(255,255,255,0.14)', color: '#fff', border: '1px solid rgba(255,255,255,0.35)', borderRadius: 11, padding: '11px 18px', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                ✨ {L.newWorkshop}
              </button>
            )}
            {completedCount > 0 && (
              <button onClick={onViewDeliverables}
                style={{ background: 'rgba(255,255,255,0.14)', color: '#fff', border: '1px solid rgba(255,255,255,0.35)', borderRadius: 11, padding: '11px 18px', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                📦 {t('dash.deliverables')}
              </button>
            )}
          </div>
        </div>

        {/* Extension VSCode — occupe l'espace libre à droite du hero.
            Placée APRÈS le contenu : en mobile elle passe sous le texte, pas au-dessus. */}
        <a
          href={VSCODE_EXTENSION.file}
          download="marty-vscode.vsix"
          className="dash-vsix"
          title={`Marty pour VSCode — version ${VSCODE_EXTENSION.version}`}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 22 }}>🧩</span>
            <div style={{ fontWeight: 800, fontSize: 14.5, lineHeight: 1.2 }}>
              {en ? 'VSCode Extension' : 'Extension VSCode'}
            </div>
          </div>
          <div style={{ fontSize: 12.5, opacity: 0.88, lineHeight: 1.5, marginBottom: 12 }}>
            {en
              ? 'Generate a Data Product straight from your editor.'
              : 'Générez un Data Product directement depuis votre éditeur.'}
          </div>
          <div className="dash-vsix-btn">
            ⬇️ {en ? 'Download (.vsix)' : 'Télécharger (.vsix)'}
          </div>
          <div style={{ fontSize: 11, opacity: 0.72, marginTop: 8 }}>
            v{VSCODE_EXTENSION.version} · {en ? 'guide in Documentation' : 'guide dans Documentation'}
          </div>
        </a>
      </div>

      {/* Tuiles KPI (cliquables → filtrent la liste) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14, marginBottom: 22 }}>
        <DashTile value={sessions.length} label={t('dash.statTotal')} emoji="📦" color="#059669" active={filter === 'all'} onClick={() => setFilter('all')} />
        <DashTile value={activeCount} label={t('dash.statActive')} emoji="⏳" color="#D97706" active={filter === 'active'} onClick={() => setFilter('active')} />
        <DashTile value={completedCount} label={t('dash.statCompleted')} emoji="✅" color="#0D9488" active={filter === 'completed'} onClick={() => setFilter('completed')} />
        {avgScore !== null && (
          <DashTile value={avgScore} label={L.avgQuality} emoji="🛡️" color={scoreColor(avgScore)} />
        )}
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

      {/* Sessions list */}
      {sessions.length > 0 && (
        <div className="sessions-section">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
            <h3 style={{ margin: 0 }}>{t('dash.recentSessions')}</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ position: 'relative' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={L.search} style={{ height: 36, padding: '0 12px 0 30px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-surface)', color: 'var(--text)', fontSize: 13, outline: 'none', width: 240, maxWidth: '60vw' }} />
              </div>
              <div style={{ display: 'inline-flex', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: 2 }}>
                {([['all', L.all], ['active', L.active], ['completed', L.done]] as const).map(([k, lbl]) => (
                  <button key={k} onClick={() => setFilter(k)} style={{ border: 'none', borderRadius: 6, padding: '5px 11px', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, background: filter === k ? 'var(--bg-surface)' : 'transparent', color: filter === k ? 'var(--text)' : 'var(--text-muted)', boxShadow: filter === k ? 'var(--shadow)' : 'none' }}>{lbl}</button>
                ))}
              </div>
            </div>
          </div>

          {visibleSessions.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13.5 }}>{L.noResult}</div>}

          {visibleSessions.map(s => {
            const score = scoreOf[s.id];
            const pct = Math.round((s.currentStep / 7) * 100);
            return (
              <div key={s.id} className="session-card" style={{ display: 'block', cursor: 'pointer' }} onClick={() => onOpenSession(s.id)}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <span className={`session-step-badge ${s.status === 'completed' ? 'session-status-completed' : ''}`} style={{ flexShrink: 0 }}>
                    {s.status === 'completed' ? `✓ ${t('dash.completed')}` : `${t('dash.step')} ${s.currentStep}/7`}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="session-name">{s.productName || t('dash.newProduct')}</div>
                    <div className="session-meta">
                      {s.domain && `${s.domain} · `}
                      {L.modified} {relTime(s.updatedAt || s.createdAt)}
                      {s.entities.length > 0 && ` · ${s.entities.length} ${L.tables} · ${s.attributes.length} ${L.cols} · ${s.relations.length} ${L.rels}`}
                    </div>
                  </div>
                  {score !== undefined && (
                    <span title={L.quality} style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: scoreColor(score), background: 'var(--bg-elevated)', border: `1px solid ${scoreColor(score)}`, borderRadius: 999, padding: '2px 10px' }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l7 3v5c0 4.2-2.9 7.4-7 9-4.1-1.6-7-4.8-7-9V6l7-3Z" /></svg>
                      {score}
                    </span>
                  )}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                    <button className="suggested-chip" onClick={() => onOpenSession(s.id)} title={t('dash.workshop')}>🧠 {t('dash.workshop')}</button>
                    {s.entities.length > 0 && onOpenDeliverables && (
                      <button className="suggested-chip" onClick={() => onOpenDeliverables(s.id)} title={t('dash.deliverables')}>📦 {t('dash.deliverables')}</button>
                    )}
                    <button className="suggested-chip" onClick={() => duplicateSession(s.id)} title={L.duplicate}>⧉</button>
                    <button className="session-delete" onClick={() => deleteSession(s.id)} title={t('dp.deleteTitle')}>✕</button>
                  </div>
                </div>
                {s.status !== 'completed' && (
                  <div style={{ marginTop: 10, height: 5, background: 'var(--bg-elevated)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: 'var(--primary)', borderRadius: 4, transition: 'width .3s' }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {sessions.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">🧠</div>
          <div className="empty-state-text">{t('dash.emptyText')}</div>
        </div>
      )}

      {/* Choix du modèle IA */}
      <div style={{ margin: '40px 0 8px' }}>
        <ModelShowcase />
      </div>
    </div>
  );
}
