'use client';

import { useEffect, useRef, useState } from 'react';
import { VSCODE_EXTENSION } from '@/lib/constants';

interface DocumentationProps {
  onStartWorkshop: () => void;
}

// ---- Structure de la doc (sert à la sidebar ET au sommaire de droite) ----
const SECTIONS: { id: string; title: string }[] = [
  { id: 'intro', title: 'Qu\'est-ce que Mart Studio ?' },
  { id: 'demarrer', title: 'Démarrer : créer un Data Product' },
  { id: 'marty', title: 'Concevoir avec Marty (chat)' },
  { id: 'etapes', title: 'Les 7 étapes de l\'atelier' },
  { id: 'visuel', title: 'L\'éditeur visuel' },
  { id: 'import', title: 'Importer vos scripts (SAS / SQL / Snowflake)' },
  { id: 'qualite', title: 'Contrôle qualité (linter)' },
  { id: 'historique', title: 'Historique & aperçu des changements' },
  { id: 'livrables', title: 'Livrables & génération' },
  { id: 'contexte', title: 'Panneau « Données collectées »' },
  { id: 'vscode', title: 'Extension VSCode' },
  { id: 'reglages', title: 'Langue, thème, idées' },
  { id: 'conseils', title: 'Bonnes pratiques' },
];

// Les onglets du panneau de l'extension VSCode.
const VSCODE_TABS = [
  { t: 'Modèle', d: 'Chaque table avec ses colonnes, clés (PK/FK) et données sensibles (🔒), plus les relations, KPI et règles.' },
  { t: 'SQL DDL', d: 'Les CREATE TABLE complets (PK, NOT NULL, FK, tables d\'association N:N), prêts à exécuter.' },
  { t: 'DBML', d: 'À coller sur dbdiagram.io pour un schéma interactif.' },
  { t: 'DBT', d: 'Le schema.yml (modèles + tests unique / not_null).' },
  { t: 'Semantic Layer', d: 'La lecture métier du modèle, en français sans jargon — à partager avec les métiers.' },
  { t: 'Dictionnaire', d: 'Le dictionnaire de données complet.' },
  { t: 'Qualité', d: 'Un score /100 et les anomalies détectées, avec la correction suggérée.' },
  { t: 'Diagramme ERD', d: 'Le schéma entité-relation dessiné directement dans VSCode (fonctionne hors ligne).' },
];

const STEPS = [
  { n: 1, icon: '🎯', title: 'Contexte', text: 'Décrivez le produit : nom, problème métier, objectif, domaine, Product Owner, Data Steward. Marty en fait une synthèse.' },
  { n: 2, icon: '🧩', title: 'Entités', text: 'À partir de votre description, Marty conçoit le modèle : tables de faits et dimensions, leurs attributs et relations.' },
  { n: 3, icon: '🔗', title: 'Relations', text: 'Les liens entre entités : cardinalités (1:1, 1:N, N:N), obligation et hiérarchies.' },
  { n: 4, icon: '📋', title: 'Attributs', text: 'On complète les colonnes : clés primaires, types SQL, attributs sensibles ou historisés.' },
  { n: 5, icon: '📊', title: 'KPI (optionnel)', text: 'Les indicateurs à piloter (formule, fréquence, axes d\'analyse). Étape facultative.' },
  { n: 6, icon: '⚖️', title: 'Règles métier (optionnel)', text: 'Contraintes de gestion et de qualité (validations, calculs, exceptions). Facultative.' },
  { n: 7, icon: '🏁', title: 'Validation', text: 'Marty génère sources, score de maturité et rapport DAD. Tout est prêt dans Livrables.' },
];

