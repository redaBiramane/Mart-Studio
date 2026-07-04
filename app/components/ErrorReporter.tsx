'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/browser';

// Capture globale des erreurs client. Envoie à Sentry si NEXT_PUBLIC_SENTRY_DSN
// est défini, et toujours à /api/client-error (→ logs serveur / Vercel).

// DSN Sentry (public). Surchargeable via NEXT_PUBLIC_SENTRY_DSN.
const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN || 'https://edfe07c98d650503653cff2059af75b7@o4511674588397568.ingest.de.sentry.io/4511674591281232';

let sentryInited = false;
function ensureClientSentry() {
  if (sentryInited) return;
  sentryInited = true;
  if (DSN) {
    Sentry.init({
      dsn: DSN,
      tracesSampleRate: 0,
      environment: process.env.NEXT_PUBLIC_VERCEL_ENV || 'production',
    });
  }
}

export function report(kind: string, message: string, stack?: string) {
  // Sentry (si configuré)
  try {
    ensureClientSentry();
    if (DSN) {
      const err = new Error(message || kind);
      if (stack) err.stack = stack;
      Sentry.captureException(err, { tags: { kind } });
    }
  } catch {
    /* ignore */
  }
  // Log serveur (toujours — fallback Vercel)
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
    ensureClientSentry();
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
