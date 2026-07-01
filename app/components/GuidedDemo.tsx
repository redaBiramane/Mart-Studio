'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useI18n } from '@/lib/i18n';

interface Props {
  onStart?: () => void;
}

const STYLE = `
.gd-wrap { max-width: 1160px; margin: 0 auto; padding: 24px; }
.gd-head { text-align: center; max-width: 720px; margin: 0 auto 32px; }
.gd-tag { font-size: 11px; font-weight: 700; letter-spacing: 2.4px; text-transform: uppercase; color: var(--primary); margin-bottom: 10px; }
.gd-head h2 { font-size: 32px; font-weight: 800; letter-spacing: -0.5px; }
.gd-head p { font-size: 15px; color: var(--text-secondary); margin-top: 12px; }

.gd-card { border: 1px solid var(--border); border-radius: 20px; background: var(--bg-surface); box-shadow: var(--shadow-lg); overflow: hidden; }
.gd-stepbar { display: flex; gap: 6px; padding: 14px 18px; border-bottom: 1px solid var(--border); overflow-x: auto; }
.gd-pill { flex: 0 0 auto; display: inline-flex; align-items: center; gap: 7px; padding: 7px 12px; border-radius: 999px; border: 1px solid var(--border); background: var(--bg-elevated); color: var(--text-secondary); font-size: 12.5px; font-weight: 600; cursor: pointer; transition: all .2s; white-space: nowrap; }
.gd-pill:hover { border-color: var(--primary); color: var(--primary); }
.gd-pill.active { background: var(--primary); color: #fff; border-color: var(--primary); box-shadow: 0 4px 12px rgba(0,0,0,0.12); }
.gd-pill.done { border-color: var(--border-active); color: var(--primary); }
.gd-pill .gd-n { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 50%; background: rgba(255,255,255,0.25); font-size: 10px; font-weight: 800; }
.gd-pill:not(.active) .gd-n { background: var(--primary-glow); color: var(--primary); }

.gd-body { display: grid; grid-template-columns: 1fr 1fr; gap: 0; }
.gd-chat { padding: 22px; border-right: 1px solid var(--border); background: var(--bg-elevated); min-height: 340px; }
.gd-model { padding: 22px; min-height: 340px; }
.gd-model-t { font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: var(--text-muted); margin-bottom: 14px; }

.gd-msg { display: flex; gap: 10px; margin-bottom: 14px; animation: gdIn .4s ease both; }
.gd-ava { width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0; overflow: hidden; background: linear-gradient(135deg, var(--primary), #16cbb6); display: flex; align-items: center; justify-content: center; }
.gd-bubble { background: var(--bg-surface); border: 1px solid var(--border); border-radius: 4px 14px 14px 14px; padding: 12px 14px; font-size: 13.5px; line-height: 1.55; color: var(--text); }
.gd-msg.user { flex-direction: row-reverse; }
.gd-msg.user .gd-bubble { background: var(--primary); color: #fff; border: none; border-radius: 14px 4px 14px 14px; }
.gd-msg.user .gd-ava { background: var(--bg-input); color: var(--text-secondary); font-weight: 700; font-size: 13px; }
.gd-typing { display: inline-flex; gap: 3px; }
.gd-typing i { width: 5px; height: 5px; border-radius: 50%; background: var(--text-muted); animation: gdBlink 1s infinite; }
.gd-typing i:nth-child(2){ animation-delay: .15s; } .gd-typing i:nth-child(3){ animation-delay: .3s; }

.gd-block { border: 1px solid var(--border); border-radius: 12px; padding: 14px; margin-bottom: 12px; animation: gdIn .45s ease both; }
.gd-block.cur { border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-glow); }
.gd-block-t { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; color: var(--text); margin-bottom: 10px; }
.gd-block-t svg { color: var(--primary); }
.gd-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.gd-chip { font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 8px; background: var(--primary-glow); color: var(--primary); border: 1px solid var(--border-active); }
.gd-chip.dim { background: var(--bg-elevated); color: var(--text-secondary); border-color: var(--border); }
.gd-rel { font-size: 12px; color: var(--text-secondary); padding: 3px 0; }
.gd-rel b { color: var(--text); }
.gd-tbl { width: 100%; border-collapse: collapse; font-size: 11.5px; }
.gd-tbl td { padding: 4px 6px; border-bottom: 1px solid var(--border-light); }
.gd-tbl .k { font-weight: 700; color: var(--primary); }
.gd-kpi { font-size: 12.5px; color: var(--text); padding: 4px 0; }
.gd-kpi span { color: var(--text-muted); }
.gd-gauge { display: flex; align-items: center; gap: 12px; }
.gd-gauge-bar { flex: 1; height: 8px; border-radius: 5px; background: var(--bg-input); overflow: hidden; }
.gd-gauge-bar span { display: block; height: 100%; background: linear-gradient(90deg, var(--primary), #16cbb6); border-radius: 5px; transition: width 1s ease; }
.gd-gauge-v { font-size: 20px; font-weight: 800; color: var(--primary); }
.gd-deliv { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 10px; }
.gd-deliv div { font-size: 11.5px; font-weight: 600; color: var(--text-secondary); padding: 6px 9px; border: 1px solid var(--border); border-radius: 8px; display: flex; align-items: center; gap: 6px; }
.gd-deliv svg { color: var(--primary); }

.gd-tip { position: relative; display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; border-radius: 50%; background: var(--primary-glow); color: var(--primary); font-size: 10px; font-weight: 800; cursor: pointer; border: 1px solid var(--border-active); margin-left: auto; outline: none; }
.gd-tip-box { position: absolute; bottom: calc(100% + 8px); right: -6px; width: 220px; background: #0d1b2a; color: #e6edf3; font-size: 11.5px; font-weight: 500; line-height: 1.5; padding: 10px 12px; border-radius: 10px; box-shadow: 0 12px 30px rgba(0,0,0,0.3); opacity: 0; visibility: hidden; transform: translateY(4px); transition: all .18s ease; z-index: 5; text-align: left; }
.gd-tip-box::after { content: ''; position: absolute; top: 100%; right: 10px; border: 6px solid transparent; border-top-color: #0d1b2a; }
.gd-tip:hover .gd-tip-box, .gd-tip:focus .gd-tip-box { opacity: 1; visibility: visible; transform: none; }

.gd-controls { display: flex; align-items: center; gap: 10px; padding: 16px 18px; border-top: 1px solid var(--border); }
.gd-btn { font-family: inherit; font-size: 13px; font-weight: 700; padding: 9px 16px; border-radius: 9px; cursor: pointer; border: 1px solid var(--border); background: var(--bg-surface); color: var(--text); transition: all .2s; display: inline-flex; align-items: center; gap: 6px; }
.gd-btn:hover:not(:disabled) { border-color: var(--primary); color: var(--primary); }
.gd-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.gd-btn-primary { background: var(--primary); color: #fff; border-color: var(--primary); }
.gd-btn-primary:hover { filter: brightness(1.07); color: #fff; }
.gd-dots { display: flex; gap: 6px; margin: 0 auto; }
.gd-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--border); cursor: pointer; transition: all .2s; }
.gd-dot.on { background: var(--primary); transform: scale(1.25); }
.gd-play { margin-left: 0; }

/* Aperçu MCD visuel (résultat) */
.gd-mcd { border-top: 1px solid var(--border); padding: 18px 22px 22px; background: var(--bg-elevated); animation: gdIn .5s ease both; }
.gd-mcd-t { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; color: var(--primary); margin-bottom: 14px; }
.gd-mcd > svg { width: 100%; height: auto; display: block; }
.gd-mcd-t svg { width: 15px; height: 15px; flex-shrink: 0; }
.gd-erd-line { fill: none; stroke: var(--text-muted); stroke-width: 1.5; stroke-dasharray: 400; stroke-dashoffset: 400; animation: gdDraw 1.2s ease forwards; }
.gd-erd-box { fill: var(--bg-surface); stroke: #C9CCEC; stroke-width: 1.2; }
[data-theme="dark"] .gd-erd-box { stroke: #3a3f56; }
.gd-erd-h { fill: #EDE9FE; }
[data-theme="dark"] .gd-erd-h { fill: #2a2440; }
.gd-erd-tx { font: 700 12px Inter, sans-serif; fill: var(--text); }
.gd-erd-row { font: 500 10.5px Inter, sans-serif; fill: var(--text-secondary); }
.gd-erd-k { font: 800 9px Inter, sans-serif; fill: var(--primary); }
.gd-erd-card { font: 700 10px Inter, sans-serif; fill: var(--text-muted); }

@keyframes gdIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
@keyframes gdBlink { 0%,100% { opacity: .3; } 50% { opacity: 1; } }
@keyframes gdDraw { to { stroke-dashoffset: 0; } }

@media (max-width: 760px) {
  .gd-body { grid-template-columns: 1fr; }
  .gd-chat { border-right: none; border-bottom: 1px solid var(--border); min-height: 0; }
  .gd-head h2 { font-size: 24px; }
  .gd-deliv { grid-template-columns: 1fr; }
}
@media (prefers-reduced-motion: reduce) {
  .gd-msg, .gd-block, .gd-mcd { animation: none !important; }
  .gd-typing i, .gd-erd-line { animation: none !important; stroke-dashoffset: 0 !important; }
}
`;

