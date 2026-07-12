// ============================================================
// Mart Studio — Générateurs de livrables (réutilisables serveur)
// ------------------------------------------------------------
// Fonctions PURES (aucune dépendance React / DOM) transformant un
// modèle conceptuel en livrables : DDL SQL, DBML, dbt schema.yml et
// dictionnaire de données. Utilisées par l'API publique /api/v1/design.
// ============================================================

// ---- Modèle d'entrée (contrat de l'API) ----

export interface DesignEntity {
  name: string;
  definition?: string;
  type?: 'transactional' | 'reference' | 'event' | 'aggregate' | string;
}

export interface DesignAttribute {
  entityName: string;
  name: string;
  type: string;
  description?: string;
  isPK?: boolean;
  isFK?: boolean;
  required?: boolean;
  sensitive?: boolean;
}

export interface DesignRelation {
  source: string;
  target: string;
  cardinality: '1:1' | '1:N' | 'N:1' | 'N:N' | string;
  required?: boolean;
  description?: string;
}

export interface DesignKPI {
  name: string;
  formula?: string;
  description?: string;
}

export interface DesignRule {
  name: string;
  description?: string;
  type?: string;
}

export interface DesignProduct {
  name: string;
  businessProblem?: string;
  objective?: string;
  domain?: string;
}

export interface DesignModel {
  product: DesignProduct;
  entities: DesignEntity[];
  attributes: DesignAttribute[];
  relations: DesignRelation[];
  kpis: DesignKPI[];
  rules: DesignRule[];
}

export interface Deliverables {
  sql: string;
  dbml: string;
  dbt: string;
  dictionary: string;
}

// ---- Utilitaires de nommage / typage ----

