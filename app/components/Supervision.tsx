'use client';

import { useEffect, useState } from 'react';
import { useWorkshopStore } from '@/lib/store';

const ACTION_META: Record<string, { icon: string; label: string }> = {
  login: { icon: 'key', label: 'Connexion' },
  logout: { icon: 'logout', label: 'Déconnexion' },
  signup: { icon: 'userplus', label: 'Inscription' },
  create_product: { icon: 'plus', label: 'Création produit' },
  duplicate_product: { icon: 'copy', label: 'Duplication produit' },
  complete_product: { icon: 'check', label: 'Atelier terminé' },
  delete_product: { icon: 'trash', label: 'Suppression produit' },
  idea: { icon: 'idea', label: 'Idée' },
};

// Icônes SVG (remplacent les emojis)
function SIcon({ name, size = 16 }: { name: string; size?: number }) {
  const p: Record<string, React.ReactNode> = {
    users: <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0" /><path d="M16 5.2a3.2 3.2 0 0 1 0 5.6" /><path d="M18.5 20a5.5 5.5 0 0 0-3.2-5" /></>,
    box: <><path d="M21 8 12 3 3 8l9 5 9-5Z" /><path d="M3 8v8l9 5 9-5V8" /><path d="M12 13v8" /></>,
    check: <><circle cx="12" cy="12" r="9" /><path d="M8.3 12.4l2.6 2.6 4.8-5.2" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5l3.2 2" /></>,
    lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
    refresh: <><path d="M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6" /></>,
    key: <><circle cx="8" cy="15" r="4" /><path d="M10.8 12.2 20 3M17 6l2 2M15 8l2 2" /></>,
    logout: <><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 17l-5-5 5-5M15 12H5" /></>,
    userplus: <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0" /><path d="M19 8v6M16 11h6" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    trash: <><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" /></>,
    copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></>,
    idea: <><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.3 1 2.5h6c0-1.2.3-1.8 1-2.5A6 6 0 0 0 12 3Z" /></>,
    promote: <><path d="M12 19V5M6 11l6-6 6 6" /></>,
    demote: <><path d="M12 5v14M6 13l6 6 6-6" /></>,
    ban: <><circle cx="12" cy="12" r="9" /><path d="M5.6 5.6l12.8 12.8" /></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: '-3px', flexShrink: 0 }}>
      {p[name] || <circle cx="12" cy="12" r="9" />}
    </svg>
  );
}

