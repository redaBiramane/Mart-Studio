// ============================================================
// Marty — Extension VSCode
// ------------------------------------------------------------
// Panneau webview : l'utilisateur décrit son idée métier, l'extension
// appelle POST /api/v1/design (API Marty) et affiche le modèle + les
// livrables (SQL, DBML, dbt, dictionnaire, ERD). Enregistrement dans le
// projet en un clic.
//
// Authentification : l'utilisateur se connecte avec le compte Marty qu'il
// possède déjà sur martstudio.it.com — aucune clé d'API à distribuer. Les
// jetons de session sont conservés dans le coffre chiffré de VSCode.
// ============================================================

import * as vscode from 'vscode';
import { createZip } from './zip';

// Jetons du compte Marty (l'utilisateur se connecte avec le compte qu'il a déjà
// sur martstudio.it.com — aucune clé d'API à distribuer).
const SECRET_ACCESS = 'marty.accessToken';
const SECRET_REFRESH = 'marty.refreshToken';
const SECRET_EMAIL = 'marty.email';

interface HistoryItem {
  id: string;
  name: string;
  domain: string;
  updatedAt: string;
  entities: number;
  tokens: number;
  model: string;
}

interface DesignResponse {
  productId?: string | null;
  product: { name: string; objective?: string; domain?: string };
  model: {
    entities: { name: string; definition?: string }[];
    attributes: { entityName: string; name: string; type: string; isPK?: boolean; isFK?: boolean; required?: boolean; sensitive?: boolean; description?: string }[];
    relations: { source: string; target: string; cardinality: string; description?: string }[];
    kpis: { name: string; formula?: string; description?: string }[];
    rules: { name: string; type?: string; description?: string }[];
  };
  deliverables: { sql: string; dbml: string; dbt: string; dictionary: string; mermaid: string; semantic: string; quality: string };
  quality?: {
    score: number;
    errors: number;
    warnings: number;
    findings: Array<{ severity: 'error' | 'warning' | 'info'; category: string; entityName: string; target?: string; message: string; current?: string; suggested?: string }>;
  };
  usage: { input: number; output: number; total: number };
  cost?: { usd: number; eur: number };
  meta: { provider: string; model: string; entities: number; attributes: number; relations: number; source?: 'ddl' | 'ia'; filename?: string };
}

let panel: vscode.WebviewPanel | undefined;
let launcherView: vscode.WebviewView | undefined;
let lastResult: DesignResponse | undefined;
// Dernière saisie : permet de restaurer le panneau à l'identique s'il est rechargé
// (« Move to New Window », déplacement de groupe… → VSCode recrée le webview).
let lastDescription = '';
let lastProvider = 'anthropic';
// Saisie faite depuis la barre latérale, à lancer dès que le panneau est prêt.
let pendingDescription: string | undefined;
let pendingProvider: string | undefined;

// Rafraîchit le statut de connexion affiché dans la barre latérale.
async function refreshLauncher(context: vscode.ExtensionContext): Promise<void> {
  const email = (await context.secrets.get(SECRET_EMAIL)) || '';
  const provider = vscode.workspace.getConfiguration('marty').get<string>('provider', 'anthropic');
  launcherView?.webview.postMessage({ type: 'init', email, provider });
  if (email) void loadHistory(context);
  else launcherView?.webview.postMessage({ type: 'history', products: [] });
}

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('marty.signIn', () => signIn(context)),
    vscode.commands.registerCommand('marty.signOut', () => signOut(context)),
    vscode.commands.registerCommand('marty.open', () => openPanel(context)),
    vscode.window.registerWebviewViewProvider('marty.launcher', new LauncherProvider(context)),
  );
}

function apiUrl(): string {
  return (vscode.workspace.getConfiguration('marty').get<string>('apiUrl') || 'https://www.martstudio.it.com').replace(/\/$/, '');
}

// ---- Vue de la barre latérale (icône Marty dans la barre d'activité) ----

class LauncherProvider implements vscode.WebviewViewProvider {
  constructor(private readonly context: vscode.ExtensionContext) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    launcherView = view;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'media')],
    };
    view.webview.html = getLauncherHtml(view.webview, this.context.extensionUri);
    view.onDidDispose(() => { launcherView = undefined; });

    view.webview.onDidReceiveMessage(async (msg) => {
      switch (msg?.type) {
        case 'ready':
          await refreshLauncher(this.context);
          break;
        case 'generate':
          openPanel(this.context, String(msg.description || ''), String(msg.provider || 'anthropic'));
          break;
        case 'open':
          openPanel(this.context);
          break;
        case 'openProduct':
          await openProduct(this.context, String(msg.id || ''));
          break;
        case 'refresh':
          await refreshLauncher(this.context);
          break;
        case 'importFile':
          await importFile(this.context, String(msg.provider || 'anthropic'));
          break;
        case 'signIn':
          await signIn(this.context);
          await refreshLauncher(this.context);
          break;
        case 'signOut':
          await signOut(this.context);
          await refreshLauncher(this.context);
          break;
      }
    });
  }
}

export function deactivate() {
  panel?.dispose();
}

// ---- Compte Marty (connexion / déconnexion / jeton) ----

// Connexion avec le compte martstudio.it.com. Les jetons sont conservés dans le
// coffre chiffré de VSCode (SecretStorage), jamais en clair.
async function signIn(context: vscode.ExtensionContext): Promise<string | undefined> {
  const email = await vscode.window.showInputBox({
    title: 'Marty — Connexion (1/2)',
    prompt: 'Ton email Marty (le même que sur martstudio.it.com).',
    placeHolder: 'prenom.nom@exemple.com',
    ignoreFocusOut: true,
  });
  if (!email?.trim()) return undefined;

  const password = await vscode.window.showInputBox({
    title: 'Marty — Connexion (2/2)',
    prompt: 'Ton mot de passe Marty.',
    password: true,
    ignoreFocusOut: true,
  });
  if (!password) return undefined;

  try {
    const res = await fetch(`${apiUrl()}/api/v1/auth`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password }),
    });
    const data = (await res.json()) as { accessToken?: string; refreshToken?: string; email?: string; error?: string };
    if (!res.ok || !data.accessToken) {
      vscode.window.showErrorMessage(`Marty : ${data.error || 'connexion impossible.'}`);
      return undefined;
    }
    await context.secrets.store(SECRET_ACCESS, data.accessToken);
    if (data.refreshToken) await context.secrets.store(SECRET_REFRESH, data.refreshToken);
    await context.secrets.store(SECRET_EMAIL, data.email || email.trim());
    vscode.window.showInformationMessage(`Marty : connecté en tant que ${data.email || email.trim()}.`);
    return data.accessToken;
  } catch (e) {
    vscode.window.showErrorMessage(`Marty : connexion impossible (${(e as Error).message}).`);
    return undefined;
  }
}

