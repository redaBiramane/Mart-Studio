'use client';

import { useRef, useState } from 'react';
import { useWorkshopStore } from '@/lib/store';
import { parseDDL } from '@/lib/ddl';
import { Entity, Attribute, Relation } from '@/lib/types';

type Status = 'available' | 'soon' | 'planned' | 'vision';

interface Connector {
  name: string;
  cat: 'Import' | 'Export' | 'Gouvernance' | 'Écosystème';
  desc: string;
  status: Status;
  icon: React.ReactNode;
  color: string;
  action?: 'import-sql';
}

const STATUS_META: Record<Status, { label: string; color: string; bg: string }> = {
  available: { label: 'Disponible', color: '#047857', bg: 'rgba(4,120,87,0.12)' },
  soon: { label: 'Bientôt', color: '#0D9488', bg: 'rgba(13,148,136,0.10)' },
  planned: { label: 'Prévu', color: '#2563EB', bg: 'rgba(37,99,235,0.10)' },
  vision: { label: 'Vision', color: '#7C3AED', bg: 'rgba(124,58,237,0.10)' },
};

const I = {
  db: <><ellipse cx="12" cy="6" rx="7" ry="2.6" /><path d="M5 6v12c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6V6" /><path d="M5 12c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6" /></>,
  git: <><circle cx="6" cy="6" r="2.5" /><circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="8" r="2.5" /><path d="M6 8.5v7M18 10.5a6 6 0 0 1-6 6H8.5" /></>,
  shield: <><path d="M12 3l7 3v5c0 4.2-2.9 7.4-7 9-4.1-1.6-7-4.8-7-9V6l7-3Z" /><path d="M9.2 12l2 2 3.6-3.8" /></>,
  chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
  play: <><ellipse cx="12" cy="6" rx="7" ry="2.6" /><path d="M5 6v12c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6V6" /><path d="M11 12.5v4l3-2Z" /></>,
  store: <><path d="M3 9l1.5-5h15L21 9" /><path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9" /><path d="M9 20v-6h6v6" /></>,
};

const PHASES: { n: number; title: string; sub: string; connectors: Connector[] }[] = [
  {
    n: 1, title: 'Partir de l’existant, livrer en prod',
    sub: 'Les connecteurs à plus forte valeur. L’import de schéma SQL est déjà fonctionnel.',
    connectors: [
      { name: 'Import de schéma SQL / Snowflake', cat: 'Import', color: '#0D9488', icon: I.db, status: 'available', action: 'import-sql',
        desc: 'Collez ou importez vos CREATE TABLE (SQL standard, Snowflake, PROC SQL). Marty en déduit entités, colonnes, types, clés PK/FK et relations, et crée le Data Product.' },
      { name: 'Push dbt vers Git', cat: 'Export', color: '#D97706', icon: I.git, status: 'soon',
        desc: 'Publie le projet dbt généré (models, schema.yml, tests) dans un dépôt Git via un jeton d’accès — le dernier kilomètre vers la prod.' },
    ],
  },
  {
    n: 2, title: 'Gouvernance & diffusion',
    sub: 'Brancher Marty au catalogue de gouvernance et aux outils de restitution.',
    connectors: [
      { name: 'Collibra', cat: 'Gouvernance', color: '#059669', icon: I.shield, status: 'planned',
        desc: 'Publie entités, dictionnaire, glossaire et lineage dans le catalogue — aligné avec le Design Authority (DAD).' },
      { name: 'Exécution DDL Snowflake', cat: 'Export', color: '#2563EB', icon: I.play, status: 'planned',
        desc: 'Exécute le DDL généré sur un environnement Snowflake (dev/bac à sable) pour matérialiser le modèle.' },
      { name: 'Power BI', cat: 'Export', color: '#7C3AED', icon: I.chart, status: 'planned',
        desc: 'Expose le modèle comme dataset Power BI pour accélérer la restitution.' },
    ],
  },
  {
    n: 3, title: 'Écosystème (vision)',
    sub: 'Pertinent uniquement en cas d’ouverture multi-société / SaaS. Sinon on reste sur des intégrations curées.',
    connectors: [
      { name: 'Marketplace de connecteurs', cat: 'Écosystème', color: '#DB2777', icon: I.store, status: 'vision',
        desc: 'Un catalogue où des tiers publient des connecteurs (SDK, sandbox, revue de sécurité). À n’envisager qu’en cas d’ouverture externe.' },
    ],
  },
];

