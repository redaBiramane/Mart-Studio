'use client';

import { useState, useMemo } from 'react';
import { useWorkshopStore } from '@/lib/store';

interface Props {
  onNew: () => void;
  onOpenWorkshop: (id: string) => void;
  onOpenDeliverables: (id: string) => void;
}

type SortKey = 'recent' | 'oldest' | 'name' | 'entities' | 'progress';

function StatIcon({ name }: { name: string }) {
  const p: Record<string, React.ReactNode> = {
    total: <><ellipse cx="12" cy="5" rx="7" ry="2.6" /><path d="M5 5v14c0 1.5 3.1 2.6 7 2.6s7-1.1 7-2.6V5" /><path d="M5 12c0 1.5 3.1 2.6 7 2.6s7-1.1 7-2.6" /></>,
    active: <><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5l3.2 2" /></>,
    done: <><circle cx="12" cy="12" r="9" /><path d="M8.3 12.4l2.6 2.6 4.8-5.2" /></>,
    domains: <><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /></>,
  };
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {p[name] || <circle cx="12" cy="12" r="9" />}
    </svg>
  );
}

export default function DataProducts({ onNew, onOpenWorkshop, onOpenDeliverables }: Props) {
  const { sessions, deleteSession, loadSession, updateSessionData } = useWorkshopStore();
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [domainFilter, setDomainFilter] = useState('all');
  const [sort, setSort] = useState<SortKey>('recent');

  const domains = useMemo(() => {
    const set = new Set<string>();
    sessions.forEach(s => { if (s.domain) set.add(s.domain); });
    return Array.from(set).sort();
  }, [sessions]);

  const list = useMemo(() => {
    let l = sessions.filter(s => {
      const hay = `${s.productName} ${s.domain} ${s.productOwner}`.toLowerCase();
      const matchQ = !q || hay.includes(q.toLowerCase());
      const matchStatus = statusFilter === 'all' || s.status === statusFilter;
      const matchDomain = domainFilter === 'all' || s.domain === domainFilter;
      return matchQ && matchStatus && matchDomain;
    });
    l = [...l].sort((a, b) => {
      switch (sort) {
        case 'oldest': return a.createdAt - b.createdAt;
        case 'name': return (a.productName || 'zzz').localeCompare(b.productName || 'zzz');
        case 'entities': return b.entities.length - a.entities.length;
        case 'progress': return b.currentStep - a.currentStep;
        default: return b.updatedAt - a.updatedAt;
      }
    });
    return l;
  }, [sessions, q, statusFilter, domainFilter, sort]);

  function fmt(ts: number) {
    return new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  function rename(id: string, current: string) {
    const name = window.prompt('Nouveau nom du Data Product :', current);
    if (name && name.trim()) {
      loadSession(id);
      updateSessionData({ productName: name.trim() });
    }
  }
  function confirmDelete(id: string, name: string) {
    if (window.confirm(`Supprimer définitivement « ${name || 'ce produit'} » ? Cette action est irréversible.`)) {
      deleteSession(id);
    }
  }

  const th: React.CSSProperties = { textAlign: 'left', padding: '10px 12px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 12, borderBottom: '2px solid var(--border)', whiteSpace: 'nowrap' };
  const td: React.CSSProperties = { padding: '10px 12px', borderBottom: '1px solid var(--border)', fontSize: 13, verticalAlign: 'middle' };
  const iconBtn: React.CSSProperties = { background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 9px', cursor: 'pointer', fontSize: 12, color: 'var(--text)', whiteSpace: 'nowrap' };

  const active = sessions.filter(s => s.status === 'active').length;
  const completed = sessions.filter(s => s.status === 'completed').length;

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 22, margin: 0 }}>Data Products</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>Gérez, filtrez et ouvrez vos produits data.</p>
        </div>
        <button className="cta-btn" onClick={onNew}>✨ Nouveau Data Product</button>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'Total', value: sessions.length, icon: 'total' },
          { label: 'En cours', value: active, icon: 'active' },
          { label: 'Terminés', value: completed, icon: 'done' },
          { label: 'Domaines', value: domains.length, icon: 'domains' },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ flex: 1, minWidth: 120 }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}><StatIcon name={s.icon} /></div>
            <div className="stat-value" style={{ fontSize: 24 }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          className="chat-input"
          placeholder="🔎 Rechercher (nom, domaine, PO)…"
          value={q}
          onChange={e => setQ(e.target.value)}
          style={{ flex: 1, minWidth: 220, height: 40 }}
        />
        <select className="chat-input" style={{ height: 40, width: 160 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value as 'all' | 'active' | 'completed')}>
          <option value="all">Tous les statuts</option>
          <option value="active">En cours</option>
          <option value="completed">Terminés</option>
        </select>
        <select className="chat-input" style={{ height: 40, width: 180 }} value={domainFilter} onChange={e => setDomainFilter(e.target.value)}>
          <option value="all">Tous les domaines</option>
          {domains.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select className="chat-input" style={{ height: 40, width: 170 }} value={sort} onChange={e => setSort(e.target.value as SortKey)}>
          <option value="recent">Tri : récent</option>
          <option value="oldest">Tri : ancien</option>
          <option value="name">Tri : nom (A→Z)</option>
          <option value="entities">Tri : nb entités</option>
          <option value="progress">Tri : avancement</option>
        </select>
      </div>

      {list.length === 0 ? (
        <div className="empty-state" style={{ padding: 48 }}>
          <div className="empty-state-icon">🛢️</div>
          <div className="empty-state-text">
            {sessions.length === 0 ? 'Aucun Data Product. Créez le premier.' : 'Aucun résultat pour ces filtres.'}
          </div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={th}>Produit</th><th style={th}>Domaine</th><th style={th}>Statut</th>
              <th style={th}>Avancement</th><th style={th}>Entités</th><th style={th}>Mis à jour</th><th style={{ ...th, textAlign: 'right' }}>Actions</th>
            </tr></thead>
            <tbody>
              {list.map(s => (
                <tr key={s.id}>
                  <td style={{ ...td, fontWeight: 600 }}>{s.productName || 'Sans nom'}</td>
                  <td style={{ ...td, color: 'var(--text-secondary)' }}>{s.domain || '—'}</td>
                  <td style={td}>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: s.status === 'completed' ? 'var(--primary-glow)' : 'var(--bg-elevated)', color: s.status === 'completed' ? 'var(--primary-light)' : 'var(--text-secondary)' }}>
                      {s.status === 'completed' ? 'Terminé' : 'En cours'}
                    </span>
                  </td>
                  <td style={td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 60, height: 6, background: 'var(--bg-elevated)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.round((s.currentStep / 7) * 100)}%`, height: '100%', background: 'var(--primary)' }} />
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.currentStep}/7</span>
                    </div>
                  </td>
                  <td style={td}>{s.entities.length}</td>
                  <td style={{ ...td, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{fmt(s.updatedAt)}</td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: 6 }}>
                      <button style={iconBtn} title="Ouvrir l'atelier" onClick={() => onOpenWorkshop(s.id)}>🧠 Ouvrir</button>
                      {s.entities.length > 0 && <button style={iconBtn} title="Voir les livrables" onClick={() => onOpenDeliverables(s.id)}>📦 Livrables</button>}
                      <button style={iconBtn} title="Renommer" onClick={() => rename(s.id, s.productName)}>✏️</button>
                      <button style={{ ...iconBtn, color: 'var(--accent-red)' }} title="Supprimer" onClick={() => confirmDelete(s.id, s.productName)}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
