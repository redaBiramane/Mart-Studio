# Marty pour VSCode — Démarrage rapide (5 minutes)

> Décris ton idée métier → reçois un **modèle de données** complet et ses **livrables**
> (SQL, DBML, dbt, dictionnaire, couche sémantique, contrôle qualité, diagramme ERD).

Tu as reçu **2 éléments** de l'administrateur :

| | |
| --- | --- |
| 📦 `marty-vscode-0.3.0.vsix` | L'extension à installer |
| 🔑 Une clé `marty_…` | **Personnelle** — ne la partage pas |

> ℹ️ **Tu n'as besoin d'AUCUNE clé Claude / OpenAI.** L'IA est appelée par le serveur Marty.
> Ta clé `marty_…` sert uniquement à t'identifier auprès de l'API interne.

---

## 1️⃣ Installer l'extension

1. Dans VSCode : `Cmd+Shift+X` (Mac) / `Ctrl+Shift+X` (Windows) → panneau **Extensions**.
2. Clique le menu **`…`** en haut du panneau → **« Install from VSIX… »**.
3. Sélectionne le fichier **`marty-vscode-0.3.0.vsix`**.

✅ Une **icône Marty** (verte) apparaît dans la barre d'activité, à gauche.

---

## 2️⃣ Enregistrer ta clé

1. `Cmd+Shift+P` / `Ctrl+Shift+P` → tape **`Marty : Définir la clé API`**.
2. Colle ta clé `marty_…` → Entrée.

> Elle est stockée **chiffrée** dans le coffre sécurisé de VSCode. À faire **une seule fois**.

---

## 3️⃣ Générer ton premier Data Product

1. Clique l'**icône Marty** dans la barre de gauche.
2. Décris ton besoin, par exemple :

   > *Suivi des crédits immobiliers : clients, comptes, prêts, échéances de remboursement,
   > garanties. Je veux suivre l'encours, les impayés et le taux de couverture des garanties.*

3. Clique **Générer un Data Product** (~50 s avec Claude Opus).

---

## 4️⃣ Exploiter le résultat

Le panneau affiche **8 onglets** :

**Modèle** · **SQL DDL** · **DBML** · **DBT** · **Semantic Layer** · **Dictionnaire** · **Qualité** · **Diagramme ERD**

Puis, en bas, **3 façons de récupérer** :

- **💾 Enregistrer dans le projet** → fichiers dans `marty-out/<nom>/`
- **📦 Télécharger le package (.zip)** → une archive à archiver ou envoyer
- **🌐 Continuer sur martstudio.it.com** → pour poursuivre l'atelier complet (KPI, gouvernance, rapport DAD)

---

## 💡 Pour un meilleur modèle

Plus ta description est riche, meilleur est le résultat. Précise :
- les **objets métier** (clients, contrats, produits…),
- ce que tu veux **mesurer** (les KPI),
- les **règles de gestion**,
- le **domaine** (crédit, épargne, assurance…).

## ⚠️ Confidentialité

Décris la **structure** et le **besoin** — ne colle jamais de **données réelles**
(vrais noms, IBAN, montants clients).

---

## En cas de souci

| Symptôme | Solution |
| --- | --- |
| Pas d'icône Marty | `Cmd/Ctrl+Shift+P` → **Reload Window** |
| *« Aucune clé API »* | Refais l'étape 2️⃣ |
| *HTTP 401* | Clé invalide/révoquée → redemande-la à l'administrateur |
| *HTTP 429* | Limite atteinte → patiente une minute |

Guide complet : `GUIDE.md`. Une question ? Contacte l'équipe Marty.
