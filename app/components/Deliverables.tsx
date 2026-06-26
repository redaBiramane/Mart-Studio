'use client';

import { useState } from 'react';
import { useWorkshopStore } from '@/lib/store';
import { WorkshopSession } from '@/lib/types';
import { MATURITY_DIMENSIONS } from '@/lib/constants';

type Tab = 'overview' | 'mcd' | 'sql' | 'dbt' | 'dictionary' | 'dad';

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
        {activeTab === 'sql' && <SQLTab session={session} />}
        {activeTab === 'dbt' && <DbtTab session={session} />}
        {activeTab === 'dictionary' && <DictionaryTab session={session} />}
        {activeTab === 'dad' && <DADTab session={session} />}
      </div>
    </div>
  );
}

function OverviewTab({ session }: { session: WorkshopSession }) {
  return (
    <div className="fade-in">
      <h2 style={{ fontSize: 22, marginBottom: 24 }}>
        {session.productName || 'Data Product'} — Vue d&apos;ensemble
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
        {[
          { label: 'Entités', value: session.entities.length, icon: '🧩' },
          { label: 'Relations', value: session.relations.length, icon: '🔗' },
          { label: 'Attributs', value: session.attributes.length, icon: '📋' },
          { label: 'KPIs', value: session.kpis.length, icon: '📊' },
          { label: 'Règles métier', value: session.businessRules.length, icon: '⚖️' },
          { label: 'Sources', value: session.dataSources.length, icon: '🗄️' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div style={{ fontSize: 24, marginBottom: 4 }}>{s.icon}</div>
            <div className="stat-value" style={{ fontSize: 28 }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

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

function MCDTab({ session }: { session: WorkshopSession }) {
  const mermaidCode = generateMermaidERD(session);

  return (
    <div className="fade-in">
      <h3 style={{ fontSize: 18, marginBottom: 16 }}>Modèle Conceptuel de Données</h3>
      <CodeBlock title="ERD Mermaid" language="mermaid" code={mermaidCode} />
      <p style={{ marginTop: 12, fontSize: 13, color: 'var(--text-muted)' }}>
        Copiez ce code dans un éditeur Mermaid (mermaid.live) pour visualiser le diagramme.
      </p>
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

function generateMermaidERD(session: WorkshopSession): string {
  let code = 'erDiagram\n';
  session.entities.forEach(entity => {
    const attrs = session.attributes.filter(a => a.entityId === entity.id || a.entityId === entity.name);
    if (attrs.length > 0) {
      code += `    ${entity.name.replace(/\s/g, '_').toUpperCase()} {\n`;
      attrs.forEach(a => {
        const pkTag = a.isPrimaryKey ? 'PK' : a.isForeignKey ? 'FK' : '';
        code += `        ${a.type || 'string'} ${a.name.replace(/\s/g, '_')}${pkTag ? ` "${pkTag}"` : ''}\n`;
      });
      code += `    }\n`;
    } else {
      code += `    ${entity.name.replace(/\s/g, '_').toUpperCase()} {\n        string id "PK"\n    }\n`;
    }
  });
  session.relations.forEach(rel => {
    const src = rel.sourceEntityName.replace(/\s/g, '_').toUpperCase();
    const tgt = rel.targetEntityName.replace(/\s/g, '_').toUpperCase();
    const card = rel.type === '1:1' ? '||--||' : rel.type === '1:N' ? '||--o{' : rel.type === 'N:1' ? '}o--||' : '}o--o{';
    code += `    ${src} ${card} ${tgt} : "${rel.description || 'lié à'}"\n`;
  });
  return code;
}

function generateSQL(session: WorkshopSession): string {
  let sql = `-- ============================================\n-- ${session.productName || 'Data Product'} — DDL\n-- Généré par Mart Studio\n-- ============================================\n\n`;
  session.entities.forEach(entity => {
    const tableName = entity.name.replace(/\s/g, '_').toLowerCase();
    const attrs = session.attributes.filter(a => a.entityId === entity.id || a.entityId === entity.name);
    sql += `-- ${entity.definition || entity.name}\nCREATE TABLE ${tableName} (\n`;
    if (attrs.length > 0) {
      const lines = attrs.map(a => {
        let line = `    ${a.name.replace(/\s/g, '_').toLowerCase()} ${mapSqlType(a.type)}`;
        if (a.isPrimaryKey) line += ' PRIMARY KEY';
        if (a.isRequired && !a.isPrimaryKey) line += ' NOT NULL';
        if (a.description) line += ` -- ${a.description}`;
        return line;
      });
      sql += lines.join(',\n');
    } else {
      sql += `    id BIGINT PRIMARY KEY,\n    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`;
    }
    sql += `\n);\n\n`;
  });
  return sql;
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
  session.entities.forEach(entity => {
    const modelName = entity.name.replace(/\s/g, '_').toLowerCase();
    yaml += `  - name: ${modelName}\n`;
    yaml += `    description: "${entity.definition || entity.description || entity.name}"\n`;
    const attrs = session.attributes.filter(a => a.entityId === entity.id || a.entityId === entity.name);
    if (attrs.length > 0) {
      yaml += `    columns:\n`;
      attrs.forEach(a => {
        yaml += `      - name: ${a.name.replace(/\s/g, '_').toLowerCase()}\n`;
        yaml += `        description: "${a.description || a.name}"\n`;
        const tests: string[] = [];
        if (a.isPrimaryKey) { tests.push('unique'); tests.push('not_null'); }
        else if (a.isRequired) tests.push('not_null');
        if (tests.length > 0) {
          yaml += `        tests:\n`;
          tests.forEach(t => { yaml += `          - ${t}\n`; });
        }
      });
    }
    yaml += `\n`;
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
    const ext = language === 'sql' ? '.sql' : language === 'yaml' ? '.yml' : '.txt';
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
