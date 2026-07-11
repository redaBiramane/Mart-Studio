'use client';

import { useEffect } from 'react';

interface LandingProps {
  onEnter: (mode: 'login' | 'signup') => void;
}

// La landing officielle est servie comme page autonome (public/landing.html) et
// affichée en plein écran via une iframe isolée : aucun conflit CSS avec l'app,
// design exact conservé. Les boutons « Se connecter / S'inscrire » communiquent
// avec l'app par postMessage.
export default function Landing({ onEnter }: LandingProps) {
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const d = e.data as { source?: string; mode?: string } | null;
      if (d && d.source === 'marty-landing') {
        onEnter(d.mode === 'login' ? 'login' : 'signup');
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onEnter]);

  return (
    <iframe
      src="/landing.html"
      title="Marty — Self Data Modeling Platform"
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', border: 'none', display: 'block' }}
    />
  );
}
