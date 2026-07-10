'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useWorkshopStore } from '@/lib/store';
import { useI18n, localeCode } from '@/lib/i18n';

interface Props {
  onNew: () => void;
  onOpenWorkshop: (id: string) => void;
  onOpenDeliverables: (id: string) => void;
}

type SortKey = 'recent' | 'oldest' | 'name' | 'entities' | 'progress';

function Ico({ name, size = 15 }: { name: string; size?: number }) {
  const p: Record<string, React.ReactNode> = {
    plus: <><path d="M12 5v14M5 12h14" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>,
    open: <><path d="M4 5a2 2 0 0 1 2-2h5l2 2h5a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" /></>,
    deliverables: <><path d="M21 8 12 3 3 8l9 5 9-5Z" /><path d="M3 8v8l9 5 9-5V8" /></>,
    edit: <><path d="M4 20h4l10-10-4-4L4 16v4Z" /><path d="M13.5 6.5l4 4" /></>,
    copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></>,
    trash: <><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" /></>,
    share: <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>{p[name]}</svg>;
}

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
  const { sessions, deleteSession, loadSession, updateSessionData, duplicateSession, sharedInfo } = useWorkshopStore();
  const { t, lang } = useI18n();
  const [q, setQ] = useState('');
  const [shareTarget, setShareTarget] = useState<{ id: string; name: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [domainFilter, setDomainFilter] = useState('all');
  const [sort, setSort] = useState<SortKey>('recent');
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

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
    return new Date(ts).toLocaleDateString(localeCode(lang), { day: '2-digit', month: 'short', year: 'numeric' });
  }
  function rename(id: string, current: string) {
    setRenameId(id);
    setRenameValue(current);
  }
  function doRename() {
    if (renameId && renameValue.trim()) {
      loadSession(renameId);
      updateSessionData({ productName: renameValue.trim() });
    }
    setRenameId(null);
  }
  function confirmDelete(id: string, name: string) {
    setDeleteTarget({ id, name });
  }
  function doDelete() {
    if (deleteTarget) deleteSession(deleteTarget.id);
    setDeleteTarget(null);
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
          <h2 style={{ fontSize: 22, margin: 0 }}>{t('dp.title')}</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>{t('dp.subtitle')}</p>
        </div>
        <button className="cta-btn" onClick={onNew} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Ico name="plus" size={17} /> {t('dp.new')}</button>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { label: t('dp.total'), value: sessions.length, icon: 'total' },
          { label: t('dp.active'), value: active, icon: 'active' },
          { label: t('dp.completed'), value: completed, icon: 'done' },
          { label: t('dp.domains'), value: domains.length, icon: 'domains' },
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
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', display: 'flex' }}><Ico name="search" size={16} /></span>
          <input
            className="chat-input"
            placeholder={t('dp.search')}
            value={q}
            onChange={e => setQ(e.target.value)}
            style={{ width: '100%', height: 40, paddingLeft: 34 }}
          />
        </div>
        <select className="chat-input" style={{ height: 40, width: 160 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value as 'all' | 'active' | 'completed')}>
          <option value="all">{t('dp.allStatuses')}</option>
          <option value="active">{t('dp.statusActive')}</option>
          <option value="completed">{t('dp.statusCompleted')}</option>
        </select>
        <select className="chat-input" style={{ height: 40, width: 180 }} value={domainFilter} onChange={e => setDomainFilter(e.target.value)}>
          <option value="all">{t('dp.allDomains')}</option>
          {domains.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select className="chat-input" style={{ height: 40, width: 170 }} value={sort} onChange={e => setSort(e.target.value as SortKey)}>
          <option value="recent">{t('dp.sortRecent')}</option>
          <option value="oldest">{t('dp.sortOldest')}</option>
          <option value="name">{t('dp.sortName')}</option>
          <option value="entities">{t('dp.sortEntities')}</option>
          <option value="progress">{t('dp.sortProgress')}</option>
        </select>
      </div>

      {list.length === 0 ? (
        <div className="empty-state" style={{ padding: 48 }}>
          <div className="empty-state-icon" style={{ display: 'flex', justifyContent: 'center', color: 'var(--text-muted)' }}>
            <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /></svg>
          </div>
          <div className="empty-state-text">
            {sessions.length === 0 ? t('dp.emptyNone') : t('dp.emptyFilter')}
          </div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={th}>{t('dp.colProduct')}</th><th style={th}>{t('dp.colDomain')}</th><th style={th}>{t('dp.colStatus')}</th>
              <th style={th}>{t('dp.colProgress')}</th><th style={th}>{t('dp.colEntities')}</th><th style={th}>{t('dp.colUpdated')}</th><th style={{ ...th, textAlign: 'right' }}>{t('dp.colActions')}</th>
            </tr></thead>
            <tbody>
              {list.map(s => {
                const shared = sharedInfo[s.id];
                return (
                <tr key={s.id}>
                  <td style={{ ...td, fontWeight: 600 }}>
                    {s.productName || t('dp.noName')}
                    {shared && (
                      <span title={`Partagé par ${shared.ownerEmail}`} style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 600, padding: '2px 7px', borderRadius: 999, background: 'var(--primary-glow)', color: 'var(--primary-light)', whiteSpace: 'nowrap' }}>
                        {shared.role === 'viewer' ? 'Partagé · lecture' : 'Partagé · édition'}
                      </span>
                    )}
                  </td>
                  <td style={{ ...td, color: 'var(--text-secondary)' }}>{s.domain || '—'}</td>
                  <td style={td}>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: s.status === 'completed' ? 'var(--primary-glow)' : 'var(--bg-elevated)', color: s.status === 'completed' ? 'var(--primary-light)' : 'var(--text-secondary)' }}>
                      {s.status === 'completed' ? t('dp.rowDone') : t('dp.rowActive')}
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
                      <button style={{ ...iconBtn, display: 'inline-flex', alignItems: 'center', gap: 5 }} title={t('dp.open')} onClick={() => onOpenWorkshop(s.id)}><Ico name="open" /> {t('dp.open')}</button>
                      {s.entities.length > 0 && <button style={{ ...iconBtn, display: 'inline-flex', alignItems: 'center', gap: 5 }} title={t('dp.deliverables')} onClick={() => onOpenDeliverables(s.id)}><Ico name="deliverables" /> {t('dp.deliverables')}</button>}
                      <button style={{ ...iconBtn, display: 'inline-flex', alignItems: 'center' }} title={t('dp.duplicateTitle')} onClick={() => duplicateSession(s.id)}><Ico name="copy" /></button>
                      {/* Actions réservées au PROPRIÉTAIRE (produits non partagés-avec-moi) */}
                      {!shared && <button style={{ ...iconBtn, display: 'inline-flex', alignItems: 'center', gap: 5 }} title="Partager avec un collègue" onClick={() => setShareTarget({ id: s.id, name: s.productName || t('dp.noName') })}><Ico name="share" /> Partager</button>}
                      {!shared && <button style={{ ...iconBtn, display: 'inline-flex', alignItems: 'center' }} title={t('dp.renameTitle')} onClick={() => rename(s.id, s.productName)}><Ico name="edit" /></button>}
                      {!shared && <button style={{ ...iconBtn, color: 'var(--accent-red)', display: 'inline-flex', alignItems: 'center' }} title={t('dp.deleteTitle')} onClick={() => confirmDelete(s.id, s.productName)}><Ico name="trash" /></button>}
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modale : renommer */}
      {renameId && (
        <div onClick={() => setRenameId(null)} style={overlay}>
          <div onClick={e => e.stopPropagation()} style={modalBox}>
            <h3 style={{ fontSize: 17, margin: '0 0 14px' }}>{t('dp.renamePrompt')}</h3>
            <input
              className="chat-input"
              autoFocus
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') doRename(); if (e.key === 'Escape') setRenameId(null); }}
              style={{ width: '100%', height: 42, padding: '0 12px' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
              <button className="suggested-chip" onClick={() => setRenameId(null)}>{t('dp.cancel')}</button>
              <button className="cta-btn" onClick={doRename} disabled={!renameValue.trim()} style={{ opacity: renameValue.trim() ? 1 : 0.5 }}>{t('dp.save')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modale : supprimer */}
      {deleteTarget && (
        <div onClick={() => setDeleteTarget(null)} style={overlay}>
          <div onClick={e => e.stopPropagation()} style={modalBox}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ color: 'var(--accent-red)', display: 'flex' }}><Ico name="trash" size={22} /></span>
              <h3 style={{ fontSize: 17, margin: 0 }}>{t('dp.deleteTitle')}</h3>
            </div>
            <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
              {t('dp.deleteConfirm', { name: deleteTarget.name || t('dp.thisProduct') })}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button className="suggested-chip" onClick={() => setDeleteTarget(null)}>{t('dp.cancel')}</button>
              <button onClick={doDelete} style={{ background: 'var(--accent-red)', color: '#fff', border: 'none', borderRadius: 9, padding: '10px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{t('dp.deleteTitle')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modale : partager */}
      {shareTarget && <ShareModal target={shareTarget} onClose={() => setShareTarget(null)} />}
    </div>
  );
}

function ShareModal({ target, onClose }: { target: { id: string; name: string }; onClose: () => void }) {
  const { shareProduct, unshareProduct, loadProductMembers, listShareableUsers } = useWorkshopStore();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'editor' | 'viewer'>('editor');
  const [members, setMembers] = useState<import('@/lib/types').ProductMember[]>([]);
  const [users, setUsers] = useState<{ id: string; email: string; full_name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const refresh = useCallback(async () => {
    setMembers(await loadProductMembers(target.id));
  }, [loadProductMembers, target.id]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { listShareableUsers().then(setUsers); }, [listShareableUsers]);

  // Utilisateurs de la base pas encore membres, filtrés par la recherche.
  const memberIds = new Set(members.map(m => m.user_id));
  const query = email.trim().toLowerCase();
  const available = users
    .filter(u => !memberIds.has(u.id))
    .filter(u => !query || u.email.toLowerCase().includes(query) || (u.full_name || '').toLowerCase().includes(query));
  const shown = available.slice(0, 50);

  const invite = async (targetEmail?: string, targetRole?: 'editor' | 'viewer') => {
    const e = (targetEmail ?? email).trim();
    if (!e) return;
    setBusy(true); setMsg(null);
    const res = await shareProduct(target.id, e, targetRole ?? role);
    setBusy(false);
    if (res === 'ok') {
      setMsg({ kind: 'ok', text: `Partagé avec ${e}.` });
      setEmail('');
      refresh();
    } else if (res === 'not_found') {
      setMsg({ kind: 'err', text: "Aucun compte avec cet email. Le collègue doit d'abord créer un compte sur Mart Studio." });
    } else if (res === 'self') {
      setMsg({ kind: 'err', text: 'Vous êtes déjà le propriétaire de ce produit.' });
    } else if (res === 'not_owner') {
      setMsg({ kind: 'err', text: 'Seul le propriétaire peut partager ce produit.' });
    } else if (res.startsWith('err:')) {
      const detail = res.slice(4);
      const missing = /share_product|does not exist|schema cache|function/i.test(detail);
      setMsg({ kind: 'err', text: missing
        ? "La fonction de partage n'existe pas encore côté base : exécutez le script SQL « product_members » dans Supabase (SQL Editor)."
        : `Échec : ${detail}` });
    } else {
      setMsg({ kind: 'err', text: 'Échec du partage. Réessayez.' });
    }
  };

  const remove = async (userId: string) => {
    await unshareProduct(target.id, userId);
    refresh();
  };

  // Changer le rôle d'un membre existant (share_product fait un upsert du rôle).
  const changeRole = async (userEmail: string, newRole: 'editor' | 'viewer') => {
    await shareProduct(target.id, userEmail, newRole);
    refresh();
  };

  const inputStyle: React.CSSProperties = { flex: 1, minWidth: 0, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 13.5, color: 'var(--text)' };
  const iconBtnLocal: React.CSSProperties = { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--primary-light)', whiteSpace: 'nowrap' };
  const roleSelectStyle: React.CSSProperties = { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 6px', fontSize: 11.5, color: 'var(--text)', cursor: 'pointer' };

  return (
    <div onClick={onClose} style={overlay}>
      <div onClick={e => e.stopPropagation()} style={{ ...modalBox, width: 'min(520px, 100%)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <span style={{ color: 'var(--primary)', display: 'flex' }}><Ico name="share" size={20} /></span>
          <h3 style={{ fontSize: 17, margin: 0 }}>Partager « {target.name} »</h3>
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '0 0 16px', lineHeight: 1.5 }}>
          Invitez un collègue par email. Il doit déjà avoir un compte Mart Studio. Le produit apparaîtra dans sa liste de Data Products.
        </p>

        <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
          <div style={{ position: 'relative', flex: 1, display: 'flex' }}>
            <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', display: 'flex', pointerEvents: 'none' }}><Ico name="search" size={15} /></span>
            <input
              type="text" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="Rechercher un nom ou un email…"
              onKeyDown={e => { if (e.key === 'Enter') invite(); }} style={{ ...inputStyle, paddingLeft: 32 }} autoFocus
            />
          </div>
          <select value={role} onChange={e => setRole(e.target.value as 'editor' | 'viewer')} style={{ ...inputStyle, flex: 'none', width: 120, cursor: 'pointer' }}>
            <option value="editor">Éditeur</option>
            <option value="viewer">Lecteur</option>
          </select>
          <button type="button" onClick={() => invite()} disabled={busy || !email.trim()} style={{ background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 8, padding: '0 16px', fontWeight: 700, fontSize: 13, cursor: busy ? 'default' : 'pointer', opacity: busy || !email.trim() ? 0.5 : 1, whiteSpace: 'nowrap' }}>
            {busy ? '…' : 'Inviter'}
          </button>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6 }}>
          <strong>Éditeur</strong> : peut modifier le modèle. <strong>Lecteur</strong> : consultation seule. Le rôle du menu s’applique à l’invitation.
        </div>

        {/* Liste organisée et cherchable — chaque ligne s'invite directement */}
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 6 }}>
            Utilisateurs de la base ({available.length}{shown.length < available.length ? `, ${shown.length} affichés` : ''}) — cliquez « Inviter » sur une ligne
          </div>
          {shown.length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', fontStyle: 'italic', padding: '6px 2px' }}>
              {query ? 'Aucun utilisateur ne correspond.' : 'Aucun utilisateur disponible.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 6 }}>
              {shown.map(u => (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.full_name || u.email}</div>
                    {u.full_name && <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>}
                  </div>
                  <button type="button" disabled={busy} onClick={() => invite(u.email)} style={{ ...iconBtnLocal, opacity: busy ? 0.5 : 1 }}>Inviter</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {msg && (
          <div style={{ marginTop: 12, fontSize: 12.5, padding: '9px 12px', borderRadius: 8, lineHeight: 1.45, background: msg.kind === 'ok' ? 'var(--primary-glow)' : 'rgba(220,38,38,0.08)', color: msg.kind === 'ok' ? 'var(--primary-light)' : 'var(--accent-red)' }}>
            {msg.text}
          </div>
        )}

        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>
            Personnes ayant accès ({members.length})
          </div>
          {members.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>Personne pour l’instant.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {members.map(m => (
                <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8 }}>
                  <span style={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.user_email}</span>
                  <select value={m.role} onChange={e => changeRole(m.user_email, e.target.value as 'editor' | 'viewer')} title="Changer le rôle" style={roleSelectStyle}>
                    <option value="editor">Éditeur</option>
                    <option value="viewer">Lecteur</option>
                  </select>
                  <button type="button" onClick={() => remove(m.user_id)} title="Retirer l’accès" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-red)', display: 'flex', padding: 2 }}><Ico name="trash" size={15} /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
          <button type="button" className="suggested-chip" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 };
const modalBox: React.CSSProperties = { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', width: 'min(460px, 100%)', padding: 26, boxShadow: '0 20px 60px rgba(0,0,0,0.35)' };
