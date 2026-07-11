'use client';

import { useMemo, useRef, useState } from 'react';
import { useWorkshopStore } from '@/lib/store';
import { useI18n } from '@/lib/i18n';
import { fmtTokens } from '@/lib/llm-labels';

const SWATCHES = ['#0D9488', '#047857', '#2563EB', '#7C3AED', '#DB2777', '#DC2626', '#D97706', '#0EA5E9', '#334155'];
const EMOJIS = ['', '🧑‍💻', '👩‍💼', '🧑‍🔬', '🚀', '⭐', '🦊', '🐼', '🦉', '🔷', '🎯', '🧠'];

// Avatar réutilisable : photo > emoji > initiales, sur la couleur choisie.
export function UserAvatar({ size = 40, prefs, email, name }: { size?: number; prefs: { avatarColor: string; avatarEmoji?: string; avatarPhoto?: string }; email?: string; name?: string }) {
  const initials = (name || email || '?').trim().slice(0, 2).toUpperCase();
  if (prefs.avatarPhoto) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={prefs.avatarPhoto} alt="avatar" width={size} height={size} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />;
  }
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: `linear-gradient(135deg, ${prefs.avatarColor}, ${prefs.avatarColor}cc)`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: size * (prefs.avatarEmoji ? 0.5 : 0.38), flexShrink: 0, letterSpacing: 0.3 }}>
      {prefs.avatarEmoji || initials}
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!on)} style={{ width: 42, height: 24, borderRadius: 999, border: 'none', cursor: 'pointer', background: on ? 'var(--primary)' : 'var(--bg-elevated)', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
      <span style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
    </button>
  );
}

