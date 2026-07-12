# marty-cli

Client d'exemple pour l'**API Marty** — le « Data Architect en tant que service ».
Vous envoyez une **description métier**, l'API renvoie un **modèle de données** complet
et ses **livrables** (SQL, DBML, dbt, dictionnaire), que ce CLI écrit sur disque.

## Prérequis

- Node.js ≥ 18 (fetch natif)
- Une **clé d'API** Marty (fournie par l'administrateur ; elle doit figurer dans
  la variable serveur `MARTY_API_KEYS` de l'application Marty).

## Installation

```bash
cd clients/marty-cli
npm install
cp .env.example .env      # puis renseignez MARTY_API_URL et MARTY_API_KEY
```

## Utilisation

```bash
# Description en argument
npm start -- "Suivi des crédits immobiliers : clients, comptes, prêts, échéances et garanties."

# Description depuis un fichier
npm start -- --file ./brief.txt --out ./out

# Description via stdin
echo "Gestion des sinistres auto : contrat, assuré, sinistre, expert, indemnisation." | npm start

# Choisir le fournisseur (défaut : anthropic / Claude Opus)
npm start -- --provider google "Portefeuille d'épargne : client, produit, versement, solde."
```

Les livrables sont écrits dans `out/<nom-du-produit>/` :

```
out/suivi-des-credits-immobiliers/
├── model.json      # entités, attributs, relations, KPI, règles
├── schema.sql      # DDL (PK, NOT NULL, FK, tables d'association N:N)
├── schema.dbml     # à coller dans dbdiagram.io
├── schema.yml      # dbt (models + tests unique/not_null)
└── dictionary.md   # dictionnaire de données
```

## L'API sous-jacente

`POST /api/v1/design`

| | |
| --- | --- |
| **Auth** | `Authorization: Bearer <clé>` (ou en-tête `x-api-key`) |
| **Body** | `{ "description": "…", "options": { "provider": "anthropic\|google", "model": "…" } }` |
| **Réponse** | `{ product, model{entities,attributes,relations,kpis,rules}, deliverables{sql,dbml,dbt,dictionary}, usage, meta }` |

Exemple `curl` équivalent :

```bash
curl -X POST "$MARTY_API_URL/api/v1/design" \
  -H "Authorization: Bearer $MARTY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"description":"Suivi des crédits immobiliers : clients, comptes, prêts."}'
```

> ⚠️ Chaque appel consomme des **tokens LLM** (coût). L'API applique une
> limitation de débit par clé et journalise chaque appel (audit).
