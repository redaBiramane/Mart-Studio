'use client';

import { useEffect } from 'react';

interface LandingProps {
  onEnter: () => void;
}

const CSS = `
:root, [data-theme="clair"] {
  --marque-principale: #009597; --marque-ardoise: #666E8A; --marque-marine: #071621; --marque-sarcelle-fonce: #006466;
  --blanc: #FFFFFF; --blanc-casse: #F7F8FA; --blanc-casse-2: #F5F5F5; --gris-clair: #E8E8E8; --gris-neutre: #C0C4CC;
  --pastel-sarcelle-tres-clair: #F0F9F9; --pastel-sarcelle-clair: #EBF7F7; --pastel-sarcelle-profond: #E0F5F5;
  --pastel-vert: #E5F2D0; --pastel-violet: #E2D6EC; --pastel-orange: #FDE8D0; --pastel-bleu: #D8EAF7;
  --vert: #2D8E57; --bleu: #3A7CC3; --violet: #7030A0; --orange: #E07A2F; --corail: #F47682; --jaune: #FFC000;
  --police: 'Open Sans', sans-serif;
  --espace-3xs: 8px; --espace-2xs: 12px; --espace-xs: 16px; --espace-s: 24px; --espace-m: 32px; --espace-l: 48px; --espace-xl: 64px;
  --rayon-tag: 3px; --rayon-bouton: 6px; --rayon-carte: 8px; --rayon-section: 12px; --rayon-capsule: 20px;
  --ombre-carte: 0 2px 12px rgba(0,0,0,0.04); --ombre-carte-survol: 0 8px 28px rgba(0,149,151,0.14); --transition: 0.2s ease;
  --surface-fond: var(--blanc-casse); --surface-carte: var(--blanc); --texte-principal: var(--marque-marine);
  --texte-secondaire: var(--marque-ardoise); --bordure: var(--gris-clair);
  --hero-fond: linear-gradient(140deg, #00767880 0%, #0096970d 55%, transparent 100%);
}
[data-theme="sombre"] {
  --surface-fond: #0D1B2A; --surface-carte: #142637; --texte-principal: #E0E4E8; --texte-secondaire: #99A3B8; --bordure: #1E3348;
  --blanc: #142637; --blanc-casse: #0F2033; --blanc-casse-2: #12242F; --gris-clair: #1E3348; --gris-neutre: #3A4A5C;
  --pastel-sarcelle-clair: #0E3537; --pastel-sarcelle-profond: #103D3F; --pastel-violet: #241A30; --pastel-orange: #2E2218; --pastel-bleu: #14243A;
  --ombre-carte-survol: 0 8px 28px rgba(0,149,151,0.25);
  --hero-fond: linear-gradient(140deg, #00959733 0%, #00959708 55%, transparent 100%);
}
* { margin: 0; padding: 0; box-sizing: border-box; }
html { scroll-behavior: smooth; scroll-padding-top: 72px; }
body { background: var(--surface-fond); color: var(--texte-principal); font-family: var(--police); -webkit-font-smoothing: antialiased; line-height: 1.65; transition: background .2s, color .2s; }
.enveloppe { max-width: 1160px; margin: 0 auto; padding: 0 var(--espace-m); }
.nav { position: sticky; top: 0; z-index: 50; background: color-mix(in srgb, var(--surface-carte) 88%, transparent); backdrop-filter: blur(10px); border-bottom: 1px solid var(--bordure); }
.nav-in { max-width: 1160px; margin: 0 auto; padding: 12px var(--espace-m); display: flex; align-items: center; gap: var(--espace-s); }
.logo { display: flex; align-items: center; gap: 9px; font-weight: 800; font-size: 17px; color: var(--texte-principal); letter-spacing: -0.3px; }
.logo-pastille { width: 28px; height: 28px; border-radius: 8px; background: linear-gradient(135deg, var(--marque-principale), var(--marque-sarcelle-fonce)); display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 800; font-size: 15px; }
.logo span { color: var(--marque-principale); }
.nav-liens { display: flex; gap: 4px; margin-left: auto; }
.nav-liens a { font-size: 12.5px; font-weight: 600; color: var(--texte-secondaire); text-decoration: none; padding: 7px 12px; border-radius: var(--rayon-bouton); transition: all .2s; }
.nav-liens a:hover { color: var(--marque-principale); background: var(--pastel-sarcelle-clair); }
.btn-theme { background: var(--surface-carte); border: 1.5px solid var(--bordure); border-radius: var(--rayon-bouton); padding: 7px 11px; cursor: pointer; display: flex; align-items: center; gap: 7px; font-family: var(--police); font-size: 11px; font-weight: 600; color: var(--texte-secondaire); }
.btn-theme:hover { border-color: var(--marque-principale); color: var(--marque-principale); }
.btn-theme svg { width: 15px; height: 15px; }
[data-theme="clair"] .icone-soleil, [data-theme="clair"] .label-sombre { display: none; }
[data-theme="sombre"] .icone-lune, [data-theme="sombre"] .label-clair { display: none; }
.btn { font-family: var(--police); font-size: 13.5px; font-weight: 700; padding: 13px 26px; cursor: pointer; border-radius: var(--rayon-bouton); border: none; transition: all .2s; display: inline-flex; align-items: center; gap: 8px; text-decoration: none; }
.btn-primaire { background: var(--marque-principale); color: #fff; box-shadow: 0 4px 14px rgba(0,149,151,0.25); }
.btn-primaire:hover { background: var(--marque-sarcelle-fonce); transform: translateY(-2px); }
.hero { position: relative; overflow: hidden; padding: var(--espace-xl) 0 56px; }
.hero::before { content: ''; position: absolute; inset: 0; background: var(--hero-fond); pointer-events: none; }
.hero-in { position: relative; max-width: 860px; }
.hero h1 { font-size: 52px; line-height: 1.08; font-weight: 800; letter-spacing: -1.2px; color: var(--texte-principal); margin-bottom: var(--espace-s); }
.hero h1 .grad { background: linear-gradient(120deg, var(--marque-principale), var(--marque-sarcelle-fonce)); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
.hero-sub { font-size: 18px; line-height: 1.6; color: var(--texte-secondaire); max-width: 640px; margin-bottom: var(--espace-m); }
.hero-sub strong { color: var(--texte-principal); font-weight: 700; }
.hero-cta { display: flex; gap: 14px; flex-wrap: wrap; align-items: center; }
.hero-kpis { display: flex; gap: var(--espace-l); margin-top: 52px; flex-wrap: wrap; }
.hero-kpi .v { font-size: 38px; font-weight: 800; color: var(--marque-principale); line-height: 1; }
.hero-kpi .l { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--marque-sarcelle-fonce); margin-top: 8px; }
section { padding: var(--espace-xl) 0; }
.sect-tag { font-size: 11px; font-weight: 700; letter-spacing: 2.5px; text-transform: uppercase; color: var(--marque-sarcelle-fonce); margin-bottom: 10px; }
.sect-titre { font-size: 34px; font-weight: 800; letter-spacing: -0.6px; color: var(--texte-principal); line-height: 1.15; max-width: 760px; }
.sect-intro { font-size: 16px; color: var(--texte-secondaire); max-width: 680px; margin-top: 14px; line-height: 1.6; }
.sect-head { margin-bottom: var(--espace-l); }
.fond-pastel { background: var(--surface-carte); border-top: 1px solid var(--bordure); border-bottom: 1px solid var(--bordure); }
.grille-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--espace-s); }
.val-carte { background: var(--surface-carte); border: 1px solid var(--bordure); border-radius: var(--rayon-section); padding: 28px 26px; transition: all .2s; }
.val-carte:hover { box-shadow: var(--ombre-carte-survol); border-color: var(--marque-principale); transform: translateY(-3px); }
.val-icone { width: 46px; height: 46px; border-radius: 11px; display: flex; align-items: center; justify-content: center; margin-bottom: 18px; font-size: 22px; }
.val-carte h3 { font-size: 17px; font-weight: 700; color: var(--texte-principal); margin-bottom: 8px; }
.val-carte p { font-size: 13.5px; color: var(--texte-secondaire); line-height: 1.6; }
.temps-grille { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--espace-s); }
.temps { background: var(--surface-carte); border: 1px solid var(--bordure); border-radius: var(--rayon-section); padding: 30px 26px; position: relative; }
.temps-num { position: absolute; top: -16px; left: 26px; width: 38px; height: 38px; border-radius: 10px; background: var(--marque-principale); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 17px; }
.temps h3 { font-size: 18px; font-weight: 700; margin: 16px 0 8px; color: var(--texte-principal); }
.temps p { font-size: 13.5px; color: var(--texte-secondaire); line-height: 1.6; }
.etapes { display: flex; flex-direction: column; }
.etape { display: grid; grid-template-columns: 80px 1fr; gap: var(--espace-s); padding: var(--espace-s) 0; border-bottom: 1px solid var(--bordure); align-items: start; }
.etape:last-child { border-bottom: none; }
.etape-badge { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.etape-cercle { width: 52px; height: 52px; border-radius: 50%; background: var(--pastel-sarcelle-clair); border: 2px solid var(--marque-principale); display: flex; align-items: center; justify-content: center; font-size: 24px; }
.etape-step { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: var(--marque-sarcelle-fonce); }
.etape-corps h3 { font-size: 18px; font-weight: 700; color: var(--marque-principale); margin-bottom: 6px; }
.etape-corps p { font-size: 14px; color: var(--texte-secondaire); line-height: 1.65; max-width: 760px; }
.grille-liv { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--espace-s); }
.liv { background: var(--surface-carte); border: 1px solid var(--bordure); border-radius: var(--rayon-carte); padding: 22px; transition: all .2s; display: flex; flex-direction: column; gap: 8px; }
.liv:hover { box-shadow: var(--ombre-carte-survol); border-color: var(--marque-principale); }
.liv-tete { display: flex; align-items: center; gap: 11px; }
.liv-ico { font-size: 22px; }
.liv h3 { font-size: 15px; font-weight: 700; color: var(--texte-principal); }
.liv-tag { font-size: 8.5px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; padding: 2px 8px; border-radius: var(--rayon-tag); margin-left: auto; background: var(--pastel-sarcelle-clair); color: var(--marque-sarcelle-fonce); }
.liv p { font-size: 12.5px; color: var(--texte-secondaire); line-height: 1.55; }
.cas-wrap { display: grid; grid-template-columns: 0.85fr 1.15fr; gap: var(--espace-l); align-items: stretch; }
.cas-besoin { background: var(--pastel-orange); border-left: 4px solid var(--orange); border-radius: var(--rayon-carte); padding: 28px; }
.cas-besoin .mini-tag { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: var(--orange); }
.cas-besoin h3 { font-size: 19px; font-weight: 700; color: var(--texte-principal); margin: 10px 0 12px; }
.cas-besoin p { font-size: 14px; color: var(--texte-principal); line-height: 1.65; opacity: 0.85; }
.cas-resu { background: var(--surface-carte); border: 1px solid var(--bordure); border-radius: var(--rayon-carte); padding: 28px; }
.cas-resu .mini-tag { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: var(--marque-principale); }
.cas-resu h3 { font-size: 19px; font-weight: 700; color: var(--texte-principal); margin: 10px 0 18px; }
.cas-stats { display: flex; gap: var(--espace-m); margin-bottom: 18px; flex-wrap: wrap; }
.cas-stat .v { font-size: 30px; font-weight: 800; color: var(--marque-principale); line-height: 1; }
.cas-stat .l { font-size: 11px; color: var(--texte-secondaire); margin-top: 5px; }
.cas-liste { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 6px; }
.cas-puce { font-size: 11px; font-weight: 600; padding: 4px 11px; border-radius: var(--rayon-capsule); background: var(--blanc-casse-2); color: var(--texte-secondaire); border: 1px solid var(--bordure); }
.cas-sortie { margin-top: 18px; padding-top: 16px; border-top: 1px dashed var(--bordure); font-size: 12.5px; color: var(--texte-secondaire); }
.cas-sortie strong { color: var(--texte-principal); }
.grille-cible { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--espace-s); }
.cible { background: var(--surface-carte); border: 1px solid var(--bordure); border-radius: var(--rayon-section); padding: 26px; }
.cible-ico { width: 44px; height: 44px; border-radius: 11px; display: flex; align-items: center; justify-content: center; font-size: 21px; margin-bottom: 16px; }
.cible h3 { font-size: 16px; font-weight: 700; color: var(--texte-principal); margin-bottom: 8px; }
.cible p { font-size: 13px; color: var(--texte-secondaire); line-height: 1.6; }
.cta-final { background: linear-gradient(135deg, var(--marque-sarcelle-fonce), var(--marque-principale)); border-radius: var(--rayon-section); padding: 56px var(--espace-l); text-align: center; position: relative; overflow: hidden; }
.cta-final h2 { font-size: 34px; font-weight: 800; color: #fff; letter-spacing: -0.6px; max-width: 640px; margin: 0 auto 14px; line-height: 1.15; }
.cta-final p { font-size: 16px; color: rgba(255,255,255,0.88); max-width: 540px; margin: 0 auto 30px; }
.cta-final .btn-blanc { background: #fff; color: var(--marque-sarcelle-fonce); }
.cta-final .btn-blanc:hover { transform: translateY(-2px); }
.pied { border-top: 1px solid var(--bordure); padding: var(--espace-m) 0; }
.pied-in { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px; }
.pied-meta { font-size: 12px; color: var(--texte-secondaire); }
.pied-nav { display: flex; gap: 18px; flex-wrap: wrap; }
.pied-nav a { font-size: 12px; font-weight: 600; color: var(--texte-secondaire); text-decoration: none; cursor: pointer; }
.pied-nav a:hover { color: var(--marque-principale); }
@media (max-width: 920px) {
  .grille-3, .temps-grille, .grille-liv, .grille-cible { grid-template-columns: 1fr; }
  .cas-wrap { grid-template-columns: 1fr; }
  .hero h1 { font-size: 38px; } .hero-sub { font-size: 16px; }
  .nav-liens { display: none; } .sect-titre, .cta-final h2 { font-size: 26px; }
}
`;

