// ============================================================
// Mart Studio — Capture d'erreurs serveur (Sentry, optionnel)
// Actif uniquement si SENTRY_DSN est défini. Sinon no-op silencieux.
// ============================================================
import * as Sentry from '@sentry/node';

// DSN Sentry (public). Surchargeable via la variable d'env SENTRY_DSN.
const DSN = process.env.SENTRY_DSN || 'https://edfe07c98d650503653cff2059af75b7@o4511674588397568.ingest.de.sentry.io/4511674591281232';

let inited = false;
function ensureInit() {
  if (inited) return;
  inited = true;
  if (DSN) {
    Sentry.init({
      dsn: DSN,
      tracesSampleRate: 0, // pas de tracing perf (uniquement les erreurs)
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
    });
  }
}

export function captureServerError(err: unknown, context?: Record<string, unknown>) {
  try {
    if (!DSN) return;
    ensureInit();
    Sentry.captureException(err, context ? { extra: context } : undefined);
  } catch {
    /* ne jamais faire échouer une requête à cause du logging */
  }
}
