'use client';

import { useState } from 'react';
import { useWorkshopStore } from '@/lib/store';
import { WorkshopSession, Entity } from '@/lib/types';
import { MATURITY_DIMENSIONS } from '@/lib/constants';
import MermaidDiagram from './MermaidDiagram';

type Tab = 'overview' | 'mcd' | 'dbml' | 'sql' | 'dbt' | 'dictionary' | 'dad';

export default function Deliverables() {
  const { session } = useWorkshopStore();
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  if (!session || session.entities.length === 0) {
    return (
      <div className="empty-state" style={{ flex: 1 }}>
        <div className="empty-state-icon">📦</div>
        <div className="empty-state-text">
          Complétez au moins les premières étapes de l&apos;atelier pour générer des livrables.
        </div>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'overview', label: 'Vue d\'ensemble', icon: '📊' },
    { key: 'mcd', label: 'MCD / ERD', icon: '🗺️' },
    { key: 'dbml', label: 'DBML (dbdiagram.io)', icon: '🧬' },
    { key: 'sql', label: 'SQL DDL', icon: '💾' },
    { key: 'dbt', label: 'dbt YAML', icon: '🔧' },
    { key: 'dictionary', label: 'Dictionnaire', icon: '📖' },
    { key: 'dad', label: 'Rapport DAD', icon: '📋' },
  ];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, padding: '12px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)', overflowX: 'auto' }}>
        {tabs.map(t => (
          <button key={t.key} className={`suggested-chip ${activeTab === t.key ? 'active' : ''}`}
            style={activeTab === t.key ? { background: 'var(--primary-glow)', borderColor: 'var(--border-active)', color: 'var(--primary-light)' } : {}}
            onClick={() => setActiveTab(t.key)}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        {activeTab === 'overview' && <OverviewTab session={session} />}
        {activeTab === 'mcd' && <MCDTab session={session} />}
        {activeTab === 'dbml' && <DbmlTab session={session} />}
        {activeTab === 'sql' && <SQLTab session={session} />}
        {activeTab === 'dbt' && <DbtTab session={session} />}
        {activeTab === 'dictionary' && <DictionaryTab session={session} />}
        {activeTab === 'dad' && <DADTab session={session} />}
      </div>
    </div>
  );
}

function OverviewTab({ session }: { session: WorkshopSession }) {
  const [detail, setDetail] = useState<OverviewDetailKey | null>(null);

  const cards: { key: OverviewDetailKey; label: string; value: number; icon: string }[] = [
    { key: 'entities', label: 'Entités', value: session.entities.length, icon: '🧩' },
    { key: 'relations', label: 'Relations', value: session.relations.length, icon: '🔗' },
    { key: 'attributes', label: 'Attributs', value: session.attributes.length, icon: '📋' },
    { key: 'kpis', label: 'KPIs', value: session.kpis.length, icon: '📊' },
    { key: 'rules', label: 'Règles métier', value: session.businessRules.length, icon: '⚖️' },
    { key: 'sources', label: 'Sources', value: session.dataSources.length, icon: '🗄️' },
  ];

  return (
    <div className="fade-in">
      <h2 style={{ fontSize: 22, marginBottom: 8 }}>
        {session.productName || 'Data Product'} — Vue d&apos;ensemble
      </h2>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>Cliquez sur une carte pour voir le détail.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
        {cards.map(s => (
          <div
            key={s.label}
            className="stat-card"
            style={{ cursor: s.value > 0 ? 'pointer' : 'default', transition: 'border-color .15s' }}
            onClick={() => s.value > 0 && setDetail(s.key)}
          >
            <div style={{ fontSize: 24, marginBottom: 4 }}>{s.icon}</div>
            <div className="stat-value" style={{ fontSize: 28 }}>{s.value}</div>
            <div className="stat-label">{s.label}{s.value > 0 && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}> · voir ›</span>}</div>
          </div>
        ))}
      </div>

      {detail && <OverviewDetailModal session={session} detail={detail} onClose={() => setDetail(null)} />}

      {session.maturityScores && (
        <div>
          <h3 style={{ fontSize: 18, marginBottom: 16 }}>Score de maturité</h3>
          <div className="maturity-scores">
            {MATURITY_DIMENSIONS.map(dim => {
              const score = session.maturityScores![dim.key as keyof typeof session.maturityScores];
              return (
                <div key={dim.key} className="maturity-score-item">
                  <span className="maturity-score-label">{dim.label}</span>
                  <div className="maturity-score-bar">
                    <div className="maturity-score-fill" style={{ width: `${score}%`, background: dim.color }} />
                  </div>
                  <span className="maturity-score-value" style={{ color: dim.color }}>{score}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

type OverviewDetailKey = 'entities' | 'relations' | 'attributes' | 'kpis' | 'rules' | 'sources';

function OverviewDetailModal({ session, detail, onClose }: { session: WorkshopSession; detail: OverviewDetailKey; onClose: () => void }) {
  const titles: Record<OverviewDetailKey, string> = {
    entities: '🧩 Entités', relations: '🔗 Relations', attributes: '📋 Attributs',
    kpis: '📊 KPIs', rules: '⚖️ Règles métier', sources: '🗄️ Sources de données',
  };
  const row: React.CSSProperties = { padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 };
  const itemTitle: React.CSSProperties = { fontWeight: 700, marginBottom: 2 };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', width: 'min(760px, 100%)', maxHeight: '82vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}>
        <div style={{ position: 'sticky', top: 0, background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 16, margin: 0 }}>{titles[detail]}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>
        <div style={{ padding: 20 }}>
          {detail === 'entities' && session.entities.map(e => (
            <div key={e.id} style={row}><div style={itemTitle}>{e.name} <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>{e.type}</span></div>{e.definition && <div style={{ color: 'var(--text-secondary)' }}>{e.definition}</div>}</div>
          ))}
          {detail === 'relations' && session.relations.map(r => (
            <div key={r.id} style={row}><div style={itemTitle}>{r.sourceEntityName} → {r.targetEntityName} <span style={{ fontSize: 11, color: 'var(--accent-blue)' }}>({r.type})</span></div>{r.description && <div style={{ color: 'var(--text-secondary)' }}>{r.description}</div>}</div>
          ))}
          {detail === 'attributes' && session.entities.map(entity => {
            const attrs = session.attributes.filter(a => a.entityId === entity.id || a.entityId === entity.name);
            if (attrs.length === 0) return null;
            return (
              <div key={entity.id} style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 700, color: 'var(--primary-light)', marginBottom: 6 }}>{entity.name}</div>
                {attrs.map(a => (
                  <div key={a.id} style={row}>
                    <strong>{a.name}</strong> <span style={{ color: 'var(--accent-blue)' }}>{a.type}</span>{' '}
                    {a.isPrimaryKey && '🔑'}{a.isForeignKey && '🔗'}{a.isSensitive && '🔒'}
                    {a.description && <span style={{ color: 'var(--text-muted)' }}> — {a.description}</span>}
                  </div>
                ))}
              </div>
            );
          })}
          {detail === 'kpis' && session.kpis.map(k => (
            <div key={k.id} style={row}><div style={itemTitle}>{k.name}</div>{k.formula && <div>Formule : <code>{k.formula}</code></div>}{k.description && <div style={{ color: 'var(--text-secondary)' }}>{k.description}</div>}</div>
          ))}
          {detail === 'rules' && session.businessRules.map(r => (
            <div key={r.id} style={row}><div style={itemTitle}>{r.name} <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.type}</span></div>{r.description && <div style={{ color: 'var(--text-secondary)' }}>{r.description}</div>}{r.expression && <div>Expression : <code>{r.expression}</code></div>}</div>
          ))}
          {detail === 'sources' && session.dataSources.map(s => (
            <div key={s.id} style={row}><div style={itemTitle}>{s.name} <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.type}</span></div>{s.system && <div>Système : {s.system}</div>}{s.loadFrequency && <div style={{ color: 'var(--text-secondary)' }}>Fréquence : {s.loadFrequency}</div>}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MCDTab({ session }: { session: WorkshopSession }) {
  const mermaidCode = generateMermaidERD(session);

  return (
    <div className="fade-in">
      <h3 style={{ fontSize: 18, marginBottom: 16 }}>Architecture visuelle du Data Product (MCD)</h3>
      <MermaidDiagram code={mermaidCode} />
      <details style={{ marginTop: 16 }}>
        <summary style={{ cursor: 'pointer', fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
          Voir / copier le code source (Mermaid)
        </summary>
        <div style={{ marginTop: 8 }}>
          <CodeBlock title="ERD Mermaid" language="mermaid" code={mermaidCode} />
        </div>
      </details>
    </div>
  );
}

function DbmlTab({ session }: { session: WorkshopSession }) {
  const dbml = generateDBML(session);
  const [opened, setOpened] = useState(false);

  function copyAndOpen() {
    navigator.clipboard.writeText(dbml).catch(() => {});
    window.open('https://dbdiagram.io/d', '_blank', 'noopener,noreferrer');
    setOpened(true);
    setTimeout(() => setOpened(false), 6000);
  }

  return (
    <div className="fade-in">
      <h3 style={{ fontSize: 18, marginBottom: 16 }}>DBML — Diagramme interactif (dbdiagram.io)</h3>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <button className="cta-btn" onClick={copyAndOpen}>🧬 Copier + ouvrir dbdiagram.io</button>
        {opened && (
          <span style={{ fontSize: 13, color: 'var(--primary)' }}>
            ✓ Code copié — collez-le (Cmd/Ctrl+V) dans l&apos;éditeur dbdiagram.io qui vient de s&apos;ouvrir.
          </span>
        )}
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
        💡 Le diagramme visuel est aussi disponible directement dans l&apos;onglet <strong>MCD / ERD</strong> (sans rien copier).
        dbdiagram.io sert à obtenir une version interactive et déplaçable.
      </p>

      <CodeBlock title="schema.dbml" language="dbml" code={dbml} />
    </div>
  );
}

function SQLTab({ session }: { session: WorkshopSession }) {
  const sql = generateSQL(session);
  return (
    <div className="fade-in">
      <h3 style={{ fontSize: 18, marginBottom: 16 }}>SQL — Création des tables</h3>
      <CodeBlock title="DDL SQL" language="sql" code={sql} />
    </div>
  );
}

function DbtTab({ session }: { session: WorkshopSession }) {
  const yaml = generateDbtYaml(session);
  return (
    <div className="fade-in">
      <h3 style={{ fontSize: 18, marginBottom: 16 }}>dbt — Schema YAML</h3>
      <CodeBlock title="schema.yml" language="yaml" code={yaml} />
    </div>
  );
}

function DictionaryTab({ session }: { session: WorkshopSession }) {
  return (
    <div className="fade-in">
      <h3 style={{ fontSize: 18, marginBottom: 16 }}>Dictionnaire de données</h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              {['Entité', 'Attribut', 'Type', 'PK', 'FK', 'Requis', 'Sensible', 'Description'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {session.entities.map(entity => {
              const attrs = session.attributes.filter(a => a.entityId === entity.id || a.entityId === entity.name);
              if (attrs.length === 0) {
                return (
                  <tr key={entity.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--primary-light)' }}>{entity.name}</td>
                    <td colSpan={7} style={{ padding: '8px 12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Attributs non définis</td>
                  </tr>
                );
              }
              return attrs.map((attr, i) => (
                <tr key={attr.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 12px', fontWeight: i === 0 ? 600 : 400, color: i === 0 ? 'var(--primary-light)' : 'var(--text)' }}>
                    {i === 0 ? entity.name : ''}
                  </td>
                  <td style={{ padding: '8px 12px' }}>{attr.name}</td>
                  <td style={{ padding: '8px 12px', color: 'var(--accent-blue)' }}>{attr.type}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'center' }}>{attr.isPrimaryKey ? '🔑' : ''}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'center' }}>{attr.isForeignKey ? '🔗' : ''}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'center' }}>{attr.isRequired ? '✓' : ''}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'center' }}>{attr.isSensitive ? '🔒' : ''}</td>
                  <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{attr.description}</td>
                </tr>
              ));
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DADTab({ session }: { session: WorkshopSession }) {
  const avgScore = session.maturityScores
    ? Math.round(Object.values(session.maturityScores).reduce((a, b) => a + b, 0) / 7)
    : 0;

  return (
    <div className="fade-in">
      <h3 style={{ fontSize: 18, marginBottom: 16 }}>Rapport de préparation DAD</h3>

      <div className="context-card" style={{ marginBottom: 16 }}>
        <div className="context-card-title">📊 Score global</div>
        <div style={{ fontSize: 48, fontWeight: 800, color: avgScore >= 70 ? 'var(--accent-emerald)' : avgScore >= 40 ? 'var(--accent-amber)' : 'var(--accent-red)', textAlign: 'center', padding: 16 }}>
          {avgScore}/100
        </div>
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>
          {avgScore >= 70 ? '✅ Prêt pour la DAD' : avgScore >= 40 ? '⚠️ Quelques points à finaliser' : '❌ Conception à approfondir'}
        </div>
      </div>

      <div className="context-card" style={{ marginBottom: 16 }}>
        <div className="context-card-title">📋 Synthèse</div>
        <div className="context-card-content">
          <p><strong>Produit :</strong> {session.productName || 'Non défini'}</p>
          <p><strong>Domaine :</strong> {session.domain || 'Non défini'}</p>
          <p><strong>Entités :</strong> {session.entities.length}</p>
          <p><strong>Relations :</strong> {session.relations.length}</p>
          <p><strong>Attributs :</strong> {session.attributes.length}</p>
          <p><strong>KPIs :</strong> {session.kpis.length}</p>
        </div>
      </div>

      <div className="context-card">
        <div className="context-card-title">⚠️ Points de vigilance</div>
        <div className="context-card-content">
          <ul style={{ paddingLeft: 16 }}>
            {session.entities.length === 0 && <li>Aucune entité définie</li>}
            {session.relations.length === 0 && <li>Aucune relation définie</li>}
            {session.attributes.length === 0 && <li>Aucun attribut défini</li>}
            {!session.granularity && <li>Granularité non définie</li>}
            {session.kpis.length === 0 && <li>Aucun KPI défini</li>}
            {!session.governance && <li>Gouvernance non documentée</li>}
            {session.qualityRules.length === 0 && <li>Aucune règle qualité définie</li>}
            {session.entities.length > 0 && session.relations.length === 0 && <li>Relations manquantes entre les entités</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ---- Generators ----

interface ForeignKey {
  columnName: string;
  referencedTable: string;
  referencedColumn: string;
  isUnique: boolean;
  isRequired: boolean;
  relationDescription?: string;
}

interface ColumnDefinition {
  name: string;
  type: string;
  description: string;
  isPk: boolean;
  isRequired: boolean;
  isUnique: boolean;
  referencedTable?: string;
  referencedColumn?: string;
  relationDescription?: string;
}

function cleanEntityName(name: string): string {
  return name.trim().replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '').toUpperCase();
}

function cleanTableName(name: string): string {
  return name.trim().replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '').toLowerCase();
}

function getPrimaryKeyOfEntity(
  nameOrId: string,
  session: WorkshopSession,
  entitiesToGenerate: Entity[]
): string {
  const ent = entitiesToGenerate.find(e => e.id === nameOrId || cleanEntityName(e.name) === cleanEntityName(nameOrId));
  if (ent) {
    const pkAttr = session.attributes.find(a => (a.entityId === ent.id || a.entityId === ent.name) && a.isPrimaryKey);
    if (pkAttr) {
      return pkAttr.name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_').toLowerCase();
    }
  }
  return 'id';
}

function buildFkMap(session: WorkshopSession, entitiesToGenerate: Entity[]): Map<string, ForeignKey[]> {
  const fkMap = new Map<string, ForeignKey[]>();
  
  session.relations.forEach(rel => {
    const srcTable = cleanTableName(rel.sourceEntityName);
    const tgtTable = cleanTableName(rel.targetEntityName);
    
    const srcPk = getPrimaryKeyOfEntity(rel.sourceEntityName, session, entitiesToGenerate);
    const tgtPk = getPrimaryKeyOfEntity(rel.targetEntityName, session, entitiesToGenerate);
    
    if (rel.type === '1:N') {
      const ent = entitiesToGenerate.find(e => e.id === rel.targetEntityId || cleanEntityName(e.name) === cleanEntityName(rel.targetEntityName));
      const key = ent ? ent.id : rel.targetEntityName;
      const existing = fkMap.get(key) || [];
      existing.push({
        columnName: `${srcTable}_${srcPk}`,
        referencedTable: srcTable,
        referencedColumn: srcPk,
        isUnique: false,
        isRequired: rel.isRequired,
        relationDescription: rel.description
      });
      fkMap.set(key, existing);
    } else if (rel.type === 'N:1') {
      const ent = entitiesToGenerate.find(e => e.id === rel.sourceEntityId || cleanEntityName(e.name) === cleanEntityName(rel.sourceEntityName));
      const key = ent ? ent.id : rel.sourceEntityName;
      const existing = fkMap.get(key) || [];
      existing.push({
        columnName: `${tgtTable}_${tgtPk}`,
        referencedTable: tgtTable,
        referencedColumn: tgtPk,
        isUnique: false,
        isRequired: rel.isRequired,
        relationDescription: rel.description
      });
      fkMap.set(key, existing);
    } else if (rel.type === '1:1') {
      const ent = entitiesToGenerate.find(e => e.id === rel.targetEntityId || cleanEntityName(e.name) === cleanEntityName(rel.targetEntityName));
      const key = ent ? ent.id : rel.targetEntityName;
      const existing = fkMap.get(key) || [];
      existing.push({
        columnName: `${srcTable}_${srcPk}`,
        referencedTable: srcTable,
        referencedColumn: srcPk,
        isUnique: true,
        isRequired: rel.isRequired,
        relationDescription: rel.description
      });
      fkMap.set(key, existing);
    }
  });
  
  return fkMap;
}

function getTableColumns(
  entity: Entity,
  session: WorkshopSession,
  entitiesToGenerate: Entity[],
  fkMap: Map<string, ForeignKey[]>
): ColumnDefinition[] {
  const attrs = session.attributes.filter(a => a.entityId === entity.id || a.entityId === entity.name);
  const columns: ColumnDefinition[] = [];
  
  const hasExplicitPk = attrs.some(a => a.isPrimaryKey);
  const hasIdAttr = attrs.some(a => a.name.toLowerCase() === 'id');
  const needsDefaultId = !hasExplicitPk && !hasIdAttr;
  
  if (needsDefaultId) {
    columns.push({
      name: 'id',
      type: 'BIGINT',
      description: 'Clé primaire auto-générée',
      isPk: true,
      isRequired: true,
      isUnique: true
    });
  }
  
  attrs.forEach(a => {
    const isPk = a.isPrimaryKey || (!hasExplicitPk && a.name.toLowerCase() === 'id');
    columns.push({
      name: a.name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_').toLowerCase(),
      type: a.type,
      description: a.description || a.name,
      isPk: isPk,
      isRequired: a.isRequired || isPk,
      isUnique: isPk
    });
  });
  
  const fks = fkMap.get(entity.id) || fkMap.get(entity.name) || [];
  fks.forEach(fk => {
    const existing = columns.find(c => c.name === fk.columnName);
    if (existing) {
      existing.referencedTable = fk.referencedTable;
      existing.referencedColumn = fk.referencedColumn;
      if (fk.isUnique) existing.isUnique = true;
      if (fk.isRequired) existing.isRequired = true;
      if (fk.relationDescription) {
        existing.relationDescription = fk.relationDescription;
        existing.description += ` (Ref: ${fk.referencedTable}.${fk.referencedColumn} - ${fk.relationDescription})`;
      }
    } else {
      columns.push({
        name: fk.columnName,
        type: 'BIGINT',
        description: fk.relationDescription || `Clé étrangère pointant vers ${fk.referencedTable}`,
        isPk: false,
        isRequired: fk.isRequired,
        isUnique: fk.isUnique,
        referencedTable: fk.referencedTable,
        referencedColumn: fk.referencedColumn,
        relationDescription: fk.relationDescription
      });
    }
  });

  return dedupeColumns(columns);
}

// Make column lists valid no matter what the AI emitted:
// 1. Merge columns whose names are the same once normalized (e.g. "sinistre_id"
//    and "sinistreId" -> "sinistreid"), OR-combining their flags. This removes
//    exact and near-duplicate columns.
// 2. Enforce a single PRIMARY KEY per table (keep the first, demote the rest to
//    a regular NOT NULL column) so the DDL is not rejected by the database.
function dedupeColumns(columns: ColumnDefinition[]): ColumnDefinition[] {
  const seen = new Map<string, ColumnDefinition>();
  for (const col of columns) {
    const key = col.name.replace(/[^a-z0-9]/gi, '').toLowerCase();
    const prev = seen.get(key);
    if (!prev) {
      seen.set(key, { ...col });
    } else {
      prev.isPk = prev.isPk || col.isPk;
      prev.isRequired = prev.isRequired || col.isRequired;
      prev.isUnique = prev.isUnique || col.isUnique;
      if (!prev.referencedTable && col.referencedTable) {
        prev.referencedTable = col.referencedTable;
        prev.referencedColumn = col.referencedColumn;
        prev.relationDescription = col.relationDescription;
      }
    }
  }

  let pkAssigned = false;
  return Array.from(seen.values()).map((col) => {
    if (col.isPk) {
      if (pkAssigned) {
        return { ...col, isPk: false, isRequired: true, isUnique: false };
      }
      pkAssigned = true;
    }
    return col;
  });
}

function generateMermaidERD(session: WorkshopSession): string {
  let code = 'erDiagram\n';
  
  // Resolve all entities (including implicit ones from relations)
  const entitiesToGenerate = [...session.entities];
  const existingEntityNames = new Set(session.entities.map(e => cleanEntityName(e.name)));
  
  session.relations.forEach(rel => {
    const src = cleanEntityName(rel.sourceEntityName);
    const tgt = cleanEntityName(rel.targetEntityName);
    if (!existingEntityNames.has(src)) {
      entitiesToGenerate.push({
        id: rel.sourceEntityName,
        name: rel.sourceEntityName,
        definition: `Entité implicite générée à partir des relations`,
        description: `Entité implicite générée à partir des relations`,
        example: '',
        responsible: '',
        type: 'reference',
        lifecycle: 'created'
      });
      existingEntityNames.add(src);
    }
    if (!existingEntityNames.has(tgt)) {
      entitiesToGenerate.push({
        id: rel.targetEntityName,
        name: rel.targetEntityName,
        definition: `Entité implicite générée à partir des relations`,
        description: `Entité implicite générée à partir des relations`,
        example: '',
        responsible: '',
        type: 'reference',
        lifecycle: 'created'
      });
      existingEntityNames.add(tgt);
    }
  });

  const mermaidFkMap = buildFkMap(session, entitiesToGenerate);

  entitiesToGenerate.forEach(entity => {
    const codeName = cleanEntityName(entity.name);
    // Use the same deduplicated column resolution as the SQL/dbt generators so the
    // diagram never shows duplicate attributes or columns.
    const cols = getTableColumns(entity, session, entitiesToGenerate, mermaidFkMap);
    if (cols.length > 0) {
      code += `    ${codeName} {\n`;
      cols.forEach(c => {
        const pkTag = c.isPk ? 'PK' : c.referencedTable ? 'FK' : '';
        const mermaidType = mapSqlType(c.type).replace(/\(.*\)/, '').toLowerCase();
        code += `        ${mermaidType} ${c.name}${pkTag ? ` "${pkTag}"` : ''}\n`;
      });
      code += `    }\n`;
    } else {
      code += `    ${codeName} {\n        bigint id "PK"\n    }\n`;
    }
  });

  session.relations.forEach(rel => {
    const src = cleanEntityName(rel.sourceEntityName);
    const tgt = cleanEntityName(rel.targetEntityName);
    const card = rel.type === '1:1' ? '||--||' : rel.type === '1:N' ? '||--o{' : rel.type === 'N:1' ? '}o--||' : '}o--o{';
    code += `    ${src} ${card} ${tgt} : "${rel.description || 'lié à'}"\n`;
  });
  return code;
}

function resolveEntitiesToGenerate(session: WorkshopSession): Entity[] {
  const entitiesToGenerate = [...session.entities];
  const existingEntityNames = new Set(session.entities.map(e => cleanEntityName(e.name)));
  session.relations.forEach(rel => {
    [rel.sourceEntityName, rel.targetEntityName].forEach(rawName => {
      const clean = cleanEntityName(rawName);
      if (!existingEntityNames.has(clean)) {
        entitiesToGenerate.push({
          id: rawName,
          name: rawName,
          definition: 'Entité implicite générée à partir des relations',
          description: 'Entité implicite générée à partir des relations',
          example: '',
          responsible: '',
          type: 'reference',
          lifecycle: 'created',
        });
        existingEntityNames.add(clean);
      }
    });
  });
  return entitiesToGenerate;
}

function dbmlType(type: string): string {
  return mapSqlType(type).toLowerCase();
}

function generateDBML(session: WorkshopSession): string {
  let dbml = `// ============================================\n// ${session.productName || 'Data Product'} — DBML\n// Généré par Mart Studio — à coller sur dbdiagram.io\n// ============================================\n\n`;

  const entitiesToGenerate = resolveEntitiesToGenerate(session);
  const fkMap = buildFkMap(session, entitiesToGenerate);
  const refs: string[] = [];

  entitiesToGenerate.forEach(entity => {
    const tableName = cleanTableName(entity.name);
    const cols = getTableColumns(entity, session, entitiesToGenerate, fkMap);

    dbml += `Table ${tableName} {\n`;
    cols.forEach(c => {
      const settings: string[] = [];
      if (c.isPk) settings.push('pk');
      if (c.isUnique && !c.isPk) settings.push('unique');
      if (c.isRequired && !c.isPk) settings.push('not null');
      const note = sanitizeComment(c.description);
      if (note) settings.push(`note: '${note.replace(/'/g, "\\'")}'`);
      const settingStr = settings.length ? ` [${settings.join(', ')}]` : '';
      dbml += `  ${c.name} ${dbmlType(c.type)}${settingStr}\n`;

      if (c.referencedTable && c.referencedColumn) {
        refs.push(`Ref: ${tableName}.${c.name} > ${c.referencedTable}.${c.referencedColumn}`);
      }
    });
    if (entity.definition) {
      dbml += `  Note: '${sanitizeComment(entity.definition).replace(/'/g, "\\'")}'\n`;
    }
    dbml += `}\n\n`;
  });

  // N:N join tables
  const processedNn = new Set<string>();
  session.relations.forEach(rel => {
    if (rel.type !== 'N:N') return;
    const srcTable = cleanTableName(rel.sourceEntityName);
    const tgtTable = cleanTableName(rel.targetEntityName);
    const key = [srcTable, tgtTable].sort().join('_');
    if (processedNn.has(key)) return;
    processedNn.add(key);

    const srcPk = getPrimaryKeyOfEntity(rel.sourceEntityName, session, entitiesToGenerate);
    const tgtPk = getPrimaryKeyOfEntity(rel.targetEntityName, session, entitiesToGenerate);
    const joinTable = `${srcTable}_${tgtTable}`;
    dbml += `Table ${joinTable} {\n`;
    dbml += `  ${srcTable}_${srcPk} bigint [not null]\n`;
    dbml += `  ${tgtTable}_${tgtPk} bigint [not null]\n`;
    dbml += `  indexes {\n    (${srcTable}_${srcPk}, ${tgtTable}_${tgtPk}) [pk]\n  }\n`;
    dbml += `}\n\n`;
    refs.push(`Ref: ${joinTable}.${srcTable}_${srcPk} > ${srcTable}.${srcPk}`);
    refs.push(`Ref: ${joinTable}.${tgtTable}_${tgtPk} > ${tgtTable}.${tgtPk}`);
  });

  if (refs.length) {
    dbml += `// Relations\n${refs.join('\n')}\n`;
  }

  return dbml;
}

function generateSQL(session: WorkshopSession): string {
  let sql = `-- ============================================\n-- ${session.productName || 'Data Product'} — DDL\n-- Généré par Mart Studio\n-- ============================================\n\n`;
  
  // Resolve all entities (including implicit ones from relations)
  const entitiesToGenerate = [...session.entities];
  const existingEntityNames = new Set(session.entities.map(e => cleanEntityName(e.name)));
  
  session.relations.forEach(rel => {
    const src = cleanEntityName(rel.sourceEntityName);
    const tgt = cleanEntityName(rel.targetEntityName);
    if (!existingEntityNames.has(src)) {
      entitiesToGenerate.push({
        id: rel.sourceEntityName,
        name: rel.sourceEntityName,
        definition: `Entité implicite générée à partir des relations`,
        description: `Entité implicite générée à partir des relations`,
        example: '',
        responsible: '',
        type: 'reference',
        lifecycle: 'created'
      });
      existingEntityNames.add(src);
    }
    if (!existingEntityNames.has(tgt)) {
      entitiesToGenerate.push({
        id: rel.targetEntityName,
        name: rel.targetEntityName,
        definition: `Entité implicite générée à partir des relations`,
        description: `Entité implicite générée à partir des relations`,
        example: '',
        responsible: '',
        type: 'reference',
        lifecycle: 'created'
      });
      existingEntityNames.add(tgt);
    }
  });

  const fkMap = buildFkMap(session, entitiesToGenerate);
  
  entitiesToGenerate.forEach(entity => {
    const tableName = cleanTableName(entity.name);
    const cols = getTableColumns(entity, session, entitiesToGenerate, fkMap);
    
    sql += `-- ${entity.definition || entity.name}\nCREATE TABLE ${tableName} (\n`;

    // Build each item as { definition, comment } so the separating comma is placed
    // BEFORE the inline "--" comment. Otherwise the comma ends up inside the comment
    // and the whole CREATE TABLE statement becomes invalid.
    const items: { def: string; comment: string }[] = [];

    cols.forEach(c => {
      let def = `    ${c.name} ${mapSqlType(c.type)}`;
      if (c.isPk) def += ' PRIMARY KEY';
      if (c.isRequired && !c.isPk) def += ' NOT NULL';
      items.push({ def, comment: sanitizeComment(c.description) });
    });

    cols.forEach(c => {
      if (c.referencedTable && c.referencedColumn) {
        items.push({
          def: `    CONSTRAINT fk_${tableName}_${c.name} FOREIGN KEY (${c.name}) REFERENCES ${c.referencedTable}(${c.referencedColumn})`,
          comment: '',
        });
      }
    });

    sql += items
      .map((item, i) => {
        const comma = i < items.length - 1 ? ',' : '';
        return `${item.def}${comma}${item.comment ? ` -- ${item.comment}` : ''}`;
      })
      .join('\n');
    sql += `\n);\n\n`;
  });
  
  // Generate N:N Join tables
  const processedNnRelations = new Set<string>();
  session.relations.forEach(rel => {
    if (rel.type === 'N:N') {
      const srcTable = cleanTableName(rel.sourceEntityName);
      const tgtTable = cleanTableName(rel.targetEntityName);
      
      const relationKey = [srcTable, tgtTable].sort().join('_');
      if (processedNnRelations.has(relationKey)) return;
      processedNnRelations.add(relationKey);
      
      const srcPk = getPrimaryKeyOfEntity(rel.sourceEntityName, session, entitiesToGenerate);
      const tgtPk = getPrimaryKeyOfEntity(rel.targetEntityName, session, entitiesToGenerate);
      const joinTableName = `${srcTable}_${tgtTable}`;
      
      sql += `-- Table de jointure pour la relation N:N entre ${rel.sourceEntityName} et ${rel.targetEntityName}\n`;
      sql += `-- Description : ${rel.description || 'Association N:N'}\n`;
      sql += `CREATE TABLE ${joinTableName} (\n`;
      sql += `    ${srcTable}_${srcPk} BIGINT NOT NULL,\n`;
      sql += `    ${tgtTable}_${tgtPk} BIGINT NOT NULL,\n`;
      sql += `    PRIMARY KEY (${srcTable}_${srcPk}, ${tgtTable}_${tgtPk}),\n`;
      sql += `    CONSTRAINT fk_${joinTableName}_${srcTable} FOREIGN KEY (${srcTable}_${srcPk}) REFERENCES ${srcTable}(${srcPk}),\n`;
      sql += `    CONSTRAINT fk_${joinTableName}_${tgtTable} FOREIGN KEY (${tgtTable}_${tgtPk}) REFERENCES ${tgtTable}(${tgtPk})\n`;
      sql += `);\n\n`;
    }
  });
  
  return sql;
}

// Inline SQL comments run to end of line, so any newline inside a description
// would break the statement. Collapse whitespace to keep the comment on one line.
function sanitizeComment(text: string): string {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function mapSqlType(type: string): string {
  const t = (type || 'varchar').toLowerCase();
  if (t.includes('int')) return 'BIGINT';
  if (t.includes('decimal') || t.includes('float') || t.includes('numeric')) return 'DECIMAL(18,4)';
  if (t.includes('date') && t.includes('time')) return 'TIMESTAMP';
  if (t.includes('date')) return 'DATE';
  if (t.includes('bool')) return 'BOOLEAN';
  if (t.includes('text')) return 'TEXT';
  return 'VARCHAR(255)';
}

function generateDbtYaml(session: WorkshopSession): string {
  let yaml = `version: 2\n\nmodels:\n`;
  
  // Resolve all entities (including implicit ones from relations)
  const entitiesToGenerate = [...session.entities];
  const existingEntityNames = new Set(session.entities.map(e => cleanEntityName(e.name)));
  
  session.relations.forEach(rel => {
    const src = cleanEntityName(rel.sourceEntityName);
    const tgt = cleanEntityName(rel.targetEntityName);
    if (!existingEntityNames.has(src)) {
      entitiesToGenerate.push({
        id: rel.sourceEntityName,
        name: rel.sourceEntityName,
        definition: `Entité implicite générée à partir des relations`,
        description: `Entité implicite générée à partir des relations`,
        example: '',
        responsible: '',
        type: 'reference',
        lifecycle: 'created'
      });
      existingEntityNames.add(src);
    }
    if (!existingEntityNames.has(tgt)) {
      entitiesToGenerate.push({
        id: rel.targetEntityName,
        name: rel.targetEntityName,
        definition: `Entité implicite générée à partir des relations`,
        description: `Entité implicite générée à partir des relations`,
        example: '',
        responsible: '',
        type: 'reference',
        lifecycle: 'created'
      });
      existingEntityNames.add(tgt);
    }
  });

  const fkMap = buildFkMap(session, entitiesToGenerate);
  
  entitiesToGenerate.forEach(entity => {
    const modelName = cleanTableName(entity.name);
    yaml += `  - name: ${modelName}\n`;
    yaml += `    description: "${(entity.definition || entity.description || entity.name).replace(/"/g, '\\"')}"\n`;
    yaml += `    columns:\n`;
    
    const cols = getTableColumns(entity, session, entitiesToGenerate, fkMap);
    
    cols.forEach(c => {
      yaml += `      - name: ${c.name}\n`;
      yaml += `        description: "${c.description.replace(/"/g, '\\"')}"\n`;
      
      const tests: string[] = [];
      if (c.isPk) {
        tests.push('unique');
        tests.push('not_null');
      } else if (c.isRequired) {
        tests.push('not_null');
      }
      
      const hasTests = tests.length > 0;
      const hasRelation = c.referencedTable && c.referencedColumn;
      
      if (hasTests || hasRelation) {
        yaml += `        tests:\n`;
        tests.forEach(t => {
          yaml += `          - ${t}\n`;
        });
        if (hasRelation) {
          yaml += `          - relationships:\n`;
          yaml += `              to: ref('${c.referencedTable}')\n`;
          yaml += `              field: ${c.referencedColumn}\n`;
        }
      }
    });
    
    yaml += `\n`;
  });

  // N:N relations to define join tables
  const processedNnRelations = new Set<string>();
  session.relations.forEach(rel => {
    if (rel.type === 'N:N') {
      const srcTable = cleanTableName(rel.sourceEntityName);
      const tgtTable = cleanTableName(rel.targetEntityName);
      
      const relationKey = [srcTable, tgtTable].sort().join('_');
      if (processedNnRelations.has(relationKey)) return;
      processedNnRelations.add(relationKey);
      
      const srcPk = getPrimaryKeyOfEntity(rel.sourceEntityName, session, entitiesToGenerate);
      const tgtPk = getPrimaryKeyOfEntity(rel.targetEntityName, session, entitiesToGenerate);
      const joinTableName = `${srcTable}_${tgtTable}`;
      
      yaml += `  - name: ${joinTableName}\n`;
      yaml += `    description: "Table de jointure N:N reliant les entités ${rel.sourceEntityName} et ${rel.targetEntityName}. Description : ${(rel.description || '').replace(/"/g, '\\"')}"\n`;
      yaml += `    columns:\n`;
      
      // Column 1
      yaml += `      - name: ${srcTable}_${srcPk}\n`;
      yaml += `        description: "Clé étrangère composite vers ${srcTable}"\n`;
      yaml += `        tests:\n`;
      yaml += `          - not_null\n`;
      yaml += `          - relationships:\n`;
      yaml += `              to: ref('${srcTable}')\n`;
      yaml += `              field: ${srcPk}\n`;
      
      // Column 2
      yaml += `      - name: ${tgtTable}_${tgtPk}\n`;
      yaml += `        description: "Clé étrangère composite vers ${tgtTable}"\n`;
      yaml += `        tests:\n`;
      yaml += `          - not_null\n`;
      yaml += `          - relationships:\n`;
      yaml += `              to: ref('${tgtTable}')\n`;
      yaml += `              field: ${tgtPk}\n`;
      
      yaml += `\n`;
    }
  });
  
  return yaml;
}

// ---- Code Block ----

function CodeBlock({ title, language, code }: { title: string; language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  function copyCode() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadCode() {
    const ext = language === 'sql' ? '.sql' : language === 'yaml' ? '.yml' : language === 'dbml' ? '.dbml' : '.txt';
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${title.replace(/\s/g, '_').toLowerCase()}${ext}`;
    a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div className="code-preview">
      <div className="code-preview-header">
        <span className="code-preview-title">{title}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="copy-btn" onClick={copyCode}>{copied ? '✓ Copié' : '📋 Copier'}</button>
          <button className="copy-btn" onClick={downloadCode}>⬇ Télécharger</button>
        </div>
      </div>
      <div className="code-preview-body">
        <pre>{code}</pre>
      </div>
    </div>
  );
}