function snake(s: string): string {
  return (s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // enlève les accents
    .trim()
    .replace(/['"`]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase();
}

// Aligne les types saisis sur des types SQL/Snowflake cohérents.
export function mapSqlType(type: string): string {
  const raw = (type || '').trim();
  if (!raw) return 'VARCHAR(255)';
  const m = raw.match(/^([a-zA-Z_]+)\s*(\(\s*\d+\s*(?:,\s*\d+\s*)?\))?/);
  if (!m) return raw.toUpperCase();
  const base = m[1].toLowerCase();
  const args = m[2] ? m[2].replace(/\s+/g, '') : '';
  const U = m[1].toUpperCase();
  if (['varchar', 'char', 'string', 'nvarchar', 'nchar', 'character'].includes(base))
    return args ? `${base === 'string' ? 'VARCHAR' : U}${args}` : (base === 'char' ? 'CHAR(1)' : 'VARCHAR(255)');
  if (['decimal', 'numeric', 'number'].includes(base))
    return args ? `${base === 'number' ? 'NUMBER' : U}${args}` : 'DECIMAL(18,4)';
  if (['int', 'integer', 'bigint', 'smallint', 'tinyint', 'byteint', 'serial', 'int2', 'int4', 'int8'].includes(base)) return 'BIGINT';
  if (['float', 'double', 'real', 'float4', 'float8'].includes(base)) return 'FLOAT';
  if (base === 'datetime' || base === 'timestamp' || (base === 'date' && raw.toLowerCase().includes('time'))) return 'TIMESTAMP';
  if (base === 'date') return 'DATE';
  if (base === 'time') return 'TIME';
  if (base === 'bool' || base === 'boolean') return 'BOOLEAN';
  if (base === 'text') return 'TEXT';
  if (base === 'variant') return 'VARIANT';
  return U + args;
}

function oneLine(text: string | undefined): string {
  return (text || '').replace(/\s+/g, ' ').trim();
}

// ---- Normalisation du modèle brut renvoyé par le LLM ----

// Rend le modèle robuste : dédoublonne, garantit une PK par entité, matérialise
// les entités seulement citées dans les relations, aligne les types.
export function normalizeModel(raw: unknown): DesignModel {
  const r = (raw || {}) as Record<string, unknown>;
  const asArr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

  const product = (r.product || {}) as DesignProduct;
  const entities = asArr<DesignEntity>(r.entities)
    .filter((e) => e && e.name)
    .map((e) => ({ name: String(e.name).trim(), definition: e.definition, type: e.type }));

  const entityNames = new Set(entities.map((e) => e.name));
  const relations = asArr<DesignRelation>(r.relations)
    .filter((rel) => rel && rel.source && rel.target)
    .map((rel) => ({
      source: String(rel.source).trim(),
      target: String(rel.target).trim(),
      cardinality: (rel.cardinality || '1:N') as DesignRelation['cardinality'],
      required: rel.required !== false,
      description: rel.description,
    }));

  // Matérialise toute entité citée dans une relation mais non déclarée.
  relations.forEach((rel) => {
    [rel.source, rel.target].forEach((n) => {
      if (!entityNames.has(n)) {
        entityNames.add(n);
        entities.push({ name: n, definition: 'Entité déduite des relations', type: 'reference' });
      }
    });
  });

  let attributes = asArr<DesignAttribute>(r.attributes)
    .filter((a) => a && a.entityName && a.name && entityNames.has(String(a.entityName).trim()))
    .map((a) => ({
      entityName: String(a.entityName).trim(),
      name: snake(String(a.name)),
      type: String(a.type || 'VARCHAR(255)'),
      description: a.description,
      isPK: !!a.isPK,
      isFK: !!a.isFK,
      required: a.required !== false,
      sensitive: !!a.sensitive,
    }));

  // Dédoublonne (entité, colonne) et garantit une PK par entité.
  const seen = new Set<string>();
  attributes = attributes.filter((a) => {
    const k = `${a.entityName}::${a.name}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  entities.forEach((e) => {
    const has = attributes.some((a) => a.entityName === e.name && a.isPK);
    if (!has) {
      attributes.unshift({
        entityName: e.name,
        name: `${snake(e.name)}_id`,
        type: 'BIGINT',
        description: `Identifiant technique de ${e.name}`,
        isPK: true,
        isFK: false,
        required: true,
        sensitive: false,
      });
    }
  });

  const kpis = asArr<DesignKPI>(r.kpis).filter((k) => k && k.name);
  const rules = asArr<DesignRule>(r.rules).filter((x) => x && x.name);

  return {
    product: {
      name: product.name || 'Data Product',
      businessProblem: product.businessProblem,
      objective: product.objective,
      domain: product.domain,
    },
    entities,
    attributes,
    relations,
    kpis,
    rules,
  };
}

// ---- Résolution des clés / FK ----

function pkOf(model: DesignModel, entityName: string): string {
  const pk = model.attributes.find((a) => a.entityName === entityName && a.isPK);
  return pk ? pk.name : `${snake(entityName)}_id`;
}

interface FkCol {
  entityName: string;      // table portant la FK (côté « plusieurs »)
  column: string;          // nom de la colonne FK
  refTable: string;        // table référencée
  refColumn: string;       // colonne référencée (PK)
  description: string;
}

// Détermine, pour chaque relation non-N:N, où poser la clé étrangère.
function foreignKeys(model: DesignModel): FkCol[] {
  const fks: FkCol[] = [];
  model.relations.forEach((rel) => {
    if (rel.cardinality === 'N:N') return;
    // Côté « un » = parent ; côté « plusieurs » = enfant (porte la FK).
    let parent = rel.source, child = rel.target;
    if (rel.cardinality === 'N:1') { parent = rel.target; child = rel.source; }
    const refPk = pkOf(model, parent);
    const column = `${snake(parent)}_${refPk}`.replace(/_+/g, '_');
    fks.push({
      entityName: child,
      column,
      refTable: snake(parent),
      refColumn: refPk,
      description: oneLine(rel.description) || `Référence vers ${parent}`,
    });
  });
  return fks;
}

// ---- DDL SQL ----

export function generateSQL(model: DesignModel): string {
  const p = model.product;
  let sql = `-- ============================================\n-- ${p.name} — DDL SQL\n-- Généré par Marty (API /api/v1/design)\n`;
  if (p.objective) sql += `-- Objectif : ${oneLine(p.objective)}\n`;
  sql += `-- ============================================\n\n`;

  const fks = foreignKeys(model);

  model.entities.forEach((e) => {
    const table = snake(e.name);
    const cols = model.attributes.filter((a) => a.entityName === e.name);
    // Chaque ligne = { def, comment }. La virgule de séparation est placée APRÈS
    // le def mais AVANT le commentaire inline (sinon la virgule tombe dans le
    // « -- … » et l'instruction CREATE TABLE devient invalide).
    const items: { def: string; comment: string }[] = [];

    cols.forEach((c) => {
      let def = `    ${c.name} ${mapSqlType(c.type)}`;
      if (c.isPK) def += ' PRIMARY KEY';
      else if (c.required) def += ' NOT NULL';
      items.push({ def, comment: oneLine(c.description) });
    });

    // Colonnes FK portées par cette table (côté « plusieurs »).
    const tableFks = fks.filter((f) => f.entityName === e.name);
    tableFks.forEach((f) => {
      items.push({ def: `    ${f.column} BIGINT`, comment: f.description });
    });
    // Contraintes FK (jamais de commentaire → pas de risque de virgule).
    tableFks.forEach((f) => {
      items.push({ def: `    CONSTRAINT fk_${table}_${f.column} FOREIGN KEY (${f.column}) REFERENCES ${f.refTable}(${f.refColumn})`, comment: '' });
    });

    const body = items
      .map((it, i) => `${it.def}${i < items.length - 1 ? ',' : ''}${it.comment ? ` -- ${it.comment}` : ''}`)
      .join('\n');

    sql += `-- ${oneLine(e.definition) || e.name}\nCREATE TABLE ${table} (\n${body}\n);\n\n`;
  });

  // Tables de jointure pour les N:N.
  const done = new Set<string>();
  model.relations.forEach((rel) => {
    if (rel.cardinality !== 'N:N') return;
    const a = snake(rel.source), b = snake(rel.target);
    const key = [a, b].sort().join('__');
    if (done.has(key)) return;
    done.add(key);
    const aPk = pkOf(model, rel.source), bPk = pkOf(model, rel.target);
    const jt = `${a}_${b}`;
    sql += `-- Table d'association N:N entre ${rel.source} et ${rel.target}\n`;
    sql += `CREATE TABLE ${jt} (\n`;
    sql += `    ${a}_${aPk} BIGINT NOT NULL,\n`;
    sql += `    ${b}_${bPk} BIGINT NOT NULL,\n`;
    sql += `    PRIMARY KEY (${a}_${aPk}, ${b}_${bPk}),\n`;
    sql += `    CONSTRAINT fk_${jt}_${a} FOREIGN KEY (${a}_${aPk}) REFERENCES ${a}(${aPk}),\n`;
    sql += `    CONSTRAINT fk_${jt}_${b} FOREIGN KEY (${b}_${bPk}) REFERENCES ${b}(${bPk})\n`;
    sql += `);\n\n`;
  });

  return sql.trimEnd() + '\n';
}

// ---- DBML (dbdiagram.io) ----

function dbmlType(type: string): string {
  return mapSqlType(type).toLowerCase();
}

export function generateDBML(model: DesignModel): string {
  let dbml = `// ${model.product.name} — Généré par Marty\n\n`;
  const fks = foreignKeys(model);

  model.entities.forEach((e) => {
    const table = snake(e.name);
    dbml += `Table ${table} {\n`;
    model.attributes.filter((a) => a.entityName === e.name).forEach((c) => {
      const flags: string[] = [];
      if (c.isPK) flags.push('pk');
      if (c.required && !c.isPK) flags.push('not null');
      const note = oneLine(c.description);
      if (note) flags.push(`note: '${note.replace(/'/g, "\\'")}'`);
      dbml += `  ${c.name} ${dbmlType(c.type)}${flags.length ? ` [${flags.join(', ')}]` : ''}\n`;
    });
    fks.filter((f) => f.entityName === e.name).forEach((f) => {
      dbml += `  ${f.column} bigint\n`;
    });
    dbml += `}\n\n`;
  });

  // Références (FK simples).
  fks.forEach((f) => {
    dbml += `Ref: ${snake(f.entityName)}.${f.column} > ${f.refTable}.${f.refColumn}\n`;
  });

  return dbml.trimEnd() + '\n';
}

// ---- dbt schema.yml ----

export function generateDbt(model: DesignModel): string {
  let y = `version: 2\n\nmodels:\n`;
  model.entities.forEach((e) => {
    const table = snake(e.name);
    y += `  - name: ${table}\n`;
    if (e.definition) y += `    description: "${oneLine(e.definition).replace(/"/g, '\\"')}"\n`;
    const cols = model.attributes.filter((a) => a.entityName === e.name);
    if (cols.length) {
      y += `    columns:\n`;
      cols.forEach((c) => {
        y += `      - name: ${c.name}\n`;
        if (c.description) y += `        description: "${oneLine(c.description).replace(/"/g, '\\"')}"\n`;
        const tests: string[] = [];
        if (c.isPK) { tests.push('unique'); tests.push('not_null'); }
        else if (c.required) tests.push('not_null');
        if (tests.length) y += `        tests:\n${tests.map((t) => `          - ${t}`).join('\n')}\n`;
      });
    }
    y += `\n`;
  });
  return y.trimEnd() + '\n';
}

// ---- Dictionnaire de données (Markdown) ----

export function generateDictionary(model: DesignModel): string {
  let md = `# Dictionnaire de données — ${model.product.name}\n\n`;
  if (model.product.objective) md += `> ${oneLine(model.product.objective)}\n\n`;

  model.entities.forEach((e) => {
    md += `## ${e.name}\n\n`;
    if (e.definition) md += `${oneLine(e.definition)}\n\n`;
    md += `| Attribut | Type | PK | FK | Requis | Sensible | Description |\n`;
    md += `| --- | --- | :-: | :-: | :-: | :-: | --- |\n`;
    model.attributes.filter((a) => a.entityName === e.name).forEach((c) => {
      md += `| ${c.name} | ${mapSqlType(c.type)} | ${c.isPK ? '✓' : ''} | ${c.isFK ? '✓' : ''} | ${c.required ? '✓' : ''} | ${c.sensitive ? '🔒' : ''} | ${oneLine(c.description)} |\n`;
    });
    md += `\n`;
  });

  if (model.relations.length) {
    md += `## Relations\n\n| Source | Cardinalité | Cible | Description |\n| --- | :-: | --- | --- |\n`;
    model.relations.forEach((r) => {
      md += `| ${r.source} | ${r.cardinality} | ${r.target} | ${oneLine(r.description)} |\n`;
    });
    md += `\n`;
  }

  if (model.kpis.length) {
    md += `## Indicateurs (KPI)\n\n`;
    model.kpis.forEach((k) => {
      md += `- **${k.name}**${k.formula ? ` — \`${oneLine(k.formula)}\`` : ''}${k.description ? ` : ${oneLine(k.description)}` : ''}\n`;
    });
    md += `\n`;
  }

  if (model.rules.length) {
    md += `## Règles métier\n\n`;
    model.rules.forEach((r) => {
      md += `- **${r.name}**${r.type ? ` _(${r.type})_` : ''}${r.description ? ` : ${oneLine(r.description)}` : ''}\n`;
    });
    md += `\n`;
  }

  return md.trimEnd() + '\n';
}

// ---- Agrégat ----

export function buildDeliverables(model: DesignModel): Deliverables {
  return {
    sql: generateSQL(model),
    dbml: generateDBML(model),
    dbt: generateDbt(model),
    dictionary: generateDictionary(model),
  };
}