const DELIVERABLES = [
  { icon: '🗺️', title: 'MCD / ERD', text: 'Le Modèle Conceptuel de Données, rendu automatiquement en diagramme (Mermaid).' },
  { icon: '✳️', title: 'Étoile / Flocon', text: 'Le modèle dimensionnel : classification automatique en faits et dimensions, schémas star & snowflake.' },
  { icon: '🧬', title: 'DBML', text: 'Code prêt à coller sur dbdiagram.io pour un diagramme interactif partageable.' },
  { icon: '💾', title: 'SQL DDL', text: 'Les CREATE TABLE complets (PK, FK, contraintes) — exécutables directement.' },
  { icon: '🔧', title: 'dbt YAML', text: 'Le schema.yml dbt avec tests (unique, not_null, relationships).' },
  { icon: '📖', title: 'Dictionnaire', text: 'Chaque attribut : type, PK/FK, sensibilité et description.' },
  { icon: '📊', title: 'Rapport détaillé (PDF)', text: 'Un rapport mis en page (couverture, tables, relations) aux couleurs de la plateforme.' },
  { icon: '📋', title: 'Rapport DAD', text: 'Score de maturité et synthèse de préparation à la Design Authority.' },
];

const QUALITY_RULES: { cat: string; sev: string; color: string; text: string }[] = [
  { cat: 'Type de donnée', sev: 'Err./Avert.', color: 'var(--accent-amber)', text: 'Un type incohérent avec le nom (ex. email en DECIMAL, date_… en VARCHAR) est signalé et corrigé.' },
  { cat: 'Clé primaire', sev: 'Erreur', color: 'var(--accent-red)', text: 'Une table sans clé primaire : marque un *_id existant en PK, ou en crée une.' },
  { cat: 'RGPD / Sensibilité', sev: 'Avert.', color: 'var(--accent-amber)', text: 'Une donnée personnelle (nom, email, IBAN, date de naissance…) non marquée sensible.' },
  { cat: 'Doublon', sev: 'Avert.', color: 'var(--accent-amber)', text: 'Une colonne en double au sein d\'une même table.' },
  { cat: 'Intégrité référentielle', sev: 'Err./Avert.', color: 'var(--accent-red)', text: 'Relation vers une table inexistante (la crée), clé étrangère manquante (l\'ajoute), ou type de FK ≠ type de la PK référencée (l\'aligne).' },
  { cat: 'Granularité', sev: 'Avert.', color: 'var(--accent-amber)', text: 'Des tables de faits sans grain défini (« que représente une ligne ? »).' },
  { cat: 'Normalisation', sev: 'Info', color: 'var(--accent-blue)', text: 'Une colonne descriptive répétée dans plusieurs tables, ou deux tables quasi identiques (doublon potentiel).' },
];

const DOCS_CSS = `
.md-docs { display: grid; grid-template-columns: 220px minmax(0,1fr) 210px; gap: 32px; max-width: 1240px; margin: 0 auto; align-items: start; }
.md-nav, .md-toc { position: sticky; top: 16px; align-self: start; max-height: calc(100vh - 32px); overflow-y: auto; }
.md-nav a, .md-toc a { display: block; padding: 6px 10px; border-radius: 7px; font-size: 12.5px; color: var(--text-secondary); text-decoration: none; line-height: 1.4; border-left: 2px solid transparent; }
.md-nav a:hover, .md-toc a:hover { background: var(--bg-elevated); color: var(--text); }
.md-nav a.active, .md-toc a.active { color: var(--primary-light); background: var(--primary-glow); border-left-color: var(--primary); font-weight: 600; }
.md-navtitle { font-size: 10.5px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: var(--text-muted); margin: 4px 10px 8px; }
.md-sec { scroll-margin-top: 16px; margin-bottom: 40px; }
.md-sec h2 { font-size: 24px; margin: 0 0 14px; padding-bottom: 8px; border-bottom: 1px solid var(--border); }
.md-sec h3 { font-size: 16px; margin: 20px 0 8px; }
.md-sec p { font-size: 14px; line-height: 1.65; color: var(--text-secondary); margin: 0 0 12px; }
.md-sec li { font-size: 13.5px; line-height: 1.6; color: var(--text-secondary); margin-bottom: 6px; }
.md-sec code { background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 5px; padding: 1px 6px; font-size: 12.5px; color: var(--primary-light); }
.md-kbd { background: var(--bg-elevated); border: 1px solid var(--border); border-bottom-width: 2px; border-radius: 6px; padding: 1px 7px; font-size: 12px; font-weight: 600; color: var(--text); }
.md-card { background: var(--bg-surface); border: 1px solid var(--border); border-radius: 12px; padding: 16px 18px; }
.md-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 12px; }
.md-callout { background: var(--primary-glow); border: 1px solid var(--border-active); border-left: 3px solid var(--primary); border-radius: 10px; padding: 12px 16px; font-size: 13.5px; color: var(--text); line-height: 1.6; }
@media (max-width: 1100px) { .md-docs { grid-template-columns: 200px minmax(0,1fr); } .md-toc { display: none; } }
@media (max-width: 780px) { .md-docs { grid-template-columns: 1fr; } .md-nav { display: none; } }
`;