// Table ERD dessinée en SVG
function ErdTable({ x, y, w, title, rows }: { x: number; y: number; w: number; title: string; rows: { c: string; k?: string }[] }) {
  const H = 24, R = 18;
  const h = H + rows.length * R;
  return (
    <g>
      <rect className="gd-erd-box" x={x} y={y} width={w} height={h} rx="6" />
      <rect className="gd-erd-h" x={x} y={y} width={w} height={H} rx="6" />
      <rect className="gd-erd-h" x={x} y={y + H - 6} width={w} height="6" />
      <line x1={x} y1={y + H} x2={x + w} y2={y + H} stroke="#C9CCEC" strokeWidth="1" />
      <text className="gd-erd-tx" x={x + w / 2} y={y + 16} textAnchor="middle">{title}</text>
      {rows.map((r, i) => (
        <g key={r.c}>
          <text className="gd-erd-row" x={x + 10} y={y + H + i * R + 13}>{r.c}</text>
          {r.k && <text className="gd-erd-k" x={x + w - 10} y={y + H + i * R + 13} textAnchor="end">{r.k}</text>}
        </g>
      ))}
    </g>
  );
}

function I({ d }: { d: string }) {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
}
const ICO = {
  context: 'M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-4 4v-4H6a2 2 0 0 1-2-2Z',
  entities: 'M4 6h6v6H4Zm10 6h6v6h-6ZM10 9h4',
  relations: 'M6 6h6v4H6Zm6 8h6M9 10v8h9',
  attributes: 'M20 10 13 3H6a2 2 0 0 0-2 2v7l7 7Z',
  kpi: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  rules: 'M9 11l2 2 4-4M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14l-4-2-4 2-4-2-4 2Z',
  check: 'M20 6 9 17l-5-5',
  doc: 'M6 2h9l5 5v15H6Z',
};

