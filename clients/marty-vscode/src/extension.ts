// ============================================================
// Marty — Extension VSCode
// ------------------------------------------------------------
// Panneau webview : l'utilisateur décrit son idée métier, l'extension
// appelle POST /api/v1/design (API Marty) et affiche le modèle + les
// livrables (SQL, DBML, dbt, dictionnaire, ERD). Enregistrement dans le
// projet en un clic. La clé API est stockée via SecretStorage.
// ============================================================

import * as vscode from 'vscode';

const SECRET_KEY = 'marty.apiKey';

interface DesignResponse {
  product: { name: string; objective?: string; domain?: string };
  model: {
    entities: { name: string; definition?: string }[];
    attributes: { entityName: string; name: string; type: string; isPK?: boolean; isFK?: boolean; required?: boolean; sensitive?: boolean; description?: string }[];
    relations: { source: string; target: string; cardinality: string; description?: string }[];
    kpis: { name: string; formula?: string; description?: string }[];
    rules: { name: string; type?: string; description?: string }[];
  };
  deliverables: { sql: string; dbml: string; dbt: string; dictionary: string; mermaid: string };
  usage: { input: number; output: number; total: number };
  meta: { provider: string; model: string; entities: number; attributes: number; relations: number };
}

let panel: vscode.WebviewPanel | undefined;
let lastResult: DesignResponse | undefined;
// Description saisie depuis la barre latérale, à lancer dès que le panneau est prêt.
let pendingDescription: string | undefined;

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('marty.setApiKey', () => setApiKey(context)),
    vscode.commands.registerCommand('marty.open', () => openPanel(context)),
    vscode.window.registerWebviewViewProvider('marty.launcher', new LauncherProvider(context)),
  );
}

// ---- Vue de la barre latérale (icône Marty dans la barre d'activité) ----

class LauncherProvider implements vscode.WebviewViewProvider {
  constructor(private readonly context: vscode.ExtensionContext) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    view.webview.options = { enableScripts: true };
    view.webview.html = getLauncherHtml(view.webview);
    view.webview.onDidReceiveMessage(async (msg) => {
      switch (msg?.type) {
        case 'generate':
          openPanel(this.context, String(msg.description || ''));
          break;
        case 'open':
          openPanel(this.context);
          break;
        case 'setKey':
          await setApiKey(this.context);
          break;
      }
    });
  }
}

export function deactivate() {
  panel?.dispose();
}

// ---- Clé API ----

async function setApiKey(context: vscode.ExtensionContext): Promise<string | undefined> {
  const value = await vscode.window.showInputBox({
    title: 'Marty — Clé API',
    prompt: 'Colle ta clé API Marty (fournie par ton administrateur).',
    placeHolder: 'marty_…',
    password: true,
    ignoreFocusOut: true,
  });
  if (value && value.trim()) {
    await context.secrets.store(SECRET_KEY, value.trim());
    vscode.window.showInformationMessage('Marty : clé API enregistrée.');
    return value.trim();
  }
  return undefined;
}

// ---- Panneau ----

