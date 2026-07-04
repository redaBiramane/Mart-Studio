'use client';

import { useEffect } from 'react';

// Capture globale des erreurs client (erreurs JS non catchées + promesses rejetées)
// et les envoie à /api/client-error (→ logs serveur / Vercel). Silencieux et sans dépendance.
export function report(kind: string, message: string, stack?: string) {
  try {
    fetch('/api/client-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, message, stack, url: typeof location !== 'undefined' ? location.href : '' }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}

export default function ErrorReporter() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => report('window.onerror', e.message, e.error?.stack);
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason;
      report('unhandledrejection', r?.message || String(r), r?.stack);
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);
  return null;
}
