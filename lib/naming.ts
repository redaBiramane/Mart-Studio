// ============================================================
// Mart Studio — Connecteur "Naming Studio" (fieldmapper.space)
// Standardise les noms de colonnes/tables via l'API publique du dictionnaire.
// ============================================================

const NAMING_API = 'https://www.fieldmapper.space/api/transform';

// Transforme un seul nom. En cas d'erreur réseau, renvoie le nom d'origine.
export async function transformName(keyword: string): Promise<string> {
  try {
    const res = await fetch(`${NAMING_API}?keyword=${encodeURIComponent(keyword)}`);
    if (!res.ok) return keyword;
    const data = await res.json();
    return (data && typeof data.transformed === 'string' && data.transformed) || keyword;
  } catch {
    return keyword;
  }
}

// Transforme une liste de noms (uniques) avec une concurrence limitée pour ne
// pas saturer l'API. Renvoie une table { nomOriginal: nomStandardisé }.
export async function transformMany(keywords: string[]): Promise<Record<string, string>> {
  const unique = Array.from(new Set(keywords.filter(Boolean)));
  const map: Record<string, string> = {};
  const POOL = 8;
  let i = 0;

  async function worker() {
    while (i < unique.length) {
      const idx = i++;
      const k = unique[idx];
      map[k] = await transformName(k);
    }
  }

  await Promise.all(Array.from({ length: Math.min(POOL, unique.length) }, worker));
  return map;
}
