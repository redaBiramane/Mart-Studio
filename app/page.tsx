'use client';

import { useState, useEffect } from 'react';
import { useWorkshopStore } from '@/lib/store';
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
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [supervisionTab, setSupervisionTab] = useState<'activity' | 'products' | 'users'>('activity');
  const [showModeModal, setShowModeModal] = useState(false);

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
  const { session, sessions, currentPage, setCurrentPage, authReady, user, profile, initAuth, signOut } = useWorkshopStore();

  useEffect(() => { initAuth(); }, [initAuth]);

  const isAdmin = profile?.role === 'admin';

  const navItems = [
    { key: 'dashboard' as Page, label: 'Accueil' },
    { key: 'products' as Page, label: 'Data Products' },
    { key: 'workshop' as Page, label: 'DataForge', badge: session?.status === 'active' ? `${session.currentStep}/7` : undefined },
    { key: 'deliverables' as Page, label: 'Livrables' },
    { key: 'docs' as Page, label: 'Documentation' },
  ];

  const adminItems = [
    ...(isAdmin ? [{ key: 'supervision' as Page, label: 'Supervision' }] : []),
    { key: 'admin' as Page, label: 'Configuration LLM' },
  ];

  // Auth gate (only when Supabase is configured)
  if (isSupabaseConfigured && !authReady) {
    return (
      <div className="app-loading">
        <Image className="app-loading-logo" src="/sofinco-logo.svg" alt="Sofinco" width={230} height={49} style={{ width: 230, height: 49 }} priority />
        <div className="app-progress" />
        <div style={{ color: 'var(--text-muted)', fontSize: 13, letterSpacing: 0.3 }}>Chargement de Mart Studio…</div>
      </div>
    );
  }
  if (isSupabaseConfigured && !user) {
    return showLogin ? <Login onBack={() => setShowLogin(false)} /> : <Landing onEnter={() => setShowLogin(true)} />;
  }

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''} ${collapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand" style={{ flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', textAlign: 'center' }}>
            <Image src="/sofinco-logo.svg" alt="Sofinco" width={240} height={51} style={{ width: 240, height: 51 }} priority />
            <div className="sidebar-title" style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Mart Studio</div>
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
            <div className="sidebar-section-title">Navigation</div>
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
              <div className="sidebar-section-title">Sessions récentes</div>
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
                    {s.productName || 'Nouveau produit'}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="sidebar-section">
            <div className="sidebar-section-title">Administration</div>
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

        <div className="sidebar-footer" style={{ position: 'relative' }}>
          {userMenuOpen && (
            <>
              <div onClick={() => setUserMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
              <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: 12, right: 12, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-lg)', padding: 6, zIndex: 41 }}>
                {isAdmin && (
                  <>
                    <button className="user-menu-item" onClick={() => { setSupervisionTab('activity'); setCurrentPage('supervision'); setSidebarOpen(false); setUserMenuOpen(false); }}><NavIcon name="supervision" /> Supervision</button>
                    <button className="user-menu-item" onClick={() => { setSupervisionTab('users'); setCurrentPage('supervision'); setSidebarOpen(false); setUserMenuOpen(false); }}><NavIcon name="users" /> Utilisateurs</button>
                    <button className="user-menu-item" onClick={() => { setCurrentPage('admin'); setSidebarOpen(false); setUserMenuOpen(false); }}><NavIcon name="admin" /> Configuration LLM</button>
                    <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                  </>
                )}
                {user && (
                  <button className="user-menu-item" style={{ color: 'var(--accent-red)' }} onClick={() => { signOut(); setUserMenuOpen(false); }}><NavIcon name="logout" /> Se déconnecter</button>
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
                {user?.email || 'Invité (mode local)'}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{isAdmin ? 'Administrateur' : (user ? 'Utilisateur' : 'Non connecté')}</div>
            </div>
            <span style={{ color: 'var(--text-muted)', fontSize: 12, transform: userMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>⌃</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className={`main-content${collapsed ? ' with-rail' : ''}`}>
        <header className="main-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              className="nav-item"
              style={{ display: 'none', padding: 8 }}
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              ☰
            </button>
            <h1>
              {currentPage === 'dashboard' && 'Tableau de bord'}
              {currentPage === 'products' && 'Data Products'}
              {currentPage === 'workshop' && 'DataForge — Conception assistée par IA'}
              {currentPage === 'deliverables' && 'Livrables'}
              {currentPage === 'admin' && 'Configuration LLM'}
              {currentPage === 'docs' && 'Documentation'}
              {currentPage === 'supervision' && 'Supervision'}
            </h1>
          </div>
          <div className="header-actions">
            {currentPage === 'dashboard' && (
              <button className="cta-btn" onClick={startNewSession}>
                ✨ Nouvel Atelier
              </button>
            )}
            <button className="header-icon-btn" title="Aide">💡</button>
            <div className="header-lang">🇫🇷 FR</div>
            <button
              className="header-icon-btn"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Passer en mode jour' : 'Passer en mode nuit'}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button className="header-icon-btn" title="Paramètres">⚙️</button>
            <button className="header-icon-btn" title="Notifications">
              🔔
              <span className="badge-dot"></span>
            </button>
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
          {currentPage === 'workshop' && <Workshop />}
          {currentPage === 'deliverables' && <Deliverables />}
          {currentPage === 'admin' && <AdminPanel />}
          {currentPage === 'supervision' && <Supervision initialTab={supervisionTab} />}
          {currentPage === 'docs' && <Documentation onStartWorkshop={startNewSession} />}
        </div>
      </div>

      {showModeModal && (
        <div onClick={() => setShowModeModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', width: 'min(640px, 100%)', padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}>
            <h2 style={{ fontSize: 20, marginBottom: 6 }}>Comment souhaitez-vous être accompagné ?</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>Choisissez le rythme de l&apos;atelier. Vous pourrez répondre librement dans les deux cas.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
              <button onClick={() => createWithMode('batch')} style={{ textAlign: 'left', cursor: 'pointer', background: 'var(--bg-elevated)', border: '2px solid var(--border)', borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 26, marginBottom: 8 }}>📋</div>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Par étape (rapide)</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>Marty affiche toutes les questions d&apos;une étape d&apos;un coup. Idéal pour aller vite et répondre globalement.</div>
              </button>
              <button onClick={() => createWithMode('guided')} style={{ textAlign: 'left', cursor: 'pointer', background: 'var(--primary-glow)', border: '2px solid var(--border-active)', borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 26, marginBottom: 8 }}>💬</div>
                <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--primary-light)' }}>Guidé (pas à pas)</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>Marty pose une seule question à la fois et attend votre réponse. Idéal pour être accompagné en douceur.</div>
              </button>
            </div>
            <div style={{ textAlign: 'right', marginTop: 16 }}>
              <button className="suggested-chip" onClick={() => setShowModeModal(false)}>Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
