// ============================================================
// Mart Studio — Contrôleur de qualité du MCD (linter)
// Analyse le modèle et propose des corrections (version actuelle → améliorée).
// Aucune modification n'est appliquée sans le choix de l'utilisateur.
// ============================================================

import type { WorkshopSession, Attribute } from './types';

export type Severity = 'error' | 'warning' | 'info';

export type LinterPatch =
  | { kind: 'attrType'; attrId: string; type: string }
  | { kind: 'attrSensitive'; attrId: string }
  | { kind: 'attrPk'; attrId: string }
  | { kind: 'addPk'; entityId: string; name: string }
  | { kind: 'removeAttr'; attrId: string };

export interface Finding {
  id: string;
  severity: Severity;
  category: string;
  entityName: string;
  target?: string;      // colonne concernée
  message: string;
  current?: string;     // version actuelle (affichage)
  suggested?: string;   // version améliorée (affichage)
  patch?: LinterPatch;  // comment appliquer
}

// ---- Normalisation des types ----
const TYPE_SYNONYMS: Record<string, string> = {
  numeric: 'decimal', number: 'decimal', float: 'decimal', double: 'decimal', real: 'decimal', money: 'decimal',
  integer: 'int', smallint: 'int', tinyint: 'int', serial: 'int',
  string: 'varchar', text: 'varchar', char: 'varchar', nvarchar: 'varchar', nchar: 'varchar',
  bool: 'boolean',
  datetime: 'timestamp', timestamptz: 'timestamp', timestamp_ntz: 'timestamp',
};
function baseType(t: string): string {
  const b = (t || '').toLowerCase().replace(/\(.*\)/, '').replace(/\s+/g, '').trim();
  return TYPE_SYNONYMS[b] || b;
}

// ---- Inférence du type attendu d'après le nom ----
function inferType(name: string): string | null {
  const n = name.toLowerCase();
  if (/(^|_)(id)$|^id_|_id_/.test(n)) return 'bigint';
  if (/mail|email|courriel/.test(n)) return 'varchar';
  if (/(^|_)(date|dt)(_|$)|_date$|date_|_naissance|_embauche|_souscription|_debut|_fin|_echeance|_decision|_demande/.test(n)) return 'date';
  if (/_at$|timestamp|horodatage/.test(n)) return 'timestamp';
  if (/montant|amount|prix|price|solde|encours|salaire|cout|coût|taux|rate|pourcentage|ratio|remise|commission|marge|chiffre|ca_|_ca$/.test(n)) return 'decimal';
  if (/^is_|^has_|^est_|_flag$|_bool$|actif_|_actif$/.test(n)) return 'boolean';
  if (/quantite|quantité|nombre|nb_|count|age|duree|durée|mois|trimestre|annee|année|jour/.test(n)) return 'int';
  if (/nom|prenom|prénom|libelle|libellé|label|titre|adresse|ville|pays|code|statut|type|categorie|catégorie|description|commentaire|telephone|téléphone|numero|numéro|reference|référence|segment|canal|region|région|nature|motif/.test(n)) return 'varchar';
  return null;
}

const PII = /(^|_)(nom|prenom|prénom|email|mail|courriel|telephone|téléphone|tel|mobile|adresse|ville|iban|rib|bic|carte|cni|passeport|naissance|date_naissance|nir|secu|salaire)($|_)/i;

const displayType = (t: string) => (t || 'varchar').toUpperCase();