function openPanel(context: vscode.ExtensionContext, description?: string) {
  const desc = description?.trim();
  if (panel) {
    panel.reveal(vscode.ViewColumn.Active);
    // Panneau déjà chargé : on peut lancer tout de suite.
    if (desc) {
      const provider = vscode.workspace.getConfiguration('marty').get<string>('provider', 'anthropic');
      panel.webview.postMessage({ type: 'prefill', description: desc });
      void generate(context, desc, provider);
    }
    return;
  }
  // Panneau pas encore créé : on attend son message « ready » pour lancer.
  pendingDescription = desc || undefined;
  panel = vscode.window.createWebviewPanel('marty', 'Marty', vscode.ViewColumn.Active, {
    enableScripts: true,
    retainContextWhenHidden: true,
  });
  panel.webview.html = getHtml(panel.webview);

  panel.webview.onDidReceiveMessage(async (msg) => {
    switch (msg?.type) {
      case 'ready': {
        const provider = vscode.workspace.getConfiguration('marty').get<string>('provider', 'anthropic');
        const hasKey = !!(await context.secrets.get(SECRET_KEY));
        panel?.webview.postMessage({ type: 'init', provider, hasKey });
        // Génération demandée depuis la barre latérale : le webview est prêt, on lance.
        if (pendingDescription) {
          const d = pendingDescription;
          pendingDescription = undefined;
          panel?.webview.postMessage({ type: 'prefill', description: d });
          await generate(context, d, provider);
        }
        break;
      }
      case 'generate':
        await generate(context, String(msg.description || ''), String(msg.provider || 'anthropic'));
        break;
      case 'save':
        await saveToProject();
        break;
      case 'copy':
        await vscode.env.clipboard.writeText(String(msg.text || ''));
        panel?.webview.postMessage({ type: 'copied' });
        break;
      case 'openExternal':
        if (msg.url) vscode.env.openExternal(vscode.Uri.parse(String(msg.url)));
        break;
      case 'setKey':
        await setApiKey(context);
        panel?.webview.postMessage({ type: 'init', hasKey: true });
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
  let apiKey = await context.secrets.get(SECRET_KEY);
  if (!apiKey) {
    apiKey = await setApiKey(context);
    if (!apiKey) {
      panel?.webview.postMessage({ type: 'error', message: 'Aucune clé API. Configure-la pour générer.' });
      return;
    }
  }
  const cfg = vscode.workspace.getConfiguration('marty');
  const url = (cfg.get<string>('apiUrl') || 'https://www.martstudio.it.com').replace(/\/$/, '');

  panel?.webview.postMessage({ type: 'progress' });
  try {
    const res = await fetch(`${url}/api/v1/design`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ description, options: { provider } }),
    });
    if (!res.ok) {
      let detail = res.statusText;
      try { detail = ((await res.json()) as { error?: string }).error || detail; } catch { /* corps non-JSON */ }
      panel?.webview.postMessage({ type: 'error', message: `HTTP ${res.status} — ${detail}` });
      return;
    }
    lastResult = (await res.json()) as DesignResponse;
    panel?.webview.postMessage({ type: 'result', data: lastResult });
  } catch (e) {
    panel?.webview.postMessage({ type: 'error', message: `Requête échouée : ${(e as Error).message}` });
  }
}

// ---- Enregistrement dans le projet ----

function slug(s: string): string {
  return (s || 'data-product').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'data-product';
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
  const d = lastResult.deliverables;
  const files: Record<string, string> = {
    'model.json': JSON.stringify(lastResult.model, null, 2),
    'schema.sql': d.sql,
    'schema.dbml': d.dbml,
    'schema.yml': d.dbt,
    'dictionary.md': d.dictionary,
    'erd.mmd': d.mermaid,
  };
  const enc = new TextEncoder();
  for (const [name, content] of Object.entries(files)) {
    if (typeof content === 'string' && content.length) {
      await vscode.workspace.fs.writeFile(vscode.Uri.joinPath(dir, name), enc.encode(content));
    }
  }
  panel?.webview.postMessage({ type: 'saved' });
  const open = await vscode.window.showInformationMessage(`Marty : livrables enregistrés dans ${dir.fsPath}`, 'Ouvrir le SQL');
  if (open) {
    const doc = await vscode.workspace.openTextDocument(vscode.Uri.joinPath(dir, 'schema.sql'));
    vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
  }
}

// ---- HTML de la barre latérale ----