export default function GuidedDemo({ onStart }: Props) {
  const { lang } = useI18n();
  const fr = lang === 'fr';
  const [step, setStep] = useState(0);
  const [auto, setAuto] = useState(false);
  const started = useRef(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const steps = fr
    ? [
        { name: 'Contexte', q: 'Décrivez votre besoin métier en quelques mots.', a: 'Je veux suivre nos clients, leurs crédits, les risques associés et les agences.', tip: 'Marty transforme votre phrase en contexte structuré : nom du produit, domaine et objectif.' },
        { name: 'Entités', q: 'Quels objets métier sont concernés ?', a: 'Des clients, des crédits, des agences et un score de risque.', tip: 'Marty déduit les entités (tables de faits et de dimensions) à modéliser.' },
        { name: 'Relations', q: 'Comment ces objets sont-ils liés entre eux ?', a: 'Un client a plusieurs crédits, une agence gère plusieurs crédits, un crédit génère des risques.', tip: 'Cardinalités (1:N, N:N) et clés étrangères sont posées automatiquement.' },
        { name: 'Attributs', q: 'Quelles informations pour un crédit ?', a: 'Le montant, la date de souscription, le type et le statut.', tip: 'Types SQL, clés primaires/étrangères et sensibilité sont complétés pour chaque colonne.' },
        { name: 'KPI', q: 'Quels indicateurs souhaitez-vous piloter ?', a: 'Le taux de défaut et l’encours moyen par agence.', tip: 'Chaque KPI est formalisé : formule, fréquence et axes d’analyse.' },
        { name: 'Règles métier', q: 'Des règles de gestion à respecter ?', a: 'Un crédit doit être rattaché à un client actif ; un score > 80 déclenche une alerte.', tip: 'Les règles deviennent des contraintes SQL et des tests dbt.' },
        { name: 'Validation', q: 'Parfait, je génère les livrables.', a: 'Go ! 🚀', tip: 'Marty calcule un score de maturité et produit les 6 livrables prêts à l’emploi.' },
      ]
    : [
        { name: 'Context', q: 'Describe your business need in a few words.', a: 'I want to track our customers, their loans, related risks and branches.', tip: 'Marty turns your sentence into a structured context: product name, domain and goal.' },
        { name: 'Entities', q: 'Which business objects are involved?', a: 'Customers, loans, branches and a risk score.', tip: 'Marty infers the entities (fact and dimension tables) to model.' },
        { name: 'Relations', q: 'How are these objects linked?', a: 'A customer has many loans, a branch manages many loans, a loan generates risks.', tip: 'Cardinalities (1:N, N:N) and foreign keys are set automatically.' },
        { name: 'Attributes', q: 'What information for a loan?', a: 'Amount, subscription date, type and status.', tip: 'SQL types, primary/foreign keys and sensitivity are filled for every column.' },
        { name: 'KPI', q: 'Which indicators do you want to track?', a: 'Default rate and average outstanding per branch.', tip: 'Each KPI is formalized: formula, frequency and analysis axes.' },
        { name: 'Business rules', q: 'Any business rules to enforce?', a: 'A loan must be tied to an active customer; a score > 80 triggers an alert.', tip: 'Rules become SQL constraints and dbt tests.' },
        { name: 'Validation', q: 'Great, I am generating the deliverables.', a: 'Go! 🚀', tip: 'Marty computes a maturity score and produces the 6 ready-to-use deliverables.' },
      ];

  // Autoplay au 1er passage dans le viewport
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting && !started.current) { started.current = true; setAuto(true); } });
    }, { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!auto) return;
    if (step >= steps.length - 1) { setAuto(false); return; }
    const t = setTimeout(() => setStep((s) => Math.min(s + 1, steps.length - 1)), 2600);
    return () => clearTimeout(t);
  }, [auto, step, steps.length]);

  function go(s: number) { setAuto(false); setStep(Math.max(0, Math.min(s, steps.length - 1))); }
  function replay() { setAuto(false); setStep(0); }

  const cur = steps[step];
  const deliv = fr
    ? ['MCD / ERD', 'DBML', 'SQL DDL', 'dbt YAML', 'Dictionnaire', 'Rapport DAD']
    : ['ERD', 'DBML', 'SQL DDL', 'dbt YAML', 'Dictionary', 'DAD report'];

  function Tip({ text }: { text: string }) {
    return (
      <span className="gd-tip" tabIndex={0} role="button" aria-label="Info">i
        <span className="gd-tip-box">{text}</span>
      </span>
    );
  }

  return (
    <div className="gd-wrap" ref={wrapRef}>
      <style dangerouslySetInnerHTML={{ __html: STYLE }} />
      <div className="gd-head">
        <div className="gd-tag">{fr ? 'Démo interactive' : 'Interactive demo'}</div>
        <h2>{fr ? 'Voyez Marty construire un Data Product' : 'Watch Marty build a Data Product'}</h2>
        <p>{fr ? 'Cliquez sur les étapes ou laissez-vous guider. Survolez les ⓘ pour comprendre chaque action.' : 'Click the steps or let it play. Hover the ⓘ to understand each action.'}</p>
      </div>

      <div className="gd-card">
        {/* Barre d'étapes */}
        <div className="gd-stepbar">
          {steps.map((s, i) => (
            <button key={s.name} className={`gd-pill ${i === step ? 'active' : i < step ? 'done' : ''}`} onClick={() => go(i)}>
              <span className="gd-n">{i < step ? '✓' : i + 1}</span>{s.name}
            </button>
          ))}
        </div>

        <div className="gd-body">
          {/* Chat Marty */}
          <div className="gd-chat">
            <div className="gd-msg" key={`q-${step}`}>
              <div className="gd-ava"><Image src="/marty-avatar.svg" alt="Marty" width={34} height={34} /></div>
              <div className="gd-bubble">{cur.q}</div>
            </div>
            <div className="gd-msg user" key={`a-${step}`}>
              <div className="gd-ava">{fr ? 'V' : 'U'}</div>
              <div className="gd-bubble">{cur.a}</div>
            </div>
            {step < steps.length - 1 && (
              <div className="gd-msg" key={`t-${step}`}>
                <div className="gd-ava"><Image src="/marty-avatar.svg" alt="Marty" width={34} height={34} /></div>
                <div className="gd-bubble"><span className="gd-typing"><i /><i /><i /></span></div>
              </div>
            )}
          </div>

          {/* Modèle en construction */}
          <div className="gd-model">
            <div className="gd-model-t">{fr ? 'Modèle en construction' : 'Model being built'}</div>

            {step >= 0 && (
              <div className={`gd-block ${step === 0 ? 'cur' : ''}`}>
                <div className="gd-block-t"><I d={ICO.context} />{fr ? 'Contexte' : 'Context'}<Tip text={steps[0].tip} /></div>
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  <b style={{ color: 'var(--text)' }}>{fr ? 'Produit' : 'Product'} :</b> Pilotage Crédit &amp; Risque · <b style={{ color: 'var(--text)' }}>{fr ? 'Domaine' : 'Domain'} :</b> {fr ? 'Risque' : 'Risk'}
                </div>
              </div>
            )}

            {step >= 1 && (
              <div className={`gd-block ${step === 1 ? 'cur' : ''}`}>
                <div className="gd-block-t"><I d={ICO.entities} />{fr ? '4 entités' : '4 entities'}<Tip text={steps[1].tip} /></div>
                <div className="gd-chips">
                  <span className="gd-chip">Client</span>
                  <span className="gd-chip dim">Agence</span>
                  <span className="gd-chip">Crédit</span>
                  <span className="gd-chip">Risque</span>
                </div>
              </div>
            )}

            {step >= 2 && (
              <div className={`gd-block ${step === 2 ? 'cur' : ''}`}>
                <div className="gd-block-t"><I d={ICO.relations} />{fr ? 'Relations' : 'Relations'}<Tip text={steps[2].tip} /></div>
                <div className="gd-rel"><b>Client</b> 1—N <b>Crédit</b></div>
                <div className="gd-rel"><b>Agence</b> 1—N <b>Crédit</b></div>
                <div className="gd-rel"><b>Crédit</b> 1—N <b>Risque</b></div>
              </div>
            )}

            {step >= 3 && (
              <div className={`gd-block ${step === 3 ? 'cur' : ''}`}>
                <div className="gd-block-t"><I d={ICO.attributes} />{fr ? 'Attributs · Crédit' : 'Attributes · Loan'}<Tip text={steps[3].tip} /></div>
                <table className="gd-tbl"><tbody>
                  <tr><td className="k">credit_id</td><td>INT · PK</td></tr>
                  <tr><td className="k">client_id</td><td>INT · FK</td></tr>
                  <tr><td>montant</td><td>DECIMAL</td></tr>
                  <tr><td>date_souscription</td><td>DATE</td></tr>
                  <tr><td>statut</td><td>VARCHAR</td></tr>
                </tbody></table>
              </div>
            )}

            {step >= 4 && (
              <div className={`gd-block ${step === 4 ? 'cur' : ''}`}>
                <div className="gd-block-t"><I d={ICO.kpi} />KPI<Tip text={steps[4].tip} /></div>
                <div className="gd-kpi">{fr ? 'Taux de défaut' : 'Default rate'} <span>= {fr ? 'Crédits en défaut / Total crédits' : 'Defaulted loans / Total loans'}</span></div>
                <div className="gd-kpi">{fr ? 'Encours moyen' : 'Avg outstanding'} <span>{fr ? 'par agence' : 'per branch'}</span></div>
              </div>
            )}

            {step >= 5 && (
              <div className={`gd-block ${step === 5 ? 'cur' : ''}`}>
                <div className="gd-block-t"><I d={ICO.rules} />{fr ? 'Règles métier' : 'Business rules'}<Tip text={steps[5].tip} /></div>
                <div className="gd-rel">• {fr ? 'Crédit rattaché à un client actif (obligatoire)' : 'Loan tied to an active customer (required)'}</div>
                <div className="gd-rel">• score_risque &gt; 80 ⇒ {fr ? 'alerte' : 'alert'}</div>
              </div>
            )}

            {step >= 6 && (
              <div className={`gd-block cur`}>
                <div className="gd-block-t"><I d={ICO.check} />{fr ? 'Validation & livrables' : 'Validation & deliverables'}<Tip text={steps[6].tip} /></div>
                <div className="gd-gauge">
                  <span className="gd-gauge-v">86%</span>
                  <div className="gd-gauge-bar"><span style={{ width: '86%' }} /></div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fr ? 'Maturité DAD' : 'DAD maturity'}</span>
                </div>
                <div className="gd-deliv">
                  {deliv.map((d) => <div key={d}><I d={ICO.doc} />{d}</div>)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Aperçu MCD visuel — le résultat concret */}
        {step >= 6 && (
          <div className="gd-mcd">
            <div className="gd-mcd-t"><I d={ICO.check} />{fr ? 'Résultat : un MCD prêt à l’emploi' : 'Result: a ready-to-use ERD'}</div>
            <svg viewBox="0 0 720 320" role="img" aria-label={fr ? 'Aperçu du modèle conceptuel de données' : 'Conceptual data model preview'}>
              {/* Relations (tracé animé) */}
              <path className="gd-erd-line" d="M110,118 C 130,180 210,150 265,175" style={{ animationDelay: '.1s' }} />
              <path className="gd-erd-line" d="M615,92 C 620,170 500,150 455,175" style={{ animationDelay: '.25s' }} />
              <path className="gd-erd-line" d="M455,235 C 490,235 500,225 520,222" style={{ animationDelay: '.4s' }} />
              {/* Cardinalités */}
              <text className="gd-erd-card" x="118" y="140">1</text>
              <text className="gd-erd-card" x="250" y="168">N</text>
              <text className="gd-erd-card" x="600" y="118">1</text>
              <text className="gd-erd-card" x="470" y="168">N</text>
              <text className="gd-erd-card" x="465" y="228">1</text>
              <text className="gd-erd-card" x="512" y="212">N</text>
              {/* Tables */}
              <ErdTable x={20} y={20} w={170} title="CLIENT" rows={[{ c: 'client_id', k: 'PK' }, { c: 'nom' }, { c: 'segment_client' }]} />
              <ErdTable x={530} y={20} w={170} title="AGENCE" rows={[{ c: 'agence_id', k: 'PK' }, { c: 'region_id', k: 'FK' }]} />
              <ErdTable x={265} y={175} w={190} title="CREDIT" rows={[{ c: 'credit_id', k: 'PK' }, { c: 'client_id', k: 'FK' }, { c: 'agence_id', k: 'FK' }, { c: 'montant' }]} />
              <ErdTable x={520} y={175} w={170} title="RISQUE" rows={[{ c: 'risque_id', k: 'PK' }, { c: 'credit_id', k: 'FK' }, { c: 'score_risque' }]} />
            </svg>
          </div>
        )}

        {/* Contrôles */}
        <div className="gd-controls">
          <button className="gd-btn" onClick={() => go(step - 1)} disabled={step === 0}>◀ {fr ? 'Précédent' : 'Back'}</button>
          <button className="gd-btn gd-play" onClick={() => setAuto((a) => !a)} title={auto ? 'Pause' : 'Play'}>
            {auto ? '⏸' : '▶'} {auto ? (fr ? 'Pause' : 'Pause') : (fr ? 'Lecture auto' : 'Autoplay')}
          </button>
          <div className="gd-dots">
            {steps.map((s, i) => <span key={s.name} className={`gd-dot ${i === step ? 'on' : ''}`} onClick={() => go(i)} />)}
          </div>
          {step < steps.length - 1 ? (
            <button className="gd-btn gd-btn-primary" onClick={() => go(step + 1)}>{fr ? 'Suivant' : 'Next'} ▶</button>
          ) : onStart ? (
            <button className="gd-btn gd-btn-primary" onClick={onStart}>{fr ? 'Créer le mien' : 'Create mine'} →</button>
          ) : (
            <button className="gd-btn" onClick={replay}>↺ {fr ? 'Rejouer' : 'Replay'}</button>
          )}
        </div>
      </div>
    </div>
  );
}
