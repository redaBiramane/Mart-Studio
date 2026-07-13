# Marty — Guide administrateur

## Le modèle d'authentification

```
Utilisateur (VSCode)  ──email+mdp──►  API Marty  ──sk-ant-xxx──►  Claude
   (son compte Marty)                  (Vercel)    ▲
                                                   └─ LA clé Claude vit ICI, et nulle part ailleurs
```

**Il n'y a plus aucune clé à distribuer.** L'utilisateur se connecte dans VSCode avec le
**compte Marty qu'il possède déjà** sur martstudio.it.com — exactement comme sur le site.

| Clé / identité | Combien | Où elle vit | Qui la voit |
| --- | --- | --- | --- |
| `ANTHROPIC_API_KEY` (`sk-ant-…`) | **1 seule** | Variables d'env. Vercel | **Toi uniquement** |
| Compte utilisateur (email + mdp) | 1 par personne | Supabase (déjà en place) | L'utilisateur |
| `MARTY_API_KEYS` (`marty_…`) | **Optionnel** | Variables d'env. Vercel | Scripts / CLI seulement |

> ⛔ **Ne distribue JAMAIS de clé Claude/Anthropic aux utilisateurs.** Ils n'en ont pas besoin :
> le serveur appelle l'IA pour eux. L'extension n'a d'ailleurs aucun champ pour ça.
> ⛔ Ne préfixe **jamais** ces variables par `NEXT_PUBLIC_` (elles seraient exposées au navigateur).

---

## Ajouter un utilisateur

**Rien à faire côté Vercel.** La personne crée (ou possède déjà) un compte sur
martstudio.it.com. Tu lui envoies simplement :

1. le fichier `marty-vscode-0.6.0.vsix`
2. le fichier `QUICK-START.md`

Elle se connecte dans VSCode avec ses identifiants habituels. C'est tout.

## Retirer un utilisateur

Dans ton **panneau Admin** (site) : passe son rôle à **`banned`** ou supprime le compte.
L'API refuse alors ses appels (`403 Compte désactivé`) — **immédiatement, sans redéploiement**.

## Faire tourner la clé Claude

Change `ANTHROPIC_API_KEY` dans Vercel → **Redeploy**.
✅ **Aucun impact utilisateur** : personne ne la connaît, personne ne la détient.

---

## Surveiller l'usage

- **Audit nominatif** : chaque génération est journalisée dans `activity_logs` avec le
  **vrai email** de la personne (`action = 'api_design'`, nombre d'entités, tokens, fournisseur).
  Visible dans **Supervision**.
- **Coût** : chaque génération consomme ~6 000–8 000 tokens Claude Opus (quelques centimes),
  débités sur **ta** clé Anthropic.
- **Limite de débit** : 12 requêtes/minute **par utilisateur**.

---

## Clés `MARTY_API_KEYS` — à quoi elles servent encore

Elles restent supportées, mais **uniquement pour les usages machine** : le CLI
(`clients/marty-cli`), un script, une intégration CI. Elles ne sont **pas** nécessaires
pour l'extension VSCode.

Émettre une clé machine :

```bash
echo "marty_$(openssl rand -hex 24)"
```

À placer dans `MARTY_API_KEYS` (plusieurs clés séparées par des virgules), puis **Redeploy**.
Si la variable n'est pas définie, seules les connexions par compte fonctionnent — ce qui est
parfaitement viable.