export default function Profile() {
  const { user, profile, sessions, sharedInfo, profilePrefs, updateProfilePrefs, updateProfileName, changePassword } = useWorkshopStore();
  const { lang, setLang } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(profile?.full_name || '');
  const [nameMsg, setNameMsg] = useState<string | null>(null);
  const [nameBusy, setNameBusy] = useState(false);

  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [pwBusy, setPwBusy] = useState(false);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => (typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'));

  const isAdmin = profile?.role === 'admin';
  const stats = useMemo(() => {
    const mine = sessions.filter((s) => !sharedInfo[s.id]);
    const tokens = mine.reduce((a, s) => a + (s.tokenUsage?.total || 0), 0);
    return { products: mine.length, tokens };
  }, [sessions, sharedInfo]);

  const saveName = async () => {
    setNameBusy(true); setNameMsg(null);
    const err = await updateProfileName(name.trim());
    setNameBusy(false);
    setNameMsg(err ? `Échec : ${err}` : '✓ Nom enregistré');
    setTimeout(() => setNameMsg(null), 2500);
  };

  const savePassword = async () => {
    if (pw1.length < 6) { setPwMsg({ ok: false, t: 'Le mot de passe doit faire au moins 6 caractères.' }); return; }
    if (pw1 !== pw2) { setPwMsg({ ok: false, t: 'Les deux mots de passe ne correspondent pas.' }); return; }
    setPwBusy(true); setPwMsg(null);
    const err = await changePassword(pw1);
    setPwBusy(false);
    if (err) setPwMsg({ ok: false, t: `Échec : ${err}` });
    else { setPwMsg({ ok: true, t: '✓ Mot de passe modifié.' }); setPw1(''); setPw2(''); }
  };

  const onPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const s = 160;
        const canvas = document.createElement('canvas');
        canvas.width = s; canvas.height = s;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const min = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - min) / 2, (img.height - min) / 2, min, min, 0, 0, s, s);
        updateProfilePrefs({ avatarPhoto: canvas.toDataURL('image/jpeg', 0.85) });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const applyTheme = (t: 'light' | 'dark') => {
    setTheme(t);
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('mart-theme', t); } catch { /* ignore */ }
  };

  const card: React.CSSProperties = { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 22, marginBottom: 18 };
  const input: React.CSSProperties = { width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 9, padding: '10px 12px', fontSize: 14, color: 'var(--text)' };
  const label: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6, display: 'block' };
  const rowBetween: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: '10px 0', borderBottom: '1px solid var(--border-light)' };
  const btnPrimary: React.CSSProperties = { background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 9, padding: '10px 18px', fontWeight: 700, fontSize: 13.5, cursor: 'pointer' };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        {/* Hero */}
        <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 20, padding: '26px 28px', marginBottom: 20, color: '#fff', background: `linear-gradient(135deg, #065F46 0%, #047857 45%, ${profilePrefs.avatarColor} 100%)`, boxShadow: '0 14px 40px rgba(4,120,87,0.25)' }}>
          <div style={{ position: 'absolute', top: -60, right: -40, width: 240, height: 240, borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }} />
          <div style={{ position: 'relative', display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <div style={{ border: '3px solid rgba(255,255,255,0.5)', borderRadius: '50%' }}>
                <UserAvatar size={84} prefs={profilePrefs} email={user?.email} name={profile?.full_name} />
              </div>
              <button type="button" onClick={() => fileRef.current?.click()} title="Changer la photo" style={{ position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: '50%', background: '#fff', color: '#065F46', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.25)' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2Z" /><circle cx="12" cy="13" r="3.5" /></svg>
              </button>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onPhoto} />
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.4 }}>{profile?.full_name || user?.email?.split('@')[0] || 'Utilisateur'}</div>
              <div style={{ fontSize: 13.5, opacity: 0.92, marginTop: 2 }}>{user?.email}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 11px', borderRadius: 999, background: 'rgba(255,255,255,0.16)' }}>{isAdmin ? '★ Administrateur' : 'Utilisateur'}</span>
                <span style={{ fontSize: 12, padding: '4px 11px', borderRadius: 999, background: 'rgba(255,255,255,0.12)' }}>📦 {stats.products} Data Products</span>
                <span style={{ fontSize: 12, padding: '4px 11px', borderRadius: 999, background: 'rgba(255,255,255,0.12)' }}>▦ {fmtTokens(stats.tokens)} tokens</span>
              </div>
            </div>
          </div>
        </div>

        {/* Profil */}
        <div style={card}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>👤 Mon profil</div>
          <label style={label}>Nom complet</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
            <input style={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Votre nom" />
            <button type="button" onClick={saveName} disabled={nameBusy} style={{ ...btnPrimary, opacity: nameBusy ? 0.6 : 1, whiteSpace: 'nowrap' }}>{nameBusy ? '…' : 'Enregistrer'}</button>
          </div>
          {nameMsg && <div style={{ fontSize: 12.5, color: nameMsg.startsWith('✓') ? 'var(--primary)' : 'var(--accent-red)', marginTop: -10, marginBottom: 12 }}>{nameMsg}</div>}

          <label style={label}>Couleur de l’avatar</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {SWATCHES.map((c) => (
              <button key={c} type="button" onClick={() => updateProfilePrefs({ avatarColor: c })} style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: profilePrefs.avatarColor === c ? '3px solid var(--text)' : '2px solid var(--border)', cursor: 'pointer' }} />
            ))}
          </div>

          <label style={label}>Emoji d’avatar (ou initiales)</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            {EMOJIS.map((e, i) => (
              <button key={i} type="button" onClick={() => updateProfilePrefs({ avatarEmoji: e })} style={{ width: 34, height: 34, borderRadius: 9, border: profilePrefs.avatarEmoji === e ? '2px solid var(--primary)' : '1px solid var(--border)', background: profilePrefs.avatarEmoji === e ? 'var(--primary-glow)' : 'var(--bg-elevated)', cursor: 'pointer', fontSize: 16 }}>{e || 'Aa'}</button>
            ))}
          </div>
          {profilePrefs.avatarPhoto && (
            <button type="button" onClick={() => updateProfilePrefs({ avatarPhoto: '' })} style={{ fontSize: 12.5, color: 'var(--accent-red)', background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>Retirer la photo importée</button>
          )}
        </div>

        {/* Sécurité */}
        <div style={card}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>🔒 Sécurité — changer le mot de passe</div>
          <label style={label}>Nouveau mot de passe</label>
          <input style={{ ...input, marginBottom: 12 }} type="password" value={pw1} onChange={(e) => setPw1(e.target.value)} placeholder="Au moins 6 caractères" autoComplete="new-password" />
          <label style={label}>Confirmer</label>
          <input style={{ ...input, marginBottom: 16 }} type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Répétez le mot de passe" autoComplete="new-password" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button type="button" onClick={savePassword} disabled={pwBusy || !pw1 || !pw2} style={{ ...btnPrimary, opacity: pwBusy || !pw1 || !pw2 ? 0.6 : 1 }}>{pwBusy ? '…' : 'Modifier le mot de passe'}</button>
            {pwMsg && <span style={{ fontSize: 12.5, color: pwMsg.ok ? 'var(--primary)' : 'var(--accent-red)' }}>{pwMsg.t}</span>}
          </div>
        </div>

        {/* Préférences */}
        <div style={card}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>⚙️ Préférences</div>

          <div style={rowBetween}>
            <div><div style={{ fontSize: 14, fontWeight: 600 }}>Thème</div><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Apparence de l’interface</div></div>
            <div style={{ display: 'inline-flex', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: 2 }}>
              {(['light', 'dark'] as const).map((t) => (
                <button key={t} type="button" onClick={() => applyTheme(t)} style={{ border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, background: theme === t ? 'var(--bg-surface)' : 'transparent', color: theme === t ? 'var(--text)' : 'var(--text-muted)' }}>{t === 'light' ? '☀ Clair' : '🌙 Sombre'}</button>
              ))}
            </div>
          </div>

          <div style={rowBetween}>
            <div><div style={{ fontSize: 14, fontWeight: 600 }}>Langue</div><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Langue de l’interface</div></div>
            <div style={{ display: 'inline-flex', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: 2 }}>
              {(['fr', 'en'] as const).map((l) => (
                <button key={l} type="button" onClick={() => setLang(l)} style={{ border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, background: lang === l ? 'var(--bg-surface)' : 'transparent', color: lang === l ? 'var(--text)' : 'var(--text-muted)' }}>{l === 'fr' ? '🇫🇷 FR' : '🇬🇧 EN'}</button>
              ))}
            </div>
          </div>

          <div style={rowBetween}>
            <div><div style={{ fontSize: 14, fontWeight: 600 }}>Mode d’atelier par défaut</div><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Pré-sélection à la création d’un Data Product</div></div>
            <select value={profilePrefs.defaultMode} onChange={(e) => updateProfilePrefs({ defaultMode: e.target.value as 'batch' | 'guided' | 'expert' })} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>
              <option value="guided">Guidé</option>
              <option value="batch">Par étape</option>
              <option value="expert">Expert</option>
            </select>
          </div>

          <div style={rowBetween}>
            <div><div style={{ fontSize: 14, fontWeight: 600 }}>Notifications — partages</div><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Invitations et demandes d’accès</div></div>
            <Toggle on={profilePrefs.notifShare} onChange={(v) => updateProfilePrefs({ notifShare: v })} />
          </div>
          <div style={rowBetween}>
            <div><div style={{ fontSize: 14, fontWeight: 600 }}>Notifications — activité produit</div><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Mises à jour et complétions</div></div>
            <Toggle on={profilePrefs.notifProduct} onChange={(v) => updateProfilePrefs({ notifProduct: v })} />
          </div>
          <div style={{ ...rowBetween, borderBottom: 'none' }}>
            <div><div style={{ fontSize: 14, fontWeight: 600 }}>Interface compacte</div><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Réduit les espacements</div></div>
            <Toggle on={profilePrefs.compact} onChange={(v) => updateProfilePrefs({ compact: v })} />
          </div>
        </div>
      </div>
    </div>
  );
}