function getLauncherHtml(webview: vscode.Webview): string {
  const n = nonce();
  const csp = `default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${n}';`;
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
  .logo { width:26px; height:26px; border-radius:7px; background:linear-gradient(155deg,var(--ca-dark),var(--ca-green));
          color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:11px; }
  .brand b { font-size: 13px; }
  p.hint { color: var(--vscode-descriptionForeground); margin: 0 0 10px; line-height: 1.45; }
  textarea { width:100%; min-height:96px; padding:8px; border-radius:6px; resize:vertical; font-family:inherit; font-size:12px;
    background: var(--vscode-input-background); color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, transparent); }
  button.primary { width:100%; margin-top:8px; background: var(--ca-green); color:#fff; border:none;
    border-radius:6px; padding:8px 10px; cursor:pointer; font-weight:600; font-size:12px; }
  button.primary:hover { background:#0aa07d; }
  button.link { background:none; border:none; color: var(--vscode-textLink-foreground); cursor:pointer;
    padding:6px 0 0; font-size:11.5px; text-align:left; }
</style>
</head>
<body>
  <div class="brand"><span class="logo">CA</span><b>Marty</b></div>
  <p class="hint">Décris ton idée métier — Marty conçoit le modèle et ses livrables.</p>
  <textarea id="d" placeholder="Ex. : Suivi des crédits immobiliers : clients, comptes, prêts, échéances, garanties…"></textarea>
  <button class="primary" id="go">Générer un Data Product</button>
  <button class="link" id="key">🔑 Définir la clé API</button>
<script nonce="${n}">
  const vscode = acquireVsCodeApi();
  document.getElementById('go').addEventListener('click', () => {
    const description = document.getElementById('d').value.trim();
    vscode.postMessage(description ? { type: 'generate', description } : { type: 'open' });
  });
  document.getElementById('key').addEventListener('click', () => vscode.postMessage({ type: 'setKey' }));
</script>
</body>
</html>`;
}

// ---- HTML du webview ----

function nonce(): string {
  return Array.from({ length: 24 }, () => 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 62)]).join('');
}

function getHtml(webview: vscode.Webview): string {
  const n = nonce();
  const csp = `default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${n}'; img-src ${webview.cspSource} data:;`;
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
  h1 { font-size: 18px; margin: 0 0 4px; display: flex; align-items: center; gap: 8px; }
  .logo { width: 26px; height: 26px; border-radius: 6px; background: linear-gradient(155deg,var(--ca-dark),var(--ca-green)); color:#fff; display:inline-flex; align-items:center; justify-content:center; font-weight:700; font-size:12px; }
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
  .save-bar { position: sticky; bottom: 0; padding: 12px 0; background: var(--vscode-editor-background); }
</style>
</head>
<body>
<div class="wrap">
  <h1><span class="logo">CA</span> Marty — Générateur de Data Product</h1>
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
    <button class="ghost" id="setkey">Changer la clé API</button>
  </div>

  <div class="status hidden" id="status"></div>

  <div id="results" class="hidden">
    <div class="summary" id="summary"></div>
    <div class="tabs" id="tabs"></div>
    <div id="panes"></div>
    <div class="save-bar">
      <button class="primary" id="save">💾 Enregistrer dans le projet</button>
    </div>
  </div>
</div>

<script nonce="${n}">
  const vscode = acquireVsCodeApi();
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  window.addEventListener('load', () => vscode.postMessage({ type: 'ready' }));

  $('go').addEventListener('click', () => {
    const description = $('desc').value;
    vscode.postMessage({ type: 'generate', description, provider: $('provider').value });
  });
  $('setkey').addEventListener('click', () => vscode.postMessage({ type: 'setKey' }));
  $('save').addEventListener('click', () => vscode.postMessage({ type: 'save' }));

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
      if (m.hasKey === false) setStatus('⚠️ Aucune clé API configurée. Clique « Changer la clé API » ou lance une génération pour la saisir.');
    } else if (m.type === 'prefill') {
      $('desc').value = m.description || '';
    } else if (m.type === 'progress') {
      $('go').disabled = true;
      setStatus('<span class="spinner"></span> Génération en cours… (~50 s avec Claude Opus)');
      $('results').classList.add('hidden');
    } else if (m.type === 'error') {
      $('go').disabled = false;
      setStatus('✗ ' + esc(m.message), true);
    } else if (m.type === 'result') {
      $('go').disabled = false;
      $('status').classList.add('hidden');
      render(m.data);
    } else if (m.type === 'saved') {
      setStatus('✓ Livrables enregistrés.');
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

  function render(data) {
    lastData = data;
    $('results').classList.remove('hidden');
    const meta = data.meta || {};
    $('summary').innerHTML = '<b>' + esc(data.product.name) + '</b>' + (data.product.domain ? ' — ' + esc(data.product.domain) : '') +
      '<br>' + (meta.entities || 0) + ' entités • ' + (meta.attributes || 0) + ' attributs • ' + (meta.relations || 0) + ' relations' +
      ' <span style="opacity:.6">• ' + esc(meta.model) + ' • ' + (data.usage ? data.usage.total : 0) + ' tokens</span>';

    const mermaidBtn = document.createElement('button');
    mermaidBtn.className = 'ghost'; mermaidBtn.textContent = '🔗 Ouvrir mermaid.live';
    mermaidBtn.addEventListener('click', () => vscode.postMessage({ type: 'openExternal', url: 'https://mermaid.live/edit' }));
    const dbmlBtn = document.createElement('button');
    dbmlBtn.className = 'ghost'; dbmlBtn.textContent = '🔗 Ouvrir dbdiagram.io';
    dbmlBtn.addEventListener('click', () => vscode.postMessage({ type: 'openExternal', url: 'https://dbdiagram.io/d' }));

    const d = data.deliverables;
    const tabsDef = [
      ['Modèle', modelPane(data)],
      ['SQL DDL', codePane(d.sql)],
      ['DBML', codePane(d.dbml, [dbmlBtn])],
      ['dbt', codePane(d.dbt)],
      ['Dictionnaire', codePane(d.dictionary)],
      ['ERD (Mermaid)', codePane(d.mermaid, [mermaidBtn])],
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
