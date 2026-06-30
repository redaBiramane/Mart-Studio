'use client';

import { useState, useEffect } from 'react';
import { useWorkshopStore } from '@/lib/store';
import { isSupabaseConfigured } from '@/lib/supabase';
import Dashboard from './components/Dashboard';
import Workshop from './components/Workshop';
import Deliverables from './components/Deliverables';
import AdminPanel from './components/AdminPanel';
import Documentation from './components/Documentation';
import Supervision from './components/Supervision';
import Login from './components/Login';
import Image from 'next/image';

type Page = 'dashboard' | 'workshop' | 'deliverables' | 'admin' | 'docs' | 'supervision';

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { session, sessions, currentPage, setCurrentPage, authReady, user, profile, initAuth, signOut } = useWorkshopStore();

  useEffect(() => { initAuth(); }, [initAuth]);

  const isAdmin = profile?.role === 'admin';

  const navItems = [
    { key: 'dashboard' as Page, icon: '🏠', label: 'Accueil' },
    { key: 'workshop' as Page, icon: '🧠', label: 'Atelier IA', badge: session?.status === 'active' ? `${session.currentStep}/5` : undefined },
    { key: 'deliverables' as Page, icon: '📦', label: 'Livrables' },
    { key: 'docs' as Page, icon: '📖', label: 'Documentation' },
  ];

  const adminItems = [
    ...(isAdmin ? [{ key: 'supervision' as Page, icon: '🛡️', label: 'Supervision' }] : []),
    { key: 'admin' as Page, icon: '⚙️', label: 'Configuration LLM' },
  ];

  // Auth gate (only when Supabase is configured)
  if (isSupabaseConfigured && !authReady) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Chargement…</div>;
  }
  if (isSupabaseConfigured && !user) {
    return <Login />;
  }

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
            <Image src="/sofinco-logo.svg" alt="Sofinco" width={140} height={30} style={{ width: 140, height: 30 }} />
            <div className="sidebar-title">Mart Studio</div>
          </div>
        </div>

        <button
          className="sidebar-collapse-btn"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="Toggle sidebar"
        >
          ◁
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
                <span className="nav-item-icon">{item.icon}</span>
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
                  <span className="nav-item-icon">📄</span>
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
                <span className="nav-item-icon">{item.icon}</span>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-footer-avatar">{(user?.email || 'A').charAt(0).toUpperCase()}</div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.email || 'Invité (mode local)'}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{isAdmin ? 'Administrateur' : (user ? 'Utilisateur' : 'Non connecté')}</div>
          </div>
          {user && (
            <button onClick={() => signOut()} title="Se déconnecter"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-red)', fontSize: 16 }}>
              ⎋
            </button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div className="main-content">
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
              {currentPage === 'workshop' && 'Atelier de conception'}
              {currentPage === 'deliverables' && 'Livrables'}
              {currentPage === 'admin' && 'Configuration LLM'}
              {currentPage === 'docs' && 'Documentation'}
              {currentPage === 'supervision' && 'Supervision'}
            </h1>
          </div>
          <div className="header-actions">
            {currentPage === 'dashboard' && (
              <button
                className="cta-btn"
                onClick={() => {
                  useWorkshopStore.getState().createSession();
                  setCurrentPage('workshop');
                }}
              >
                ✨ Nouvel Atelier
              </button>
            )}
            <button className="header-icon-btn" title="Aide">💡</button>
            <div className="header-lang">🇫🇷 FR</div>
            <button className="header-icon-btn" title="Paramètres">⚙️</button>
            <button className="header-icon-btn" title="Notifications">
              🔔
              <span className="badge-dot"></span>
            </button>
          </div>
        </header>

        <div className="main-body">
          {currentPage === 'dashboard' && <Dashboard onStartWorkshop={() => {
            useWorkshopStore.getState().createSession();
            setCurrentPage('workshop');
          }} onOpenSession={(id) => {
            useWorkshopStore.getState().loadSession(id);
            setCurrentPage('workshop');
          }} onViewDeliverables={() => setCurrentPage('deliverables')} onViewDocs={() => setCurrentPage('docs')} onOpenDeliverables={(id) => {
            useWorkshopStore.getState().loadSession(id);
            setCurrentPage('deliverables');
          }} />}
          {currentPage === 'workshop' && <Workshop />}
          {currentPage === 'deliverables' && <Deliverables />}
          {currentPage === 'admin' && <AdminPanel />}
          {currentPage === 'supervision' && <Supervision />}
          {currentPage === 'docs' && <Documentation onStartWorkshop={() => {
            useWorkshopStore.getState().createSession();
            setCurrentPage('workshop');
          }} />}
        </div>
      </div>
    </div>
  );
}
