'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import { useI18n } from '@/lib/i18n';

interface LandingProps {
  onEnter: (mode: 'login' | 'signup') => void;
}

const STYLE = `
.ml-root { min-height: 100vh; overflow-x: hidden; background: var(--bg-surface); color: var(--text); }
.ml-nav { position: sticky; top: 0; z-index: 50; backdrop-filter: blur(10px); background: color-mix(in srgb, var(--bg-surface) 85%, transparent); border-bottom: 1px solid var(--border); }
.ml-nav-in { max-width: 1160px; margin: 0 auto; padding: 12px 24px; display: flex; align-items: center; gap: 16px; }
.ml-brand { display: flex; align-items: center; gap: 10px; font-weight: 800; font-size: 17px; letter-spacing: -0.3px; }
.ml-brand img { border-radius: 8px; }
.ml-nav-actions { margin-left: auto; display: flex; align-items: center; gap: 10px; }
.ml-lang { background: transparent; border: 1.5px solid var(--border); border-radius: 8px; padding: 7px 11px; cursor: pointer; font-family: inherit; font-size: 12px; font-weight: 700; color: var(--text-secondary); transition: all .2s; }
.ml-lang:hover { border-color: var(--primary); color: var(--primary); }
.ml-btn { font-family: inherit; font-size: 13.5px; font-weight: 700; padding: 11px 22px; cursor: pointer; border-radius: 9px; border: none; transition: all .2s; display: inline-flex; align-items: center; justify-content: center; gap: 8px; }
.ml-btn-primary { background: var(--primary); color: #fff; box-shadow: 0 6px 18px rgba(0,0,0,0.12); }
.ml-btn-primary:hover { filter: brightness(1.06); transform: translateY(-2px); }
.ml-btn-ghost { background: transparent; color: var(--text); border: 1.5px solid var(--border); }
.ml-btn-ghost:hover { border-color: var(--primary); color: var(--primary); }
.ml-btn-sm { padding: 9px 16px; font-size: 13px; }

.ml-hero { position: relative; max-width: 1000px; margin: 0 auto; padding: 76px 24px 40px; text-align: center; }
.ml-blob { position: absolute; z-index: 0; border-radius: 50%; filter: blur(70px); opacity: 0.4; pointer-events: none; }
.ml-blob-1 { width: 420px; height: 420px; background: var(--primary); top: -120px; left: -80px; animation: mlFloat 9s ease-in-out infinite; }
.ml-blob-2 { width: 360px; height: 360px; background: #3EE3D3; bottom: -140px; right: -60px; animation: mlFloat 11s ease-in-out infinite reverse; }
.ml-hero > * { position: relative; z-index: 1; }
.ml-chip { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 700; letter-spacing: 0.4px; color: var(--primary); background: var(--primary-glow); border: 1px solid var(--border); border-radius: 999px; padding: 6px 14px; margin-bottom: 22px; animation: mlUp .6s ease both; }
.ml-hero h1 { font-size: 52px; line-height: 1.06; font-weight: 800; letter-spacing: -1.4px; margin-bottom: 20px; animation: mlUp .7s ease .05s both; }
.ml-grad { background: linear-gradient(120deg, var(--primary), #009597); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
.ml-hero-sub { font-size: 18px; line-height: 1.6; color: var(--text-secondary); max-width: 660px; margin: 0 auto 30px; animation: mlUp .7s ease .12s both; }
.ml-hero-cta { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; animation: mlUp .7s ease .18s both; }
.ml-kpis { display: flex; gap: 48px; justify-content: center; flex-wrap: wrap; margin-top: 54px; animation: mlUp .7s ease .28s both; }
.ml-kpi .v { font-size: 42px; font-weight: 800; color: var(--primary); line-height: 1; }
.ml-kpi .l { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: var(--text-muted); margin-top: 8px; }

.ml-sec { max-width: 1160px; margin: 0 auto; padding: 64px 24px; }
.ml-sec-alt { background: var(--bg-elevated); border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
.ml-head { text-align: center; max-width: 720px; margin: 0 auto 44px; }
.ml-tag { font-size: 11px; font-weight: 700; letter-spacing: 2.4px; text-transform: uppercase; color: var(--primary); margin-bottom: 10px; }
.ml-head h2 { font-size: 34px; font-weight: 800; letter-spacing: -0.6px; line-height: 1.15; }
.ml-head p { font-size: 16px; color: var(--text-secondary); margin-top: 14px; line-height: 1.6; }

.ml-steps { display: flex; gap: 16px; flex-wrap: wrap; justify-content: center; }
.ml-step { flex: 1; min-width: 170px; background: var(--bg-surface); border: 1px solid var(--border); border-radius: 16px; padding: 24px 20px; text-align: center; transition: transform .25s ease, box-shadow .25s ease, border-color .25s; }
.ml-step:hover { transform: translateY(-6px); box-shadow: var(--shadow-lg); border-color: var(--primary); }
.ml-step-ico { width: 48px; height: 48px; margin: 0 auto 14px; border-radius: 13px; background: var(--primary-glow); color: var(--primary); display: flex; align-items: center; justify-content: center; }
.ml-step-num { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); }
.ml-step h3 { font-size: 16px; font-weight: 700; margin-top: 4px; }

.ml-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.ml-card { background: var(--bg-surface); border: 1px solid var(--border); border-radius: 14px; padding: 22px; transition: transform .25s ease, box-shadow .25s ease, border-color .25s; }
.ml-card:hover { transform: translateY(-4px); box-shadow: var(--shadow-lg); border-color: var(--primary); }
.ml-card-tete { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
.ml-card-ico { width: 40px; height: 40px; border-radius: 11px; background: var(--primary-glow); color: var(--primary); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.ml-card h3 { font-size: 15px; font-weight: 700; }
.ml-card-tag { font-size: 8.5px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; padding: 2px 8px; border-radius: 4px; margin-left: auto; background: var(--bg-elevated); color: var(--text-muted); }
.ml-card p { font-size: 13px; color: var(--text-secondary); line-height: 1.55; }

.ml-feats { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px; }
.ml-feat { display: flex; gap: 16px; background: var(--bg-surface); border: 1px solid var(--border); border-radius: 14px; padding: 22px; }
.ml-feat-ico { width: 44px; height: 44px; border-radius: 12px; background: var(--primary); color: #fff; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.ml-feat h3 { font-size: 16px; font-weight: 700; margin-bottom: 5px; }
.ml-feat p { font-size: 13.5px; color: var(--text-secondary); line-height: 1.55; }

.ml-final { max-width: 1160px; margin: 0 auto; padding: 24px; }
.ml-final-in { background: linear-gradient(135deg, #009597, var(--primary)); border-radius: 20px; padding: 56px 32px; text-align: center; color: #fff; }
.ml-final-in h2 { font-size: 34px; font-weight: 800; letter-spacing: -0.6px; margin-bottom: 12px; }
.ml-final-in p { font-size: 16px; opacity: 0.9; max-width: 520px; margin: 0 auto 28px; }
.ml-final-in .ml-btn { background: #fff; color: #007678; }
.ml-final-in .ml-btn:hover { transform: translateY(-2px); }

.ml-foot { border-top: 1px solid var(--border); padding: 28px 24px; }
.ml-foot-in { max-width: 1160px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px; }
.ml-foot-brand { display: flex; align-items: center; gap: 10px; }
.ml-foot-meta { font-size: 12px; color: var(--text-muted); }

.ml-reveal { opacity: 0; transform: translateY(26px); transition: opacity .6s ease, transform .6s ease; }
.ml-reveal.ml-in { opacity: 1; transform: none; }

@keyframes mlUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: none; } }
@keyframes mlFloat { 0%,100% { transform: translate(0,0); } 50% { transform: translate(20px,-24px); } }

@media (max-width: 920px) {
  .ml-hero h1 { font-size: 36px; }
  .ml-head h2, .ml-final-in h2 { font-size: 26px; }
  .ml-grid { grid-template-columns: 1fr; }
  .ml-feats { grid-template-columns: 1fr; }
  .ml-nav-hide { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .ml-reveal, .ml-chip, .ml-hero h1, .ml-hero-sub, .ml-hero-cta, .ml-kpis { animation: none !important; transition: none !important; opacity: 1 !important; transform: none !important; }
  .ml-blob { animation: none !important; }
}
`;

