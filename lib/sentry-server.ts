// ============================================================
// Mart Studio — Capture d'erreurs serveur (Sentry, optionnel)
// Actif uniquement si SENTRY_DSN est défini. Sinon no-op silencieux.
// ============================================================
import * as Sentry from '@sentry/node';

let inited = false;
function ensureInit() {
  if (inited) return;
  inited = true;
  const dsn = process.env.SENTRY_DSN;
  if (dsn) {
    Sentry.init({
      dsn,
      tracesSampleRate: 0, // pas de tracing perf (uniquement les erreurs)
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
    });
  }
}

export function captureServerError(err: unknown, context?: Record<string, unknown>) {
  try {
    if (!process.env.SENTRY_DSN) return;
    ensureInit();
    Sentry.captureException(err, context ? { extra: context } : undefined);
  } catch {
    /* ne jamais faire échouer une requête à cause du logging */
  }
}
