'use client';

import { useEffect, useMemo, useState } from 'react';
import { useWorkshopStore } from '@/lib/store';
import { STEPS } from '@/lib/constants';

const ACTION_META: Record<string, { icon: string; label: string }> = {
  login: { icon: 'key', label: 'Connexion' },
  logout: { icon: 'logout', label: 'Déconnexion' },
  signup: { icon: 'userplus', label: 'Inscription' },
  create_product: { icon: 'plus', label: 'Création produit' },
  duplicate_product: { icon: 'copy', label: 'Duplication produit' },
  complete_product: { icon: 'check', label: 'Atelier terminé' },
  delete_product: { icon: 'trash', label: 'Suppression produit' },
  idea: { icon: 'idea', label: 'Idée' },
  view_conversation: { icon: 'chat', label: 'Consultation conversation' },
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
    chat: <><path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-4 4v-4H6a2 2 0 0 1-2-2Z" /><path d="M8 8.5h8M8 12h5" /></>,
    chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
    alert: <><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: '-3px', flexShrink: 0 }}>
      {p[name] || <circle cx="12" cy="12" r="9" />}
    </svg>
  );
}

export default function Supervision({ initialTab = 'stats' }: { initialTab?: 'activity' | 'products' | 'users' | 'stats' | 'ideas' | 'reports' }) {
  const { profile, user, adminProducts, adminProfiles, activityLogs, loadAdminData, setUserRole, deleteUser, fetchConversation, fetchStatsData, replyToIdea } = useWorkshopStore();
  const [tab, setTab] = useState<'activity' | 'products' | 'users' | 'stats' | 'ideas' | 'reports'>(initialTab);
  const [statsData, setStatsData] = useState<Array<{ status: string; currentStep: number; msgSteps: number[] }> | null>(null);

  useEffect(() => {
    if (tab === 'stats' && statsData === null) fetchStatsData().then(setStatsData);
  }, [tab, statsData, fetchStatsData]);

  const stats = useMemo(() => {
    if (!statsData) return null;
    const total = statsData.length;
    const completed = statsData.filter(p => p.status === 'completed').length;
    const active = total - completed;
    const stuckByStep: Record<number, number> = {};
    const msgByStep: Record<number, number> = {};
    let totalMsgs = 0;
    statsData.forEach(p => {
      if (p.status !== 'completed') stuckByStep[p.currentStep] = (stuckByStep[p.currentStep] || 0) + 1;
      p.msgSteps.forEach(s => { msgByStep[s] = (msgByStep[s] || 0) + 1; totalMsgs++; });
    });
    return { total, completed, active, stuckByStep, msgByStep, totalMsgs, avgMsgs: total ? Math.round(totalMsgs / total) : 0, completionRate: total ? Math.round((completed / total) * 100) : 0 };
  }, [statsData]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [fUser, setFUser] = useState('all');
  const [fAction, setFAction] = useState('all');
  const [fDetail, setFDetail] = useState('');
  const [uSearch, setUSearch] = useState('');
  const [uRole, setURole] = useState('all');
  const [delUser, setDelUser] = useState<{ id: string; label: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [ideaModal, setIdeaModal] = useState<import('@/lib/types').ActivityLog | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyBusy, setReplyBusy] = useState(false);
  const [replySent, setReplySent] = useState(false);

  async function sendReply() {
    if (!ideaModal || !replyText.trim()) return;
    setReplyBusy(true);
    await replyToIdea(ideaModal.user_id || '', ideaModal.user_email || '', replyText.trim(), ideaModal.detail || '');
    setReplyBusy(false);
    setReplySent(true);
    setReplyText('');
    setTimeout(() => { setIdeaModal(null); setReplySent(false); }, 1600);
  }

  const [conv, setConv] = useState<{ name: string; owner: string } | null>(null);
  const [convMsgs, setConvMsgs] = useState<import('@/lib/types').ChatMessage[] | null>(null);
  const [convSearch, setConvSearch] = useState('');
  const [convStepF, setConvStepF] = useState('all');

  async function openConversation(id: string, name: string, owner: string) {
    setConv({ name, owner });
    setConvMsgs(null);
    setConvSearch('');
    setConvStepF('all');
    const msgs = await fetchConversation(id);
    setConvMsgs(msgs);
  }

  useEffect(() => {
    if (!toast) return;
    const tm = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(tm);
  }, [toast]);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  async function changeRole(id: string, currentRole: string) {
    setBusyId(id);
    const err = await setUserRole(id, currentRole === 'admin' ? 'user' : 'admin');
    setBusyId(null);
    if (err) setToast(`Échec du changement de rôle : ${err}`);
  }
  async function toggleBan(id: string, currentRole: string) {
    setBusyId(id);
    const err = await setUserRole(id, currentRole === 'banned' ? 'user' : 'banned');
    setBusyId(null);
    if (err) setToast(`Échec du bannissement : ${err}`);
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
    { key: 'stats', icon: 'chart', label: 'Statistiques' },
    { key: 'activity', icon: 'clock', label: `Activité (${activityLogs.length})` },
    { key: 'products', icon: 'box', label: `Data Products (${adminProducts.length})` },
    { key: 'users', icon: 'users', label: `Utilisateurs (${adminProfiles.length})` },
    { key: 'ideas', icon: 'idea', label: `Idées (${activityLogs.filter(l => l.action === 'idea').length})` },
    { key: 'reports', icon: 'alert', label: `Signalements IA (${activityLogs.filter(l => l.action === 'report_ai').length})` },
  ];

  const ideas = activityLogs.filter(l => l.action === 'idea');
  const reports = activityLogs.filter(l => l.action === 'report_ai');

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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Utilisateurs', value: adminProfiles.length, icon: 'users', color: '#2563EB', go: 'users' as typeof tab },
          { label: 'Data Products', value: adminProducts.length, icon: 'box', color: '#059669', go: 'products' as typeof tab },
          { label: 'Terminés', value: adminProducts.filter(p => p.status === 'completed').length, icon: 'check', color: '#0D9488', go: 'products' as typeof tab },
          { label: 'Actions enregistrées', value: activityLogs.length, icon: 'clock', color: '#7C3AED', go: 'activity' as typeof tab },
        ].map(s => (
          <div
            key={s.label}
            onClick={() => setTab(s.go)}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.10)'; e.currentTarget.style.borderColor = s.color; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'var(--border)'; }}
            style={{ position: 'relative', overflow: 'hidden', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '18px 20px', cursor: 'pointer', transition: 'transform .18s, box-shadow .18s, border-color .18s' }}
          >
            <div style={{ position: 'absolute', top: -20, right: -20, width: 78, height: 78, borderRadius: '50%', background: s.color, opacity: 0.07 }} />
            <div style={{ width: 40, height: 40, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', background: s.color + '1A', color: s.color, marginBottom: 10 }}><SIcon name={s.icon} size={22} /></div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>{s.value}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 3, fontWeight: 500 }}>{s.label} <span style={{ color: s.color }}>›</span></div>
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
            <thead><tr><th style={th}>Produit</th><th style={th}>Domaine</th><th style={th}>Propriétaire</th><th style={th}>Statut</th><th style={th}>Mis à jour</th><th style={{ ...th, textAlign: 'right' }}>Conversation</th></tr></thead>
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
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>{fmt(p.updated_at)}</td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <button className="suggested-chip" onClick={() => openConversation(p.id, p.name || 'Sans nom', p.owner_email || '')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <SIcon name="chat" size={14} /> Voir
                    </button>
                  </td>
                </tr>
              ))}
              {adminProducts.length === 0 && <tr><td style={td} colSpan={6}>Aucun Data Product.</td></tr>}
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

        {tab === 'stats' && (
          <div>
            {!stats ? (
              <div style={{ padding: 24, color: 'var(--text-muted)', fontSize: 13 }}>Chargement des statistiques…</div>
            ) : (
              <>
                {/* Donut de complétion + KPI colorés + point de friction */}
                {(() => {
                  const rr = 46, cc = 2 * Math.PI * rr;
                  const offC = cc - (stats.completionRate / 100) * cc;
                  const frictionId = Object.entries(stats.stuckByStep).sort((a, b) => b[1] - a[1])[0];
                  const frictionStep = frictionId && Number(frictionId[1]) > 0 ? STEPS.find(s => s.id === Number(frictionId[0])) : null;
                  const chattyId = Object.entries(stats.msgByStep).sort((a, b) => b[1] - a[1])[0];
                  const chattyStep = chattyId ? STEPS.find(s => s.id === Number(chattyId[0])) : null;
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 280px) 1fr', gap: 16, marginBottom: 18, alignItems: 'stretch' }} className="sv-stats-top">
                      {/* Donut complétion */}
                      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        <div style={{ fontWeight: 700, fontSize: 13.5, alignSelf: 'flex-start' }}>Complétion globale</div>
                        <svg width="130" height="130" viewBox="0 0 120 120">
                          <circle cx="60" cy="60" r={rr} fill="none" stroke="var(--bg-elevated)" strokeWidth="12" />
                          <circle cx="60" cy="60" r={rr} fill="none" stroke="#059669" strokeWidth="12" strokeLinecap="round" strokeDasharray={cc} strokeDashoffset={offC} transform="rotate(-90 60 60)" style={{ transition: 'stroke-dashoffset .8s ease' }} />
                          <text x="60" y="58" textAnchor="middle" fontSize="28" fontWeight="800" fill="var(--text)">{stats.completionRate}%</text>
                          <text x="60" y="76" textAnchor="middle" fontSize="11" fill="var(--text-muted)">terminés</text>
                        </svg>
                        <div style={{ display: 'flex', gap: 14, fontSize: 12 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: 2, background: '#059669' }} /> {stats.completed} terminés</span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--bg-elevated)', border: '1px solid var(--border)' }} /> {stats.active} en cours</span>
                        </div>
                      </div>
                      {/* KPI + insights */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
                          {[
                            { label: 'Data Products', value: stats.total, c: '#059669' },
                            { label: 'En cours', value: stats.active, c: '#D97706' },
                            { label: 'Terminés', value: stats.completed, c: '#0D9488' },
                            { label: 'Messages/produit', value: stats.avgMsgs, c: '#7C3AED' },
                          ].map(k => (
                            <div key={k.label} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '13px 14px 13px 17px', position: 'relative', overflow: 'hidden' }}>
                              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: k.c }} />
                              <div style={{ fontSize: 25, fontWeight: 800, color: k.c, letterSpacing: -0.3 }}>{k.value}</div>
                              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{k.label}</div>
                            </div>
                          ))}
                        </div>
                        {/* Insights parlants */}
                        {frictionStep && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.3)', borderRadius: 10, padding: '11px 14px', fontSize: 13 }}>
                            <span style={{ fontSize: 16 }}>⚠️</span>
                            <span><strong>Point de friction :</strong> la plupart des produits non terminés s’arrêtent à l’étape <strong>{frictionStep.id}. {frictionStep.titleShort}</strong> ({frictionId[1]} produit{Number(frictionId[1]) > 1 ? 's' : ''}). À simplifier en priorité.</span>
                          </div>
                        )}
                        {chattyStep && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--primary-glow)', border: '1px solid var(--border-active)', borderRadius: 10, padding: '11px 14px', fontSize: 13 }}>
                            <span style={{ fontSize: 16 }}>💬</span>
                            <span><strong>Étape la plus bavarde :</strong> <strong>{chattyStep.id}. {chattyStep.titleShort}</strong> ({chattyId[1]} messages) — questions peut-être peu claires.</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
                  {/* Où les utilisateurs s'arrêtent */}
                  <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 }}>
                    <div style={{ fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}><span>🚧</span> Où les utilisateurs s&apos;arrêtent</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>Produits <strong>non terminés</strong> par étape courante. L&apos;étape la plus haute = point d&apos;abandon.</div>
                    {(() => { const max = Math.max(1, ...Object.values(stats.stuckByStep)); return STEPS.map(s => {
                      const v = stats.stuckByStep[s.id] || 0;
                      const isMax = v > 0 && v === max;
                      return (
                        <div key={s.id} onClick={() => setTab('products')} title="Voir les Data Products" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, cursor: 'pointer' }}>
                          <div style={{ width: 120, fontSize: 12, fontWeight: isMax ? 700 : 400, color: isMax ? 'var(--accent-amber)' : 'var(--text-secondary)', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.id}. {s.titleShort}</div>
                          <div style={{ flex: 1, background: 'var(--bg-elevated)', borderRadius: 6, height: 18 }}>
                            <div style={{ width: `${(v / max) * 100}%`, background: isMax ? 'linear-gradient(90deg,#F59E0B,#D97706)' : 'rgba(217,119,6,0.4)', height: '100%', borderRadius: 6, minWidth: v > 0 ? 5 : 0, transition: 'width .5s' }} />
                          </div>
                          <div style={{ width: 26, fontSize: 12.5, fontWeight: 700, color: isMax ? 'var(--accent-amber)' : 'var(--text)' }}>{v}</div>
                        </div>
                      );
                    }); })()}
                  </div>

                  {/* Volume de messages par étape */}
                  <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 }}>
                    <div style={{ fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}><span>💬</span> Volume de messages par étape</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>Messages échangés à chaque étape (une étape « bavarde » = à optimiser).</div>
                    {(() => { const max = Math.max(1, ...Object.values(stats.msgByStep)); return STEPS.map(s => {
                      const v = stats.msgByStep[s.id] || 0;
                      const isMax = v > 0 && v === max;
                      return (
                        <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                          <div style={{ width: 120, fontSize: 12, fontWeight: isMax ? 700 : 400, color: isMax ? 'var(--primary)' : 'var(--text-secondary)', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.id}. {s.titleShort}</div>
                          <div style={{ flex: 1, background: 'var(--bg-elevated)', borderRadius: 6, height: 18 }}>
                            <div style={{ width: `${(v / max) * 100}%`, background: isMax ? 'linear-gradient(90deg,#047857,#0D9488)' : 'rgba(5,150,105,0.4)', height: '100%', borderRadius: 6, minWidth: v > 0 ? 5 : 0, transition: 'width .5s' }} />
                          </div>
                          <div style={{ width: 34, fontSize: 12.5, fontWeight: 700, color: isMax ? 'var(--primary)' : 'var(--text)' }}>{v}</div>
                        </div>
                      );
                    }); })()}
                  </div>
                </div>

                <button className="suggested-chip" onClick={() => { setStatsData(null); }} style={{ marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 6 }}><SIcon name="refresh" size={14} /> Recalculer</button>
              </>
            )}
          </div>
        )}

        {tab === 'ideas' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 4px' }}>
              Suggestions envoyées par les utilisateurs via le bouton 💡. {ideas.length} au total.
            </p>
            {ideas.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, border: '1px dashed var(--border)', borderRadius: 10 }}>Aucune idée envoyée pour le moment.</div>}
            {ideas.map(l => (
              <div
                key={l.id}
                onClick={() => { setIdeaModal(l); setReplyText(''); setReplySent(false); }}
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderLeft: '3px solid var(--accent-amber)', borderRadius: 10, padding: '12px 16px', cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-surface)'; }}
              >
                <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{l.detail || '(vide)'}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 8, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><SIcon name="users" size={13} /> {l.user_email || '—'}</span>
                  <span>· {fmt(l.created_at)}</span>
                  <span style={{ marginLeft: 'auto', color: 'var(--primary)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}><SIcon name="chat" size={13} /> Répondre</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'reports' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 4px' }}>
              Problèmes IA signalés par les utilisateurs (hallucinations, réponses fausses, comportements inattendus) via <strong>Options → Signaler un problème IA</strong>. {reports.length} au total.
            </p>
            {reports.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, border: '1px dashed var(--border)', borderRadius: 10 }}>Aucun signalement pour le moment.</div>}
            {reports.map(l => {
              // Le détail contient « [Produit · étape N/7] description | Dernier message IA: … »
              const raw = l.detail || '';
              const ctxMatch = raw.match(/^\[(.*?)\]\s*/);
              const ctx = ctxMatch ? ctxMatch[1] : '';
              const rest = ctxMatch ? raw.slice(ctxMatch[0].length) : raw;
              const [desc, martyMsg] = rest.split(/\s*\|\s*Dernier message IA:\s*/);
              return (
                <div key={l.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderLeft: '3px solid var(--accent-red)', borderRadius: 10, padding: '12px 16px' }}>
                  {ctx && <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', marginBottom: 6 }}>{ctx}</div>}
                  <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{desc || '(vide)'}</div>
                  {martyMsg && (
                    <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 11px' }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>Dernier message de Marty : </span>{martyMsg}
                    </div>
                  )}
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 8, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><SIcon name="users" size={13} /> {l.user_email || '—'}</span>
                    <span>· {fmt(l.created_at)}</span>
                  </div>
                </div>
              );
            })}
          </div>
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

      {/* Modale : détail d'une idée + réponse in-app */}
      {ideaModal && (
        <div onClick={() => setIdeaModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 'min(560px, 96%)', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.35)', padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{ color: 'var(--accent-amber)', display: 'flex' }}><SIcon name="idea" size={20} /></span>
              <h3 style={{ fontSize: 18, margin: 0, flex: 1 }}>Idée</h3>
              <button onClick={() => setIdeaModal(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 8, display: 'flex', gap: 10 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><SIcon name="users" size={13} /> {ideaModal.user_email || '—'}</span>
              <span>· {fmt(ideaModal.created_at)}</span>
            </div>
            <div style={{ fontSize: 14.5, color: 'var(--text)', lineHeight: 1.6, whiteSpace: 'pre-wrap', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginBottom: 16 }}>{ideaModal.detail || '(vide)'}</div>

            {replySent ? (
              <div style={{ textAlign: 'center', padding: '12px 0', color: 'var(--primary)', fontWeight: 600 }}>✓ Réponse envoyée — l&apos;auteur recevra une notification.</div>
            ) : (
              <>
                <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)' }}>Votre réponse (envoyée dans la plateforme)</label>
                <textarea value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Merci pour votre suggestion ! Nous…" className="chat-input" style={{ width: '100%', minHeight: 110, resize: 'vertical', padding: 12, marginTop: 6 }} autoFocus />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
                  <button className="suggested-chip" onClick={() => setIdeaModal(null)}>Annuler</button>
                  <button className="cta-btn" onClick={sendReply} disabled={!replyText.trim() || replyBusy} style={{ opacity: replyText.trim() && !replyBusy ? 1 : 0.5 }}>{replyBusy ? '…' : 'Envoyer la réponse'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modale : conversation (lecture seule) */}
      {conv && (
        <div onClick={() => { setConv(null); setConvMsgs(null); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 'min(760px, 96%)', maxHeight: '86%', display: 'flex', flexDirection: 'column', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.35)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: 'var(--primary)', display: 'flex' }}><SIcon name="chat" size={18} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{conv.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{conv.owner} · lecture seule</div>
              </div>
              <button onClick={() => { setConv(null); setConvMsgs(null); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            {convMsgs && convMsgs.filter(m => !m.content.startsWith('[SYSTÈME]')).length > 0 && (
              <div style={{ display: 'flex', gap: 8, padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
                <input value={convSearch} onChange={e => setConvSearch(e.target.value)} placeholder="Rechercher dans la conversation…" className="chat-input" style={{ flex: 1, height: 38 }} />
                <select value={convStepF} onChange={e => setConvStepF(e.target.value)} className="chat-input" style={{ height: 38, width: 150 }}>
                  <option value="all">Toutes les étapes</option>
                  {Array.from(new Set(convMsgs.map(m => m.step))).sort((a, b) => a - b).map(s => <option key={s} value={s}>Étape {s}</option>)}
                </select>
              </div>
            )}
            <div style={{ overflowY: 'auto', padding: 18, flex: 1, display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--bg-elevated)' }}>
              {convMsgs === null && <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: 24 }}>Chargement…</div>}
              {(() => {
                if (!convMsgs) return null;
                const visible = convMsgs
                  .filter(m => !m.content.startsWith('[SYSTÈME]'))
                  .filter(m => convStepF === 'all' || String(m.step) === convStepF)
                  .filter(m => !convSearch || m.content.toLowerCase().includes(convSearch.toLowerCase()));
                if (visible.length === 0) return <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: 24 }}>{convMsgs.filter(m => !m.content.startsWith('[SYSTÈME]')).length === 0 ? 'Aucun message dans cette conversation.' : 'Aucun message pour ce filtre.'}</div>;
                return visible.map(m => {
                const isUser = m.role === 'user';
                const text = m.content.replace(/```json:extract[\s\S]*?```/g, '').trim();
                if (!text) return null;
                return (
                  <div key={m.id} style={{ alignSelf: isUser ? 'flex-end' : 'flex-start', maxWidth: '82%' }}>
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 3, textAlign: isUser ? 'right' : 'left' }}>
                      {isUser ? (conv.owner || 'Utilisateur') : 'Marty'} · étape {m.step}
                    </div>
                    <div style={{ whiteSpace: 'pre-wrap', fontSize: 13.5, lineHeight: 1.55, padding: '10px 14px', borderRadius: isUser ? '14px 4px 14px 14px' : '4px 14px 14px 14px', background: isUser ? 'var(--primary)' : 'var(--bg-surface)', color: isUser ? '#fff' : 'var(--text)', border: isUser ? 'none' : '1px solid var(--border)' }}>
                      {text}
                    </div>
                  </div>
                );
                });
              })()}
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 200, background: 'var(--bg-code, #1f2430)', color: '#fff', padding: '12px 18px', borderRadius: 10, boxShadow: '0 12px 30px rgba(0,0,0,0.35)', fontSize: 13.5, maxWidth: 'min(640px, 92vw)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></svg>
          <span>{toast}</span>
          <button onClick={() => setToast(null)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 16, marginLeft: 4 }}>✕</button>
        </div>
      )}
    </div>
  );
}