function Icon({ name }: { name: string }) {
  const p: Record<string, React.ReactNode> = {
    context: <><path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-4 4v-4H6a2 2 0 0 1-2-2Z" /><path d="M8 8.5h8M8 12h5" /></>,
    entities: <><rect x="3" y="4" width="7" height="7" rx="1.5" /><rect x="14" y="4" width="7" height="7" rx="1.5" /><rect x="8.5" y="14" width="7" height="6" rx="1.5" /><path d="M6.5 11v1.5a1.5 1.5 0 0 0 1.5 1.5M17.5 11v1.5a1.5 1.5 0 0 1-1.5 1.5" /></>,
    relations: <><circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><circle cx="18" cy="6" r="2.5" /><path d="M8.5 6H15M6 8.5V15a3 3 0 0 0 3 3h6.5" /></>,
    attributes: <><path d="M20 10.5 13.5 4H6a2 2 0 0 0-2 2v7.5L10.5 20a2 2 0 0 0 2.8 0l6.7-6.7a2 2 0 0 0 0-2.8Z" /><circle cx="9" cy="9" r="1.4" /></>,
    validation: <><circle cx="12" cy="12" r="9" /><path d="M8.3 12.4l2.6 2.6 4.8-5.2" /></>,
    erd: <><rect x="3" y="4" width="8" height="6" rx="1" /><rect x="13" y="14" width="8" height="6" rx="1" /><path d="M7 10v2a2 2 0 0 0 2 2h4" /></>,
    dbml: <><path d="M8 8l-4 4 4 4M16 8l4 4-4 4" /></>,
    sql: <><ellipse cx="12" cy="6" rx="7" ry="2.6" /><path d="M5 6v12c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6V6" /><path d="M5 12c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6" /></>,
    dbt: <><circle cx="12" cy="12" r="9" /><path d="M12 3a9 9 0 0 1 0 18M8 8l4 4-4 4" /></>,
    dict: <><path d="M6.5 2H18a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" /><path d="M8 7h8M8 11h6" /></>,
    dad: <><path d="M9 3h6l1 3H8l1-3Z" /><rect x="4" y="6" width="16" height="15" rx="2" /><path d="M8 12h8M8 16h5" /></>,
    import: <><path d="M14 3v5h5" /><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M12 12v5M9.5 14.5 12 17l2.5-2.5" /></>,
    gov: <><path d="M12 3l7 3v5c0 4.2-2.9 7.4-7 9-4.1-1.6-7-4.8-7-9V6l7-3Z" /><path d="M9.2 12l2 2 3.6-3.8" /></>,
    arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  };
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{p[name]}</svg>;
}

