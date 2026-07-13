# Marty — Extension VSCode

Décris ton **idée métier** dans VSCode, reçois un **modèle de données** complet et
ses **livrables** (SQL DDL, DBML, dbt, dictionnaire, diagramme ERD) dans un panneau,
puis enregistre-les dans ton projet en un clic.

L'extension appelle l'API Marty (`POST /api/v1/design`) — aucun traitement local.

## Installation (interne, via .vsix)

1. Récupère le fichier `marty-vscode-0.4.0.vsix` (généré par `npm run package`).
2. Dans VSCode : **Extensions** → menu `…` en haut → **Install from VSIX…** → choisis le fichier.
   (ou en ligne de commande : `code --install-extension marty-vscode-0.4.0.vsix`)

## Configuration

1. `Cmd/Ctrl+Shift+P` → **« Marty : Définir la clé API »** → colle ta clé `marty_…`
   (elle est stockée de façon **sécurisée** dans le SecretStorage de VSCode, jamais en clair).
2. (Optionnel) Réglages → `marty.apiUrl` (défaut `https://www.martstudio.it.com`) et
   `marty.provider` (`anthropic` = Claude Opus, `google` = Gemini Flash).

## Utilisation

1. `Cmd/Ctrl+Shift+P` → **« Marty : Générer un Data Product »**.
2. Tape ton idée métier, clique **Générer** (~50 s avec Claude Opus).
3. Explore les onglets : **Modèle**, **SQL DDL**, **DBML**, **dbt**, **Dictionnaire**, **ERD (Mermaid)**.
4. **💾 Enregistrer dans le projet** → écrit les fichiers dans `marty-out/<nom>/`.

## Développement / build du .vsix

```bash
cd clients/marty-vscode
npm install
npm run compile          # compile TypeScript -> out/
npm run package          # génère le .vsix (via @vscode/vsce)
```

Pour tester en direct : ouvre ce dossier dans VSCode et appuie sur **F5**
(« Run Extension ») — une fenêtre VSCode de test se lance avec l'extension chargée.

## Publier plus tard sur le Marketplace (optionnel)

`vsce publish` avec un compte éditeur Azure DevOps. À évaluer côté gouvernance
avant toute publication publique d'un outil badgé Crédit Agricole.
