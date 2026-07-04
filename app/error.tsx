'use client';

import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Point d'accroche pour un service de suivi d'erreurs (Sentry, etc.)
    console.error('[app] Erreur non gérée:', error);
  }, [error]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, textAlign: 'center', fontFamily: 'Inter, system-ui, sans-serif', background: '#F5F6FA', color: '#1A1A2E' }}>
      <div style={{ width: 60, height: 60, borderRadius: 16, background: '#3EE3D3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 30, color: '#13324F' }}>S</div>
      <h1 style={{ fontSize: 22, margin: 0 }}>Une erreur est survenue</h1>
      <p style={{ fontSize: 14, color: '#5A5A72', maxWidth: 440, margin: 0 }}>
        Un problème inattendu s&apos;est produit. Vous pouvez réessayer ; si cela persiste, rechargez la page.
      </p>
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button onClick={reset} style={{ background: '#006B4F', color: '#fff', border: 'none', borderRadius: 9, padding: '10px 20px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Réessayer</button>
        <button onClick={() => (window.location.href = '/')} style={{ background: '#fff', color: '#1A1A2E', border: '1px solid #E5E7EB', borderRadius: 9, padding: '10px 20px', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Accueil</button>
      </div>
    </div>
  );
}
