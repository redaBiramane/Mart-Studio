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

      {/* Concrete example */}
      <h3 style={{ fontSize: 18, marginBottom: 16 }}>Exemple concret — pour vous inspirer</h3>
      <div className="context-card" style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>1. Ce que vous écrivez à Marty</div>
        <div className="transform-before" style={{ padding: 16, borderRadius: 8 }}>
          <em style={{ color: 'var(--text-secondary)' }}>
            « Je veux un Data Product pour piloter les réclamations clients. On veut suivre le volume,
            le statut, le délai de résolution, les motifs et les actions correctives. Domaine :
            relation client. PO : Responsable Expérience Client. »
          </em>
        </div>
      </div>

      <div className="context-card" style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>2. Ce que Marty modélise automatiquement</div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          <strong>Entités :</strong> Client, Réclamation, Canal, MotifRéclamation, DossierRéclamation,
          Gestionnaire, ActionCorrective, SatisfactionClient.<br />
          <strong>Relations :</strong> Client → Réclamation (1:N), Réclamation → Canal (N:1),
          Réclamation → MotifRéclamation (N:1), DossierRéclamation → ActionCorrective (1:N)…<br />
          <strong>Attributs :</strong> clés primaires, dates, statuts, délais, montants, avec types SQL.
        </div>
      </div>

      <div className="context-card" style={{ marginBottom: 32 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>3. Ce que vous récupérez en un clic</div>
        <pre style={{ background: 'var(--bg-surface-2, #0d1117)', color: '#c9d1d9', padding: 16, borderRadius: 8, overflow: 'auto', fontSize: 12.5, lineHeight: 1.5 }}>{`CREATE TABLE reclamation (
    reclamation_id BIGINT PRIMARY KEY, -- Clé primaire de la réclamation
    date_reclamation DATE NOT NULL,    -- Date de la réclamation
    statut VARCHAR(255) NOT NULL,      -- Statut actuel
    client_client_id BIGINT NOT NULL,  -- FK vers Client
    canal_canal_id BIGINT NOT NULL,    -- FK vers Canal
    CONSTRAINT fk_reclamation_client FOREIGN KEY (client_client_id)
        REFERENCES client(client_id)
);`}</pre>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
          + le diagramme DBML (dbdiagram.io), le schéma dbt, le dictionnaire de données et le rapport DAD.
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
