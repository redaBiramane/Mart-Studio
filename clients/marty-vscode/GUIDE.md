# Guide d'utilisation — Extension Marty pour VSCode

**Marty** transforme une simple **description métier** en un **modèle de données** complet
et ses **livrables** (SQL, DBML, dbt, dictionnaire, diagramme ERD), directement dans VSCode.

> Public : porteurs de Data Products, data analysts, data engineers, MOA/MOE.
> Aucune compétence en modélisation requise — vous décrivez le besoin, Marty conçoit le modèle.

---

## 1. Ce dont vous avez besoin

- **VSCode** (version 1.85 ou plus récente).
- Le fichier **`marty-vscode-0.3.0.vsix`** (fourni par l'administrateur / par mail ou partage réseau).
- Une **clé API Marty** (format `marty_…`), fournie par l'administrateur. Elle est **personnelle** :
  ne la partagez pas.

---

## 2. Installer l'extension (2 minutes)

1. Ouvrez VSCode.
2. Ouvrez le panneau **Extensions** : `Cmd+Shift+X` (Mac) ou `Ctrl+Shift+X` (Windows/Linux).
3. En haut du panneau, cliquez le menu **`…`** (« Vues et plus d'actions »).
4. Choisissez **« Installer à partir d'un VSIX… »** (*Install from VSIX…*).
5. Sélectionnez le fichier **`marty-vscode-0.3.0.vsix`**.
6. VSCode confirme l'installation. C'est terminé.

> L'icône verte Marty apparaît dans la liste de vos extensions.

---

## 3. Enregistrer votre clé API (une seule fois)

1. Ouvrez la palette de commandes : `Cmd+Shift+P` (Mac) / `Ctrl+Shift+P` (Windows/Linux).
2. Tapez **`Marty : Définir la clé API`** et validez.
3. Collez votre clé `marty_…` et appuyez sur Entrée.

> Votre clé est stockée **de façon chiffrée** dans le coffre sécurisé de VSCode
> (*SecretStorage*). Elle n'apparaît jamais en clair et n'est pas synchronisée.

---

## 4. Générer un Data Product

**Deux accès possibles :**
- 🟢 **L'icône Marty dans la barre d'activité** (à gauche, comme Python) : cliquez dessus,
  tapez votre idée dans le panneau latéral, puis **Générer un Data Product**.
- Ou la palette de commandes → **`Marty : Générer un Data Product`**.

1. Un panneau **Marty** s'ouvre. Décrivez votre **idée métier** dans le champ, par exemple :

   > *« Suivi des crédits immobiliers : clients, comptes bancaires, prêts, échéances de
   > remboursement, garanties. Je veux suivre l'encours, les impayés et le taux de couverture
   > des garanties. »*

3. (Optionnel) Choisissez le modèle IA :
   - **Claude Opus** — le plus précis (recommandé), ~50 secondes.
   - **Gemini Flash** — plus rapide, un peu moins fin.
4. Cliquez **Générer**. Une barre de progression s'affiche pendant la conception.

### Plus votre description est riche, meilleur est le modèle
Mentionnez : les **objets métier** (clients, contrats, produits…), ce que vous voulez
**mesurer** (KPI), les **règles de gestion**, et le **domaine** (crédit, épargne, assurance…).

---

## 5. Explorer et récupérer les livrables

Une fois généré, le panneau affiche des **onglets** :

| Onglet | Contenu |
| --- | --- |
| **Modèle** | Vue lisible : chaque table avec ses colonnes, clés (PK/FK), données sensibles (🔒), relations, KPI et règles. |
| **SQL DDL** | Le script de création des tables (`CREATE TABLE…`), prêt à exécuter. |
| **DBML** | À coller sur [dbdiagram.io](https://dbdiagram.io) pour un schéma visuel interactif. |
| **DBT** | Le fichier `schema.yml` (modèles + tests `unique`/`not_null`). |
| **Semantic Layer** | La **lecture métier** du modèle : à quoi sert chaque objet, comment ils se relient (en français, sans jargon), ce que l'on mesure, les règles à respecter. À partager avec les métiers. |
| **Dictionnaire** | Le dictionnaire de données complet (tableau). |
| **Qualité** | Un **score sur 100** et les anomalies détectées : clé primaire manquante, clé étrangère absente, type suspect, donnée personnelle non marquée (RGPD), granularité non définie… avec la correction suggérée. |
| **Diagramme ERD** | Le **schéma entité-relation dessiné** directement dans VSCode (fonctionne hors ligne). Bouton `</> Voir le code` pour basculer sur la source Mermaid. |

Chaque onglet a un bouton **📋 Copier**.

### Récupérer les livrables — 3 possibilités

| Bouton | Ce qu'il fait |
| --- | --- |
| **💾 Enregistrer dans le projet** | Écrit les fichiers dans `marty-out/<nom-du-produit>/` de votre dossier VSCode ouvert. |
| **📦 Télécharger le package (.zip)** | Crée une archive `.zip` contenant tous les livrables, à l'emplacement de votre choix (pratique pour l'envoyer à un collègue). |
| **🌐 Continuer sur martstudio.it.com** | Copie le **DDL SQL** et ouvre l'application web. Créez-y un Data Product en mode **Expert** et collez le DDL pour poursuivre l'atelier complet (KPI, règles, qualité, gouvernance, rapport DAD…). |

Fichiers produits : `schema.sql`, `schema.dbml`, `schema.yml`, `dictionary.md`, `semantic-layer.md`, `quality.md`, `erd.mmd`, `model.json`.

---

## 6. Réglages (facultatif)

`Cmd/Ctrl+,` → recherchez « Marty » :

- **`marty.apiUrl`** — URL de l'API (par défaut `https://www.martstudio.it.com`).
- **`marty.provider`** — modèle IA par défaut (`anthropic` ou `google`).

---

## 7. En cas de problème

| Message / symptôme | Cause & solution |
| --- | --- |
| *« Aucune clé API »* | Vous n'avez pas encore enregistré votre clé → étape 3. |
| *HTTP 401 — Clé invalide* | Clé erronée ou révoquée → redemandez-en une à l'administrateur. |
| *HTTP 429 — Trop de requêtes* | Limite atteinte, patientez une minute. |
| *HTTP 503 — Service surchargé* | Réessayez dans quelques instants. |
| La commande Marty n'apparaît pas | Rechargez VSCode (`Cmd/Ctrl+Shift+P` → *Reload Window*). |

---

## 8. Bon à savoir

- **Où passent mes données ?** Votre description est envoyée à l'API Marty interne, qui
  appelle le modèle IA pour concevoir le schéma. Aucun traitement en local.
- **Confidentialité** : évitez de coller des **données réelles** (vraies valeurs clients).
  Décrivez la **structure** et le **besoin**, pas des enregistrements réels.
- **Coût** : chaque génération consomme des crédits IA côté plateforme — utilisez-la à bon escient.

---

Une question ou une amélioration à suggérer ? Contactez l'équipe Marty.
