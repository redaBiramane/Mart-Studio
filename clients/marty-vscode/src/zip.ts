// ============================================================
// Écriture d'archives ZIP — sans dépendance externe
// ------------------------------------------------------------
// L'extension est packagée avec `vsce --no-dependencies` : aucune
// dépendance runtime n'est embarquée. On écrit donc un ZIP minimal
// (méthode « deflate ») avec la seule aide de zlib, fourni par Node.
// ============================================================

import { deflateRawSync } from 'node:zlib';

// Table CRC-32 (polynôme standard 0xEDB88320).
const CRC_TABLE: number[] = (() => {
  const t: number[] = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// Date/heure au format MS-DOS attendu par le format ZIP.
function dosDateTime(d: Date): { time: number; date: number } {
  const time = ((d.getHours() & 0x1f) << 11) | ((d.getMinutes() & 0x3f) << 5) | ((d.getSeconds() / 2) & 0x1f);
  const date = (((d.getFullYear() - 1980) & 0x7f) << 9) | (((d.getMonth() + 1) & 0x0f) << 5) | (d.getDate() & 0x1f);
  return { time, date };
}

export interface ZipEntry {
  name: string;
  content: string;
}

export function createZip(entries: ZipEntry[]): Buffer {
  const { time, date } = dosDateTime(new Date());
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const raw = Buffer.from(entry.content, 'utf8');
    const deflated = deflateRawSync(raw);
    const crc = crc32(raw);

    // En-tête local (30 octets + nom) puis données compressées.
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);  // signature
    local.writeUInt16LE(20, 4);          // version minimale
    local.writeUInt16LE(0, 6);           // drapeaux
    local.writeUInt16LE(8, 8);           // méthode : deflate
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(deflated.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);          // pas de champ « extra »
    locals.push(local, nameBuf, deflated);

    // Entrée du répertoire central (46 octets + nom).
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);        // version d'écriture
    central.writeUInt16LE(20, 6);        // version minimale
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(deflated.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);        // extra
    central.writeUInt16LE(0, 32);        // commentaire
    central.writeUInt16LE(0, 34);        // disque de départ
    central.writeUInt16LE(0, 36);        // attributs internes
    central.writeUInt32LE(0, 38);        // attributs externes
    central.writeUInt32LE(offset, 42);   // position de l'en-tête local
    centrals.push(central, nameBuf);

    offset += local.length + nameBuf.length + deflated.length;
  }

  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);                    // numéro de disque
  end.writeUInt16LE(0, 6);                    // disque du répertoire central
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);              // début du répertoire central
  end.writeUInt16LE(0, 20);                   // commentaire

  return Buffer.concat([...locals, centralBuf, end]);
}