export default function Supervision({ initialTab = 'activity' }: { initialTab?: 'activity' | 'products' | 'users' }) {
  const { profile, user, adminProducts, adminProfiles, activityLogs, loadAdminData, setUserRole, deleteUser } = useWorkshopStore();
  const [tab, setTab] = useState<'activity' | 'products' | 'users'>(initialTab);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [fUser, setFUser] = useState('all');
  const [fAction, setFAction] = useState('all');
  const [fDetail, setFDetail] = useState('');
  const [uSearch, setUSearch] = useState('');
  const [uRole, setURole] = useState('all');
  const [delUser, setDelUser] = useState<{ id: string; label: string } | null>(null);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  async function changeRole(id: string, currentRole: string) {
    setBusyId(id);
    await setUserRole(id, currentRole === 'admin' ? 'user' : 'admin');
    setBusyId(null);
  }
  async function toggleBan(id: string, currentRole: string) {
    setBusyId(id);
    await setUserRole(id, currentRole === 'banned' ? 'user' : 'banned');
    setBusyId(null);
  }
  async function doDeleteUser() {
    if (!delUser) return;
    setBusyId(delUser.id);
    await deleteUser(delUser.id);
    setBusyId(null);
    setDelUser(null);
  }

  if (profile?.role !== 'admin') {
    return (
      <div className="empty-state" style={{ padding: 48 }}>
        <div className="empty-state-icon" style={{ display: 'flex', justifyContent: 'center', color: 'var(--text-muted)' }}><SIcon name="lock" size={40} /></div>
        <div className="empty-state-text">Accès réservé aux administrateurs.</div>
      </div>
    );
  }

  function fmt(ts: string) {
    return new Date(ts).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  const tabs: { key: typeof tab; icon: string; label: string }[] = [
    { key: 'activity', icon: 'clock', label: `Activité (${activityLogs.length})` },
    { key: 'products', icon: 'box', label: `Data Products (${adminProducts.length})` },
    { key: 'users', icon: 'users', label: `Utilisateurs (${adminProfiles.length})` },
  ];

  // Filtres onglet Activité
  const activityUsers = Array.from(new Set(activityLogs.map(l => l.user_email).filter(Boolean))) as string[];
  const activityActions = Array.from(new Set(activityLogs.map(l => l.action)));
  const filteredLogs = activityLogs.filter(l =>
    (fUser === 'all' || l.user_email === fUser) &&
    (fAction === 'all' || l.action === fAction) &&
    (!fDetail || `${l.detail || ''}`.toLowerCase().includes(fDetail.toLowerCase()))
  );

  const filteredUsers = adminProfiles.filter(u =>
    (uRole === 'all' || u.role === uRole) &&
    (!uSearch || `${u.full_name || ''} ${u.email}`.toLowerCase().includes(uSearch.toLowerCase()))
  );

  const th: React.CSSProperties = { padding: '10px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap', borderBottom: '2px solid var(--border)' };
  const td: React.CSSProperties = { padding: '8px 12px', borderBottom: '1px solid var(--border)' };
  const filterCtl: React.CSSProperties = { width: '100%', height: 32, padding: '4px 8px', fontSize: 12.5, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-surface)', color: 'var(--text)' };
  const filterTh: React.CSSProperties = { padding: '6px 12px 10px', borderBottom: '1px solid var(--border)', verticalAlign: 'top' };

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
      <h2 style={{ fontSize: 22, marginBottom: 4 }}>Supervision de la plateforme</h2>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
        Vue administrateur : activité des utilisateurs, ensemble des Data Products et comptes.
      </p>

      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Utilisateurs', value: adminProfiles.length, icon: 'users' },
          { label: 'Data Products', value: adminProducts.length, icon: 'box' },
          { label: 'Terminés', value: adminProducts.filter(p => p.status === 'completed').length, icon: 'check' },
          { label: 'Actions enregistrées', value: activityLogs.length, icon: 'clock' },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ flex: 1 }}>
            <div style={{ marginBottom: 4, color: 'var(--primary)' }}><SIcon name={s.icon} size={26} /></div>
            <div className="stat-value" style={{ fontSize: 26 }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {tabs.map(t => (
          <button key={t.key} className="suggested-chip"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, ...(tab === t.key ? { background: 'var(--primary-glow)', borderColor: 'var(--border-active)', color: 'var(--primary-light)' } : {}) }}
            onClick={() => setTab(t.key)}>
            <SIcon name={t.icon} size={15} /> {t.label}
          </button>
        ))}
        <button className="suggested-chip" onClick={() => loadAdminData()} style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6 }}><SIcon name="refresh" size={15} /> Actualiser</button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        {tab === 'activity' && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr><th style={th}>Date</th><th style={th}>Utilisateur</th><th style={th}>Action</th><th style={th}>Détail</th></tr>
              <tr>
                <th style={filterTh} />
                <th style={filterTh}>
                  <select style={filterCtl} value={fUser} onChange={e => setFUser(e.target.value)}>
                    <option value="all">Tous les utilisateurs</option>
                    {activityUsers.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </th>
                <th style={filterTh}>
                  <select style={filterCtl} value={fAction} onChange={e => setFAction(e.target.value)}>
                    <option value="all">Toutes les actions</option>
                    {activityActions.map(a => <option key={a} value={a}>{ACTION_META[a]?.label || a}</option>)}
                  </select>
                </th>
                <th style={filterTh}>
                  <input style={filterCtl} placeholder="Filtrer le détail…" value={fDetail} onChange={e => setFDetail(e.target.value)} />
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map(l => {
                const meta = ACTION_META[l.action];
                return (
                  <tr key={l.id}>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{fmt(l.created_at)}</td>
                    <td style={td}>{l.user_email || '—'}</td>
                    <td style={td}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: 'var(--primary)' }}><SIcon name={meta?.icon || 'clock'} size={15} /></span>
                        {meta?.label || l.action}
                      </span>
                    </td>
                    <td style={{ ...td, color: 'var(--text-secondary)' }}>{l.detail || ''}</td>
                  </tr>
                );
              })}
              {filteredLogs.length === 0 && <tr><td style={td} colSpan={4}>{activityLogs.length === 0 ? 'Aucune activité enregistrée.' : 'Aucun résultat pour ces filtres.'}</td></tr>}
            </tbody>
          </table>
        )}

        {tab === 'products' && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr><th style={th}>Produit</th><th style={th}>Domaine</th><th style={th}>Propriétaire</th><th style={th}>Statut</th><th style={th}>Mis à jour</th></tr></thead>
            <tbody>
              {adminProducts.map(p => (
                <tr key={p.id}>
                  <td style={{ ...td, fontWeight: 600 }}>{p.name || 'Sans nom'}</td>
                  <td style={td}>{p.domain || '—'}</td>
                  <td style={td}>{p.owner_email || '—'}</td>
                  <td style={td}>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: p.status === 'completed' ? 'var(--primary-glow)' : 'var(--border)', color: p.status === 'completed' ? 'var(--primary-light)' : 'var(--text-secondary)' }}>
                      {p.status === 'completed' ? 'Terminé' : 'En cours'}
                    </span>
                  </td>
                  <td style={td}>{fmt(p.updated_at)}</td>
                </tr>
              ))}
              {adminProducts.length === 0 && <tr><td style={td} colSpan={5}>Aucun Data Product.</td></tr>}
            </tbody>
          </table>
        )}

        {tab === 'users' && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr><th style={th}>Nom</th><th style={th}>Email</th><th style={th}>Rôle</th><th style={th}>Inscrit le</th><th style={{ ...th, textAlign: 'right' }}>Actions</th></tr>
              <tr>
                <th style={filterTh} colSpan={2}>
                  <input style={filterCtl} placeholder="Rechercher un nom ou email…" value={uSearch} onChange={e => setUSearch(e.target.value)} />
                </th>
                <th style={filterTh}>
                  <select style={filterCtl} value={uRole} onChange={e => setURole(e.target.value)}>
                    <option value="all">Tous les rôles</option>
                    <option value="admin">Admin</option>
                    <option value="user">User</option>
                    <option value="banned">Banni</option>
                  </select>
                </th>
                <th style={filterTh} colSpan={2} />
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(u => {
                const roleBg = u.role === 'admin' ? '#fde68a' : u.role === 'banned' ? '#fecaca' : 'var(--border)';
                const roleFg = u.role === 'admin' ? '#92400e' : u.role === 'banned' ? '#991b1b' : 'var(--text-secondary)';
                const roleLabel = u.role === 'banned' ? 'banni' : u.role;
                return (
                  <tr key={u.id}>
                    <td style={{ ...td, fontWeight: 600 }}>{u.full_name || '—'}</td>
                    <td style={td}>{u.email}</td>
                    <td style={td}>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: roleBg, color: roleFg }}>{roleLabel}</span>
                    </td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{fmt(u.created_at)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      {u.id === user?.id ? (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>vous</span>
                      ) : (
                        <div style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          {u.role !== 'banned' && (
                            <button className="suggested-chip" disabled={busyId === u.id} onClick={() => changeRole(u.id, u.role)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }} title={u.role === 'admin' ? 'Rétrograder' : 'Promouvoir admin'}>
                              <SIcon name={u.role === 'admin' ? 'demote' : 'promote'} size={14} /> {u.role === 'admin' ? 'Rétrograder' : 'Promouvoir'}
                            </button>
                          )}
                          <button className="suggested-chip" disabled={busyId === u.id} onClick={() => toggleBan(u.id, u.role)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: u.role === 'banned' ? 'var(--primary)' : 'var(--accent-amber)' }} title={u.role === 'banned' ? 'Réactiver' : 'Bannir'}>
                            <SIcon name={u.role === 'banned' ? 'check' : 'ban'} size={14} /> {u.role === 'banned' ? 'Réactiver' : 'Bannir'}
                          </button>
                          <button className="suggested-chip" disabled={busyId === u.id} onClick={() => setDelUser({ id: u.id, label: u.full_name || u.email })} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--accent-red)' }} title="Supprimer">
                            <SIcon name="trash" size={14} /> Supprimer
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredUsers.length === 0 && <tr><td style={td} colSpan={5}>Aucun utilisateur pour ces filtres.</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      {/* Modale confirmation suppression utilisateur */}
      {delUser && (
        <div onClick={() => setDelUser(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', width: 'min(460px, 100%)', padding: 26, boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ color: 'var(--accent-red)', display: 'flex' }}><SIcon name="trash" size={22} /></span>
              <h3 style={{ fontSize: 17, margin: 0 }}>Supprimer l&apos;utilisateur</h3>
            </div>
            <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
              Supprimer définitivement <strong>{delUser.label}</strong> et tous ses Data Products ? Cette action est irréversible.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button className="suggested-chip" onClick={() => setDelUser(null)}>Annuler</button>
              <button onClick={doDeleteUser} disabled={busyId === delUser.id} style={{ background: 'var(--accent-red)', color: '#fff', border: 'none', borderRadius: 9, padding: '10px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{busyId === delUser.id ? '…' : 'Supprimer'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