export default function Landing({ onEnter }: LandingProps) {
  const { lang, toggle } = useI18n();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const els = rootRef.current?.querySelectorAll('.ml-reveal');
    if (!els) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('ml-in'); io.unobserve(e.target); } });
    }, { threshold: 0.15 });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const fr = lang === 'fr';
  const L = {
    login: fr ? 'Se connecter' : 'Sign in',
    signup: fr ? "S'inscrire" : 'Sign up',
    chip: fr ? 'Data Architect IA · Sofinco' : 'AI Data Architect · Sofinco',
    h1a: fr ? "De l'idée métier" : 'From business idea',
    h1b: fr ? 'au Produit Data en quelques minutes' : 'to a Data Product in minutes',
    sub: fr
      ? "Mart Studio transforme une description en langage naturel en un modèle de données complet et ses livrables techniques. Aucune compétence en data modeling requise."
      : 'Mart Studio turns a plain-language description into a complete data model and its technical deliverables. No data modeling skills required.',
    ctaMain: fr ? 'Créer un produit data' : 'Create a data product',
    ctaSecond: fr ? "J'ai déjà un compte" : 'I already have an account',
    kSteps: fr ? 'étapes guidées' : 'guided steps',
    kDeliv: fr ? 'livrables générés' : 'deliverables generated',
    kCode: fr ? 'ligne de code' : 'line of code',
    procTag: fr ? 'Un processus simplifié' : 'A simplified process',
    procTitle: fr ? '5 étapes guidées, 0 ligne de code' : '5 guided steps, 0 line of code',
    procSub: fr
      ? 'Passez du besoin métier au modèle technique (entités, relations, attributs) sans programmation.'
      : 'Go from business need to technical model (entities, relations, attributes) without programming.',
    delivTag: fr ? 'Un pack complet de livrables' : 'A complete deliverables pack',
    delivTitle: fr ? '6 livrables techniques générés' : '6 technical deliverables generated',
    delivSub: fr
      ? "Des documents prêts à l'emploi pour le développement et la documentation technique."
      : 'Ready-to-use documents for development and technical documentation.',
    catModel: fr ? 'Modélisation' : 'Modeling',
    catDev: fr ? 'Développement' : 'Development',
    catDoc: fr ? 'Documentation' : 'Documentation',
    importTitle: fr ? 'Import de fichiers existants' : 'Import existing files',
    importDesc: fr
      ? "L'IA déduit automatiquement le modèle à partir de fichiers SAS, SQL, CSV ou Excel."
      : 'AI automatically infers the model from SAS, SQL, CSV or Excel files.',
    govTitle: fr ? 'Gouvernance intégrée' : 'Built-in governance',
    govDesc: fr
      ? 'Score de maturité et préparation automatique au Design Authority (DAD).'
      : 'Maturity score and automatic Design Authority (DAD) readiness.',
    finalTitle: fr ? 'Standardisation et rapidité' : 'Standardization and speed',
    finalSub: fr
      ? 'Générez un Data Product complet et standardisé en seulement quelques minutes.'
      : 'Generate a complete, standardized Data Product in just a few minutes.',
    finalBtn: fr ? 'Démarrer maintenant' : 'Get started now',
  };

  const steps = [
    { ico: 'context', num: fr ? 'Étape 1' : 'Step 1', name: fr ? 'Contexte' : 'Context' },
    { ico: 'entities', num: fr ? 'Étape 2' : 'Step 2', name: fr ? 'Entités' : 'Entities' },
    { ico: 'relations', num: fr ? 'Étape 3' : 'Step 3', name: fr ? 'Relations' : 'Relations' },
    { ico: 'attributes', num: fr ? 'Étape 4' : 'Step 4', name: fr ? 'Attributs' : 'Attributes' },
    { ico: 'validation', num: fr ? 'Étape 5' : 'Step 5', name: 'Validation' },
  ];

  const deliverables = [
    { ico: 'erd', name: 'MCD / ERD', cat: L.catModel, desc: fr ? 'Diagramme conceptuel Mermaid, visualisable dans l’app.' : 'Mermaid conceptual diagram, viewable in the app.' },
    { ico: 'dbml', name: 'DBML', cat: L.catModel, desc: fr ? 'Code prêt à coller sur dbdiagram.io.' : 'Code ready to paste into dbdiagram.io.' },
    { ico: 'sql', name: 'SQL DDL', cat: L.catDev, desc: fr ? 'CREATE TABLE complets, clés et contraintes.' : 'Full CREATE TABLE, keys and constraints.' },
    { ico: 'dbt', name: 'dbt YAML', cat: L.catDev, desc: fr ? 'schema.yml avec tests (unique, not_null…).' : 'schema.yml with tests (unique, not_null…).' },
    { ico: 'dict', name: fr ? 'Dictionnaire de données' : 'Data dictionary', cat: L.catDoc, desc: fr ? 'Type, PK/FK, sensibilité et description.' : 'Type, PK/FK, sensitivity and description.' },
    { ico: 'dad', name: fr ? 'Rapport DAD' : 'DAD report', cat: L.catDoc, desc: fr ? 'Score de maturité et préparation Design Authority.' : 'Maturity score and Design Authority readiness.' },
  ];

  return (
    <div className="ml-root" ref={rootRef}>
      <style dangerouslySetInnerHTML={{ __html: STYLE }} />

      {/* NAV */}
      <nav className="ml-nav">
        <div className="ml-nav-in">
          <div className="ml-brand">
            <Image src="/mart-icon.svg" alt="Mart Studio" width={30} height={30} />
            <span>Mart Studio</span>
          </div>
          <div className="ml-nav-actions">
            <button className="ml-lang" onClick={toggle} title={fr ? 'Switch to English' : 'Passer en français'}>
              {fr ? '🇫🇷 FR' : '🇬🇧 EN'}
            </button>
            <button className="ml-btn ml-btn-ghost ml-btn-sm ml-nav-hide" onClick={() => onEnter('login')}>{L.login}</button>
            <button className="ml-btn ml-btn-primary ml-btn-sm" onClick={() => onEnter('signup')}>{L.signup}</button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <header className="ml-hero">
        <div className="ml-blob ml-blob-1" />
        <div className="ml-blob ml-blob-2" />
        <div className="ml-chip"><Image src="/mart-icon.svg" alt="" width={16} height={16} /> {L.chip}</div>
        <h1>{L.h1a}<br /><span className="ml-grad">{L.h1b}</span></h1>
        <p className="ml-hero-sub">{L.sub}</p>
        <div className="ml-hero-cta">
          <button className="ml-btn ml-btn-primary" onClick={() => onEnter('signup')}>{L.ctaMain}<Icon name="arrow" /></button>
          <button className="ml-btn ml-btn-ghost" onClick={() => onEnter('login')}>{L.ctaSecond}</button>
        </div>
        <div className="ml-kpis">
          <div className="ml-kpi"><div className="v">5</div><div className="l">{L.kSteps}</div></div>
          <div className="ml-kpi"><div className="v">6</div><div className="l">{L.kDeliv}</div></div>
          <div className="ml-kpi"><div className="v">0</div><div className="l">{L.kCode}</div></div>
        </div>
      </header>

      {/* PROCESS */}
      <section className="ml-sec">
        <div className="ml-head ml-reveal">
          <div className="ml-tag">{L.procTag}</div>
          <h2>{L.procTitle}</h2>
          <p>{L.procSub}</p>
        </div>
        <div className="ml-steps">
          {steps.map((s, i) => (
            <div key={s.name} className="ml-step ml-reveal" style={{ transitionDelay: `${i * 70}ms` }}>
              <div className="ml-step-ico"><Icon name={s.ico} /></div>
              <div className="ml-step-num">{s.num}</div>
              <h3>{s.name}</h3>
            </div>
          ))}
        </div>
      </section>

      {/* DELIVERABLES */}
      <section className="ml-sec-alt">
        <div className="ml-sec">
          <div className="ml-head ml-reveal">
            <div className="ml-tag">{L.delivTag}</div>
            <h2>{L.delivTitle}</h2>
            <p>{L.delivSub}</p>
          </div>
          <div className="ml-grid">
            {deliverables.map((d, i) => (
              <div key={d.name} className="ml-card ml-reveal" style={{ transitionDelay: `${(i % 3) * 70}ms` }}>
                <div className="ml-card-tete">
                  <div className="ml-card-ico"><Icon name={d.ico} /></div>
                  <h3>{d.name}</h3>
                  <span className="ml-card-tag">{d.cat}</span>
                </div>
                <p>{d.desc}</p>
              </div>
            ))}
          </div>
          <div className="ml-feats">
            <div className="ml-feat ml-reveal">
              <div className="ml-feat-ico"><Icon name="import" /></div>
              <div><h3>{L.importTitle}</h3><p>{L.importDesc}</p></div>
            </div>
            <div className="ml-feat ml-reveal" style={{ transitionDelay: '80ms' }}>
              <div className="ml-feat-ico"><Icon name="gov" /></div>
              <div><h3>{L.govTitle}</h3><p>{L.govDesc}</p></div>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="ml-final">
        <div className="ml-final-in ml-reveal">
          <h2>{L.finalTitle}</h2>
          <p>{L.finalSub}</p>
          <button className="ml-btn" onClick={() => onEnter('signup')}>{L.finalBtn}<Icon name="arrow" /></button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="ml-foot">
        <div className="ml-foot-in">
          <div className="ml-foot-brand">
            <Image src="/sofinco-logo.svg" alt="Sofinco" width={110} height={23} style={{ width: 110, height: 23 }} />
            <span className="ml-foot-meta">— Mart Studio</span>
          </div>
          <div className="ml-foot-meta">Personal Finance &amp; Mobility</div>
        </div>
      </footer>
    </div>
  );
}