const thStyle: React.CSSProperties = { textAlign: 'left', padding: '7px 10px', borderBottom: '2px solid var(--border)', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap', fontSize: 12 };
const tdStyle: React.CSSProperties = { padding: '7px 10px', borderBottom: '1px solid var(--border)', fontSize: 13 };

export default function Documentation({ onStartWorkshop }: DocumentationProps) {
  const [active, setActive] = useState<string>('intro');
  const mainRef = useRef<HTMLDivElement>(null);

  // Scrollspy : met en surbrillance la section visible dans la sidebar et le sommaire.
  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter(Boolean) as HTMLElement[];
    if (!els.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-10% 0px -70% 0px', threshold: 0 }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const go = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActive(id);
  };

  const NavList = ({ cls }: { cls: string }) => (
    <>
      {SECTIONS.map((s) => (
        <a key={s.id} href={`#${s.id}`} className={`${cls} ${active === s.id ? 'active' : ''}`} onClick={go(s.id)}>{s.title}</a>
      ))}
    </>
  );

  return (
    <div className="dashboard">
      <style dangerouslySetInnerHTML={{ __html: DOCS_CSS }} />

      <div style={{ maxWidth: 1240, margin: '0 auto 20px' }}>
        <h1 style={{ fontSize: 30, margin: '0 0 6px' }}>Documentation Mart Studio</h1>
        <p style={{ fontSize: 15, color: 'var(--text-muted)', margin: 0 }}>Tout ce que la plateforme fait, et comment l&apos;utiliser — de la description en langage naturel au modèle de données livrable.</p>
      </div>

      <div className="md-docs">
        {/* Sidebar gauche */}
        <nav className="md-nav">
          <div className="md-navtitle">Sur cette doc</div>
          <NavList cls="" />
        </nav>

        {/* Contenu */}
        <div ref={mainRef}>

          <section id="intro" className="md-sec">
            <h2>Qu&apos;est-ce que Mart Studio ?</h2>
            <p>Mart Studio transforme une <strong>description métier en langage naturel</strong> en un <strong>modèle de données complet et livrable</strong> (MCD, SQL, dbt, dictionnaire…). Un assistant, <strong>Marty</strong>, vous guide étape par étape ; vous pouvez à tout moment basculer sur un <strong>éditeur visuel</strong> pour ajuster le modèle à la main.</p>
            <p>L&apos;objectif : passer de l&apos;idée (« je veux piloter mes ventes ») à un modèle structuré, contrôlé qualité et prêt à être implémenté, sans partir d&apos;une page blanche.</p>
            <div className="md-callout">En bref : <strong>vous décrivez</strong> → <strong>Marty modélise</strong> → <strong>vous ajustez</strong> (visuel + qualité) → <strong>vous exportez</strong> les livrables.</div>
          </section>

          <section id="demarrer" className="md-sec">
            <h2>Démarrer : créer un Data Product</h2>
            <p>Depuis <strong>Data Products</strong>, cliquez sur <strong>Nouveau</strong>. Un « Data Product » = un modèle de données autour d&apos;un besoin métier (ex. « Pilotage des Ventes »). Vous pouvez en gérer autant que vous voulez ; ils sont listés dans la barre latérale et sauvegardés automatiquement.</p>
            <h3>Deux modes de conception</h3>
            <ul>
              <li><strong>Chat</strong> — vous dialoguez avec Marty qui pose les bonnes questions et construit le modèle.</li>
              <li><strong>Visuel</strong> — vous manipulez directement les tables, colonnes et relations sur un canvas.</li>
            </ul>
            <p>Le bouton <strong>Chat / Visuel</strong> en haut de l&apos;atelier bascule entre les deux — c&apos;est <strong>le même modèle</strong> des deux côtés, toute modification est instantanément partagée.</p>
            <button className="cta-btn" onClick={onStartWorkshop} style={{ marginTop: 4 }}>Ouvrir l&apos;atelier →</button>
          </section>

          <section id="marty" className="md-sec">
            <h2>Concevoir avec Marty (chat)</h2>
            <p>Marty est l&apos;assistant Data Architect. Vous répondez à ses questions <strong>en langage naturel</strong> — même une réponse partielle suffit : il structure, déduit les entités, relations et types, et remplit le modèle au fur et à mesure.</p>
            <h3>Comment Marty écrit dans le modèle</h3>
            <p>À chaque réponse, Marty <strong>extrait</strong> les informations et met à jour le modèle. Un bandeau récapitule alors ce qui a changé (<code>+3 tables · +12 colonnes · +2 relations</code>) avec un bouton <strong>↶ Annuler</strong> pour tout revenir en un clic si le résultat ne vous convient pas.</p>
            <div className="md-callout">Astuce : soyez concret. Citez vos objets métier, vos KPIs et vos systèmes sources — Marty les capte dès votre première réponse.</div>
          </section>

          <section id="etapes" className="md-sec">
            <h2>Les 7 étapes de l&apos;atelier</h2>
            <p>L&apos;atelier suit un déroulé en 7 étapes (les étapes 5 et 6 sont facultatives). La barre de progression à gauche indique où vous en êtes.</p>
            <div className="md-grid">
              {STEPS.map((s) => (
                <div key={s.n} className="md-card">
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>{s.icon} {s.n}. {s.title}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{s.text}</div>
                </div>
              ))}
            </div>
          </section>

          <section id="visuel" className="md-sec">
            <h2>L&apos;éditeur visuel</h2>
            <p>Le mode <strong>Visuel</strong> affiche votre modèle sous forme de tables reliées, façon diagramme entité-relation. Vous pouvez tout éditer directement.</p>
            <h3>Relier deux tables</h3>
            <p>Chaque table a des <strong>poignées de connexion</strong> sur ses bords gauche et droit (elles s&apos;agrandissent au survol). <strong>Tirez</strong> depuis le bord d&apos;une table vers une autre pour créer une relation — l&apos;accroche se fait automatiquement en approchant.</p>
            <h3>Colonnes & tables</h3>
            <ul>
              <li><strong>+ colonne</strong> ajoute un champ ; cliquez <strong>PK</strong> pour la clé primaire, choisissez le <strong>type</strong> SQL.</li>
              <li>Le nom se valide en sortant du champ ou avec <span className="md-kbd">Entrée</span> (saisie fluide, même avec beaucoup de tables).</li>
              <li>L&apos;icône <strong>⧉</strong> ouvre <strong>toutes les colonnes</strong> d&apos;une table dans une fenêtre avec recherche.</li>
              <li><strong>Arranger</strong> réorganise automatiquement la disposition des tables.</li>
            </ul>
            <h3>Naviguer à grande échelle (100+ tables)</h3>
            <ul>
              <li><strong>Recherche</strong> (en haut à droite du canvas) : tapez un nom de table ou de colonne → la liste des résultats apparaît, cliquez pour <strong>zoomer</strong> dessus. Les tables trouvées sont surlignées, les autres estompées.</li>
              <li><strong>Focus voisins</strong> (icône ⊕ sur une table) : n&apos;affiche que cette table et ses <strong>tables directement reliées</strong>. Cliquez le fond pour quitter.</li>
              <li><strong>Mini-carte</strong> et zoom en bas pour se repérer.</li>
            </ul>
          </section>

          <section id="import" className="md-sec">
            <h2>Importer vos scripts (SAS / SQL / Snowflake)</h2>
            <p>Vous partez de tables existantes ? Dans le visuel, <strong>Importer SQL</strong> accepte un ou plusieurs <code>CREATE TABLE</code> (SQL standard, Snowflake, PROC SQL). Les tables, colonnes, types et clés <strong>PK / FK</strong> (ainsi que les relations) sont créés automatiquement.</p>
            <h3>Round-trip : resynchroniser</h3>
            <p>Ré-importer un script <strong>met à jour</strong> les tables déjà présentes au lieu de les dupliquer : nouveaux champs ajoutés, types et clés resynchronisés. Idéal pour garder le modèle aligné avec un DDL qui évolue.</p>
            <div className="md-callout">Dans le chat, vous pouvez aussi <strong>joindre un fichier</strong> (script, requête, export) : Marty en déduit le modèle et émet les entités/attributs/relations.</div>
          </section>

          <section id="qualite" className="md-sec">
            <h2>Contrôle qualité (linter)</h2>
            <p>L&apos;onglet <strong>Qualité</strong> (dans Livrables) analyse votre modèle et affiche un <strong>score /100</strong> avec la liste des points à corriger. Pour chaque suggestion, vous comparez <span style={{ color: 'var(--accent-red)', textDecoration: 'line-through' }}>votre version</span> → <span style={{ color: 'var(--primary)', fontWeight: 700 }}>la version améliorée</span>, puis <strong>Valider</strong> (applique) ou <strong>Ignorer</strong> (masqué durablement).</p>
            <h3>Ce que le linter vérifie</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={thStyle}>Catégorie</th><th style={thStyle}>Niveau</th><th style={thStyle}>Contrôle</th></tr></thead>
                <tbody>
                  {QUALITY_RULES.map((r) => (
                    <tr key={r.cat}>
                      <td style={{ ...tdStyle, fontWeight: 600, whiteSpace: 'nowrap' }}>{r.cat}</td>
                      <td style={{ ...tdStyle, color: r.color, fontWeight: 700, whiteSpace: 'nowrap' }}>{r.sev}</td>
                      <td style={{ ...tdStyle, color: 'var(--text-secondary)' }}>{r.text}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="md-callout" style={{ marginTop: 14 }}>Avant de générer un livrable, une <strong>bannière d&apos;alerte</strong> apparaît sur les onglets code (SQL, dbt…) si le modèle contient des erreurs ou si le score est bas — avec un lien direct vers l&apos;onglet Qualité.</div>
          </section>

          <section id="historique" className="md-sec">
            <h2>Historique & aperçu des changements</h2>
            <p>Toutes les modifications du modèle (Marty, éditeur visuel, panneau contexte, corrections qualité, import) sont <strong>annulables</strong>.</p>
            <ul>
              <li>Boutons <strong>Annuler / Rétablir</strong> dans l&apos;en-tête de l&apos;atelier.</li>
              <li>Raccourcis <span className="md-kbd">⌘/Ctrl + Z</span> et <span className="md-kbd">⌘/Ctrl + Maj + Z</span>.</li>
              <li>Une action de Marty = <strong>un seul pas d&apos;annulation</strong> ; la conversation n&apos;est jamais affectée.</li>
            </ul>
            <p>C&apos;est le filet de sécurité qui permet de laisser Marty modifier le modèle en confiance : si le résultat ne convient pas, un clic suffit à revenir en arrière.</p>
          </section>

          <section id="livrables" className="md-sec">
            <h2>Livrables & génération</h2>
            <p>L&apos;onglet <strong>Livrables</strong> génère automatiquement tous les artefacts à partir de votre modèle. Ils se mettent à jour dès que le modèle change.</p>
            <div className="md-grid">
              {DELIVERABLES.map((d) => (
                <div key={d.title} className="md-card">
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>{d.icon} {d.title}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{d.text}</div>
                </div>
              ))}
            </div>
            <p style={{ marginTop: 14 }}>Les diagrammes (MCD, Étoile/Flocon) se <strong>téléchargent en PNG</strong> ; le code (SQL, dbt, DBML) se <strong>copie</strong> en un clic ; le rapport détaillé s&apos;<strong>exporte en PDF</strong>.</p>
          </section>

          <section id="contexte" className="md-sec">
            <h2>Panneau « Données collectées »</h2>
            <p>À droite de l&apos;atelier, ce panneau montre l&apos;état du modèle en temps réel : contexte, entités, relations, attributs, KPIs, règles, sources. Chaque section est <strong>cliquable</strong> pour ouvrir un mode <strong>Modifier</strong>.</p>
            <h3>Recherche dans les modals</h3>
            <p>Dans les fenêtres <strong>Modifier</strong> (Entités, Attributs, Relations), une <strong>barre de recherche</strong> filtre en direct : tapez un nom de table pour voir toutes ses colonnes, ou un nom de colonne pour ne garder que les tables concernées. Le compteur <code>(3 / 42)</code> indique les colonnes affichées sur le total — indispensable au-delà de quelques dizaines de tables.</p>
          </section>

          <section id="vscode" className="md-sec">
            <h2>Extension VSCode</h2>
            <p>
              Vous préférez travailler dans votre éditeur ? L&apos;extension <strong>Marty pour VSCode</strong> transforme
              une simple <strong>description métier</strong> en un modèle de données complet et ses livrables,
              sans quitter votre projet. Les générations sont <strong>enregistrées dans votre espace</strong> :
              vous les retrouvez ici, dans <strong>Data Products</strong>, pour poursuivre l&apos;atelier.
            </p>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', margin: '16px 0' }}>
              <a
                className="cta-btn"
                href={VSCODE_EXTENSION.file}
                download="marty-vscode.vsix"
                style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                ⬇️ Télécharger l&apos;extension (.vsix)
              </a>
              <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                Version {VSCODE_EXTENSION.version} · VSCode 1.85+ · ~1 Mo
              </span>
            </div>

            <div className="md-callout">
              🔑 <strong>Aucune clé API à saisir</strong> (ni Claude, ni OpenAI). Vous vous connectez dans VSCode
              avec <strong>ce même compte</strong> — c&apos;est tout. L&apos;IA est appelée par le serveur Marty.
            </div>

            <h3>Installer (2 minutes)</h3>
            <ol>
              <li>Téléchargez le fichier <code>.vsix</code> ci-dessus.</li>
              <li>Dans VSCode : <span className="md-kbd">⌘/Ctrl + Maj + X</span> pour ouvrir <strong>Extensions</strong>.</li>
              <li>Menu <code>…</code> en haut du panneau → <strong>Install from VSIX…</strong> → choisissez le fichier.</li>
              <li>Une <strong>icône Marty</strong> apparaît dans la barre d&apos;activité, à gauche.</li>
            </ol>

            <h3>Se connecter (une seule fois)</h3>
            <p>
              Cliquez l&apos;icône Marty → <strong>Se connecter</strong>, puis saisissez l&apos;<strong>email et le mot de passe
              de ce site</strong>. Votre session est stockée chiffrée dans le coffre de VSCode et se renouvelle
              toute seule : vous n&apos;y reviendrez plus.
            </p>

            <h3>Générer</h3>
            <p>
              Décrivez votre idée métier dans le panneau latéral, choisissez le modèle IA
              (<strong>Claude Opus</strong> pour la précision, <strong>Gemini Flash</strong> pour la rapidité) et lancez.
              Le <strong>coût estimé en euros</strong> de chaque génération est affiché — Opus est nettement plus
              coûteux que Gemini : choisissez en conséquence.
            </p>

            <h3>Les 8 onglets de livrables</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={thStyle}>Onglet</th><th style={thStyle}>Contenu</th></tr></thead>
                <tbody>
                  {VSCODE_TABS.map((r) => (
                    <tr key={r.t}>
                      <td style={{ ...tdStyle, fontWeight: 600, whiteSpace: 'nowrap' }}>{r.t}</td>
                      <td style={{ ...tdStyle, color: 'var(--text-secondary)' }}>{r.d}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3>Récupérer les livrables</h3>
            <ul>
              <li><strong>💾 Enregistrer dans le projet</strong> — écrit les fichiers dans <code>marty-out/&lt;nom&gt;/</code> de votre dossier ouvert.</li>
              <li><strong>📦 Télécharger le package (.zip)</strong> — une archive de tous les livrables.</li>
              <li><strong>🌐 Continuer sur le site</strong> — le Data Product y est <strong>déjà enregistré</strong> : ouvrez-le dans <strong>Data Products</strong> pour poursuivre l&apos;atelier (KPI, gouvernance, rapport DAD).</li>
            </ul>

            <h3>Vos générations sont conservées</h3>
            <p>
              La section <strong>« Mes générations »</strong> (barre latérale de VSCode) liste vos Data Products.
              Un clic les <strong>rouvre instantanément</strong> : les livrables sont reconstruits sans rappeler l&apos;IA,
              donc <strong>sans coût ni attente</strong>.
            </p>

            <h3>En cas de problème</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={thStyle}>Symptôme</th><th style={thStyle}>Solution</th></tr></thead>
                <tbody>
                  <tr>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>Pas d&apos;icône Marty</td>
                    <td style={{ ...tdStyle, color: 'var(--text-secondary)' }}>Rechargez VSCode : <span className="md-kbd">⌘/Ctrl + Maj + P</span> → <em>Reload Window</em>.</td>
                  </tr>
                  <tr>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>« Non connecté »</td>
                    <td style={{ ...tdStyle, color: 'var(--text-secondary)' }}>Cliquez « Se connecter » et saisissez vos identifiants de ce site.</td>
                  </tr>
                  <tr>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>Email ou mot de passe incorrect</td>
                    <td style={{ ...tdStyle, color: 'var(--text-secondary)' }}>Ce sont exactement les identifiants de martstudio.it.com.</td>
                  </tr>
                  <tr>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>Trop de requêtes (429)</td>
                    <td style={{ ...tdStyle, color: 'var(--text-secondary)' }}>Limite de 12 générations/minute par compte : patientez une minute.</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="md-callout" style={{ marginTop: 14 }}>
              ⚠️ <strong>Confidentialité</strong> — décrivez la <strong>structure</strong> et le <strong>besoin</strong>,
              jamais de données réelles (vrais noms, IBAN, montants clients).
            </div>
          </section>

          <section id="reglages" className="md-sec">
            <h2>Langue, thème, idées</h2>
            <ul>
              <li><strong>🌐 Langue</strong> — bascule Français / Anglais depuis l&apos;en-tête.</li>
              <li><strong>🌙 Thème</strong> — clair / sombre.</li>
              <li><strong>🔔 Notifications</strong> — les réponses de l&apos;équipe à vos idées y apparaissent.</li>
              <li><strong>💡 Idées d&apos;amélioration</strong> — proposez une amélioration de la plateforme ; l&apos;équipe peut vous répondre directement dans l&apos;app.</li>
            </ul>
          </section>

          <section id="conseils" className="md-sec">
            <h2>Bonnes pratiques</h2>
            <ul>
              <li><strong>Soyez concret dès le contexte</strong> : nommez vos objets métier, KPIs et systèmes sources — Marty gagne du temps sur les étapes suivantes.</li>
              <li><strong>Nommez clairement vos colonnes</strong> : <code>montant</code>, <code>date_commande</code>, <code>client_id</code>… le linter en déduit les types et les clés.</li>
              <li><strong>Passez par l&apos;onglet Qualité</strong> avant d&apos;exporter : corrigez les erreurs, vérifiez l&apos;intégrité référentielle.</li>
              <li><strong>Alternez chat et visuel</strong> : laissez Marty poser la structure, ajustez finement au visuel.</li>
              <li><strong>N&apos;ayez pas peur d&apos;essayer</strong> : tout est annulable (<span className="md-kbd">⌘Z</span>).</li>
            </ul>
            <button className="cta-btn" onClick={onStartWorkshop} style={{ marginTop: 8 }}>Commencer un Data Product →</button>
          </section>

        </div>

        {/* Sommaire droite */}
        <aside className="md-toc">
          <div className="md-navtitle">Sur cette page</div>
          <NavList cls="" />
        </aside>
      </div>
    </div>
  );
}