const genId = (p: string) => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export default function Integrations() {
  const { logActivity, createSession, updateSessionData, setCurrentPage } = useWorkshopStore();
  const [voted, setVoted] = useState<Record<string, boolean>>({});
  const [showImport, setShowImport] = useState(false);
  const [ddl, setDdl] = useState('');
  const [pname, setPname] = useState('Modèle importé');
  const [preview, setPreview] = useState<{ tables: string[]; cols: number; rels: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const vote = (name: string) => {
    if (voted[name]) return;
    setVoted((v) => ({ ...v, [name]: true }));
    logActivity('integration_interest', name).catch(() => {});
  };

  function analyse(text: string) {
    setErr(null);
    const { tables, relations } = parseDDL(text);
    if (tables.length === 0) { setPreview(null); setErr('Aucune table « CREATE TABLE » détectée. Vérifiez le script.'); return; }
    setPreview({ tables: tables.map((t) => t.name), cols: tables.reduce((a, t) => a + t.columns.length, 0), rels: relations.length });
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { const txt = String(r.result || ''); setDdl(txt); analyse(txt); };
    r.readAsText(f);
  }

  function doImport() {
    const { tables, relations } = parseDDL(ddl);
    if (tables.length === 0) { setErr('Aucune table détectée.'); return; }

    const entities: Entity[] = [];
    const attributes: Attribute[] = [];
    const rels: Relation[] = [];
    const byName: Record<string, Entity> = {};

    tables.forEach((t) => {
      const e: Entity = { id: genId('e'), name: t.name, definition: '', description: '', example: '', responsible: '', type: 'transactional', lifecycle: 'created' };
      entities.push(e); byName[t.name.toLowerCase()] = e;
      t.columns.forEach((c) => attributes.push({
        id: genId('a'), entityId: e.id, name: c.name, type: c.type, description: '',
        isPrimaryKey: c.isPrimaryKey, isForeignKey: c.isForeignKey, isNaturalKey: false,
        isRequired: c.isPrimaryKey, isSensitive: false, isHistorized: false,
      }));
    });
    relations.forEach((r) => {
      const s = byName[r.source.toLowerCase()], tg = byName[r.target.toLowerCase()];
      if (!s || !tg) return;
      rels.push({ id: genId('r'), sourceEntityId: s.id, targetEntityId: tg.id, sourceEntityName: s.name, targetEntityName: tg.name, type: '1:N', isRequired: false, description: '', isHierarchy: false, fkColumn: r.fkColumn, refColumn: r.refColumn });
    });

    createSession('expert');
    updateSessionData({ productName: pname.trim() || 'Modèle importé', entities, attributes, relations: rels });
    logActivity('import_sql', `${pname.trim()} · ${tables.length} tables`).catch(() => {});
    setShowImport(false);
    setCurrentPage('deliverables');
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
      <div style={{ maxWidth: 1040, margin: '0 auto' }}>
        <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 20, padding: '28px 30px', marginBottom: 22, color: '#fff', background: 'linear-gradient(135deg,#065F46 0%,#047857 45%,#0D9488 100%)', boxShadow: '0 14px 40px rgba(4,120,87,0.28)' }}>
          <div style={{ position: 'absolute', top: -60, right: -40, width: 240, height: 240, borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }} />
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11.5, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', background: 'rgba(255,255,255,0.16)', padding: '4px 11px', borderRadius: 999, marginBottom: 12 }}>Connecteurs · feuille de route</div>
            <h2 style={{ fontSize: 26, margin: '0 0 6px', fontWeight: 800, letterSpacing: -0.5 }}>Intégrations & connecteurs</h2>
            <p style={{ fontSize: 14, opacity: 0.92, lineHeight: 1.55, maxWidth: 660, margin: 0 }}>
              Brancher Marty à votre stack data. <strong>L’import de schéma SQL est fonctionnel</strong> dès maintenant. Pour les autres, cliquez « Ça m’intéresse » — les votes priorisent le développement.
            </p>
          </div>
        </div>

        {PHASES.map((ph) => (
          <div key={ph.n} style={{ marginBottom: 30 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
              <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, fontWeight: 700, color: 'var(--primary)', letterSpacing: 0.5 }}>PHASE {ph.n}</span>
              <h3 style={{ fontSize: 18, margin: 0, fontWeight: 700 }}>{ph.title}</h3>
            </div>
            <p style={{ fontSize: 13.5, color: 'var(--text-muted)', margin: '0 0 16px', lineHeight: 1.5, maxWidth: 720 }}>{ph.sub}</p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
              {ph.connectors.map((c) => {
                const st = STATUS_META[c.status];
                const done = voted[c.name];
                return (
                  <div key={c.name} style={{ background: 'var(--bg-surface)', border: `1px solid ${c.status === 'available' ? 'var(--border-active)' : 'var(--border)'}`, borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ width: 42, height: 42, borderRadius: 12, background: c.color + '18', color: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{c.icon}</svg>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.25 }}>{c.name}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{c.cat}</div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999, color: st.color, background: st.bg, whiteSpace: 'nowrap' }}>{st.label}</span>
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0, flex: 1 }}>{c.desc}</p>
                    {c.action === 'import-sql' ? (
                      <button type="button" onClick={() => { setShowImport(true); setPreview(null); setErr(null); }}
                        style={{ fontSize: 13, fontWeight: 700, padding: '10px 14px', borderRadius: 10, cursor: 'pointer', border: 'none', background: 'var(--primary)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12M7 11l5 4 5-4M5 21h14" /></svg>
                        Importer un schéma
                      </button>
                    ) : (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" disabled style={{ flex: 'none', fontSize: 12.5, fontWeight: 600, padding: '8px 14px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-muted)', cursor: 'not-allowed' }}>Connecter</button>
                        <button type="button" onClick={() => vote(c.name)} disabled={done}
                          style={{ flex: 1, fontSize: 12.5, fontWeight: 700, padding: '8px 14px', borderRadius: 9, cursor: done ? 'default' : 'pointer', border: done ? '1px solid var(--border-active)' : 'none', background: done ? 'var(--primary-glow)' : 'var(--primary)', color: done ? 'var(--primary-light)' : '#fff' }}>
                          {done ? '✓ Intérêt enregistré' : '👍 Ça m’intéresse'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0 20px', lineHeight: 1.5 }}>
          Les votes « Ça m’intéresse » sont enregistrés dans l’activité (visibles par l’admin dans la Supervision) pour prioriser les connecteurs utiles.<br />
          Sécurité : tout connecteur à identifiants les utiliserait <strong>côté serveur uniquement</strong>, sur des environnements de dev/bac à sable en premier.
        </div>
      </div>

      {/* Modale d'import SQL — connecteur réel */}
      {showImport && (
        <div onClick={() => setShowImport(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 18, width: 'min(680px, 100%)', maxHeight: '88vh', overflowY: 'auto', padding: 24, boxShadow: '0 24px 60px rgba(0,0,0,0.35)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ color: '#0D9488', display: 'flex' }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{I.db}</svg></span>
              <h3 style={{ fontSize: 18, margin: 0 }}>Import de schéma SQL</h3>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 16px', lineHeight: 1.5 }}>Collez vos <code>CREATE TABLE</code> (SQL standard, Snowflake, PROC SQL) ou importez un fichier <code>.sql</code>. Aucune connexion à une base — traitement 100 % local.</p>

            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input value={pname} onChange={(e) => setPname(e.target.value)} placeholder="Nom du Data Product" style={{ flex: 1, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 9, padding: '9px 12px', fontSize: 13.5, color: 'var(--text)' }} />
              <button type="button" onClick={() => fileRef.current?.click()} className="suggested-chip" style={{ whiteSpace: 'nowrap' }}>📄 Fichier .sql</button>
              <input ref={fileRef} type="file" accept=".sql,.txt,.ddl" style={{ display: 'none' }} onChange={onFile} />
            </div>

            <textarea value={ddl} onChange={(e) => { setDdl(e.target.value); }} onBlur={() => ddl.trim() && analyse(ddl)}
              placeholder={'CREATE TABLE client (\n  client_id BIGINT PRIMARY KEY,\n  nom VARCHAR(120),\n  ...\n);\nCREATE TABLE compte (\n  compte_id BIGINT PRIMARY KEY,\n  client_id BIGINT REFERENCES client(client_id),\n  ...\n);'}
              style={{ width: '100%', minHeight: 200, fontFamily: 'ui-monospace, monospace', fontSize: 12.5, lineHeight: 1.6, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, color: 'var(--text)', resize: 'vertical' }} />

            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button type="button" onClick={() => analyse(ddl)} className="suggested-chip">Analyser</button>
            </div>

            {err && <div style={{ marginTop: 12, fontSize: 13, color: 'var(--accent-red)', background: 'rgba(220,38,38,0.08)', border: '1px solid var(--accent-red)', borderRadius: 8, padding: '9px 12px' }}>{err}</div>}
            {preview && (
              <div style={{ marginTop: 12, background: 'var(--primary-glow)', border: '1px solid var(--border-active)', borderRadius: 10, padding: '12px 14px', fontSize: 13.5 }}>
                <strong>{preview.tables.length} table(s)</strong> · {preview.cols} colonne(s) · {preview.rels} relation(s) détectées.
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {preview.tables.map((t) => <span key={t} style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11.5, padding: '2px 8px', borderRadius: 6, background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>{t}</span>)}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button type="button" className="suggested-chip" onClick={() => setShowImport(false)}>Annuler</button>
              <button type="button" onClick={doImport} disabled={!preview} style={{ border: 'none', borderRadius: 9, padding: '10px 18px', fontWeight: 700, fontSize: 13.5, cursor: preview ? 'pointer' : 'not-allowed', background: preview ? 'var(--primary)' : 'var(--bg-elevated)', color: preview ? '#fff' : 'var(--text-muted)' }}>Importer &amp; ouvrir →</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