export function lintModel(session: WorkshopSession): Finding[] {
  const findings: Finding[] = [];
  const attrsOf = (eid: string, ename: string) => session.attributes.filter((a) => a.entityId === eid || a.entityId === ename);

  session.entities.forEach((e) => {
    const attrs = attrsOf(e.id, e.name);

    // 1) Clé primaire manquante
    if (!attrs.some((a) => a.isPrimaryKey)) {
      const idCol = attrs.find((a) => /(^|_)id$|^id$/i.test(a.name));
      if (idCol) {
        findings.push({
          id: `pk-${e.id}`, severity: 'error', category: 'Clé primaire', entityName: e.name, target: idCol.name,
          message: `« ${e.name} » n'a pas de clé primaire. La colonne « ${idCol.name} » ressemble à un identifiant.`,
          current: 'aucune PK', suggested: `${idCol.name} = PK`, patch: { kind: 'attrPk', attrId: idCol.id },
        });
      } else {
        const pkName = slug(e.name) + '_id';
        findings.push({
          id: `pk-add-${e.id}`, severity: 'error', category: 'Clé primaire', entityName: e.name,
          message: `« ${e.name} » n'a pas de clé primaire. Ajouter un identifiant.`,
          current: 'aucune PK', suggested: `+ ${pkName} BIGINT PK`, patch: { kind: 'addPk', entityId: e.id, name: pkName },
        });
      }
    }

    // 2) Types suspects (inférence par le nom)
    attrs.forEach((a) => {
      const inferred = inferType(a.name);
      if (inferred && baseType(a.type) !== inferred) {
        const sev: Severity = (['decimal', 'int'].includes(baseType(a.type)) && ['varchar', 'date', 'boolean'].includes(inferred)) ? 'error' : 'warning';
        findings.push({
          id: `type-${a.id}`, severity: sev, category: 'Type de donnée', entityName: e.name, target: a.name,
          message: `Le type de « ${a.name} » semble incorrect.`,
          current: displayType(a.type), suggested: displayType(inferred), patch: { kind: 'attrType', attrId: a.id, type: inferred },
        });
      }
    });

    // 3) Données personnelles (RGPD) non marquées sensibles
    attrs.forEach((a) => {
      if (PII.test(a.name) && !a.isSensitive) {
        findings.push({
          id: `pii-${a.id}`, severity: 'warning', category: 'RGPD / Sensibilité', entityName: e.name, target: a.name,
          message: `« ${a.name} » est une donnée personnelle : à marquer sensible (RGPD).`,
          current: 'non sensible', suggested: 'sensible ✓', patch: { kind: 'attrSensitive', attrId: a.id },
        });
      }
    });

    // 4) Colonnes en double
    const seen = new Map<string, Attribute>();
    attrs.forEach((a) => {
      const key = a.name.trim().toLowerCase();
      if (seen.has(key)) {
        findings.push({
          id: `dup-${a.id}`, severity: 'warning', category: 'Doublon', entityName: e.name, target: a.name,
          message: `La colonne « ${a.name} » est en double dans « ${e.name} ».`,
          current: '2 colonnes', suggested: '1 colonne', patch: { kind: 'removeAttr', attrId: a.id },
        });
      } else { seen.set(key, a); }
    });

    // 5) Entité orpheline (aucune relation) — information, sans correctif auto
    const hasRel = session.relations.some((r) => r.sourceEntityId === e.id || r.targetEntityId === e.id || r.sourceEntityName === e.name || r.targetEntityName === e.name);
    if (!hasRel && session.entities.length > 1) {
      findings.push({
        id: `orphan-${e.id}`, severity: 'info', category: 'Relations', entityName: e.name,
        message: `« ${e.name} » n'a aucune relation : vérifiez si elle doit être reliée à une autre table.`,
      });
    }
  });

  const order: Record<Severity, number> = { error: 0, warning: 1, info: 2 };
  return findings.sort((a, b) => order[a.severity] - order[b.severity]);
}

// Applique une sélection de correctifs et renvoie les tableaux mis à jour.
export function applyPatches(session: WorkshopSession, patches: LinterPatch[]): { entities: WorkshopSession['entities']; attributes: Attribute[] } {
  let attributes = [...session.attributes];
  const entities = [...session.entities];

  patches.forEach((p) => {
    switch (p.kind) {
      case 'attrType':
        attributes = attributes.map((a) => (a.id === p.attrId ? { ...a, type: p.type } : a));
        break;
      case 'attrSensitive':
        attributes = attributes.map((a) => (a.id === p.attrId ? { ...a, isSensitive: true } : a));
        break;
      case 'attrPk':
        attributes = attributes.map((a) => (a.id === p.attrId ? { ...a, isPrimaryKey: true } : a));
        break;
      case 'removeAttr':
        attributes = attributes.filter((a) => a.id !== p.attrId);
        break;
      case 'addPk':
        attributes = [...attributes, {
          id: `a_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, entityId: p.entityId, name: p.name, type: 'bigint',
          description: '', isPrimaryKey: true, isForeignKey: false, isNaturalKey: false, isRequired: true, isSensitive: false, isHistorized: false,
        }];
        break;
    }
  });

  return { entities, attributes };
}

// Score de qualité 0–100 (pénalise erreurs et avertissements)
export function qualityScore(findings: Finding[]): number {
  const errors = findings.filter((f) => f.severity === 'error').length;
  const warnings = findings.filter((f) => f.severity === 'warning').length;
  return Math.max(0, Math.min(100, 100 - errors * 8 - warnings * 3));
}

function slug(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/_+/g, '_').replace(/^_|_$/g, '')
    .toLowerCase();
}
