#!/usr/bin/env tsx
// ============================================================
// marty-cli — Client d'exemple de l'API Marty
// ------------------------------------------------------------
// Envoie une description métier à POST /api/v1/design, puis écrit
// le modèle + les livrables générés dans un dossier de sortie.
//
//   Usage :
//     npm start -- "Suivi des crédits immobiliers : clients, comptes, prêts…"
//     npm start -- --file ./brief.txt --out ./out
//     echo "…" | npm start
//
//   Configuration (variables d'environnement, cf. .env.example) :
//     MARTY_API_URL   base de l'API      (défaut http://localhost:3000)
//     MARTY_API_KEY   clé d'API          (obligatoire)
// ============================================================

import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

// Charge le fichier .env du dossier courant (tsx/node ne le fait pas seul).
function loadDotenv(): void {
  const p = resolve(process.cwd(), '.env');
  if (!existsSync(p)) return;
  for (const raw of readFileSync(p, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(k in process.env)) process.env[k] = v; // les variables déjà exportées priment
  }
}

// ---- Types du contrat d'API (sous-ensemble utile) ----
interface DesignResponse {
  product: { name: string; objective?: string; domain?: string };
  model: {
    entities: unknown[];
    attributes: unknown[];
    relations: unknown[];
    kpis: unknown[];
    rules: unknown[];
  };
  deliverables: { sql: string; dbml: string; dbt: string; dictionary: string };
  usage: { input: number; output: number; total: number };
  meta: { provider: string; model: string; entities: number; attributes: number; relations: number };
}

// ---- Petites aides ----
const C = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
};

function die(msg: string): never {
  console.error(C.red(`✗ ${msg}`));
  process.exit(1);
}

function slug(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'data-product';
}

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return '';
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString('utf8').trim();
}

// ---- Analyse des arguments ----
function parseArgs(argv: string[]) {
  const args = argv.slice(2).filter((a) => a !== 'design'); // "design" = alias de sous-commande
  const opts: { file?: string; out: string; provider?: string; text: string[] } = { out: 'out', text: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--file' || a === '-f') opts.file = args[++i];
    else if (a === '--out' || a === '-o') opts.out = args[++i];
    else if (a === '--provider' || a === '-p') opts.provider = args[++i];
    else opts.text.push(a);
  }
  return opts;
}

async function main() {
  loadDotenv();
  const url = (process.env.MARTY_API_URL || 'http://localhost:3000').replace(/\/$/, '');
  const key = process.env.MARTY_API_KEY;
  if (!key) die('MARTY_API_KEY manquante. Copiez .env.example en .env et renseignez votre clé (ou exportez la variable).');

  const opts = parseArgs(process.argv);
  let description = opts.file ? readFileSync(resolve(opts.file), 'utf8').trim() : opts.text.join(' ').trim();
  if (!description) description = await readStdin();
  if (!description || description.length < 10) {
    die('Fournissez une description métier (argument, --file <chemin>, ou via stdin).');
  }

  console.log(C.dim(`→ POST ${url}/api/v1/design`));
  console.log(C.dim(`  ${description.length} caractères • provider ${opts.provider || 'anthropic'}`));

  const t0 = Date.now();
  let res: Response;
  try {
    res = await fetch(`${url}/api/v1/design`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({ description, options: opts.provider ? { provider: opts.provider } : undefined }),
    });
  } catch (e) {
    return die(`Requête échouée : ${(e as Error).message} (l'API tourne-t-elle sur ${url} ?)`);
  }

  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json() as { error?: string }).error || ''; } catch { /* corps non-JSON */ }
    return die(`HTTP ${res.status} — ${detail || res.statusText}`);
  }

  const data = (await res.json()) as DesignResponse;
  const secs = ((Date.now() - t0) / 1000).toFixed(1);

  // ---- Écriture des livrables ----
  const dir = join(resolve(opts.out), slug(data.product.name));
  mkdirSync(dir, { recursive: true });
  const files: Record<string, string> = {
    'model.json': JSON.stringify(data.model, null, 2),
    'schema.sql': data.deliverables.sql,
    'schema.dbml': data.deliverables.dbml,
    'schema.yml': data.deliverables.dbt,
    'dictionary.md': data.deliverables.dictionary,
  };
  for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content);

  // ---- Résumé ----
  console.log(C.green(`\n✓ Modèle généré en ${secs}s`) + C.dim(` (${data.meta.model})`));
  console.log(`  ${C.bold(data.product.name)}${data.product.domain ? C.dim(` — ${data.product.domain}`) : ''}`);
  console.log(`  ${C.cyan(String(data.meta.entities))} entités • ${C.cyan(String(data.meta.attributes))} attributs • ${C.cyan(String(data.meta.relations))} relations`);
  console.log(`  ${C.dim(`tokens : ${data.usage.input} in / ${data.usage.output} out / ${data.usage.total} total`)}`);
  console.log(C.dim(`\n  Livrables écrits dans ${dir} :`));
  for (const name of Object.keys(files)) console.log(C.dim(`    • ${name}`));
}

main().catch((e) => die(e instanceof Error ? e.message : String(e)));