async function signOut(context: vscode.ExtensionContext): Promise<void> {
  await context.secrets.delete(SECRET_ACCESS);
  await context.secrets.delete(SECRET_REFRESH);
  await context.secrets.delete(SECRET_EMAIL);
  vscode.window.showInformationMessage('Marty : déconnecté.');
  panel?.webview.postMessage({ type: 'init', email: '' });
}

// Renouvelle le jeton d'accès expiré à partir du jeton de rafraîchissement.
async function refreshToken(context: vscode.ExtensionContext): Promise<string | undefined> {
  const rt = await context.secrets.get(SECRET_REFRESH);
  if (!rt) return undefined;
  try {
    const res = await fetch(`${apiUrl()}/api/v1/auth`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt }),
    });
    if (!res.ok) return undefined;
    const data = (await res.json()) as { accessToken?: string; refreshToken?: string };
    if (!data.accessToken) return undefined;
    await context.secrets.store(SECRET_ACCESS, data.accessToken);
    if (data.refreshToken) await context.secrets.store(SECRET_REFRESH, data.refreshToken);
    return data.accessToken;
  } catch {
    return undefined;
  }
}

// Appel authentifié : renouvelle le jeton en silence si la session a expiré.
async function authFetch(
  context: vscode.ExtensionContext,
  path: string,
  init?: RequestInit,
): Promise<Response | undefined> {
  let token = await context.secrets.get(SECRET_ACCESS);
  if (!token) {
    token = await signIn(context);
    if (!token) return undefined;
  }
  const call = (t: string) => fetch(`${apiUrl()}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers || {}), authorization: `Bearer ${t}` },
  });

  let res = await call(token);
  if (res.status === 401) {
    const fresh = (await refreshToken(context)) || (await signIn(context));
    if (!fresh) return res;
    res = await call(fresh);
  }
  return res;
}

// ---- Historique des générations ----

async function loadHistory(context: vscode.ExtensionContext): Promise<void> {
  try {
    const res = await authFetch(context, '/api/v1/products');
    if (!res || !res.ok) { launcherView?.webview.postMessage({ type: 'history', products: [] }); return; }
    const data = (await res.json()) as { products?: HistoryItem[] };
    launcherView?.webview.postMessage({ type: 'history', products: data.products || [] });
  } catch {
    launcherView?.webview.postMessage({ type: 'history', products: [] });
  }
}

// Rouvre un Data Product : les livrables sont reconstruits côté serveur à partir du
// modèle enregistré — aucun appel à l'IA, donc instantané et gratuit.
async function openProduct(context: vscode.ExtensionContext, id: string): Promise<void> {
  openPanel(context);
  panel?.webview.postMessage({ type: 'progress', message: 'Chargement du Data Product…' });
  try {
    const res = await authFetch(context, `/api/v1/products?id=${encodeURIComponent(id)}`);
    if (!res || !res.ok) {
      const detail = res ? ((await res.json()) as { error?: string }).error : 'requête impossible';
      panel?.webview.postMessage({ type: 'error', message: detail || 'Chargement impossible.' });
      return;
    }
    lastResult = (await res.json()) as DesignResponse;
    lastDescription = ''; // produit rouvert : pas de saisie à restaurer
    if (panel && lastResult.product?.name) panel.title = `Marty — ${lastResult.product.name}`;
    panel?.webview.postMessage({ type: 'result', data: lastResult });
  } catch (e) {
    panel?.webview.postMessage({ type: 'error', message: `Chargement impossible : ${(e as Error).message}` });
  }
}

// ---- Import d'un fichier existant (SQL, SAS, CSV…) ----

// Un DDL SQL est parsé côté serveur SANS IA : gratuit, instantané, sans limite
// de taille. Les autres formats passent par le modèle.
async function importFile(context: vscode.ExtensionContext, provider: string): Promise<void> {
  const picked = await vscode.window.showOpenDialog({
    canSelectMany: false,
    openLabel: 'Importer',
    filters: {
      'Modèles et scripts': ['sql', 'ddl', 'sas', 'csv', 'txt', 'json', 'md', 'yml', 'yaml'],
      'Tous les fichiers': ['*'],
    },
  });
  if (!picked || !picked.length) return;

  const uri = picked[0];
  const filename = uri.path.split('/').pop() || 'fichier';

  // Excel est un format binaire : on ne peut pas le lire tel quel.
  if (/\.(xlsx|xls)$/i.test(filename)) {
    vscode.window.showWarningMessage(
      `Marty : les fichiers Excel (.xlsx) sont binaires et ne peuvent pas être lus directement. Enregistrez la feuille en CSV, puis réimportez-la.`,
    );
    return;
  }

  let content: string;
  try {
    const bytes = await vscode.workspace.fs.readFile(uri);
    content = new TextDecoder('utf-8').decode(bytes);
  } catch (e) {
    vscode.window.showErrorMessage(`Marty : lecture impossible (${(e as Error).message}).`);
    return;
  }
  if (!content.trim()) {
    vscode.window.showWarningMessage('Marty : ce fichier est vide.');
    return;
  }

  openPanel(context);
  panel?.webview.postMessage({ type: 'progress', message: `Import de « ${filename} »…` });

  try {
    const res = await authFetch(context, '/api/v1/import', {
      method: 'POST',
      body: JSON.stringify({ filename, content, options: { provider } }),
    });
    if (!res || !res.ok) {
      let detail = 'import impossible';
      try { detail = ((await res!.json()) as { error?: string }).error || detail; } catch { /* non-JSON */ }
      panel?.webview.postMessage({ type: 'error', message: detail });
      return;
    }
    lastResult = (await res.json()) as DesignResponse;
    lastDescription = '';
    if (panel && lastResult.product?.name) panel.title = `Marty — ${lastResult.product.name}`;
    panel?.webview.postMessage({ type: 'result', data: lastResult });
    void loadHistory(context);

    if (lastResult.meta?.source === 'ddl') {
      vscode.window.showInformationMessage(
        `Marty : « ${filename} » importé — ${lastResult.meta.entities} tables analysées sans appel à l'IA (aucun coût).`,
      );
    }
  } catch (e) {
    panel?.webview.postMessage({ type: 'error', message: `Import échoué : ${(e as Error).message}` });
  }
}

// ---- Panneau ----

