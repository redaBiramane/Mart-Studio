'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useWorkshopStore } from '@/lib/store';

export default function Login({ onBack }: { onBack?: () => void }) {
  const { signIn, signUp, authError } = useWorkshopStore();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setInfo(null);
    if (mode === 'login') {
      await signIn(email.trim(), password);
    } else {
      const msg = await signUp(email.trim(), password, fullName.trim() || email.trim());
      if (msg) setInfo(msg);
    }
    setBusy(false);
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg, #f3f4f6)', padding: 24 }}>
      <div className="context-card" style={{ width: 'min(420px, 100%)', padding: 32, position: 'relative' }}>
        {onBack && (
          <button onClick={onBack} style={{ position: 'absolute', top: 16, left: 16, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, fontWeight: 600 }}>
            ← Accueil
          </button>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 24 }}>
          <Image src="/sofinco-logo.svg" alt="Sofinco" width={150} height={32} style={{ width: 150, height: 32 }} />
          <h2 style={{ fontSize: 20, margin: '8px 0 0' }}>Mart Studio</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', margin: 0 }}>
            {mode === 'login' ? 'Connectez-vous pour accéder à l’atelier' : 'Créez votre compte'}
          </p>
        </div>

        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {mode === 'signup' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 600 }}>Nom complet</label>
              <input className="chat-input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Prénom Nom" />
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 600 }}>Email</label>
            <input className="chat-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.com" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 600 }}>Mot de passe</label>
            <input className="chat-input" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>

          {authError && <div style={{ fontSize: 13, color: 'var(--accent-red)' }}>{authError}</div>}
          {info && <div style={{ fontSize: 13, color: 'var(--primary)' }}>{info}</div>}

          <button type="submit" className="cta-btn" disabled={busy} style={{ marginTop: 4 }}>
            {busy ? '…' : mode === 'login' ? 'Se connecter' : 'Créer le compte'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: 'var(--text-secondary)' }}>
          {mode === 'login' ? (
            <>Pas encore de compte ?{' '}
              <button onClick={() => { setMode('signup'); setInfo(null); }} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}>S&apos;inscrire</button>
            </>
          ) : (
            <>Déjà un compte ?{' '}
              <button onClick={() => { setMode('login'); setInfo(null); }} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}>Se connecter</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
