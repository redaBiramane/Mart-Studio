'use client';

import { useState } from 'react';
import { useWorkshopStore } from '@/lib/store';

export default function Login({ onBack, initialMode = 'login' }: { onBack?: () => void; initialMode?: 'login' | 'signup' }) {
  const { signIn, signUp, resetPassword, authError } = useWorkshopStore();
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
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

  async function onForgot() {
    setInfo(null);
    const target = email.trim();
    if (!target) { setInfo('Saisissez votre email ci-dessus, puis cliquez à nouveau sur « Mot de passe oublié ».'); return; }
    setBusy(true);
    const err = await resetPassword(target);
    setBusy(false);
    setInfo(err ? err : `Un email de réinitialisation a été envoyé à ${target}.`);
  }

  const input: React.CSSProperties = {
    width: '100%', height: 46, padding: '0 14px', fontSize: 14.5, color: '#0B2A22',
    background: '#F4F8F6', border: '1.5px solid #D8E5DE', borderRadius: 11, outline: 'none',
  };
  const label: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: '#33493F' };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#EDF3F0', fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' }}>
      {/* Panneau gauche — marque CA */}
      <div className="login-brandpane" style={{
        flex: '0 0 46%', position: 'relative', overflow: 'hidden', color: '#fff', padding: '48px 52px',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        background: 'linear-gradient(155deg,#04382d 0%,#075a44 48%,#0e8266 100%)',
      }}>
        <div style={{ position: 'absolute', top: -80, right: -60, width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle,rgba(18,181,165,.35),transparent 65%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -120, left: -60, width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle,rgba(255,255,255,.08),transparent 65%)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 18 }}>
          <span style={{ background: '#fff', borderRadius: 14, padding: '14px 18px', display: 'inline-flex', boxShadow: '0 12px 30px -12px rgba(0,0,0,0.35)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/ca-logo.png" alt="Crédit Agricole Personal Finance & Mobility" style={{ height: 54, width: 'auto', display: 'block' }} />
          </span>
          <div style={{ borderLeft: '1px solid rgba(255,255,255,0.3)', paddingLeft: 18 }}>
            <div style={{ fontWeight: 800, fontSize: 19, letterSpacing: -0.3 }}>Marty</div>
            <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9.5, letterSpacing: 1.4, opacity: 0.85 }}>SELF DATA MODELING PLATFORM</div>
          </div>
        </div>

        <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
          <div style={{
            background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.20)', borderRadius: 26,
            padding: '40px 42px 34px', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            maxWidth: 480, width: '100%', textAlign: 'center', boxShadow: '0 34px 70px -34px rgba(0,0,0,0.55)',
          }}>
            <div style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 52, lineHeight: 0.6, color: 'rgba(255,255,255,0.45)' }}>&ldquo;</div>
            <p style={{ fontSize: 23, lineHeight: 1.42, fontWeight: 700, letterSpacing: -0.3, margin: '10px 0 28px', color: '#fff' }}>
              De l&apos;idée métier au Produit Data complet — MCD, SQL, dbt et documentation, en quelques minutes.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 13 }}>
              <span style={{ width: 44, height: 44, borderRadius: '50%', background: '#fff', color: '#065F46', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 19, flexShrink: 0 }}>M</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 700, fontSize: 14.5 }}>Marty</div>
                <div style={{ fontSize: 12.5, opacity: 0.82 }}>Data Architect IA · Sofinco</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ position: 'relative', fontSize: 12, opacity: 0.8 }}>
          Sofinco · Crédit Agricole Personal Finance &amp; Mobility
        </div>
      </div>

      {/* Panneau droit — formulaire */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 28, position: 'relative' }}>
        {onBack && (
          <button onClick={onBack} style={{ position: 'absolute', top: 22, right: 26, background: 'none', border: 'none', cursor: 'pointer', color: '#6B8378', fontSize: 13.5, fontWeight: 600 }}>
            ← Accueil
          </button>
        )}
        <div style={{ width: 'min(400px, 100%)' }}>
          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11.5, letterSpacing: 2, color: '#0F766E', fontWeight: 600, marginBottom: 10 }}>
            {mode === 'login' ? 'CONNEXION' : 'COMMENCER'}
          </div>
          <h2 style={{ fontSize: 30, fontWeight: 800, letterSpacing: -0.5, color: '#0B2A22', margin: '0 0 8px', lineHeight: 1.1 }}>
            {mode === 'login' ? 'Bon retour.' : 'Essayez Marty gratuitement.'}
          </h2>
          <p style={{ fontSize: 14.5, color: '#4A6459', margin: '0 0 26px', lineHeight: 1.5 }}>
            {mode === 'login' ? 'Connectez-vous pour accéder à votre atelier.' : 'Modèle Gemini gratuit inclus. Aucune carte requise.'}
          </p>

          <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
            {mode === 'signup' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <label style={label}>Nom complet</label>
                <input style={input} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Prénom Nom" />
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <label style={label}>Email</label>
              <input style={input} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@sofinco.fr" autoComplete="email" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <label style={label}>Mot de passe</label>
              <input style={input} type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
              {mode === 'login' && (
                <div style={{ textAlign: 'right' }}>
                  <button type="button" onClick={onForgot} disabled={busy} style={{ background: 'none', border: 'none', color: '#0F766E', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, padding: 0 }}>Mot de passe oublié ?</button>
                </div>
              )}
            </div>

            {authError && <div style={{ fontSize: 13, color: '#DC2626' }}>{authError}</div>}
            {info && <div style={{ fontSize: 13, color: '#0F766E' }}>{info}</div>}

            <button type="submit" disabled={busy} style={{ marginTop: 4, height: 48, borderRadius: 11, border: 'none', cursor: busy ? 'default' : 'pointer', background: '#065F46', color: '#fff', fontWeight: 700, fontSize: 15, opacity: busy ? 0.7 : 1, boxShadow: '0 10px 24px -12px rgba(6,95,70,.9)' }}>
              {busy ? '…' : mode === 'login' ? 'Se connecter' : 'Créer mon compte →'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: 18, fontSize: 13.5, color: '#4A6459' }}>
            {mode === 'login' ? (
              <>Pas encore de compte ?{' '}
                <button onClick={() => { setMode('signup'); setInfo(null); }} style={{ background: 'none', border: 'none', color: '#0F766E', cursor: 'pointer', fontWeight: 700 }}>S&apos;inscrire</button>
              </>
            ) : (
              <>Déjà un compte ?{' '}
                <button onClick={() => { setMode('login'); setInfo(null); }} style={{ background: 'none', border: 'none', color: '#0F766E', cursor: 'pointer', fontWeight: 700 }}>Se connecter</button>
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 860px){ .login-brandpane{ display:none !important; } }
      `}</style>
    </div>
  );
}
