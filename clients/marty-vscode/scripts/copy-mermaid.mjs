// Copie le bundle Mermaid dans media/ pour qu'il soit embarqué dans le .vsix.
// (Le webview le charge en local : aucune requête réseau, fonctionne hors ligne.)
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules', 'mermaid', 'dist', 'mermaid.min.js');
const destDir = join(root, 'media');
const dest = join(destDir, 'mermaid.min.js');

if (!existsSync(src)) {
  console.error('✗ mermaid introuvable. Lance « npm install » d\'abord.');
  process.exit(1);
}
mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log('✓ mermaid.min.js copié dans media/');