const BODY = `
<nav class="nav"><div class="nav-in">
  <div class="logo"><span class="logo-pastille">M</span>Mart<span>Studio</span></div>
  <div class="nav-liens">
    <a href="#valeur">Comment ça marche</a>
    <a href="#atelier">L'atelier</a>
    <a href="#livrables">Livrables</a>
    <a href="#cas">Cas d'usage</a>
    <a href="#cible">Pour qui</a>
  </div>
  <button class="btn-theme" onclick="basculerTheme()">
    <svg class="icone-lune" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
    <svg class="icone-soleil" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
    <span class="label-clair">Sombre</span><span class="label-sombre">Clair</span>
  </button>
</div></nav>

<header class="hero"><div class="enveloppe hero-in">
  <h1>Décrivez votre projet data.<br><span class="grad">Une IA conçoit le Produit Data.</span></h1>
  <p class="hero-sub">Mart Studio transforme une description en <strong>langage naturel</strong> en un modèle de données complet avec ses livrables techniques prêts à l'emploi. <strong>Aucune compétence en data modeling requise</strong> : Mart Studio s'occupe de tout.</p>
  <div class="hero-cta">
    <a href="#" class="btn btn-primaire js-enter">Créer un produit data
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
    </a>
  </div>
  <div class="hero-kpis">
    <div class="hero-kpi"><div class="v">5</div><div class="l">étapes guidées</div></div>
    <div class="hero-kpi"><div class="v">6</div><div class="l">livrables générés</div></div>
    <div class="hero-kpi"><div class="v">0</div><div class="l">ligne de code à écrire</div></div>
  </div>
</div></header>

<section id="valeur"><div class="enveloppe">
  <div class="sect-head">
    <div class="sect-tag">Comment ça marche</div>
    <h2 class="sect-titre">Du langage métier au modèle technique, sans expert data</h2>
    <p class="sect-intro">Concevoir, modéliser, documenter et exporter un Data Product devient un geste accessible. Plus de goulot d'étranglement sur la modélisation : l'IA déduit le modèle, vous gardez la main sur le métier.</p>
  </div>
  <div class="grille-3">
    <div class="val-carte"><div class="val-icone" style="background:var(--pastel-violet);">🧠</div><h3>Métier → technique</h3><p>Passez du langage métier à un modèle de données technique sans aucune expertise en data modeling.</p></div>
    <div class="val-carte"><div class="val-icone" style="background:var(--pastel-sarcelle-profond);">⚡</div><h3>En quelques clics</h3><p>Conception, modélisation, documentation et export d'un Data Product complet, sans quitter un seul écran.</p></div>
    <div class="val-carte"><div class="val-icone" style="background:var(--pastel-bleu);">🏭</div><h3>Livrables prêts à l'emploi</h3><p>Produisez des livrables normés — SQL, dbt, diagrammes, dictionnaire, rapport de gouvernance — prêts à l'emploi.</p></div>
  </div>
</div></section>

<section id="fonctionnement" class="fond-pastel"><div class="enveloppe">
  <div class="sect-head"><div class="sect-tag">En 3 temps</div><h2 class="sect-titre">Comment ça marche</h2></div>
  <div class="temps-grille">
    <div class="temps"><div class="temps-num">1</div><h3>Décrivez</h3><p>Vous expliquez votre besoin métier en langage simple à Marty. Pas de jargon technique, juste votre réalité opérationnelle.</p></div>
    <div class="temps"><div class="temps-num">2</div><h3>Marty modélise</h3><p>En 5 étapes guidées, il conçoit entités, relations, attributs, clés, règles de gestion et sources de données.</p></div>
    <div class="temps"><div class="temps-num">3</div><h3>Exportez</h3><p>Vous récupérez le MCD, le SQL, le DBML, le schéma dbt, le dictionnaire et le rapport DAD. Prêts à brancher.</p></div>
  </div>
</div></section>

<section id="atelier"><div class="enveloppe">
  <div class="sect-head"><div class="sect-tag">Le parcours</div><h2 class="sect-titre">L'atelier en 5 étapes guidées</h2>
    <p class="sect-intro">Marty vous accompagne pas à pas. Chaque étape collecte ce dont il a besoin, puis en fait la synthèse avant de passer à la suivante.</p></div>
  <div class="etapes">
    <div class="etape"><div class="etape-badge"><div class="etape-cercle">🎯</div><div class="etape-step">Étape 1</div></div><div class="etape-corps"><h3>Contexte</h3><p>Description du produit data : nom, problème métier, objectif, domaine, Product Owner, Data Steward. Marty en fait une synthèse exploitable.</p></div></div>
    <div class="etape"><div class="etape-badge"><div class="etape-cercle">🧩</div><div class="etape-step">Étape 2</div></div><div class="etape-corps"><h3>Entités</h3><p>Conception du modèle complet : tables de faits et de dimensions, attributs (clés, types) et relations entre objets.</p></div></div>
    <div class="etape"><div class="etape-badge"><div class="etape-cercle">🔗</div><div class="etape-step">Étape 3</div></div><div class="etape-corps"><h3>Relations</h3><p>Précision des liens : cardinalités (1:1, 1:N, N:N), caractère obligatoire et hiérarchies entre les entités.</p></div></div>
    <div class="etape"><div class="etape-badge"><div class="etape-cercle">📋</div><div class="etape-step">Étape 4</div></div><div class="etape-corps"><h3>Attributs</h3><p>Complétion des colonnes : clés primaires, types SQL, attributs sensibles ou historisés.</p></div></div>
    <div class="etape"><div class="etape-badge"><div class="etape-cercle">🏁</div><div class="etape-step">Étape 5</div></div><div class="etape-corps"><h3>Validation</h3><p>Génération des règles de gestion, des sources de données, d'un score de maturité et du rapport de préparation à la Design Authority (DAD).</p></div></div>
  </div>
</div></section>

<section id="livrables" class="fond-pastel"><div class="enveloppe">
  <div class="sect-head"><div class="sect-tag">Restitution</div><h2 class="sect-titre">6 livrables générés, prêts à brancher</h2>
    <p class="sect-intro">À la sortie de l'atelier, tout est normé, exécutable et partageable. Vous ne repartez pas avec un brouillon — vous repartez avec une production.</p></div>
  <div class="grille-liv">
    <div class="liv"><div class="liv-tete"><span class="liv-ico">🗺️</span><h3>MCD / ERD</h3><span class="liv-tag">Mermaid</span></div><p>Modèle Conceptuel de Données au format Mermaid, visualisable directement dans l'app.</p></div>
    <div class="liv"><div class="liv-tete"><span class="liv-ico">🧬</span><h3>DBML</h3><span class="liv-tag">dbdiagram</span></div><p>Code prêt à coller sur dbdiagram.io pour un diagramme interactif et partageable.</p></div>
    <div class="liv"><div class="liv-tete"><span class="liv-ico">💾</span><h3>SQL DDL</h3><span class="liv-tag">Exécutable</span></div><p>Les CREATE TABLE complets — clés primaires, clés étrangères, contraintes — exécutables directement.</p></div>
    <div class="liv"><div class="liv-tete"><span class="liv-ico">🔧</span><h3>dbt YAML</h3><span class="liv-tag">schema.yml</span></div><p>Le schema.yml dbt avec tests (unique, not_null, relationships) pour industrialiser la transformation.</p></div>
    <div class="liv"><div class="liv-tete"><span class="liv-ico">📖</span><h3>Dictionnaire</h3><span class="liv-tag">Données</span></div><p>Dictionnaire de données : type, PK/FK, sensibilité et description de chaque attribut.</p></div>
    <div class="liv"><div class="liv-tete"><span class="liv-ico">📊</span><h3>Rapport DAD</h3><span class="liv-tag">Gouvernance</span></div><p>Score de maturité et synthèse de préparation à la Design Authority (DAD).</p></div>
  </div>
</div></section>

<section id="cas"><div class="enveloppe">
  <div class="sect-head"><div class="sect-tag">Cas d'usage illustratif</div><h2 class="sect-titre">Du besoin exprimé au modèle complet</h2></div>
  <div class="cas-wrap">
    <div class="cas-besoin"><div class="mini-tag">Besoin exprimé · langage métier</div><h3>Piloter les réclamations clients</h3><p>« Je veux suivre le volume, le statut, le délai de résolution, les motifs et les actions correctives. » Domaine : relation client. C'est tout ce que Marty reçoit.</p></div>
    <div class="cas-resu"><div class="mini-tag">Ce que Marty modélise automatiquement</div><h3>8 entités, 14 relations, le modèle entier</h3>
      <div class="cas-stats"><div class="cas-stat"><div class="v">8</div><div class="l">entités</div></div><div class="cas-stat"><div class="v">14</div><div class="l">relations + clés FK</div></div><div class="cas-stat"><div class="v">6</div><div class="l">livrables produits</div></div></div>
      <div class="cas-liste"><span class="cas-puce">Client</span><span class="cas-puce">Réclamation</span><span class="cas-puce">Canal</span><span class="cas-puce">MotifRéclamation</span><span class="cas-puce">DossierRéclamation</span><span class="cas-puce">Gestionnaire</span><span class="cas-puce">ActionCorrective</span><span class="cas-puce">SatisfactionClient</span></div>
      <div class="cas-sortie">Exemples de relations : <strong>Client → Réclamation (1:N)</strong>, <strong>Réclamation → Canal (N:1)</strong>. Restitution : SQL, DBML, schéma dbt, dictionnaire et rapport DAD.</div>
    </div>
  </div>
</div></section>

<section id="cible" class="fond-pastel"><div class="enveloppe">
  <div class="sect-head"><div class="sect-tag">Pour qui</div><h2 class="sect-titre">Conçu pour le métier, pensé pour la data</h2></div>
  <div class="grille-cible">
    <div class="cible"><div class="cible-ico" style="background:var(--pastel-sarcelle-profond);">👥</div><h3>Profils métier</h3><p>Product Owners, Data Stewards, responsables fonctionnels : concevez un Data Product sans compétences techniques.</p></div>
    <div class="cible"><div class="cible-ico" style="background:var(--pastel-bleu);">⚙️</div><h3>Équipes data</h3><p>Accélérez et standardisez la modélisation et la production de livrables, sur un socle normé et testé.</p></div>
    <div class="cible"><div class="cible-ico" style="background:var(--pastel-violet);">🛡️</div><h3>Gouvernance / DA</h3><p>Pilotez la Design Authority avec un score de maturité et un rapport de préparation DAD intégrés.</p></div>
  </div>
</div></section>

<section id="cta"><div class="enveloppe">
  <div class="cta-final">
    <h2>Votre prochain Data Product n'attend qu'une description</h2>
    <p>Décrivez votre besoin en langage naturel. Marty s'occupe du modèle, des clés, des tests et de la gouvernance.</p>
    <a href="#" class="btn btn-blanc js-enter">Ouvrir Mart Studio
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
    </a>
  </div>
</div></section>

<footer class="pied"><div class="enveloppe pied-in">
  <div class="pied-meta"><strong style="color:var(--texte-principal);">Mart&nbsp;Studio</strong> — Personal Finance &amp; Mobility</div>
  <div class="pied-nav"><a href="#fonctionnement">Comment ça marche</a><a href="#atelier">Atelier IA</a><a href="#livrables">Livrables</a><a href="#" class="js-enter">Accéder à l'app →</a></div>
</div></footer>
`;

const SCRIPT = `
function basculerTheme(){var h=document.documentElement;h.setAttribute('data-theme',h.getAttribute('data-theme')==='sombre'?'clair':'sombre');}
document.addEventListener('click',function(e){var el=e.target.closest('.js-enter');if(el){e.preventDefault();parent.postMessage('mart-enter','*');}});
`;

const HTML = `<!DOCTYPE html><html lang="fr" data-theme="clair"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Mart Studio</title><link href="https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,400;0,600;0,700;0,800;1,400&display=swap" rel="stylesheet"><style>${CSS}</style></head><body>${BODY}<script>${SCRIPT}</script></body></html>`;

export default function Landing({ onEnter }: LandingProps) {
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.data === 'mart-enter') onEnter();
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onEnter]);

  return (
    <iframe
      title="Mart Studio — Présentation"
      srcDoc={HTML}
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', border: 'none' }}
    />
  );
}