function openPanel(context: vscode.ExtensionContext, description?: string, provider?: string) {
  const desc = description?.trim();
  const prov = provider || vscode.workspace.getConfiguration('marty').get<string>('provider', 'anthropic');
  if (panel) {
    panel.reveal(vscode.ViewColumn.Active);
    // Panneau déjà chargé : on peut lancer tout de suite.
    if (desc) {
      panel.webview.postMessage({ type: 'prefill', description: desc, provider: prov });
      void generate(context, desc, prov);
    }
    return;
  }
  // Panneau pas encore créé : on attend son message « ready » pour lancer.
  pendingDescription = desc || undefined;
  pendingProvider = desc ? prov : undefined;
  panel = vscode.window.createWebviewPanel('marty', 'Marty', vscode.ViewColumn.Active, {
    enableScripts: true,
    retainContextWhenHidden: true,
    // Autorise le chargement du bundle Mermaid embarqué (rendu du diagramme hors ligne).
    localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')],
  });
  panel.webview.html = getHtml(panel.webview, context.extensionUri);

  panel.webview.onDidReceiveMessage(async (msg) => {
    switch (msg?.type) {
      case 'ready': {
        const provider = vscode.workspace.getConfiguration('marty').get<string>('provider', 'anthropic');
        const email = (await context.secrets.get(SECRET_EMAIL)) || '';
        panel?.webview.postMessage({ type: 'init', provider, email });

        // Génération demandée depuis la barre latérale : le webview est prêt, on lance.
        if (pendingDescription) {
          const d = pendingDescription;
          const p = pendingProvider || provider;
          pendingDescription = undefined;
          pendingProvider = undefined;
          panel?.webview.postMessage({ type: 'prefill', description: d, provider: p });
          await generate(context, d, p);
          break;
        }

        // Webview reconstruit (« Move to New Window », changement de groupe…) :
        // VSCode repart du HTML vide. On lui réinjecte le dernier résultat, sinon
        // l'utilisateur retrouve un panneau vide et croit avoir tout perdu.
        if (lastResult) {
          panel?.webview.postMessage({ type: 'prefill', description: lastDescription, provider: lastProvider });
          panel?.webview.postMessage({ type: 'result', data: lastResult });
        }
        break;
      }
      case 'generate':
        await generate(context, String(msg.description || ''), String(msg.provider || 'anthropic'));
        break;
      case 'save':
        await saveToProject();
        break;
      case 'zip':
        await downloadZip();
        break;
      case 'continueWeb':
        await continueOnWeb();
        break;
      case 'copy':
        await vscode.env.clipboard.writeText(String(msg.text || ''));
        panel?.webview.postMessage({ type: 'copied' });
        break;
      case 'openExternal':
        if (msg.url) vscode.env.openExternal(vscode.Uri.parse(String(msg.url)));
        break;
      case 'signIn': {
        await signIn(context);
        const em = (await context.secrets.get(SECRET_EMAIL)) || '';
        panel?.webview.postMessage({ type: 'init', email: em });
        await refreshLauncher(context); // garde la barre latérale synchronisée
        break;
      }
      case 'signOut':
        await signOut(context);
        await refreshLauncher(context);
        break;
    }
  });

  panel.onDidDispose(() => { panel = undefined; });
}

// ---- Appel API ----

