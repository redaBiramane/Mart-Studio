'use client';

import { useState, useEffect, useMemo } from 'react';
import { useWorkshopStore } from '@/lib/store';
import { useI18n } from '@/lib/i18n';
import { isSupabaseConfigured } from '@/lib/supabase';
import Dashboard from './components/Dashboard';
import GlobalSearch from './components/GlobalSearch';
import Workshop from './components/Workshop';
import Deliverables from './components/Deliverables';
import AdminPanel from './components/AdminPanel';
import Documentation from './components/Documentation';
import DataProducts from './components/DataProducts';
import Supervision from './components/Supervision';
import QuestionsAdmin from './components/QuestionsAdmin';
import Help from './components/Help';
import Profile, { UserAvatar } from './components/Profile';
import Integrations from './components/Integrations';
import Login from './components/Login';
import Landing from './components/Landing';
import Image from 'next/image';

type Page = 'dashboard' | 'products' | 'workshop' | 'deliverables' | 'admin' | 'docs' | 'supervision' | 'questions' | 'help' | 'profile';

// Icônes SVG (line icons) pour la navigation — plus pro que des emojis.
function NavIcon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    dashboard: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M9.5 21v-6h5v6" /></>,
    products: <><rect x="3" y="4" width="7.5" height="7.5" rx="1.5" /><rect x="13.5" y="4" width="7.5" height="7.5" rx="1.5" /><rect x="3" y="14.5" width="7.5" height="5.5" rx="1.5" /><rect x="13.5" y="14.5" width="7.5" height="5.5" rx="1.5" /></>,
    workshop: <><path d="M12 6.5 13.7 11l4.5 1.7-4.5 1.7L12 19l-1.7-4.6L5.8 12.7 10.3 11 12 6.5Z" /><path d="M5 4v3M3.5 5.5h3M18 15v3M16.5 16.5h3" /></>,
    deliverables: <><path d="M21 8 12 3 3 8l9 5 9-5Z" /><path d="M3 8v8l9 5 9-5V8" /><path d="M12 13v8" /></>,
    integrations: <><path d="M9 2v5M15 2v5" /><path d="M7 7h10v4a5 5 0 0 1-10 0V7Z" /><path d="M12 16v3a3 3 0 0 0 3 3" /></>,
    docs: <><path d="M6.5 2H18a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" /><path d="M8 7h8M8 11h8M8 15h5" /></>,
    supervision: <><path d="M12 3l7 3v5c0 4.2-2.9 7.4-7 9-4.1-1.6-7-4.8-7-9V6l7-3Z" /><path d="M9.2 12l2 2 3.6-3.8" /></>,
    admin: <><circle cx="12" cy="12" r="3.2" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M19.4 4.6l-2.1 2.1M6.7 17.3l-2.1 2.1" /></>,
    session: <><ellipse cx="12" cy="5" rx="7" ry="2.6" /><path d="M5 5v6c0 1.5 3.1 2.6 7 2.6s7-1.1 7-2.6V5" /><path d="M5 11v6c0 1.5 3.1 2.6 7 2.6s7-1.1 7-2.6v-6" /></>,
    users: <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0" /><path d="M16 5.2a3.2 3.2 0 0 1 0 5.6" /><path d="M18.5 20a5.5 5.5 0 0 0-3.2-5" /></>,
    logout: <><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 17l-5-5 5-5" /><path d="M15 12H5" /></>,
    questions: <><path d="M6.5 2H18a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" /><path d="M9.2 8.2a2.3 2.3 0 0 1 4.3 1c0 1.6-2.3 1.8-2.3 3M11.2 15h.01" /></>,
    help: <><circle cx="12" cy="12" r="9" /><path d="M9.2 9.2a2.8 2.8 0 0 1 5.3 1.2c0 1.9-2.8 2.1-2.8 3.6M12 17h.01" /></>,
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
  const [supervisionTab, setSupervisionTab] = useState<'activity' | 'products' | 'users' | 'stats' | 'ideas' | 'reports'>('stats');
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
  function createWithMode(mode: 'batch' | 'guided' | 'expert') {
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
  const { session, sessions, currentPage, setCurrentPage, authReady, user, profile, initAuth, signOut, activityLogs, adminProfiles, logActivity, myLogs, respondAccess, sharedInfo, seenShared, profilePrefs } = useWorkshopStore();
  // Produits partagés reçus et pas encore ouverts → pastille rouge « nouveau ».
  const newSharedCount = Object.keys(sharedInfo).filter((id) => !seenShared.includes(id)).length;
  const [replyView, setReplyView] = useState<string | null>(null);

  useEffect(() => { initAuth(); }, [initAuth]);

  const isAdmin = profile?.role === 'admin';

  // Notifications dérivées : événements produits (tous) + activité récente (admin)
  const notifications = useMemo(() => {
    type Notif = { id: string; icon: string; title: string; desc: string; ts: number; go?: () => void; actions?: { label: string; kind: 'primary' | 'danger'; run: () => void }[] };
    const items: Notif[] = [];
    const goProduct = (id: string, page: Page) => () => { useWorkshopStore.getState().loadSession(id); setCurrentPage(page); setNotifOpen(false); setSidebarOpen(false); };
    const goSupervision = (tab: 'activity' | 'ideas' | 'reports') => () => { setSupervisionTab(tab); setCurrentPage('supervision'); setNotifOpen(false); setSidebarOpen(false); };
    sessions.slice(0, 12).forEach((s) => {
      const name = s.productName || t('dash.newProduct');
      if (s.status === 'completed') {
        items.push({ id: `done-${s.id}`, icon: 'done', title: `« ${name} » ${t('notif.completed')}`, desc: `${s.entities.length} ${t('dash.entities')}`, ts: s.updatedAt, go: goProduct(s.id, 'deliverables') });
      } else {
        items.push({ id: `upd-${s.id}`, icon: 'edit', title: `« ${name} » ${t('notif.updated')}`, desc: `${t('dash.step')} ${s.currentStep}/7`, ts: s.updatedAt, go: goProduct(s.id, 'workshop') });
      }
    });
    if (isAdmin) {
      const personal = new Set(['shared', 'shared_with', 'access_request', 'access_granted', 'access_denied', 'idea_reply']);
      activityLogs.filter((l) => !personal.has(l.action)).slice(0, 10).forEach((l) => {
        const isIdea = l.action === 'idea';
        const isReport = l.action === 'report_ai';
        const title = isIdea ? '💡 Nouvelle idée' : isReport ? '⚠️ Signalement IA' : `${t('notif.activity')} · ${l.action}`;
        items.push({ id: `act-${l.id}`, icon: isIdea ? 'idea' : 'activity', title, desc: `${l.user_email || ''}${l.detail ? ' — ' + l.detail : ''}`, ts: new Date(l.created_at).getTime(), go: goSupervision(isIdea ? 'ideas' : isReport ? 'reports' : 'activity') });
      });
    }
    // Réponses de l'admin aux idées de l'utilisateur courant → notif in-app
    myLogs.filter((l) => l.action === 'idea_reply').slice(0, 10).forEach((l) => {
      items.push({ id: `myl-${l.id}`, icon: 'idea', title: '💬 Réponse à votre idée', desc: l.detail || '', ts: new Date(l.created_at).getTime(), go: () => { setReplyView(l.detail || ''); setNotifOpen(false); } });
    });
    // Partages : produit partagé AVEC moi (récepteur) et confirmations (émetteur)
    myLogs.filter((l) => l.action === 'shared_with' || l.action === 'shared').slice(0, 10).forEach((l) => {
      const received = l.action === 'shared_with';
      items.push({
        id: `shr-${l.id}`, icon: received ? 'done' : 'activity',
        title: received ? '📦 Un data product a été partagé avec vous' : '✅ Data product partagé',
        desc: l.detail || '', ts: new Date(l.created_at).getTime(),
        go: () => { setCurrentPage('products'); setNotifOpen(false); setSidebarOpen(false); },
      });
    });
    // Demandes d'accès Éditeur reçues (je suis le propriétaire) → Accepter / Refuser
    myLogs.filter((l) => l.action === 'access_request').slice(0, 10).forEach((l) => {
      const [pid, reqEmail, pname] = (l.detail || '').split('§§');
      items.push({
        id: `areq-${l.id}`, icon: 'idea',
        title: '🔑 Demande d’accès Éditeur',
        desc: `${reqEmail || 'Un utilisateur'} demande à contribuer à « ${pname || 'un data product'} »`,
        ts: new Date(l.created_at).getTime(),
        actions: [
          { label: 'Accepter', kind: 'primary', run: () => { respondAccess(pid, reqEmail, 'accept'); } },
          { label: 'Refuser', kind: 'danger', run: () => { respondAccess(pid, reqEmail, 'deny'); } },
        ],
      });
    });
    // Réponses à MA demande d'accès
    myLogs.filter((l) => l.action === 'access_granted' || l.action === 'access_denied').slice(0, 10).forEach((l) => {
      const granted = l.action === 'access_granted';
      items.push({
        id: `ares-${l.id}`, icon: granted ? 'done' : 'activity',
        title: granted ? '🔓 Accès Éditeur accordé' : '🔒 Demande d’accès refusée',
        desc: l.detail || '', ts: new Date(l.created_at).getTime(),
        go: granted ? () => { setCurrentPage('products'); setNotifOpen(false); setSidebarOpen(false); } : undefined,
      });
    });
    if (items.length === 0) {
      items.push({ id: 'welcome', icon: 'welcome', title: t('notif.welcome'), desc: t('notif.welcomeDesc'), ts: Date.now() });
    }
    return items.sort((a, b) => b.ts - a.ts).slice(0, 15);
  }, [sessions, activityLogs, myLogs, isAdmin, t, setCurrentPage, respondAccess]);

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
      idea: <><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.3 1 2.5h6c0-1.2.3-1.8 1-2.5A6 6 0 0 0 12 3Z" /></>,
      welcome: <><path d="M12 3l2.3 4.7 5.2.8-3.8 3.7.9 5.1L12 15l-4.6 2.4.9-5.1L4.5 8.5l5.2-.8L12 3Z" /></>,
    };
    return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{p[name] || <circle cx="12" cy="12" r="9" />}</svg>;
  }

  const navItems = [
    { key: 'dashboard' as Page, label: t('nav.dashboard') },
    { key: 'products' as Page, label: t('nav.products'), badgeRed: newSharedCount > 0 ? newSharedCount : undefined },
    { key: 'workshop' as Page, label: t('nav.workshop'), badge: session?.status === 'active' ? `${session.currentStep}/7` : undefined },
    { key: 'deliverables' as Page, label: t('nav.deliverables') },
    // Intégrations masqué pour l'instant — réactiver en décommentant la ligne ci-dessous.
    // { key: 'integrations' as Page, label: 'Intégrations' },
  ];

  const adminItems = [
    ...(isAdmin ? [{ key: 'supervision' as Page, label: t('menu.supervision') }] : []),
    ...(isAdmin ? [{ key: 'questions' as Page, label: t('nav.questions') }] : []),
    { key: 'admin' as Page, label: t('menu.llm') },
  ];

  // Auth gate (only when Supabase is configured)
  if (isSupabaseConfigured && !authReady) {
    return (
      <div className="app-loading">
        <Image className="app-loading-logo" src="/ca-logo.png" alt="Crédit Agricole Personal Finance & Mobility" width={240} height={71} style={{ width: 240, height: 'auto', maxWidth: '80%' }} priority />
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.5, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Self Data Modeling Platform</div>
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
            style={{ flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: 12, width: '100%', textAlign: 'left', cursor: 'pointer' }}
          >
            <Image src="/ca-logo.png" alt="Crédit Agricole Personal Finance & Mobility" width={170} height={51} style={{ width: 170, height: 'auto', maxWidth: '100%' }} priority />
            <div className="sidebar-title" style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Self Data Modeling Platform</div>
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
                {'badgeRed' in item && item.badgeRed && (
                  <span style={{ marginLeft: 'auto', minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, background: '#DC2626', color: '#fff', fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>{item.badgeRed}</span>
                )}
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

        <div className="sidebar-brandfoot">
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
                    <button className="user-menu-item" onClick={() => { setSupervisionTab('stats'); setCurrentPage('supervision'); setSidebarOpen(false); setUserMenuOpen(false); }}><NavIcon name="supervision" /> {t('menu.supervision')}</button>
                    <button className="user-menu-item" onClick={() => { setSupervisionTab('users'); setCurrentPage('supervision'); setSidebarOpen(false); setUserMenuOpen(false); }}><NavIcon name="users" /> {t('menu.users')}</button>
                    <button className="user-menu-item" onClick={() => { setCurrentPage('admin'); setSidebarOpen(false); setUserMenuOpen(false); }}><NavIcon name="admin" /> {t('menu.llm')}</button>
                    <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                  </>
                )}
                <button className="user-menu-item" onClick={() => { setCurrentPage('profile'); setSidebarOpen(false); setUserMenuOpen(false); }}><NavIcon name="users" /> Mon profil</button>
                <button className="user-menu-item" onClick={() => { setCurrentPage('help'); setSidebarOpen(false); setUserMenuOpen(false); }}><NavIcon name="help" /> {t('menu.help')}</button>
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
            <UserAvatar size={36} prefs={profilePrefs} email={user?.email} name={profile?.full_name} />
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
              {currentPage === 'workshop' && (session?.productName ? `DataForge — ${session.productName}` : t('header.workshop'))}
              {currentPage === 'deliverables' && t('header.deliverables')}
              {currentPage === 'admin' && t('header.admin')}
              {currentPage === 'docs' && t('header.docs')}
              {currentPage === 'supervision' && t('header.supervision')}
              {currentPage === 'questions' && t('nav.questions')}
              {currentPage === 'help' && t('menu.help')}
              {currentPage === 'profile' && 'Mon profil'}
              {currentPage === 'integrations' && 'Intégrations'}
            </h1>
          </div>
          <div className="header-actions">
            {currentPage === 'dashboard' && (
              <button className="cta-btn" onClick={startNewSession}>
                ✨ {t('action.newWorkshop')}
              </button>
            )}
            <GlobalSearch onOpen={(id) => { useWorkshopStore.getState().loadSession(id); setCurrentPage('workshop'); }} />
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
              {theme === 'dark' ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4.2" /><path d="M12 2.5v2.4M12 19.1v2.4M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7" /></svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.6 6.6 0 0 0 9.8 9.8Z" /></svg>
              )}
            </button>
            <div style={{ position: 'relative' }}>
              <button className="header-icon-btn" title={t('tooltip.notifications')} onClick={openNotifications}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M18 9a6 6 0 0 0-12 0c0 6-2.5 7-2.5 7h17S18 15 18 9Z" /><path d="M10.5 20a2 2 0 0 0 3 0" /></svg>
                {unreadCount > 0 && <span className="badge-count">{unreadCount > 9 ? '9+' : unreadCount}</span>}
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
                      <div
                        key={n.id}
                        onClick={n.go}
                        style={{ display: 'flex', gap: 10, padding: '11px 14px', borderBottom: '1px solid var(--border-light)', background: n.ts > notifSeen && n.id !== 'welcome' ? 'var(--primary-glow)' : 'transparent', cursor: n.go ? 'pointer' : 'default' }}
                        onMouseEnter={(e) => { if (n.go) e.currentTarget.style.background = 'var(--bg-elevated)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = n.ts > notifSeen && n.id !== 'welcome' ? 'var(--primary-glow)' : 'transparent'; }}
                      >
                        <div style={{ marginTop: 1 }}><NotifIcon name={n.icon} /></div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{n.title}</div>
                          {n.desc && <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: n.actions ? 'normal' : 'nowrap' }}>{n.desc}</div>}
                          {n.actions && (
                            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                              {n.actions.map((a, i) => (
                                <button key={i} type="button"
                                  onClick={(e) => { e.stopPropagation(); a.run(); }}
                                  style={{ border: 'none', borderRadius: 7, padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                                    background: a.kind === 'primary' ? 'var(--primary)' : 'transparent',
                                    color: a.kind === 'primary' ? '#fff' : 'var(--accent-red)',
                                    ...(a.kind === 'danger' ? { border: '1px solid var(--accent-red)' } : {}) }}>
                                  {a.label}
                                </button>
                              ))}
                            </div>
                          )}
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
          {currentPage === 'questions' && <QuestionsAdmin />}
          {currentPage === 'help' && <Help onOpenDocs={() => setCurrentPage('docs')} onStartWorkshop={startNewSession} onSuggestIdea={() => { setShowIdea(true); setIdeaSent(false); }} isAdmin={isAdmin} />}
          {currentPage === 'profile' && <Profile />}
          {currentPage === 'integrations' && <Integrations />}
          {currentPage === 'docs' && <Documentation onStartWorkshop={startNewSession} />}
        </div>
      </div>

      {showModeModal && (
        <div onClick={() => setShowModeModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', width: 'min(820px, 100%)', padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}>
            <h2 style={{ fontSize: 20, marginBottom: 6 }}>{t('mode.title')}</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>{t('mode.subtitle')}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 16 }}>
              <button onClick={() => createWithMode('batch')} style={{ textAlign: 'left', cursor: 'pointer', background: 'var(--bg-elevated)', border: '2px solid var(--border)', borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 26, marginBottom: 8 }}>📋</div>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>{t('mode.batchTitle')}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{t('mode.batchDesc')}</div>
              </button>
              <button onClick={() => createWithMode('guided')} style={{ textAlign: 'left', cursor: 'pointer', background: 'var(--bg-elevated)', border: '2px solid var(--border)', borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 26, marginBottom: 8 }}>💬</div>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>{t('mode.guidedTitle')}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{t('mode.guidedDesc')}</div>
              </button>
              <button onClick={() => createWithMode('expert')} style={{ textAlign: 'left', cursor: 'pointer', background: 'var(--primary-glow)', border: '2px solid var(--border-active)', borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 26, marginBottom: 8 }}>⚡</div>
                <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--primary-light)' }}>{t('mode.expertTitle')}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{t('mode.expertDesc')}</div>
              </button>
            </div>
            <div style={{ textAlign: 'right', marginTop: 16 }}>
              <button className="suggested-chip" onClick={() => setShowModeModal(false)}>{t('mode.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modale : lecture d'une réponse à une idée */}
      {replyView && (
        <div onClick={() => setReplyView(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', width: 'min(500px, 100%)', padding: 26, boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{ color: 'var(--primary)', display: 'flex' }}><NavIcon name="docs" /></span>
              <h2 style={{ fontSize: 18, margin: 0 }}>Réponse de l&apos;équipe à votre idée</h2>
            </div>
            <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.6, whiteSpace: 'pre-wrap', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>{replyView}</div>
            <div style={{ textAlign: 'right', marginTop: 18 }}>
              <button className="cta-btn" onClick={() => setReplyView(null)}>Fermer</button>
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
