# Marty — Guide administrateur (gestion des clés)

## Le modèle de clés — à bien comprendre

```
Utilisateur (VSCode)  ──marty_xxx──►  API Marty (Vercel)  ──sk-ant-xxx──►  Claude
                                       ▲
                                       └─ LA clé Claude vit ICI, et nulle part ailleurs
```

| Clé | Combien | Où elle vit | Qui la voit |
| --- | --- | --- | --- |
| `ANTHROPIC_API_KEY` (`sk-ant-…`) | **1 seule** | Variables d'env. Vercel (serveur) | **Toi uniquement** |
| `MARTY_API_KEYS` (`marty_…`) | **1 par utilisateur** | Variables d'env. Vercel + poste de l'utilisateur | L'utilisateur concerné |

> ⛔ **Ne distribue JAMAIS de clé Claude/Anthropic aux utilisateurs.** Ils n'en ont pas besoin :
> le serveur appelle l'IA pour eux. L'extension n'a d'ailleurs aucun champ pour ça.
> ⛔ Ne préfixe **jamais** ces variables par `NEXT_PUBLIC_` (elles seraient exposées au navigateur).

---

## Émettre une clé pour un nouvel utilisateur

### 1. Générer la clé

```bash
echo "marty_$(openssl rand -hex 24)"
# → marty_9f3c1d... (48 caractères aléatoires)
```

### 2. L'ajouter dans Vercel

**Vercel → Projet → Settings → Environment Variables → `MARTY_API_KEYS`**

Les clés sont **séparées par des virgules** (sans espace) :

```
marty_aaaa…,marty_bbbb…,marty_cccc…
```

Ajoute la nouvelle à la suite, puis **Save** → **Redeploy** (obligatoire pour que la
nouvelle clé soit prise en compte).

### 3. Tenir un registre

L'audit journalise chaque appel sous la forme `api:key_XXXX` (les **4 derniers caractères**
de la clé). Garde donc une correspondance quelque part (fichier interne, pas dans git) :

| Personne | 4 derniers car. | Émise le |
| --- | --- | --- |
| Reda B. | `a0c9` | 2026-07-12 |
| … | … | … |

### 4. Transmettre à l'utilisateur

Envoie-lui **3 choses** :
1. le fichier `marty-vscode-0.3.0.vsix`
2. le fichier `QUICK-START.md`
3. **sa** clé `marty_…` (par un canal sûr — messagerie interne, pas un mail public)

---

## Révoquer une clé

Retire simplement la clé de `MARTY_API_KEYS` → **Save** → **Redeploy**.
L'utilisateur reçoit alors `HTTP 401` à la prochaine tentative. Les autres ne sont pas affectés.

---

## Surveiller l'usage

- **Coût** : chaque génération consomme des tokens Claude Opus (~6 000–8 000 tokens,
  soit quelques centimes). C'est **ta** clé Anthropic qui est débitée.
- **Audit** : chaque appel est enregistré dans la table `activity_logs` de Supabase
  (`action = 'api_design'`, avec le nombre d'entités, les tokens et le fournisseur).
- **Limite de débit** : 12 requêtes/minute par clé (protection contre les abus).

---

## Quand passer à autre chose

Le système actuel (liste de clés dans une variable d'environnement) est parfait
**jusqu'à ~15–20 utilisateurs**. Ses limites :

- il faut **redéployer** à chaque ajout/retrait de clé ;
- pas de self-service ;
- pas de quota par personne.

Au-delà, il faudra une **table `api_keys` en base** (clés hachées, révocation immédiate,
quota et statistiques par utilisateur, création depuis l'interface d'administration).
