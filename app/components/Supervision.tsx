'use client';

import { useEffect, useState } from 'react';
import { useWorkshopStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';

const ACTION_LABELS: Record<string, string> = {
  login: '🔑 Connexion',
  logout: '🚪 Déconnexion',
  signup: '🆕 Inscription',
  create_product: '➕ Création produit',
  complete_product: '✅ Atelier terminé',
  delete_product: '🗑️ Suppression produit',
};

export default function Supervision({ initialTab = 'activity' }: { initialTab?: 'activity' | 'products' | 'users' }) {
  const { profile, user, adminProducts, adminProfiles, activityLogs, loadAdminData } = useWorkshopStore();
  const [tab, setTab] = useState<'activity' | 'products' | 'users'>(initialTab);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  async function changeRole(id: string, currentRole: string) {
    if (!supabase) return;
    setBusyId(id);
    const next = currentRole === 'admin' ? 'user' : 'admin';
    await supabase.from('profiles').update({ role: next }).eq('id', id);
    await loadAdminData();
    setBusyId(null);
  }

  if (profile?.role !== 'admin') {
    return (
      <div className="empty-state" style={{ padding: 48 }}>
        <div className="empty-state-icon">🔒</div>
        <div className="empty-state-text">Accès réservé aux administrateurs.</div>
      </div>
    );
  }

  function fmt(ts: string) {
    return new Date(ts).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  const tabs: { key: typeof tab; label: string }[] = [
    { key: 'activity', label: `🕑 Activité (${activityLogs.length})` },
    { key: 'products', label: `📦 Data Products (${adminProducts.length})` },
    { key: 'users', label: `👥 Utilisateurs (${adminProfiles.length})` },
  ];

  const th: React.CSSProperties = { padding: '10px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap', borderBottom: '2px solid var(--border)' };
  const td: React.CSSProperties = { padding: '8px 12px', borderBottom: '1px solid var(--border)' };

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
      <h2 style={{ fontSize: 22, marginBottom: 4 }}>Supervision de la plateforme</h2>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
        Vue administrateur : activité des utilisateurs, ensemble des Data Products et comptes.
      </p>

      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Utilisateurs', value: adminProfiles.length, icon: '👥' },
          { label: 'Data Products', value: adminProducts.length, icon: '📦' },
          { label: 'Terminés', value: adminProducts.filter(p => p.status === 'completed').length, icon: '✅' },
          { label: 'Actions enregistrées', value: activityLogs.length, icon: '🕑' },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ flex: 1 }}>
            <div style={{ fontSize: 22 }}>{s.icon}</div>
            <div className="stat-value" style={{ fontSize: 26 }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {tabs.map(t => (
          <button key={t.key} className="suggested-chip"
            style={tab === t.key ? { background: 'var(--primary-glow)', borderColor: 'var(--border-active)', color: 'var(--primary-light)' } : {}}
            onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
        <button className="suggested-chip" onClick={() => loadAdminData()} style={{ marginLeft: 'auto' }}>🔄 Actualiser</button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        {tab === 'activity' && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr><th style={th}>Date</th><th style={th}>Utilisateur</th><th style={th}>Action</th><th style={th}>Détail</th></tr></thead>
            <tbody>
              {activityLogs.map(l => (
                <tr key={l.id}>
                  <td style={td}>{fmt(l.created_at)}</td>
                  <td style={td}>{l.user_email || '—'}</td>
                  <td style={td}>{ACTION_LABELS[l.action] || l.action}</td>
                  <td style={{ ...td, color: 'var(--text-secondary)' }}>{l.detail || ''}</td>
                </tr>
              ))}
              {activityLogs.length === 0 && <tr><td style={td} colSpan={4}>Aucune activité enregistrée.</td></tr>}
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
            <thead><tr><th style={th}>Nom</th><th style={th}>Email</th><th style={th}>Rôle</th><th style={th}>Inscrit le</th><th style={th}>Actions</th></tr></thead>
            <tbody>
              {adminProfiles.map(u => (
                <tr key={u.id}>
                  <td style={{ ...td, fontWeight: 600 }}>{u.full_name || '—'}</td>
                  <td style={td}>{u.email}</td>
                  <td style={td}>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: u.role === 'admin' ? '#fde68a' : 'var(--border)', color: u.role === 'admin' ? '#92400e' : 'var(--text-secondary)' }}>
                      {u.role}
                    </span>
                  </td>
                  <td style={td}>{fmt(u.created_at)}</td>
                  <td style={td}>
                    {u.id === user?.id ? (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>vous</span>
                    ) : (
                      <button className="suggested-chip" disabled={busyId === u.id} onClick={() => changeRole(u.id, u.role)}>
                        {busyId === u.id ? '…' : u.role === 'admin' ? '↓ Rétrograder' : '↑ Promouvoir admin'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
