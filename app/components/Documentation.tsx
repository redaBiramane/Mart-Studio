'use client';

interface DocumentationProps {
  onStartWorkshop: () => void;
}

const STEPS = [
  { n: 1, icon: '🎯', title: 'Contexte', text: 'Vous décrivez votre produit data : nom, problème métier, objectif, domaine, Product Owner et Data Steward. Marty en fait une synthèse.' },
  { n: 2, icon: '🧩', title: 'Entités', text: 'À partir de votre description, Marty conçoit le modèle complet : tables de faits et dimensions, leurs attributs (clés, types) et leurs relations.' },
  { n: 3, icon: '🔗', title: 'Relations', text: 'Les liens entre entités sont précisés : cardinalités (1:1, 1:N, N:N), obligation et hiérarchies.' },
  { n: 4, icon: '📋', title: 'Attributs', text: 'On complète les colonnes manquantes : clés primaires, types SQL, attributs sensibles ou historisés.' },
  { n: 5, icon: '🏁', title: 'Validation', text: 'Marty génère les règles de gestion, les sources de données, un score de maturité et le rapport de préparation DAD.' },
];

const DELIVERABLES = [
  { icon: '🗺️', title: 'MCD / ERD', text: 'Le Modèle Conceptuel de Données au format Mermaid, à visualiser sur mermaid.live.' },
  { icon: '🧬', title: 'DBML', text: 'Code prêt à coller sur dbdiagram.io pour un diagramme interactif et partageable.' },
  { icon: '💾', title: 'SQL DDL', text: 'Les CREATE TABLE complets avec clés primaires, clés étrangères et contraintes — exécutables directement.' },
  { icon: '🔧', title: 'dbt YAML', text: 'Le schema.yml dbt avec tests (unique, not_null, relationships) pour industrialiser la transformation.' },
  { icon: '📖', title: 'Dictionnaire', text: 'Le dictionnaire de données : chaque attribut, son type, PK/FK, sensibilité et description.' },
  { icon: '📋', title: 'Rapport DAD', text: 'Le score de maturité et la synthèse de préparation à la Design Authority (DAD).' },
];

const EXAMPLE_STEPS = [
  {
    n: 1, icon: '🎯', title: 'Contexte',
    write: '« Data Product : Pilotage de la Production de Crédits. Objectif : suivre les dossiers de financement (montants demandés/accordés, taux d\'acceptation, délais) par canal, partenaire et produit. Domaine : financement à la consommation. Utilisateurs : direction commerciale, risque, pilotage. PO : Responsable Production. Data Steward : Data Steward Crédit. »',
    produce: 'Une synthèse du contexte : nom, objectif, domaine, PO et Data Steward enregistrés dans « Données collectées ».',
  },
  {
    n: 2, icon: '🧩', title: 'Entités',
    write: '« Les objets : le dossier de crédit (avec montant et statut), le client, le produit de financement, le partenaire/apporteur, le canal de souscription, le conseiller, et la période. »',
    produce: 'Marty déduit le modèle dimensionnel : 1 table de faits (Dossier) + 6 dimensions (Client, Produit, Partenaire, Canal, Conseiller, Période).',
  },
  {
    n: 3, icon: '🔗', title: 'Relations',
    write: '« Un client a plusieurs dossiers. Chaque dossier porte sur un produit, vient d\'un partenaire, d\'un canal, est traité par un conseiller, et rattaché à une période. »',
    produce: 'Les relations 1:N reliant chaque dimension au fait Dossier, avec cardinalités et obligation.',
  },
  {
    n: 4, icon: '📋', title: 'Attributs',
    write: '« Dossier : id, montant demandé, montant accordé, statut, date de demande, date de décision. Client : id, nom, segment. Produit : id, libellé, taux. »',
    produce: 'Pour chaque entité : la clé primaire, les colonnes métier typées (DECIMAL, DATE, VARCHAR…) et les clés étrangères déduites des relations.',
  },
  {
    n: 5, icon: '🏁', title: 'Validation',
    write: '« ok »',
    produce: 'Marty génère les règles de gestion, les sources de données, le score de maturité et le rapport DAD — tout est prêt dans Livrables.',
  },
];

