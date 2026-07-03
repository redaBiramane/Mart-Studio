// ============================================================
// Mart Studio — Parseur DDL (Snowflake / SQL standard / PROC SQL)
// Extrait tables, colonnes, types, clés primaires et étrangères
// à partir d'un script CREATE TABLE collé par l'utilisateur.
// ============================================================

export interface ParsedColumn {
  name: string;
  type: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
}
export interface ParsedTable {
  name: string;
  columns: ParsedColumn[];
}
export interface ParsedRelation {
  source: string; // table référencée (côté 1)
  target: string; // table portant la FK (côté N)
  fkColumn: string;
  refColumn: string;
}
export interface ParsedDDL {
  tables: ParsedTable[];
  relations: ParsedRelation[];
}

function clean(id: string): string {
  return id.replace(/["`\[\]]/g, '').replace(/;$/, '').trim();
}
function baseName(qualified: string): string {
  const parts = clean(qualified).split('.');
  return parts[parts.length - 1];
}

// Découpe une chaîne par les virgules de premier niveau (hors parenthèses)
function splitTopLevel(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of body) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; }
    else cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  return parts;
}

function parenCols(s: string): string[] {
  const m = s.match(/\(([^)]*)\)/);
  if (!m) return [];
  return m[1].split(',').map((c) => clean(c));
}

export function parseDDL(sql: string): ParsedDDL {
  const tables: ParsedTable[] = [];
  const relations: ParsedRelation[] = [];

  // Retire les commentaires
  const text = sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ');

  const re = /create\s+(?:or\s+replace\s+)?(?:transient\s+|temporary\s+|global\s+|local\s+|volatile\s+)?table\s+(?:if\s+not\s+exists\s+)?([\w."`\[\]]+)\s*\(/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const tableName = baseName(m[1]);
    // Scanne le corps en équilibrant les parenthèses depuis le '(' capturé
    let i = re.lastIndex;
    const start = i;
    let depth = 1;
    while (i < text.length && depth > 0) {
      const ch = text[i];
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      i++;
    }
    const body = text.slice(start, i - 1);
    re.lastIndex = i;

    const columns: ParsedColumn[] = [];
    const pkCols = new Set<string>();

    for (const raw of splitTopLevel(body)) {
      const t = raw.trim();
      if (!t) continue;
      const low = t.toLowerCase();

      // Contrainte PRIMARY KEY (col, ...)
      if (/^(constraint\b.*)?primary\s+key/i.test(low) && /\(/.test(t) && !/^\w+\s+/.test(low.replace(/^constraint\s+\w+\s+/, ''))) {
        parenCols(t).forEach((c) => pkCols.add(c.toLowerCase()));
        continue;
      }
      // Contrainte FOREIGN KEY (col) REFERENCES table (col)
      if (/foreign\s+key/i.test(low)) {
        const fk = t.match(/foreign\s+key\s*\(([^)]+)\)\s*references\s+([\w."`\[\]]+)\s*\(([^)]+)\)/i);
        if (fk) {
          const fkCol = clean(fk[1].split(',')[0]);
          relations.push({ source: baseName(fk[2]), target: tableName, fkColumn: fkCol, refColumn: clean(fk[3].split(',')[0]) });
          const col = columns.find((c) => c.name.toLowerCase() === fkCol.toLowerCase());
          if (col) col.isForeignKey = true;
        }
        continue;
      }
      // Autres contraintes de table
      if (/^(constraint|unique|check|primary|foreign|like)\b/i.test(low)) {
        if (/primary\s+key/i.test(low)) parenCols(t).forEach((c) => pkCols.add(c.toLowerCase()));
        continue;
      }

      // Définition de colonne : nom type ...
      const cm = t.match(/^([\w."`\[\]]+)\s+([\s\S]+)$/);
      if (!cm) continue;
      const name = clean(cm[1]);
      if (!name) continue;
      const rest = cm[2].trim();
      const typeMatch = rest.match(/^([a-zA-Z_][\w]*\s*(\([^)]*\))?)/);
      const type = (typeMatch ? typeMatch[1] : 'varchar').replace(/\s+/g, '').toLowerCase();
      const isPk = /\bprimary\s+key\b/i.test(rest);
      const inlineFk = rest.match(/references\s+([\w."`\[\]]+)\s*\(([^)]+)\)/i);
      if (isPk) pkCols.add(name.toLowerCase());
      if (inlineFk) {
        relations.push({ source: baseName(inlineFk[1]), target: tableName, fkColumn: name, refColumn: clean(inlineFk[2].split(',')[0]) });
      }
      columns.push({ name, type, isPrimaryKey: isPk, isForeignKey: !!inlineFk });
    }

    columns.forEach((c) => { if (pkCols.has(c.name.toLowerCase())) c.isPrimaryKey = true; });
    if (columns.length > 0) tables.push({ name: tableName, columns });
  }

  return { tables, relations };
}
