'use client';

import { useState, useEffect, useMemo } from 'react';
import { useWorkshopStore } from '@/lib/store';
import { useI18n } from '@/lib/i18n';
import { isSupabaseConfigured } from '@/lib/supabase';
import Dashboard from './components/Dashboard';
import Workshop from './components/Workshop';
import Deliverables from './components/Deliverables';
import AdminPanel from './components/AdminPanel';
import Documentation from './components/Documentation';
import DataProducts from './components/DataProducts';
import Supervision from './components/Supervision';
import Login from './components/Login';
import Landing from './components/Landing';
import Image from 'next/image';

type Page = 'dashboard' | 'products' | 'workshop' | 'deliverables' | 'admin' | 'docs' | 'supervision';

// Icônes SVG (line icons) pour la navigation — plus pro que des emojis.
function NavIcon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    dashboard: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M9.5 21v-6h5v6" /></>,
    products: <><rect x="3" y="4" width="7.5" height="7.5" rx="1.5" /><rect x="13.5" y="4" width="7.5" height="7.5" rx="1.5" /><rect x="3" y="14.5" width="7.5" height="5.5" rx="1.5" /><rect x="13.5" y="14.5" width="7.5" height="5.5" rx="1.5" /></>,
    workshop: <><path d="M12 6.5 13.7 11l4.5 1.7-4.5 1.7L12 19l-1.7-4.6L5.8 12.7 10.3 11 12 6.5Z" /><path d="M5 4v3M3.5 5.5h3M18 15v3M16.5 16.5h3" /></>,
    deliverables: <><path d="M21 8 12 3 3 8l9 5 9-5Z" /><path d="M3 8v8l9 5 9-5V8" /><path d="M12 13v8" /></>,
    docs: <><path d="M6.5 2H18a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" /><path d="M8 7h8M8 11h8M8 15h5" /></>,
    supervision: <><path d="M12 3l7 3v5c0 4.2-2.9 7.4-7 9-4.1-1.6-7-4.8-7-9V6l7-3Z" /><path d="M9.2 12l2 2 3.6-3.8" /></>,
    admin: <><circle cx="12" cy="12" r="3.2" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M19.4 4.6l-2.1 2.1M6.7 17.3l-2.1 2.1" /></>,
    session: <><ellipse cx="12" cy="5" rx="7" ry="2.6" /><path d="M5 5v6c0 1.5 3.1 2.6 7 2.6s7-1.1 7-2.6V5" /><path d="M5 11v6c0 1.5 3.1 2.6 7 2.6s7-1.1 7-2.6v-6" /></>,
    users: <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0" /><path d="M16 5.2a3.2 3.2 0 0 1 0 5.6" /><path d="M18.5 20a5.5 5.5 0 0 0-3.2-5" /></>,
    logout: <><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 17l-5-5 5-5" /><path d="M15 12H5" /></>,
  };
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
      {paths[name] || <circle cx="12" cy="12" r="9" />}
    </svg>
  );
}

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [showLogin, setShowLogin] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [supervisionTab, setSupervisionTab] = useState<'activity' | 'products' | 'users'>('activity');
  const [showModeModal, setShowModeModal] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifSeen, setNotifSeen] = useState(0);
  const [showIdea, setShowIdea] = useState(false);
  const [ideaText, setIdeaText] = useState('');
  const [ideaSent, setIdeaSent] = useState(false);

  const { lang, toggle: toggleLang, setLang, t } = useI18n();

  useEffect(() => {
    const seen = Number(typeof window !== 'undefined' ? localStorage.getItem('mart-notif-seen') : 0) || 0;
    setNotifSeen(seen);
    const savedLang = typeof window !== 'undefined' ? localStorage.getItem('mart-lang') : null;
    if (savedLang === 'en') setLang('en');
  }, [setLang]);

  const startNewSession = () => setShowModeModal(true);
  function createWithMode(mode: 'batch' | 'guided') {
    useWorkshopStore.getState().createSession(mode);
    setShowModeModal(false);
    setCurrentPage('workshop');
  }

  useEffect(() => {
    const saved = (typeof window !== 'undefined' ? localStorage.getItem('mart-theme') : null) as 'light' | 'dark' | null;
    const initial = saved || 'light';
    setTheme(initial);
    document.documentElement.setAttribute('data-theme', initial);
  }, []);

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('mart-theme', next); } catch { /* ignore */ }
  }
  const { session, sessions, currentPage, setCurrentPage, authReady, user, profile, initAuth, signOut, activityLogs, adminProfiles, logActivity } = useWorkshopStore();

  useEffect(() => { initAuth(); }, [initAuth]);

  const isAdmin = profile?.role === 'admin';

  // Notifications dérivées : événements produits (tous) + activité récente (admin)
  const notifications = useMemo(() => {
    const items: { id: string; icon: string; title: string; desc: string; ts: number }[] = [];
    sessions.slice(0, 12).forEach((s) => {
      const name = s.productName || t('dash.newProduct');
      if (s.status === 'completed') {
        items.push({ id: `done-${s.id}`, icon: 'done', title: `« ${name} » ${t('notif.completed')}`, desc: `${s.entities.length} ${t('dash.entities')}`, ts: s.updatedAt });
      } else {
        items.push({ id: `upd-${s.id}`, icon: 'edit', title: `« ${name} » ${t('notif.updated')}`, desc: `${t('dash.step')} ${s.currentStep}/7`, ts: s.updatedAt });
      }
    });
    if (isAdmin) {
      activityLogs.slice(0, 10).forEach((l) => {
        items.push({ id: `act-${l.id}`, icon: 'activity', title: `${t('notif.activity')} · ${l.action}`, desc: `${l.user_email || ''}${l.detail ? ' — ' + l.detail : ''}`, ts: new Date(l.created_at).getTime() });
      });
    }
    if (items.length === 0) {
      items.push({ id: 'welcome', icon: 'welcome', title: t('notif.welcome'), desc: t('notif.welcomeDesc'), ts: Date.now() });
    }
    return items.sort((a, b) => b.ts - a.ts).slice(0, 15);
  }, [sessions, activityLogs, isAdmin, t]);

  const unreadCount = notifications.filter((n) => n.ts > notifSeen && n.id !== 'welcome').length;

  function openNotifications() {
    setNotifOpen((o) => !o);
  }
  function markNotifsRead() {
    const now = Date.now();
    setNotifSeen(now);
    try { localStorage.setItem('mart-notif-seen', String(now)); } catch { /* ignore */ }
  }
  useEffect(() => {
    if (isAdmin) useWorkshopStore.getState().loadAdminData();
  }, [isAdmin]);

  async function submitIdea() {
    const txt = ideaText.trim();
    if (!txt) return;
    try { await logActivity('idea', txt); } catch { /* mode local : ignore */ }
    setIdeaSent(true);
    setIdeaText('');
    setTimeout(() => { setShowIdea(false); setIdeaSent(false); }, 1800);
  }

  function NotifIcon({ name }: { name: string }) {
    const p: Record<string, React.ReactNode> = {
      done: <><circle cx="12" cy="12" r="9" /><path d="M8.3 12.4l2.6 2.6 4.8-5.2" /></>,
      edit: <><path d="M4 20h4l10-10-4-4L4 16v4Z" /><path d="M13.5 6.5l4 4" /></>,
      activity: <><path d="M3 12h4l2.5-7 5 14 2.5-7H21" /></>,
      welcome: <><path d="M12 3l2.3 4.7 5.2.8-3.8 3.7.9 5.1L12 15l-4.6 2.4.9-5.1L4.5 8.5l5.2-.8L12 3Z" /></>,
    };
    return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{p[name] || <circle cx="12" cy="12" r="9" />}</svg>;
  }

  const navItems = [
    { key: 'dashboard' as Page, label: t('nav.dashboard') },
    { key: 'products' as Page, label: t('nav.products') },
    { key: 'workshop' as Page, label: t('nav.workshop'), badge: session?.status === 'active' ? `${session.currentStep}/7` : undefined },
    { key: 'deliverables' as Page, label: t('nav.deliverables') },
  ];

  const adminItems = [
    ...(isAdmin ? [{ key: 'supervision' as Page, label: t('menu.supervision') }] : []),
    { key: 'admin' as Page, label: t('menu.llm') },
  ];

  // Auth gate (only when Supabase is configured)
  if (isSupabaseConfigured && !authReady) {
    return (
      <div className="app-loading">
        <Image className="app-loading-logo" src="/mart-icon.svg" alt="Mart Studio" width={72} height={72} style={{ width: 72, height: 72 }} priority />
        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.3, color: 'var(--text)' }}>Mart Studio</div>
        <div className="app-progress" />
        <div style={{ color: 'var(--text-muted)', fontSize: 13, letterSpacing: 0.3 }}>Chargement…</div>
      </div>
    );
  }
  if (isSupabaseConfigured && !user) {
    return showLogin
      ? <Login onBack={() => setShowLogin(false)} initialMode={authMode} />
      : <Landing onEnter={(mode) => { setAuthMode(mode); setShowLogin(true); }} />;
  }

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''} ${collapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <div
            className="sidebar-brand"
            role="button"
            tabIndex={0}
            title="Retour à l'accueil"
            onClick={() => { setCurrentPage('dashboard'); setSidebarOpen(false); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setCurrentPage('dashboard'); setSidebarOpen(false); } }}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', textAlign: 'center', cursor: 'pointer' }}
          >
            <Image src="/mart-icon.svg" alt="Mart Studio" width={36} height={36} style={{ width: 36, height: 36, borderRadius: 9 }} priority />
            <div className="sidebar-title" style={{ fontSize: 19, fontWeight: 800, letterSpacing: -0.3, color: 'var(--text)' }}>Mart Studio</div>
          </div>
        </div>

        <button
          className="sidebar-collapse-btn"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Afficher le menu' : 'Réduire le menu'}
          title={collapsed ? 'Afficher le menu' : 'Réduire le menu'}
        >
          {collapsed ? '▷' : '◁'}
        </button>

        <nav className="sidebar-nav">
          <div className="sidebar-section">
            <div className="sidebar-section-title">{t('nav.navigation')}</div>
            {navItems.map((item) => (
              <div
                key={item.key}
                className={`nav-item ${currentPage === item.key ? 'active' : ''}`}
                onClick={() => { setCurrentPage(item.key); setSidebarOpen(false); }}
              >
                <span className="nav-item-icon"><NavIcon name={item.key} /></span>
                <span>{item.label}</span>
                {item.badge && <span className="nav-item-badge">{item.badge}</span>}
              </div>
            ))}
          </div>

          {sessions.length > 0 && (
            <div className="sidebar-section">
              <div className="sidebar-section-title">{t('nav.recentSessions')}</div>
              {sessions.slice(0, 5).map((s) => (
                <div
                  key={s.id}
                  className={`nav-item ${session?.id === s.id ? 'active' : ''}`}
                  onClick={() => {
                    useWorkshopStore.getState().loadSession(s.id);
                    setCurrentPage('workshop');
                    setSidebarOpen(false);
                  }}
                >
                  <span className="nav-item-icon"><NavIcon name="session" /></span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.productName || t('nav.newProduct')}
                  </span>
                </div>
              ))}
              <div
                className="nav-item"
                onClick={() => { setCurrentPage('products'); setSidebarOpen(false); }}
                style={{ color: 'var(--primary)', fontWeight: 600 }}
              >
                <span className="nav-item-icon"><NavIcon name="products" /></span>
                <span>{t('nav.seeAll')}{sessions.length > 5 ? ` (${sessions.length})` : ''}</span>
              </div>
            </div>
          )}

          <div className="sidebar-section">
            <div
              className={`nav-item ${currentPage === 'docs' ? 'active' : ''}`}
              onClick={() => { setCurrentPage('docs'); setSidebarOpen(false); }}
            >
              <span className="nav-item-icon"><NavIcon name="docs" /></span>
              <span>{t('nav.docs')}</span>
            </div>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-section-title">{t('nav.administration')}</div>
            {adminItems.map((item) => (
              <div
                key={item.key}
                className={`nav-item ${currentPage === item.key ? 'active' : ''}`}
                onClick={() => { setCurrentPage(item.key); setSidebarOpen(false); }}
              >
                <span className="nav-item-icon"><NavIcon name={item.key} /></span>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </nav>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '10px 12px 4px' }}>
          <Image src="/sofinco-logo.svg" alt="Sofinco" width={92} height={20} style={{ width: 92, height: 20, opacity: 0.7 }} />
          <span style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: 0.3 }}>Personal Finance &amp; Mobility</span>
        </div>

        <div className="sidebar-footer" style={{ position: 'relative' }}>
          {userMenuOpen && (
            <>
              <div onClick={() => setUserMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
              <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: 12, right: 12, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-lg)', padding: 6, zIndex: 41 }}>
                {isAdmin && (
                  <>
                    <button className="user-menu-item" onClick={() => { setSupervisionTab('activity'); setCurrentPage('supervision'); setSidebarOpen(false); setUserMenuOpen(false); }}><NavIcon name="supervision" /> {t('menu.supervision')}</button>
                    <button className="user-menu-item" onClick={() => { setSupervisionTab('users'); setCurrentPage('supervision'); setSidebarOpen(false); setUserMenuOpen(false); }}><NavIcon name="users" /> {t('menu.users')}</button>
                    <button className="user-menu-item" onClick={() => { setCurrentPage('admin'); setSidebarOpen(false); setUserMenuOpen(false); }}><NavIcon name="admin" /> {t('menu.llm')}</button>
                    <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                  </>
                )}
                {user && (
                  <button className="user-menu-item" style={{ color: 'var(--accent-red)' }} onClick={() => { signOut(); setUserMenuOpen(false); }}><NavIcon name="logout" /> {t('menu.logout')}</button>
                )}
              </div>
            </>
          )}
          <button
            onClick={() => setUserMenuOpen((o) => !o)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}
          >
            <div className="sidebar-footer-avatar">{(user?.email || 'A').charAt(0).toUpperCase()}</div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.email || t('role.guest')}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{isAdmin ? t('role.admin') : (user ? t('role.user') : t('role.notConnected'))}</div>
            </div>
            <span style={{ color: 'var(--text-muted)', fontSize: 12, transform: userMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>⌃</span>
          </button>
        </div>
      </aside>

      {/* Backdrop mobile (ferme le drawer au tap) */}
      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}

      {/* Main Content */}
      <div className={`main-content${collapsed ? ' with-rail' : ''}`}>
        <header className="main-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              className="mobile-menu-btn"
              aria-label="Ouvrir le menu"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <h1>
              {currentPage === 'dashboard' && t('header.dashboard')}
              {currentPage === 'products' && t('header.products')}
              {currentPage === 'workshop' && t('header.workshop')}
              {currentPage === 'deliverables' && t('header.deliverables')}
              {currentPage === 'admin' && t('header.admin')}
              {currentPage === 'docs' && t('header.docs')}
              {currentPage === 'supervision' && t('header.supervision')}
            </h1>
          </div>
          <div className="header-actions">
            {currentPage === 'dashboard' && (
              <button className="cta-btn" onClick={startNewSession}>
                ✨ {t('action.newWorkshop')}
              </button>
            )}
            <button className="header-icon-btn" title={t('tooltip.idea')} onClick={() => { setShowIdea(true); setIdeaSent(false); }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6" /><path d="M10 21h4" /><path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.3 1 2.5h6c0-1.2.3-1.8 1-2.5A6 6 0 0 0 12 3Z" /></svg>
            </button>
            <button className="header-lang" onClick={toggleLang} title={lang === 'fr' ? 'Switch to English' : 'Passer en français'}>
              {lang === 'fr' ? '🇫🇷 FR' : '🇬🇧 EN'}
            </button>
            <button
              className="header-icon-btn"
              onClick={toggleTheme}
              title={theme === 'dark' ? t('tooltip.themeDark') : t('tooltip.themeLight')}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <div style={{ position: 'relative' }}>
              <button className="header-icon-btn" title={t('tooltip.notifications')} onClick={openNotifications}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M18 9a6 6 0 0 0-12 0c0 6-2.5 7-2.5 7h17S18 15 18 9Z" /><path d="M10.5 20a2 2 0 0 0 3 0" /></svg>
                {unreadCount > 0 && <span className="badge-dot"></span>}
              </button>
              {notifOpen && (
                <>
                  <div onClick={() => setNotifOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 44 }} />
                  <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 340, maxWidth: '90vw', maxHeight: 420, overflowY: 'auto', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-lg)', zIndex: 45 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg-surface)' }}>
                      <strong style={{ fontSize: 14 }}>{t('notif.title')}</strong>
                      {unreadCount > 0 && <button onClick={markNotifsRead} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>{t('notif.markRead')}</button>}
                    </div>
                    {notifications.length === 0 ? (
                      <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>{t('notif.empty')}</div>
                    ) : notifications.map((n) => (
                      <div key={n.id} style={{ display: 'flex', gap: 10, padding: '11px 14px', borderBottom: '1px solid var(--border-light)', background: n.ts > notifSeen && n.id !== 'welcome' ? 'var(--primary-glow)' : 'transparent' }}>
                        <div style={{ marginTop: 1 }}><NotifIcon name={n.icon} /></div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{n.title}</div>
                          {n.desc && <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.desc}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <div className="main-body">
          {currentPage === 'dashboard' && <Dashboard onStartWorkshop={startNewSession} onOpenSession={(id) => {
            useWorkshopStore.getState().loadSession(id);
            setCurrentPage('workshop');
          }} onViewDeliverables={() => setCurrentPage('deliverables')} onViewDocs={() => setCurrentPage('docs')} onOpenDeliverables={(id) => {
            useWorkshopStore.getState().loadSession(id);
            setCurrentPage('deliverables');
          }} />}
          {currentPage === 'products' && <DataProducts
            onNew={startNewSession}
            onOpenWorkshop={(id) => { useWorkshopStore.getState().loadSession(id); setCurrentPage('workshop'); }}
            onOpenDeliverables={(id) => { useWorkshopStore.getState().loadSession(id); setCurrentPage('deliverables'); }}
          />}
          {currentPage === 'workshop' && <Workshop onNew={startNewSession} />}
          {currentPage === 'deliverables' && <Deliverables />}
          {currentPage === 'admin' && <AdminPanel />}
          {currentPage === 'supervision' && <Supervision initialTab={supervisionTab} />}
          {currentPage === 'docs' && <Documentation onStartWorkshop={startNewSession} />}
        </div>
      </div>

      {showModeModal && (
        <div onClick={() => setShowModeModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', width: 'min(640px, 100%)', padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}>
            <h2 style={{ fontSize: 20, marginBottom: 6 }}>{t('mode.title')}</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>{t('mode.subtitle')}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
              <button onClick={() => createWithMode('batch')} style={{ textAlign: 'left', cursor: 'pointer', background: 'var(--bg-elevated)', border: '2px solid var(--border)', borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 26, marginBottom: 8 }}>📋</div>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>{t('mode.batchTitle')}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{t('mode.batchDesc')}</div>
              </button>
              <button onClick={() => createWithMode('guided')} style={{ textAlign: 'left', cursor: 'pointer', background: 'var(--primary-glow)', border: '2px solid var(--border-active)', borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 26, marginBottom: 8 }}>💬</div>
                <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--primary-light)' }}>{t('mode.guidedTitle')}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{t('mode.guidedDesc')}</div>
              </button>
            </div>
            <div style={{ textAlign: 'right', marginTop: 16 }}>
              <button className="suggested-chip" onClick={() => setShowModeModal(false)}>{t('mode.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modale : proposer une amélioration */}
      {showIdea && (
        <div onClick={() => setShowIdea(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', width: 'min(520px, 100%)', padding: 26, boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}>
            {ideaSent ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                  <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M8.3 12.4l2.6 2.6 4.8-5.2" /></svg>
                </div>
                <div style={{ fontWeight: 600 }}>{t('idea.thanks')}</div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6" /><path d="M10 21h4" /><path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.3 1 2.5h6c0-1.2.3-1.8 1-2.5A6 6 0 0 0 12 3Z" /></svg>
                  <h2 style={{ fontSize: 18, margin: 0 }}>{t('idea.title')}</h2>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>{t('idea.desc')}</p>
                <textarea
                  className="chat-input"
                  value={ideaText}
                  onChange={(e) => setIdeaText(e.target.value)}
                  placeholder={t('idea.placeholder')}
                  style={{ width: '100%', minHeight: 120, resize: 'vertical', padding: 12 }}
                  autoFocus
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                  <button className="suggested-chip" onClick={() => setShowIdea(false)}>{t('idea.cancel')}</button>
                  <button className="cta-btn" onClick={submitIdea} disabled={!ideaText.trim()} style={{ opacity: ideaText.trim() ? 1 : 0.5 }}>{t('idea.submit')}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