async function generate(context: vscode.ExtensionContext, description: string, provider: string) {
  if (description.trim().length < 10) {
    panel?.webview.postMessage({ type: 'error', message: 'Décris ton idée métier (au moins 10 caractères).' });
    return;
  }
  let token = await context.secrets.get(SECRET_ACCESS);
  if (!token) {
    token = await signIn(context);
    if (!token) {
      panel?.webview.postMessage({ type: 'error', message: 'Connecte-toi à ton compte Marty pour générer.' });
      return;
    }
  }

  const call = (t: string) => fetch(`${apiUrl()}/api/v1/design`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${t}` },
    body: JSON.stringify({ description, options: { provider } }),
  });

  lastDescription = description;
  lastProvider = provider;
  panel?.webview.postMessage({ type: 'progress' });
  try {
    let res = await call(token);

    // Jeton expiré (les sessions durent ~1 h) : on le renouvelle en silence et on
    // rejoue la requête, pour que l'utilisateur n'ait pas à se reconnecter.
    if (res.status === 401) {
      const fresh = (await refreshToken(context)) || (await signIn(context));
      if (!fresh) {
        panel?.webview.postMessage({ type: 'error', message: 'Session expirée. Reconnecte-toi.' });
        return;
      }
      res = await call(fresh);
    }

    if (!res.ok) {
      let detail = res.statusText;
      try { detail = ((await res.json()) as { error?: string }).error || detail; } catch { /* corps non-JSON */ }
      panel?.webview.postMessage({ type: 'error', message: `HTTP ${res.status} — ${detail}` });
      return;
    }
    lastResult = (await res.json()) as DesignResponse;
    // L'onglet porte le nom du Data Product généré.
    if (panel && lastResult.product?.name) panel.title = `Marty — ${lastResult.product.name}`;
    panel?.webview.postMessage({ type: 'result', data: lastResult });
    void loadHistory(context); // la nouvelle génération apparaît dans l'historique
  } catch (e) {
    panel?.webview.postMessage({ type: 'error', message: `Requête échouée : ${(e as Error).message}` });
  }
}

// ---- Enregistrement dans le projet ----

function slug(s: string): string {
  return (s || 'data-product').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'data-product';
}

// Les livrables à écrire, quel que soit le mode (projet ou archive).
function deliverableFiles(result: DesignResponse): Record<string, string> {
  const d = result.deliverables;
  const files: Record<string, string> = {
    'model.json': JSON.stringify(result.model, null, 2),
    'schema.sql': d.sql,
    'schema.dbml': d.dbml,
    'schema.yml': d.dbt,
    'dictionary.md': d.dictionary,
    'erd.mmd': d.mermaid,
    'semantic-layer.md': d.semantic,
    'quality.md': d.quality,
  };
  // Un livrable absent (API plus ancienne) ne doit pas produire un fichier vide.
  for (const [k, v] of Object.entries(files)) {
    if (typeof v !== 'string' || !v.length) delete files[k];
  }
  return files;
}

async function saveToProject() {
  if (!lastResult) return;
  let base: vscode.Uri;
  const folders = vscode.workspace.workspaceFolders;
  if (folders && folders.length) {
    base = vscode.Uri.joinPath(folders[0].uri, 'marty-out');
  } else {
    const picked = await vscode.window.showOpenDialog({ canSelectFolders: true, canSelectFiles: false, openLabel: 'Enregistrer ici' });
    if (!picked || !picked.length) return;
    base = picked[0];
  }
  const dir = vscode.Uri.joinPath(base, slug(lastResult.product.name));
  const files = deliverableFiles(lastResult);
  const enc = new TextEncoder();
  for (const [name, content] of Object.entries(files)) {
    await vscode.workspace.fs.writeFile(vscode.Uri.joinPath(dir, name), enc.encode(content));
  }
  panel?.webview.postMessage({ type: 'saved', message: `Enregistré dans ${dir.fsPath}` });
  const open = await vscode.window.showInformationMessage(`Marty : livrables enregistrés dans ${dir.fsPath}`, 'Ouvrir le SQL');
  if (open) {
    const doc = await vscode.workspace.openTextDocument(vscode.Uri.joinPath(dir, 'schema.sql'));
    vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
  }
}

// Archive .zip de tous les livrables, à l'emplacement choisi par l'utilisateur.
async function downloadZip() {
  if (!lastResult) return;
  const name = slug(lastResult.product.name);
  const folders = vscode.workspace.workspaceFolders;
  const defaultUri = vscode.Uri.joinPath(folders?.length ? folders[0].uri : vscode.Uri.file(''), `${name}.zip`);
  const target = await vscode.window.showSaveDialog({
    defaultUri,
    filters: { 'Archive ZIP': ['zip'] },
    saveLabel: 'Télécharger le package',
  });
  if (!target) return;

  const entries = Object.entries(deliverableFiles(lastResult)).map(([file, content]) => ({ name: `${name}/${file}`, content }));
  await vscode.workspace.fs.writeFile(target, createZip(entries));

  panel?.webview.postMessage({ type: 'saved', message: `Package enregistré : ${target.fsPath}` });
  const reveal = await vscode.window.showInformationMessage(`Marty : package enregistré (${entries.length} fichiers).`, 'Révéler dans le Finder');
  if (reveal) vscode.commands.executeCommand('revealFileInOS', target);
}

// Reprendre l'atelier complet sur l'application web : on copie le DDL, que
// l'utilisateur colle dans Marty (mode Expert) pour enrichir le modèle.
async function continueOnWeb() {
  if (!lastResult) return;
  await vscode.env.openExternal(vscode.Uri.parse(apiUrl()));

  // Généré depuis un compte : le Data Product est DÉJÀ enregistré côté site.
  if (lastResult.productId) {
    panel?.webview.postMessage({ type: 'saved', message: 'Data Product déjà enregistré sur le site — ouvre « Data Products ».' });
    vscode.window.showInformationMessage(
      `Marty : « ${lastResult.product.name} » est déjà enregistré dans ton espace. Ouvre l'onglet « Data Products » pour poursuivre l'atelier (KPI, règles, gouvernance, rapport DAD…).`,
    );
    return;
  }

  // Cas d'une clé machine (pas de compte) : pas de propriétaire, on repasse par le DDL.
  await vscode.env.clipboard.writeText(lastResult.deliverables.sql);
  panel?.webview.postMessage({ type: 'saved', message: 'DDL copié — colle-le dans Marty (mode Expert).' });
  vscode.window.showInformationMessage(
    'Marty : le DDL SQL a été copié. Crée un Data Product en mode « Expert » et colle-le pour poursuivre l\'atelier.',
  );
}

// ---- HTML de la barre latérale ----

function getLauncherHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const n = nonce();
  const iconUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'icon.png'));
  const csp = `default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${n}'; img-src ${webview.cspSource};`;
  return /* html */ `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="${csp}" />
<style>
  :root { --ca-green:#0e8266; --ca-dark:#04382d; }
  * { box-sizing: border-box; }
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); font-size: 12px; padding: 12px 10px; }
  .brand { display:flex; align-items:center; gap:8px; margin-bottom:10px; }
  .logo { width:28px; height:28px; border-radius:7px; display:block; }
  .brand b { font-size: 13px; }
  p.hint { color: var(--vscode-descriptionForeground); margin: 0 0 10px; line-height: 1.45; }
  textarea { width:100%; min-height:96px; padding:8px; border-radius:6px; resize:vertical; font-family:inherit; font-size:12px;
    background: var(--vscode-input-background); color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, transparent); }
  button.primary { width:100%; margin-top:8px; background: var(--ca-green); color:#fff; border:none;
    border-radius:6px; padding:8px 10px; cursor:pointer; font-weight:600; font-size:12px; }
  button.primary:hover { background:#0aa07d; }
  button.link { background:none; border:none; color: var(--vscode-textLink-foreground); cursor:pointer;
    padding:0; font-size:11.5px; text-align:left; }
  label.f { display:block; font-size:11px; color: var(--vscode-descriptionForeground); margin:12px 0 4px; }
  select { width:100%; padding:6px 8px; border-radius:6px; font-size:12px;
    background: var(--vscode-dropdown-background); color: var(--vscode-dropdown-foreground);
    border: 1px solid var(--vscode-dropdown-border, transparent); }
  .acct { display:flex; align-items:center; gap:6px; padding:7px 9px; border-radius:6px; margin-bottom:12px;
    background: var(--vscode-editorWidget-background); border:1px solid var(--vscode-editorWidget-border, #4443); font-size:11.5px; }
  .acct .dot { width:7px; height:7px; border-radius:50%; flex:none; }
  .acct .on { background:#1aa06d; }
  .acct .off { background:#e09100; }
  .acct .who { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  button.ghost2 { width:100%; margin-top:6px; background:transparent; color: var(--vscode-foreground);
    border:1px solid var(--vscode-input-border, #4445); border-radius:6px; padding:7px 10px;
    cursor:pointer; font-size:11.5px; }
  button.ghost2:hover { background: var(--vscode-list-hoverBackground); }
  .sect { margin-top:18px; font-size:10.5px; text-transform:uppercase; letter-spacing:.6px;
    color: var(--vscode-descriptionForeground); border-top:1px solid var(--vscode-editorWidget-border,#4443);
    padding-top:12px; margin-bottom:6px; }
  .sect-row { display:flex; align-items:center; justify-content:space-between; }
  button.icon { background:none; border:none; color: var(--vscode-descriptionForeground); cursor:pointer;
    font-size:14px; padding:0 2px; line-height:1; }
  button.icon:hover { color: var(--vscode-foreground); }
  button.icon.spin { animation: mspin .8s linear infinite; }
  @keyframes mspin { to { transform: rotate(360deg); } }
  .item { padding:7px 9px; border-radius:6px; cursor:pointer; margin-bottom:3px; }
  .item:hover { background: var(--vscode-list-hoverBackground); }
  .item .t { font-size:12px; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .item .s { font-size:10.5px; color: var(--vscode-descriptionForeground); margin-top:2px; }
  .empty { font-size:11.5px; color: var(--vscode-descriptionForeground); font-style:italic; padding:4px 0; }
</style>
</head>
<body>
  <div class="brand"><img class="logo" src="${iconUri}" alt="" /><b>Marty</b></div>

  <div class="acct">
    <span class="dot off" id="dot"></span>
    <span class="who" id="who">Non connecté</span>
    <button class="link" id="acct">Se connecter</button>
    <button class="link" id="out" title="Se déconnecter" style="display:none">⏻</button>
  </div>

  <p class="hint">Décris ton idée métier — Marty conçoit le modèle et ses livrables.</p>
  <textarea id="d" placeholder="Ex. : Suivi des crédits immobiliers : clients, comptes, prêts, échéances, garanties…"></textarea>

  <label class="f" for="p">Modèle IA</label>
  <select id="p">
    <option value="anthropic">Claude Opus — précis (~50 s)</option>
    <option value="google">Gemini Flash — rapide</option>
  </select>

  <button class="primary" id="go">Générer un Data Product</button>
  <button class="ghost2" id="imp">📎 Importer un fichier (SQL, SAS, CSV…)</button>

  <div class="sect sect-row">
    <span>Mes générations</span>
    <button class="icon" id="ref" title="Rafraîchir la liste">⟳</button>
  </div>
  <div id="hist"><div class="empty">Aucune génération pour l'instant.</div></div>

<script nonce="${n}">
  const vscode = acquireVsCodeApi();
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  let signedIn = false;

  window.addEventListener('load', () => vscode.postMessage({ type: 'ready' }));

  function renderHistory(products) {
    const box = $('hist');
    if (!products || !products.length) {
      box.innerHTML = '<div class="empty">' + (signedIn ? 'Aucune génération pour l\\'instant.' : 'Connecte-toi pour voir ton historique.') + '</div>';
      return;
    }
    box.innerHTML = '';
    products.forEach((p) => {
      const d = new Date(p.updatedAt);
      const when = isNaN(d) ? '' : d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      const el = document.createElement('div');
      el.className = 'item';
      el.title = 'Rouvrir ce Data Product';
      el.innerHTML = '<div class="t">' + esc(p.name) + '</div><div class="s">' + esc(when) + ' • ' + (p.entities || 0) + ' entités</div>';
      el.addEventListener('click', () => vscode.postMessage({ type: 'openProduct', id: p.id }));
      box.appendChild(el);
    });
  }

  window.addEventListener('message', (e) => {
    const m = e.data;
    if (m.type === 'history') { $('ref').classList.remove('spin'); renderHistory(m.products); return; }
    if (m.type !== 'init') return;
    signedIn = !!m.email;
    $('who').textContent = signedIn ? m.email : 'Non connecté';
    $('who').title = signedIn ? m.email : '';
    $('dot').className = 'dot ' + (signedIn ? 'on' : 'off');
    $('acct').textContent = signedIn ? 'Changer' : 'Se connecter';
    $('out').style.display = signedIn ? '' : 'none';
    if (m.provider) $('p').value = m.provider;
  });

  // « Changer » relance la connexion : le nouveau compte remplace l'ancien.
  $('acct').addEventListener('click', () => vscode.postMessage({ type: 'signIn' }));
  $('out').addEventListener('click', () => vscode.postMessage({ type: 'signOut' }));

  $('go').addEventListener('click', () => {
    const description = $('d').value.trim();
    const provider = $('p').value;
    vscode.postMessage(description ? { type: 'generate', description, provider } : { type: 'open' });
  });

  $('imp').addEventListener('click', () => vscode.postMessage({ type: 'importFile', provider: $('p').value }));

  $('ref').addEventListener('click', () => {
    $('ref').classList.add('spin');
    vscode.postMessage({ type: 'refresh' });
  });
</script>
</body>
</html>`;
}

// ---- HTML du webview ----

function nonce(): string {
  return Array.from({ length: 24 }, () => 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 62)]).join('');
}

function getHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const n = nonce();
  const mermaidUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'mermaid.min.js'));
  const iconUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'icon.png'));
  const csp = `default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'nonce-${n}'; img-src ${webview.cspSource} data:; font-src ${webview.cspSource};`;
  return /* html */ `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="${csp}" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>
  :root { --ca-green:#0e8266; --ca-dark:#04382d; }
  * { box-sizing: border-box; }
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 0; margin: 0; font-size: 13px; }
  .wrap { max-width: 960px; margin: 0 auto; padding: 20px 24px 60px; }
  h1 { font-size: 18px; margin: 0 0 4px; display: flex; align-items: center; gap: 10px; }
  .logo { width: 30px; height: 30px; border-radius: 7px; display: block; }
  .sub { color: var(--vscode-descriptionForeground); margin: 0 0 18px; }
  textarea { width: 100%; min-height: 90px; padding: 10px 12px; border-radius: 8px; resize: vertical;
    background: var(--vscode-input-background); color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, transparent); font-family: inherit; font-size: 13px; }
  .row { display: flex; gap: 10px; align-items: center; margin-top: 10px; flex-wrap: wrap; }
  select { background: var(--vscode-dropdown-background); color: var(--vscode-dropdown-foreground);
    border: 1px solid var(--vscode-dropdown-border, transparent); border-radius: 6px; padding: 6px 8px; }
  button.primary { background: var(--ca-green); color: #fff; border: none; border-radius: 6px; padding: 8px 16px; cursor: pointer; font-weight: 600; }
  button.primary:hover { background: #0aa07d; }
  button.ghost { background: transparent; color: var(--vscode-foreground); border: 1px solid var(--vscode-input-border, #4444); border-radius: 6px; padding: 6px 12px; cursor: pointer; }
  button:disabled { opacity: .5; cursor: default; }
  .status { margin-top: 14px; color: var(--vscode-descriptionForeground); }
  .status.err { color: var(--vscode-errorForeground); }
  .spinner { display:inline-block; width:12px; height:12px; border:2px solid #8888; border-top-color: var(--ca-green); border-radius:50%; animation: sp 0.8s linear infinite; vertical-align:-2px; margin-right:6px; }
  @keyframes sp { to { transform: rotate(360deg); } }
  .hidden { display: none !important; }
  .summary { margin: 18px 0 6px; padding: 12px 14px; border-radius: 8px; background: var(--vscode-editorWidget-background); border: 1px solid var(--vscode-editorWidget-border, #4443); }
  .summary b { color: var(--ca-green); }
  .cost { display: inline-block; padding: 1px 7px; border-radius: 10px; font-weight: 600; font-size: 11.5px;
    background: #e0910022; color: #e09100; border: 1px solid #e0910044; }
  .tabs { display: flex; gap: 4px; flex-wrap: wrap; margin: 16px 0 10px; border-bottom: 1px solid var(--vscode-editorWidget-border, #4443); }
  .tab { padding: 7px 12px; cursor: pointer; border: none; background: transparent; color: var(--vscode-foreground); border-bottom: 2px solid transparent; }
  .tab.active { border-bottom-color: var(--ca-green); font-weight: 600; }
  pre { background: var(--vscode-textCodeBlock-background); padding: 12px; border-radius: 8px; overflow-x: auto; font-family: var(--vscode-editor-font-family, monospace); font-size: 12px; white-space: pre; }
  .pane { display: none; }
  .pane.active { display: block; }
  .toolbar { display: flex; gap: 8px; margin-bottom: 8px; }
  .card { border: 1px solid var(--vscode-editorWidget-border, #4443); border-radius: 8px; margin-bottom: 12px; overflow: hidden; }
  .card h3 { margin: 0; padding: 8px 12px; background: var(--vscode-editorWidget-background); font-size: 13px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  td, th { text-align: left; padding: 5px 12px; border-top: 1px solid var(--vscode-editorWidget-border, #4443); }
  .badge { font-size: 10px; padding: 1px 6px; border-radius: 4px; margin-left: 4px; }
  .pk { background: #0e826622; color: var(--ca-green); }
  .fk { background: #8884; }
  .sens { background: #e0910022; color: #e09100; }
  .rel { padding: 4px 0; }
  .mono { font-family: var(--vscode-editor-font-family, monospace); }
  .save-bar { position: sticky; bottom: 0; padding: 12px 0; background: var(--vscode-editor-background);
    display: flex; gap: 8px; flex-wrap: wrap; border-top: 1px solid var(--vscode-editorWidget-border, #4443); }
  .graph { overflow-x: auto; padding: 10px 0; }
  .graph svg { max-width: 100%; height: auto; }
  /* Markdown rendu (Semantic Layer, Dictionnaire) */
  .md h1 { font-size: 17px; margin: 2px 0 10px; }
  .md h2 { font-size: 15px; margin: 18px 0 8px; }
  .md h3 { font-size: 13.5px; margin: 14px 0 6px; color: var(--ca-green); }
  .md p { margin: 6px 0; line-height: 1.55; }
  .md ul { padding-left: 18px; margin: 6px 0; }
  .md li { margin: 4px 0; line-height: 1.5; }
  .md blockquote { margin: 8px 0; padding: 6px 12px; border-left: 3px solid var(--ca-green);
    background: var(--vscode-editorWidget-background); color: var(--vscode-descriptionForeground); }
  .md code { font-family: var(--vscode-editor-font-family, monospace); font-size: 11.5px;
    background: var(--vscode-textCodeBlock-background); padding: 1px 5px; border-radius: 4px; }
  .md table { width: 100%; border-collapse: collapse; font-size: 12px; margin: 10px 0; }
  .md th { color: var(--vscode-descriptionForeground); font-weight: 600; }
  .md em { opacity: .75; }
  /* Contrôle qualité */
  .score { display: flex; align-items: center; gap: 16px; margin: 4px 0 14px; }
  .score .num { font-size: 34px; font-weight: 800; line-height: 1; }
  .finding { border-left: 3px solid; padding: 8px 12px; margin-bottom: 8px; border-radius: 0 6px 6px 0;
    background: var(--vscode-editorWidget-background); }
  .finding.error { border-color: #e05252; }
  .finding.warning { border-color: #e09100; }
  .finding.info { border-color: #3b9dd8; }
  .finding .where { font-family: var(--vscode-editor-font-family, monospace); font-weight: 600; }
  .finding .fix { font-size: 11.5px; opacity: .8; margin-top: 4px; }
</style>
</head>
<body>
<div class="wrap">
  <h1><img class="logo" src="${iconUri}" alt="" /> Marty — Générateur de Data Product</h1>
  <p class="sub">Décris ton idée métier, reçois le modèle et ses livrables.</p>

  <textarea id="desc" placeholder="Ex. : Suivi des crédits immobiliers : clients, comptes, prêts, échéances de remboursement, garanties, et analyse du risque…"></textarea>
  <div class="row">
    <button class="primary" id="go">Générer</button>
    <label>Modèle&nbsp;
      <select id="provider">
        <option value="anthropic">Claude Opus (précis)</option>
        <option value="google">Gemini Flash (rapide)</option>
      </select>
    </label>
    <button class="ghost" id="account">👤 Compte</button>
    <button class="ghost" id="logout" style="display:none">⏻ Déconnexion</button>
    <span id="who" style="font-size:12px;color:var(--vscode-descriptionForeground)"></span>
  </div>

  <div class="status hidden" id="status"></div>

  <div id="results" class="hidden">
    <div class="summary" id="summary"></div>
    <div class="tabs" id="tabs"></div>
    <div id="panes"></div>
    <div class="save-bar">
      <button class="primary" id="save">💾 Enregistrer dans le projet</button>
      <button class="ghost" id="zip">📦 Télécharger le package (.zip)</button>
      <button class="ghost" id="web">🌐 Continuer sur martstudio.it.com</button>
    </div>
  </div>
</div>

<script nonce="${n}" src="${mermaidUri}"></script>
<script nonce="${n}">
  const vscode = acquireVsCodeApi();
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  window.addEventListener('load', () => vscode.postMessage({ type: 'ready' }));

  $('go').addEventListener('click', () => {
    const description = $('desc').value;
    vscode.postMessage({ type: 'generate', description, provider: $('provider').value });
  });
  $('account').addEventListener('click', () => vscode.postMessage({ type: 'signIn' }));
  $('logout').addEventListener('click', () => vscode.postMessage({ type: 'signOut' }));
  $('save').addEventListener('click', () => vscode.postMessage({ type: 'save' }));
  $('zip').addEventListener('click', () => vscode.postMessage({ type: 'zip' }));
  $('web').addEventListener('click', () => vscode.postMessage({ type: 'continueWeb' }));

  function setStatus(html, isErr) {
    const el = $('status');
    el.className = 'status' + (isErr ? ' err' : '');
    el.innerHTML = html;
    el.classList.remove('hidden');
  }

  window.addEventListener('message', (e) => {
    const m = e.data;
    if (m.type === 'init') {
      if (m.provider) $('provider').value = m.provider;
      $('who').textContent = m.email ? 'Connecté : ' + m.email : '';
      $('logout').style.display = m.email ? '' : 'none';
      if (!m.email) setStatus('👤 Non connecté. Clique « Compte » (ou lance une génération) pour te connecter avec ton compte Marty.');
    } else if (m.type === 'prefill') {
      $('desc').value = m.description || '';
      if (m.provider) $('provider').value = m.provider;
    } else if (m.type === 'progress') {
      $('go').disabled = true;
      setStatus('<span class="spinner"></span> ' + esc(m.message || 'Génération en cours… (~50 s avec Claude Opus)'));
      $('results').classList.add('hidden');
    } else if (m.type === 'error') {
      $('go').disabled = false;
      setStatus('✗ ' + esc(m.message), true);
    } else if (m.type === 'result') {
      $('go').disabled = false;
      $('status').classList.add('hidden');
      render(m.data);
    } else if (m.type === 'saved') {
      setStatus('✓ ' + esc(m.message || 'Livrables enregistrés.'));
    } else if (m.type === 'copied') {
      setStatus('✓ Copié dans le presse-papiers.');
    }
  });

  function copyBtn(text) {
    const b = document.createElement('button');
    b.className = 'ghost'; b.textContent = '📋 Copier';
    b.addEventListener('click', () => vscode.postMessage({ type: 'copy', text }));
    return b;
  }

  function codePane(text, extraBtns) {
    const div = document.createElement('div');
    const tb = document.createElement('div'); tb.className = 'toolbar';
    tb.appendChild(copyBtn(text));
    (extraBtns || []).forEach((b) => tb.appendChild(b));
    const pre = document.createElement('pre'); pre.textContent = text || '(vide)';
    div.appendChild(tb); div.appendChild(pre);
    return div;
  }

  // --- Rendu Markdown minimal (titres, listes, tableaux, gras, code) ---
  function inlineMd(s) {
    return esc(s)
      .replace(/\`([^\`]+)\`/g, '<code>$1</code>')
      .replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>')
      .replace(/(^|[\\s(])_([^_]+)_/g, '$1<em>$2</em>');
  }

  function mdToHtml(md) {
    const lines = String(md || '').split('\\n');
    let html = '', i = 0;
    while (i < lines.length) {
      const l = lines[i];
      if (/^\\s*$/.test(l)) { i++; continue; }
      const h = l.match(/^(#{1,4})\\s+(.*)$/);
      if (h) { const lv = h[1].length; html += '<h' + lv + '>' + inlineMd(h[2]) + '</h' + lv + '>'; i++; continue; }
      // Tableau : ligne d'en-tête suivie d'une ligne de séparation
      if (/^\\s*\\|/.test(l) && /^\\s*\\|[\\s:|-]*$/.test(lines[i + 1] || '')) {
        const head = l.split('|').slice(1, -1).map((c) => c.trim());
        i += 2;
        let rows = '';
        while (i < lines.length && /^\\s*\\|/.test(lines[i])) {
          const cells = lines[i].split('|').slice(1, -1).map((c) => c.trim());
          rows += '<tr>' + cells.map((c) => '<td>' + inlineMd(c) + '</td>').join('') + '</tr>';
          i++;
        }
        html += '<table><thead><tr>' + head.map((c) => '<th>' + inlineMd(c) + '</th>').join('') + '</tr></thead><tbody>' + rows + '</tbody></table>';
        continue;
      }
      if (/^\\s*[-*]\\s+/.test(l)) {
        let items = '';
        while (i < lines.length && /^\\s*[-*]\\s+/.test(lines[i])) {
          let item = lines[i].replace(/^\\s*[-*]\\s+/, ''); i++;
          // lignes de continuation indentées
          while (i < lines.length && /^\\s{2,}\\S/.test(lines[i]) && !/^\\s*[-*]\\s+/.test(lines[i])) { item += ' ' + lines[i].trim(); i++; }
          items += '<li>' + inlineMd(item) + '</li>';
        }
        html += '<ul>' + items + '</ul>';
        continue;
      }
      if (/^\\s*>/.test(l)) { html += '<blockquote>' + inlineMd(l.replace(/^\\s*>\\s?/, '')) + '</blockquote>'; i++; continue; }
      let p = l; i++;
      while (i < lines.length && !/^\\s*$/.test(lines[i]) && !/^(#|\\||\\s*[-*]\\s|>)/.test(lines[i])) { p += ' ' + lines[i]; i++; }
      html += '<p>' + inlineMd(p) + '</p>';
    }
    return html;
  }

  function mdPane(md) {
    const div = document.createElement('div');
    const tb = document.createElement('div'); tb.className = 'toolbar';
    tb.appendChild(copyBtn(md || ''));
    const body = document.createElement('div'); body.className = 'md';
    body.innerHTML = mdToHtml(md) || '<p>(Livrable indisponible — rechargez après le redéploiement de l\\'API.)</p>';
    div.appendChild(tb); div.appendChild(body);
    return div;
  }

  // --- Onglet Qualité : score + anomalies détectées ---
  function qualityPane(data) {
    const q = data.quality;
    const div = document.createElement('div');
    const tb = document.createElement('div'); tb.className = 'toolbar';
    tb.appendChild(copyBtn(data.deliverables.quality || ''));
    div.appendChild(tb);

    if (!q) { return mdPane(data.deliverables.quality); }

    const color = q.score >= 80 ? '#1aa06d' : q.score >= 50 ? '#e09100' : '#e05252';
    const head = document.createElement('div'); head.className = 'score';
    head.innerHTML = '<div class="num" style="color:' + color + '">' + q.score + '<span style="font-size:14px;opacity:.6">/100</span></div>'
      + '<div>' + q.errors + ' erreur(s) • ' + q.warnings + ' avertissement(s)'
      + '<br><span style="opacity:.7">Contrôles déterministes : clés, intégrité référentielle, types, RGPD, granularité.</span></div>';
    div.appendChild(head);

    if (!q.findings.length) {
      div.insertAdjacentHTML('beforeend', '<div class="finding info">✅ Aucun problème détecté.</div>');
      return div;
    }
    const rank = { error: 0, warning: 1, info: 2 };
    q.findings.slice().sort((a, b) => rank[a.severity] - rank[b.severity]).forEach((f) => {
      const where = f.target ? f.entityName + '.' + f.target : f.entityName;
      const icon = f.severity === 'error' ? '🔴' : f.severity === 'warning' ? '🟠' : '🟡';
      let h = '<div class="finding ' + f.severity + '">'
        + '<div>' + icon + ' <span class="where">' + esc(where) + '</span> <span style="opacity:.6">· ' + esc(f.category) + '</span></div>'
        + '<div>' + esc(f.message) + '</div>';
      if (f.current && f.suggested) h += '<div class="fix">Actuel : ' + esc(f.current) + ' → Suggéré : ' + esc(f.suggested) + '</div>';
      div.insertAdjacentHTML('beforeend', h + '</div>');
    });
    return div;
  }

  // Onglet ERD : diagramme rendu (Mermaid embarqué, hors ligne) + code repliable.
  function erdPane(code) {
    const div = document.createElement('div');
    const tb = document.createElement('div'); tb.className = 'toolbar';

    // Zoom du diagramme (le SVG rendu peut être large : on le met à l'échelle).
    let scale = 1;
    const graph = document.createElement('div'); graph.className = 'graph';
    const applyZoom = () => {
      const svg = graph.querySelector('svg');
      if (!svg) return;
      svg.style.transformOrigin = 'top left';
      svg.style.transform = 'scale(' + scale + ')';
      // Sans ça, le conteneur garde la taille d'origine et le zoom rogne le schéma.
      graph.style.height = svg.getBoundingClientRect().height + 'px';
      zoomLabel.textContent = Math.round(scale * 100) + '%';
    };
    const zoomBtn = (label, title, fn) => {
      const b = document.createElement('button');
      b.className = 'ghost'; b.textContent = label; b.title = title;
      b.addEventListener('click', () => { fn(); applyZoom(); });
      return b;
    };
    const zoomLabel = document.createElement('span');
    zoomLabel.style.cssText = 'font-size:12px;opacity:.7;min-width:38px;text-align:center';
    zoomLabel.textContent = '100%';

    tb.appendChild(zoomBtn('−', 'Dézoomer', () => { scale = Math.max(0.3, scale - 0.15); }));
    tb.appendChild(zoomLabel);
    tb.appendChild(zoomBtn('+', 'Zoomer', () => { scale = Math.min(3, scale + 0.15); }));
    tb.appendChild(zoomBtn('⤢ Ajuster', 'Ajuster à la largeur', () => {
      const svg = graph.querySelector('svg');
      if (!svg) { scale = 1; return; }
      const w = svg.getBBox ? svg.getBBox().width : svg.clientWidth;
      scale = w > 0 ? Math.min(3, Math.max(0.3, (graph.clientWidth - 8) / w)) : 1;
    }));
    tb.appendChild(copyBtn(code));

    const live = document.createElement('button');
    live.className = 'ghost'; live.textContent = '🔗 mermaid.live';
    live.addEventListener('click', () => vscode.postMessage({ type: 'openExternal', url: 'https://mermaid.live/edit' }));
    tb.appendChild(live);

    const pre = document.createElement('pre'); pre.textContent = code || '(vide)'; pre.style.display = 'none';

    const toggle = document.createElement('button');
    toggle.className = 'ghost'; toggle.textContent = '</> Voir le code';
    toggle.addEventListener('click', () => {
      const showCode = pre.style.display === 'none';
      pre.style.display = showCode ? 'block' : 'none';
      graph.style.display = showCode ? 'none' : 'block';
      toggle.textContent = showCode ? '🖼 Voir le diagramme' : '</> Voir le code';
    });
    tb.appendChild(toggle);

    div.appendChild(tb); div.appendChild(graph); div.appendChild(pre);
    // Le rendu est asynchrone : on ajuste la hauteur du conteneur une fois le SVG posé.
    renderMermaid(code, graph).then(applyZoom);
    return div;
  }

  async function renderMermaid(code, container) {
    try {
      const dark = document.body.classList.contains('vscode-dark') || document.body.classList.contains('vscode-high-contrast');
      window.mermaid.initialize({ startOnLoad: false, theme: dark ? 'dark' : 'default', securityLevel: 'strict' });
      const { svg } = await window.mermaid.render('erd' + Math.random().toString(36).slice(2), code);
      container.innerHTML = svg;
    } catch (err) {
      container.innerHTML = '<div class="status err">Diagramme non rendu : ' + esc(err && err.message ? err.message : err) + ' — utilise « Voir le code ».</div>';
    }
  }

  function modelPane(data) {
    const div = document.createElement('div');
    const model = data.model;
    const byEntity = {};
    (model.attributes || []).forEach((a) => { (byEntity[a.entityName] = byEntity[a.entityName] || []).push(a); });
    (model.entities || []).forEach((ent) => {
      const card = document.createElement('div'); card.className = 'card';
      const h = document.createElement('h3'); h.textContent = ent.name; card.appendChild(h);
      const t = document.createElement('table');
      (byEntity[ent.name] || []).forEach((a) => {
        const badges = (a.isPK ? '<span class="badge pk">PK</span>' : '') + (a.isFK ? '<span class="badge fk">FK</span>' : '') + (a.sensitive ? '<span class="badge sens">🔒 PII</span>' : '');
        t.insertAdjacentHTML('beforeend', '<tr><td class="mono">' + esc(a.name) + badges + '</td><td class="mono">' + esc(a.type) + '</td><td>' + esc(a.description) + '</td></tr>');
      });
      card.appendChild(t); div.appendChild(card);
    });
    if ((model.relations || []).length) {
      const h = document.createElement('h3'); h.textContent = 'Relations'; h.style.marginTop = '10px'; div.appendChild(h);
      model.relations.forEach((r) => {
        div.insertAdjacentHTML('beforeend', '<div class="rel"><span class="mono">' + esc(r.source) + '</span> <b>' + esc(r.cardinality) + '</b> <span class="mono">' + esc(r.target) + '</span> — ' + esc(r.description) + '</div>');
      });
    }
    ['kpis', 'rules'].forEach((k) => {
      const arr = model[k] || [];
      if (!arr.length) return;
      const h = document.createElement('h3'); h.textContent = k === 'kpis' ? 'Indicateurs (KPI)' : 'Règles métier'; h.style.marginTop = '10px'; div.appendChild(h);
      arr.forEach((x) => div.insertAdjacentHTML('beforeend', '<div class="rel"><b>' + esc(x.name) + '</b>' + (x.formula ? ' — <span class="mono">' + esc(x.formula) + '</span>' : '') + (x.description ? ' : ' + esc(x.description) : '') + '</div>'));
    });
    return div;
  }

  // Coût lisible : on ne masque pas les petits montants derrière un « 0,00 € ».
  function fmtEur(eur) {
    if (typeof eur !== 'number') return '';
    if (eur < 0.01) return '< 0,01 €';
    return eur.toFixed(2).replace('.', ',') + ' €';
  }

  function render(data) {
    lastData = data;
    $('results').classList.remove('hidden');
    const meta = data.meta || {};
    const tokens = data.usage ? data.usage.total : 0;
    const eur = data.cost ? data.cost.eur : null;
    const costHtml = eur === null ? ''
      : ' • <span class="cost" title="Coût IA estimé de cette génération, à la charge de la plateforme.">≈ ' + esc(fmtEur(eur)) + '</span>';
    $('summary').innerHTML = '<b>' + esc(data.product.name) + '</b>' + (data.product.domain ? ' — ' + esc(data.product.domain) : '') +
      '<br>' + (meta.entities || 0) + ' entités • ' + (meta.attributes || 0) + ' attributs • ' + (meta.relations || 0) + ' relations' +
      ' <span style="opacity:.6">• ' + esc(meta.model) + ' • ' + tokens.toLocaleString('fr-FR') + ' tokens</span>' + costHtml;

    const dbmlBtn = document.createElement('button');
    dbmlBtn.className = 'ghost'; dbmlBtn.textContent = '🔗 Ouvrir dbdiagram.io';
    dbmlBtn.addEventListener('click', () => vscode.postMessage({ type: 'openExternal', url: 'https://dbdiagram.io/d' }));

    const d = data.deliverables;
    const tabsDef = [
      ['Modèle', modelPane(data)],
      ['SQL DDL', codePane(d.sql)],
      ['DBML', codePane(d.dbml, [dbmlBtn])],
      ['DBT', codePane(d.dbt)],
      ['Semantic Layer', mdPane(d.semantic)],
      ['Dictionnaire', mdPane(d.dictionary)],
      ['Qualité', qualityPane(data)],
      ['Diagramme ERD', erdPane(d.mermaid)],
    ];

    const tabs = $('tabs'); tabs.innerHTML = '';
    const panes = $('panes'); panes.innerHTML = '';
    tabsDef.forEach(([label, node], i) => {
      const b = document.createElement('button'); b.className = 'tab' + (i === 0 ? ' active' : ''); b.textContent = label;
      const p = document.createElement('div'); p.className = 'pane' + (i === 0 ? ' active' : ''); p.appendChild(node);
      b.addEventListener('click', () => {
        [...tabs.children].forEach((c) => c.classList.remove('active'));
        [...panes.children].forEach((c) => c.classList.remove('active'));
        b.classList.add('active'); p.classList.add('active');
      });
      tabs.appendChild(b); panes.appendChild(p);
    });
  }
  let lastData = null;
</script>
</body>
</html>`;
}