const FACT_COLUMNS: [string, string, string, string][] = [
  ['dossier_id', 'BIGINT', 'PK', 'Clé primaire du dossier'],
  ['montant_demande', 'DECIMAL', '', 'Montant demandé par le client'],
  ['montant_accorde', 'DECIMAL', '', 'Montant finalement accordé'],
  ['statut', 'VARCHAR', '', 'En cours / Accepté / Refusé'],
  ['date_demande', 'DATE', '', 'Date de la demande'],
  ['date_decision', 'DATE', '', 'Date de la décision'],
  ['client_client_id', 'BIGINT', 'FK', 'Clé étrangère vers dim_client'],
  ['produit_produit_id', 'BIGINT', 'FK', 'Clé étrangère vers dim_produit'],
];

const thStyle: React.CSSProperties = { textAlign: 'left', padding: '6px 10px', borderBottom: '2px solid var(--border)', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' };
const tdStyle: React.CSSProperties = { padding: '6px 10px', borderBottom: '1px solid var(--border)' };

export default function Documentation({ onStartWorkshop }: DocumentationProps) {
  return (
    <div className="dashboard" style={{ maxWidth: 960, margin: '0 auto' }}>
      {/* Intro */}
      <div className="context-card" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, marginBottom: 8 }}>📖 Comment fonctionne Mart Studio</h2>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Mart Studio est un atelier de conception assisté par IA. Vous décrivez votre besoin métier
          en langage naturel, et <strong>Marty</strong>, votre Senior Data Architect IA, vous guide en
          <strong> 5 étapes</strong> pour transformer cette description en un <strong>modèle de données complet</strong> et
          en livrables techniques prêts à l&apos;emploi (SQL, dbt, diagrammes, dictionnaire). Aucune connaissance
          technique préalable n&apos;est requise.
        </p>
      </div>

      {/* How it works */}
      <h3 style={{ fontSize: 18, marginBottom: 16 }}>Le déroulé de l&apos;atelier</h3>
      <div style={{ display: 'grid', gap: 12, marginBottom: 32 }}>
        {STEPS.map(s => (
          <div key={s.n} className="context-card" style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <div style={{ fontSize: 28, lineHeight: 1 }}>{s.icon}</div>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Étape {s.n} — {s.title}</div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{s.text}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Deliverables */}
      <h3 style={{ fontSize: 18, marginBottom: 16 }}>Les livrables générés</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12, marginBottom: 32 }}>
        {DELIVERABLES.map(d => (
          <div key={d.title} className="context-card">
            <div style={{ fontSize: 22, marginBottom: 6 }}>{d.icon}</div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{d.title}</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{d.text}</div>
          </div>
        ))}
      </div>

      {/* Complete worked example */}
      <h3 style={{ fontSize: 18, marginBottom: 6 }}>📚 Exemple complet — atelier de A à Z</h3>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
        Un atelier réel déroulé étape par étape : ce que vous écrivez, ce que Marty produit, jusqu&apos;aux livrables.
        Inspirez-vous-en pour votre propre Data Product.
      </p>

      <div className="context-card" style={{ marginBottom: 24, borderLeft: '3px solid var(--primary)' }}>
        <div style={{ fontWeight: 800, fontSize: 16 }}>🎯 Cas : « Pilotage de la Production de Crédits »</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Domaine : financement à la consommation — suivre les dossiers de crédit, montants accordés, taux d&apos;acceptation par canal, partenaire et produit.</div>
      </div>

      {EXAMPLE_STEPS.map(s => (
        <div key={s.n} className="context-card" style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>{s.icon} Étape {s.n} — {s.title}</div>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Vous écrivez</div>
            <div className="transform-before" style={{ padding: 12, borderRadius: 8, marginTop: 4 }}>
              <em style={{ color: 'var(--text-secondary)', fontSize: 13.5, lineHeight: 1.6 }}>{s.write}</em>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Marty produit</div>
            <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: 4 }}>{s.produce}</div>
          </div>
        </div>
      ))}

      {/* Resulting model */}
      <h4 style={{ fontSize: 16, margin: '24px 0 10px' }}>🧩 Le modèle obtenu (faits &amp; dimensions)</h4>
      <div className="context-card" style={{ marginBottom: 14 }}>
        <div style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700 }}>⭐ Fait :</span>{' '}
          <code>fact_dossier_credit</code> (la mesure : un dossier = un montant demandé/accordé à une date)
        </div>
        <div>
          <span style={{ fontSize: 12, fontWeight: 700 }}>🧩 Dimensions :</span>{' '}
          <code>dim_client</code>, <code>dim_produit</code>, <code>dim_partenaire</code>, <code>dim_canal</code>, <code>dim_conseiller</code>, <code>dim_periode</code>
        </div>
      </div>

      <div className="context-card" style={{ marginBottom: 14, overflowX: 'auto' }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Table de faits — <code>fact_dossier_credit</code></div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead><tr>{['Attribut', 'Type', 'Clé', 'Description'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
          <tbody>
            {FACT_COLUMNS.map(c => (
              <tr key={c[0]}>
                <td style={tdStyle}><strong>{c[0]}</strong></td>
                <td style={{ ...tdStyle, color: 'var(--accent-blue)' }}>{c[1]}</td>
                <td style={tdStyle}>{c[2]}</td>
                <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{c[3]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="context-card" style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>🔗 Relations</div>
        <ul style={{ paddingLeft: 18, fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.8, margin: 0 }}>
          <li>dim_client → fact_dossier_credit (1:N)</li>
          <li>dim_produit → fact_dossier_credit (1:N)</li>
          <li>dim_partenaire → fact_dossier_credit (1:N)</li>
          <li>dim_canal → fact_dossier_credit (1:N)</li>
          <li>dim_periode → fact_dossier_credit (1:N)</li>
        </ul>
      </div>

      <div className="context-card" style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>📊 KPIs &amp; ⚖️ Règles métier déduits</div>
        <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          <strong>KPIs :</strong> Taux d&apos;acceptation (dossiers acceptés / total), Montant moyen accordé, Délai moyen de décision.<br />
          <strong>Règles :</strong> montant_accorde ≤ montant_demande ; date_decision ≥ date_demande ; statut ∈ {'{'}En cours, Accepté, Refusé{'}'}.<br />
          <strong>Sources :</strong> Système de gestion des dossiers (LOS), Référentiel partenaires.
        </div>
      </div>

      {/* Deliverable snippet */}
      <h4 style={{ fontSize: 16, margin: '24px 0 10px' }}>📦 Un extrait des livrables générés</h4>
      <div className="context-card" style={{ marginBottom: 32 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>SQL DDL (extrait)</div>
        <pre style={{ background: '#0d1117', color: '#c9d1d9', padding: 16, borderRadius: 8, overflow: 'auto', fontSize: 12.5, lineHeight: 1.5 }}>{`CREATE TABLE fact_dossier_credit (
    dossier_id        BIGINT PRIMARY KEY, -- Clé primaire du dossier
    montant_demande   DECIMAL(18,4) NOT NULL,
    montant_accorde   DECIMAL(18,4),
    statut            VARCHAR(255) NOT NULL,
    date_demande      DATE NOT NULL,
    date_decision     DATE,
    client_client_id  BIGINT NOT NULL,    -- FK vers dim_client
    produit_produit_id BIGINT NOT NULL,   -- FK vers dim_produit
    CONSTRAINT fk_dossier_client  FOREIGN KEY (client_client_id)  REFERENCES dim_client(client_id),
    CONSTRAINT fk_dossier_produit FOREIGN KEY (produit_produit_id) REFERENCES dim_produit(produit_id)
);`}</pre>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
          + le diagramme MCD/ERD, le schéma en étoile/flocon, le DBML (dbdiagram.io), le schéma dbt,
          le dictionnaire de données et le rapport DAD avec score de maturité — tous téléchargeables.
        </div>
      </div>

      {/* Tips */}
      <h3 style={{ fontSize: 18, marginBottom: 16 }}>Conseils pour de meilleurs résultats</h3>
      <div className="context-card" style={{ marginBottom: 32 }}>
        <ul style={{ paddingLeft: 18, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8, margin: 0 }}>
          <li>Décrivez le <strong>métier</strong>, pas la technique : Marty déduit le modèle.</li>
          <li>Citez les <strong>objets manipulés</strong> (client, contrat, agence, période…) et les <strong>mesures</strong> à suivre.</li>
          <li>Répondez à toutes les questions d&apos;une étape <strong>en un seul message</strong>.</li>
          <li>Vous pouvez toujours cliquer sur <strong>« Donner plus d&apos;infos »</strong> pour affiner une étape.</li>
          <li>Consultez le panneau <strong>« Données collectées »</strong> à droite : chaque section est cliquable pour voir le détail.</li>
        </ul>
      </div>

      <div className="dashboard-cta-group">
        <button className="cta-btn" onClick={onStartWorkshop}>
          <span className="cta-btn-icon">✨</span>
          Démarrer un atelier →
        </button>
      </div>
    </div>
  );
}
