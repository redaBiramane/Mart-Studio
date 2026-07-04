'use client';

import { useState } from 'react';
import { report } from './ErrorReporter';

interface HelpProps {
  onOpenDocs: () => void;
  onStartWorkshop: () => void;
  onSuggestIdea?: () => void;
  isAdmin?: boolean;
}

const FAQ: { q: string; a: string }[] = [
  { q: 'Comment démarrer un Data Product ?', a: "Cliquez sur « Nouvel Atelier » (accueil ou DataForge), choisissez le mode Guidé ou Par étape, puis décrivez votre besoin métier à Marty. Il construit le modèle avec vous en 7 étapes." },
  { q: 'Puis-je importer un modèle existant ?', a: "Oui. En mode Visuel, bouton « Importer SQL » pour coller un CREATE TABLE Snowflake/SQL, ou le bouton 📎 dans le chat pour un fichier SAS/CSV/Excel. Tables, colonnes et clés PK/FK sont créées automatiquement." },
  { q: 'Chat ou Visuel : quelle différence ?', a: "Les deux modélisent le même modèle, en temps réel. Le Chat laisse Marty déduire ; le Visuel vous laisse dessiner (glisser-déposer les tables, tirer les relations). Ce que vous faites d'un côté est vu de l'autre." },
  { q: 'Où récupérer mes livrables ?', a: "Dans le menu « Livrables » : MCD/ERD, schéma étoile/flocon, SQL DDL, DBML, dbt YAML, dictionnaire de données et rapport DAD — tous téléchargeables." },
  { q: 'Comment réinitialiser ou supprimer un atelier ?', a: "Dans DataForge, menu « Options » (en haut) : « Remettre à zéro l'atelier » ou « Supprimer ce Data Product ». Une confirmation est demandée." },
  { q: 'Mes données sont-elles sauvegardées ?', a: "Oui, automatiquement : chaque modification est enregistrée sur votre compte. Vous retrouvez vos Data Products dans « Data Products » et « Sessions récentes »." },
];

const TIPS: string[] = [
  'Décrivez le métier, pas la technique : Marty déduit le modèle.',
  'Citez les objets manipulés (client, contrat, agence, période…) et les mesures à suivre.',
  'Le panneau « Données collectées » (à droite) est éditable : chaque section est cliquable.',
  'Le bouton 💡 (en haut) permet de proposer une amélioration de la plateforme.',
];

export default function Help({ onOpenDocs, onStartWorkshop, onSuggestIdea, isAdmin }: HelpProps) {
  const [tested, setTested] = useState(false);
  return (
    <div className="dashboard" style={{ maxWidth: 860, margin: '0 auto' }}>
      <div className="context-card" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, marginBottom: 8 }}>Aide & support</h2>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
          Retrouvez ici l&apos;essentiel pour bien utiliser Mart Studio. Pour un guide détaillé pas à pas,
          consultez la <button onClick={onOpenDocs} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 700, padding: 0, textDecoration: 'underline' }}>documentation complète</button>.
        </p>
      </div>

      {/* Actions rapides */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 28 }}>
        <button className="context-card" onClick={onStartWorkshop} style={{ textAlign: 'left', cursor: 'pointer', border: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>✨ Démarrer un atelier</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Concevoir un nouveau Data Product avec Marty.</div>
        </button>
        <button className="context-card" onClick={onOpenDocs} style={{ textAlign: 'left', cursor: 'pointer', border: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>📖 Documentation</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Le guide complet, étape par étape, avec exemple.</div>
        </button>
        {onSuggestIdea && (
          <button className="context-card" onClick={onSuggestIdea} style={{ textAlign: 'left', cursor: 'pointer', border: '1px solid var(--border)' }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>💡 Proposer une idée</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Suggérer une amélioration ou signaler un souci.</div>
          </button>
        )}
      </div>

      {/* FAQ */}
      <h3 style={{ fontSize: 18, marginBottom: 16 }}>Questions fréquentes</h3>
      <div style={{ display: 'grid', gap: 12, marginBottom: 28 }}>
        {FAQ.map((f) => (
          <details key={f.q} className="context-card" style={{ cursor: 'pointer' }}>
            <summary style={{ fontWeight: 700, listStyle: 'none' }}>{f.q}</summary>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: 8 }}>{f.a}</div>
          </details>
        ))}
      </div>

      {/* Conseils */}
      <h3 style={{ fontSize: 18, marginBottom: 16 }}>Conseils</h3>
      <div className="context-card" style={{ marginBottom: 28 }}>
        <ul style={{ paddingLeft: 18, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.9, margin: 0 }}>
          {TIPS.map((t) => <li key={t}>{t}</li>)}
        </ul>
      </div>

      {/* Test Sentry (admin) */}
      {isAdmin && (
        <div className="context-card" style={{ marginBottom: 28, borderLeft: '3px solid var(--accent-amber)' }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>🛠️ Diagnostic — Monitoring (admin)</div>
          <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 12 }}>
            Envoie un événement de test à Sentry pour vérifier que le monitoring d&apos;erreurs fonctionne. L&apos;événement doit apparaître dans sentry.io → Issues en quelques secondes.
          </div>
          <button
            className="suggested-chip"
            onClick={() => { report('test-sentry', `Test Sentry depuis la page Aide — ${new Date().toISOString()}`); setTested(true); setTimeout(() => setTested(false), 4000); }}
          >
            Envoyer un événement de test
          </button>
          {tested && <span style={{ marginLeft: 12, fontSize: 13, color: 'var(--primary)', fontWeight: 600 }}>✓ Envoyé — vérifiez Sentry (Issues)</span>}
        </div>
      )}

      {/* Contact */}
      <div className="context-card" style={{ borderLeft: '3px solid var(--primary)' }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Besoin d&apos;aide supplémentaire ?</div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Contactez votre administrateur Mart Studio, ou écrivez à{' '}
          <a href="mailto:support@martstudio.it.com" style={{ color: 'var(--primary)', fontWeight: 600 }}>support@martstudio.it.com</a>.
        </div>
      </div>
    </div>
  );
}
