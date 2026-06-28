'use client';

import { useState } from 'react';
import { useWorkshopStore } from '@/lib/store';
import Dashboard from './components/Dashboard';
import Workshop from './components/Workshop';
import Deliverables from './components/Deliverables';
import AdminPanel from './components/AdminPanel';
import Image from 'next/image';

type Page = 'dashboard' | 'workshop' | 'deliverables' | 'admin';

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { session, sessions, currentPage, setCurrentPage } = useWorkshopStore();

  const navItems = [
    { key: 'dashboard' as Page, icon: '🏠', label: 'Accueil' },
    { key: 'workshop' as Page, icon: '🧠', label: 'Atelier IA', badge: session?.status === 'active' ? `${session.currentStep}/5` : undefined },
    { key: 'deliverables' as Page, icon: '📦', label: 'Livrables' },
  ];

  const adminItems = [
    { key: 'admin' as Page, icon: '⚙️', label: 'Configuration LLM' },
  ];

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ width: '100%' }}>
              <Image src="/ca-logo.svg" alt="CA Personal Finance & Mobility" width={180} height={50} style={{ width: '100%', maxWidth: 180, height: 'auto' }} />
            </div>
            <div>
              <div className="sidebar-title">Mart Studio</div>
              <div className="sidebar-subtitle">Data Product Workshop</div>
            </div>
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
          <div className="sidebar-footer-avatar">A</div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text)' }}>admin</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Admin</div>
          </div>
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
          }} onViewDeliverables={() => setCurrentPage('deliverables')} />}
          {currentPage === 'workshop' && <Workshop />}
          {currentPage === 'deliverables' && <Deliverables />}
          {currentPage === 'admin' && <AdminPanel />}
        </div>
      </div>
    </div>
  );
}
