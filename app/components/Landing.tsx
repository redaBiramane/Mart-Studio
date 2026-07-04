'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import { useI18n } from '@/lib/i18n';
import GuidedDemo from './GuidedDemo';

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

.ml-hero { position: relative; max-width: 1000px; margin: 0 auto; padding: 64px 24px 32px; text-align: center; }
.ml-hero .ml-blob { position: absolute; z-index: 0; border-radius: 50%; filter: blur(70px); opacity: 0.35; pointer-events: none; }
.ml-hero .ml-blob-1 { width: 380px; height: 380px; background: var(--primary); top: -100px; left: -60px; animation: mlFloat 9s ease-in-out infinite; }
.ml-hero .ml-blob-2 { width: 320px; height: 320px; background: #3EE3D3; bottom: -120px; right: -40px; animation: mlFloat 11s ease-in-out infinite reverse; }
.ml-chip, .ml-hero h1, .ml-hero-sub, .ml-hero-cta, .ml-kpis { position: relative; z-index: 1; }
.ml-chip { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 700; letter-spacing: 0.4px; color: var(--primary); background: var(--primary-glow); border: 1px solid var(--border); border-radius: 999px; padding: 6px 14px; margin-bottom: 22px; animation: mlUp .6s ease both; }
.ml-hero h1 { font-size: 52px; line-height: 1.06; font-weight: 800; letter-spacing: -1.4px; margin-bottom: 20px; animation: mlUp .7s ease .05s both; }
.ml-grad { background: linear-gradient(120deg, var(--primary), #009597); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
.ml-hero-sub { font-size: 18px; line-height: 1.6; color: var(--text-secondary); max-width: 660px; margin: 0 auto 30px; animation: mlUp .7s ease .12s both; }
.ml-hero-cta { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; animation: mlUp .7s ease .18s both; }
.ml-kpis { display: flex; gap: 48px; justify-content: center; flex-wrap: wrap; margin-top: 54px; animation: mlUp .7s ease .28s both; }
.ml-kpi .v { font-size: 42px; font-weight: 800; color: var(--primary); line-height: 1; }
.ml-kpi .l { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: var(--text-muted); margin-top: 8px; }

/* ===== Diagramme produit (INPUT -> IA -> OUTPUT) ===== */
.ml-diagram-wrap { max-width: 1240px; margin: 0 auto; padding: 10px 24px 44px; }
.ml-diagram { position: relative; border-radius: 22px; padding: 28px; background: linear-gradient(160deg, #0b1a28, #071521); border: 1px solid rgba(62,227,211,0.18); box-shadow: 0 30px 80px rgba(0,0,0,0.35); color: #dbe7f0; overflow: hidden; }
.ml-diagram::after { content: ''; position: absolute; inset: 0; background: radial-gradient(620px 320px at 50% 42%, rgba(62,227,211,0.10), transparent 70%); pointer-events: none; }
.mld-inner { position: relative; z-index: 1; }
.mld-title { text-align: center; font-size: 12px; font-weight: 800; letter-spacing: 2.5px; color: #3EE3D3; margin-bottom: 22px; }

.mld-steps { position: relative; display: flex; justify-content: space-between; gap: 6px; max-width: 900px; margin: 0 auto 30px; }
.mld-steps::before { content: ''; position: absolute; top: 22px; left: 6%; right: 6%; height: 2px; background: linear-gradient(90deg, rgba(62,227,211,0.12), rgba(62,227,211,0.6), rgba(62,227,211,0.12)); }
.mld-step { position: relative; z-index: 1; flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8px; }
.mld-step-ico { width: 46px; height: 46px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #3EE3D3; background: #0c2230; border: 1.5px solid rgba(62,227,211,0.45); animation: mldPulse 3s ease-in-out infinite; }
.mld-step-l { font-size: 10.5px; font-weight: 600; color: #b9c9d6; text-align: center; }

.mld-flow { display: grid; grid-template-columns: 1fr auto 1.3fr auto 1fr; gap: 14px; align-items: center; }
.mld-arrow { color: #3EE3D3; animation: mldArrow 1.5s ease-in-out infinite; }
.mld-panel { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.09); border-radius: 16px; padding: 18px; }
.mld-panel-t { font-size: 11px; font-weight: 800; letter-spacing: 2px; color: #3EE3D3; margin-bottom: 14px; }
.mld-bubble { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 12px 14px; font-size: 12px; line-height: 1.5; color: #cfdae2; margin-bottom: 16px; }
.mld-sub { font-size: 10px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #8fa3b3; margin-bottom: 9px; }
.mld-row { display: flex; align-items: center; gap: 10px; padding: 9px 11px; border-radius: 9px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); font-size: 12px; margin-bottom: 8px; color: #c7d3dd; }
.mld-row:last-child { margin-bottom: 0; }
.mld-row svg { color: #3EE3D3; flex-shrink: 0; }
.mld-row .mld-tag { margin-left: auto; font-size: 8.5px; font-weight: 800; letter-spacing: 0.5px; color: #04303a; background: #3EE3D3; border-radius: 5px; padding: 2px 7px; }

.mld-core { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.mld-ai { width: 96px; height: 96px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 17px; letter-spacing: 0.6px; color: #04303a; background: radial-gradient(circle at 35% 30%, #8ff5e6, #16cbb6 58%, #0a9e97); animation: mldGlow2 3s ease-in-out infinite; cursor: default; transition: transform .25s ease; }
.mld-ai:hover { transform: scale(1.06); }
.mld-ai-l { font-size: 10px; font-weight: 700; letter-spacing: 0.4px; color: #9fc7c4; margin-bottom: 8px; }
.mld-erd { width: 100%; background: #f6fafc; border-radius: 12px; padding: 12px; box-shadow: 0 6px 20px rgba(0,0,0,0.25); }
.mld-erd-t { font-size: 9px; font-weight: 800; letter-spacing: 1px; color: #0a9e97; text-align: center; margin-bottom: 10px; }
.mld-erd-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.mld-tbl { background: #fff; border: 1px solid #d8e6ee; border-radius: 8px; overflow: hidden; transition: transform .2s ease, box-shadow .2s ease, border-color .2s; }
.mld-tbl:hover { transform: translateY(-3px); box-shadow: 0 8px 18px rgba(10,158,151,0.25); border-color: #16cbb6; }
.mld-tbl-h { background: #0a2a3a; color: #a9eee6; font-size: 9px; font-weight: 800; letter-spacing: 1px; padding: 4px 8px; }
.mld-tbl-b { padding: 6px 8px; font-size: 8.5px; color: #4a5b68; line-height: 1.55; }
.mld-rel { margin-top: 10px; display: flex; flex-wrap: wrap; gap: 5px; justify-content: center; }
.mld-rel span { font-size: 8px; font-weight: 700; color: #0a7d78; background: #dff5f2; border: 1px solid #b6e6e0; border-radius: 5px; padding: 2px 6px; }

/* Lineage animé ERD -> livrables */
.mld-lineage { display: flex; align-items: center; justify-content: center; }
.mld-lineage svg { width: 54px; height: 300px; overflow: visible; }
.mld-wire { fill: none; stroke-width: 2.4; stroke-linecap: round; stroke-dasharray: 5 7; animation: mldDash 0.9s linear infinite; filter: drop-shadow(0 0 3px currentColor); }

/* Livrables color-codés + hover */
.mld-row-out { position: relative; border-left: 3px solid var(--c, #3EE3D3); transition: transform .2s ease, background .2s ease, box-shadow .2s ease; cursor: pointer; }
.mld-row-out:hover { transform: translateX(4px); background: rgba(62,227,211,0.08); box-shadow: -6px 0 16px -8px var(--c, #3EE3D3); }
.mld-row-out:hover .mld-tag { filter: brightness(1.1); }
.mld-row-in { transition: transform .2s ease, background .2s ease; }
.mld-row-in:hover { transform: translateX(4px); background: rgba(62,227,211,0.07); }
.mld-step { transition: transform .2s ease; }
.mld-step:hover { transform: translateY(-3px); }
.mld-step:hover .mld-step-ico { background: rgba(62,227,211,0.18); }
.mld-feats > div { transition: transform .2s ease; }
.mld-feats > div:hover { transform: translateY(-3px); }

.mld-feats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-top: 24px; padding-top: 22px; border-top: 1px solid rgba(255,255,255,0.08); }
.mld-feat-t { display: flex; align-items: center; gap: 8px; font-size: 12.5px; font-weight: 800; color: #3EE3D3; margin-bottom: 7px; }
.mld-feat p { font-size: 11.5px; color: #9fb0bd; line-height: 1.5; }
.mld-bar { height: 5px; border-radius: 3px; background: rgba(255,255,255,0.1); margin-top: 9px; overflow: hidden; }
.mld-bar span { display: block; height: 100%; background: linear-gradient(90deg, #3EE3D3, #10A37F); border-radius: 3px; width: 0; animation: mldBar 1.6s ease forwards; }

.ml-sec { max-width: 1160px; margin: 0 auto; padding: 64px 24px; }
.ml-sec-alt { background: var(--bg-elevated); border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
.ml-head { text-align: center; max-width: 720px; margin: 0 auto 44px; }
.ml-tag { font-size: 11px; font-weight: 700; letter-spacing: 2.4px; text-transform: uppercase; color: var(--primary); margin-bottom: 10px; }
.ml-head h2 { font-size: 34px; font-weight: 800; letter-spacing: -0.6px; line-height: 1.15; }
.ml-head p { font-size: 16px; color: var(--text-secondary); margin-top: 14px; line-height: 1.6; }

.ml-steps { display: flex; gap: 16px; flex-wrap: wrap; justify-content: center; }
.ml-step { flex: 1 1 130px; min-width: 130px; max-width: 200px; background: var(--bg-surface); border: 1px solid var(--border); border-radius: 16px; padding: 22px 16px; text-align: center; transition: transform .25s ease, box-shadow .25s ease, border-color .25s; }
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
@keyframes mlFloatY { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
@keyframes mlGlow { 0%,100% { opacity: 0.55; } 50% { opacity: 1; } }
@keyframes mldGlow2 { 0%,100% { box-shadow: 0 0 28px rgba(62,227,211,0.4); } 50% { box-shadow: 0 0 56px rgba(62,227,211,0.75); } }
@keyframes mldPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(62,227,211,0.35); } 50% { box-shadow: 0 0 0 6px rgba(62,227,211,0); } }
@keyframes mldArrow { 0%,100% { transform: translateX(0); opacity: 0.5; } 50% { transform: translateX(5px); opacity: 1; } }
@keyframes mldBar { from { width: 0; } to { width: var(--w, 80%); } }
@keyframes mldDash { to { stroke-dashoffset: -12; } }

@media (max-width: 920px) {
  .ml-hero h1 { font-size: 36px; }
  .ml-head h2, .ml-final-in h2 { font-size: 26px; }
  .ml-grid { grid-template-columns: 1fr; }
  .ml-feats { grid-template-columns: 1fr; }
  .ml-nav-hide { display: none; }
  .mld-flow { grid-template-columns: 1fr; }
  .mld-arrow { transform: rotate(90deg); justify-self: center; }
  .mld-lineage { display: none; }
  .mld-feats { grid-template-columns: 1fr 1fr; }
  .mld-steps { flex-wrap: wrap; justify-content: center; gap: 14px; }
  .mld-steps::before { display: none; }
  .mld-step { flex: 0 0 70px; }
}
@media (prefers-reduced-motion: reduce) {
  .ml-reveal, .ml-chip, .ml-hero h1, .ml-hero-sub, .ml-hero-cta, .ml-kpis { animation: none !important; transition: none !important; opacity: 1 !important; transform: none !important; }
  .ml-blob, .mld-ai, .mld-step-ico, .mld-arrow, .mld-bar span, .mld-wire { animation: none !important; }
  .mld-bar span { width: var(--w, 80%) !important; }
}
`;

function Icon({ name }: { name: string }) {
  const p: Record<string, React.ReactNode> = {
    context: <><path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-4 4v-4H6a2 2 0 0 1-2-2Z" /><path d="M8 8.5h8M8 12h5" /></>,
    entities: <><rect x="3" y="4" width="7" height="7" rx="1.5" /><rect x="14" y="4" width="7" height="7" rx="1.5" /><rect x="8.5" y="14" width="7" height="6" rx="1.5" /><path d="M6.5 11v1.5a1.5 1.5 0 0 0 1.5 1.5M17.5 11v1.5a1.5 1.5 0 0 1-1.5 1.5" /></>,
    relations: <><circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><circle cx="18" cy="6" r="2.5" /><path d="M8.5 6H15M6 8.5V15a3 3 0 0 0 3 3h6.5" /></>,
    attributes: <><path d="M20 10.5 13.5 4H6a2 2 0 0 0-2 2v7.5L10.5 20a2 2 0 0 0 2.8 0l6.7-6.7a2 2 0 0 0 0-2.8Z" /><circle cx="9" cy="9" r="1.4" /></>,
    kpi: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
    rules: <><path d="M6.5 2H18a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" /><path d="M9 8l1.5 1.5L13 7M9 14l1.5 1.5L13 13" /></>,
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
    procTitle: fr ? '7 étapes guidées, 0 ligne de code' : '7 guided steps, 0 line of code',
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
    importTitle: fr ? 'Importez vos scripts existants' : 'Import your existing scripts',
    importDesc: fr
      ? "Collez un CREATE TABLE Snowflake / SQL, ou importez un fichier SAS, CSV ou Excel : tables, colonnes, clés PK/FK et relations sont créées automatiquement."
      : 'Paste a Snowflake / SQL CREATE TABLE, or import a SAS, CSV or Excel file: tables, columns, PK/FK keys and relations are created automatically.',
    visualTitle: fr ? 'Éditeur visuel (glisser-déposer)' : 'Visual editor (drag & drop)',
    visualDesc: fr
      ? "Modélisez sur un canvas type ERD : déplacez les tables, éditez les colonnes, marquez les clés, tirez d'une table à l'autre pour créer une relation."
      : 'Model on an ERD-style canvas: move tables, edit columns, mark keys, drag between tables to create a relation.',
    syncTitle: fr ? 'Chat & Visuel synchronisés' : 'Chat & Visual in sync',
    syncDesc: fr
      ? "Marty comprend les deux : ce que vous dessinez, il le lit en contexte ; ce qu'il déduit apparaît sur le canvas. Une seule source, alimentant tous les livrables."
      : 'Marty understands both: what you draw feeds its context; what it infers appears on the canvas. One source, feeding every deliverable.',
    govTitle: fr ? 'Gouvernance intégrée' : 'Built-in governance',
    govDesc: fr
      ? 'Score de maturité et préparation automatique au Design Authority (DAD).'
      : 'Maturity score and automatic Design Authority (DAD) readiness.',
    finalTitle: fr ? 'Standardisation et rapidité' : 'Standardization and speed',
    finalSub: fr
      ? 'Générez un Data Product complet et standardisé en seulement quelques minutes.'
      : 'Generate a complete, standardized Data Product in just a few minutes.',
    finalBtn: fr ? 'Démarrer maintenant' : 'Get started now',
    showCaption: fr ? "De l'idée métier au Data Product prêt à l'emploi" : 'From business idea to a ready-to-use Data Product',
    diagTitle: fr ? '7 étapes guidées' : '7 guided steps',
    diagInput: 'INPUT',
    diagOutput: 'OUTPUT',
    diagNeed: fr ? 'Idée métier / Besoin' : 'Business idea / Need',
    diagNeedEx: fr ? '« Suivre nos clients, leurs crédits, les risques associés et les agences. »' : '“Track our customers, their loans, related risks and branches.”',
    diagSources: fr ? 'Sources de données' : 'Data sources',
    diagCore: fr ? 'MCD / ERD proposé' : 'Proposed ERD',
    diagOut6: fr ? '6 livrables techniques' : '6 technical deliverables',
    export: fr ? 'Exporter' : 'Export',
  };

  const delivColors = ['#3EE3D3', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#38BDF8'];

  const inputs = [
    fr ? 'Fichiers SAS' : 'SAS files', 'Excel',
    fr ? 'Bases existantes' : 'Existing databases',
    fr ? 'Documents métier' : 'Business docs', 'APIs / ERP / CRM',
  ];

  const features = [
    { icon: 'import', t: fr ? 'Import automatisé' : 'Automated import', d: fr ? 'Lecture et profilage des fichiers (SAS, SQL, Excel…).' : 'Reads and profiles files (SAS, SQL, Excel…).', w: '78%' },
    { icon: 'gov', t: fr ? 'Gouvernance intégrée' : 'Built-in governance', d: fr ? 'Règles, glossaire, lineage et qualité des données.' : 'Rules, glossary, lineage and data quality.', w: '100%' },
    { icon: 'dad', t: fr ? 'Score de maturité (DAD)' : 'Maturity score (DAD)', d: fr ? 'Évaluation automatique selon le Design Authority.' : 'Automatic Design Authority assessment.', w: '86%' },
    { icon: 'arrow', t: fr ? 'Rapidité' : 'Speed', d: fr ? 'Un Data Product complet et standardisé en minutes.' : 'A complete, standardized Data Product in minutes.', w: '92%' },
  ];

  const steps = [
    { ico: 'context', num: fr ? 'Étape 1' : 'Step 1', name: fr ? 'Contexte' : 'Context' },
    { ico: 'entities', num: fr ? 'Étape 2' : 'Step 2', name: fr ? 'Entités' : 'Entities' },
    { ico: 'relations', num: fr ? 'Étape 3' : 'Step 3', name: fr ? 'Relations' : 'Relations' },
    { ico: 'attributes', num: fr ? 'Étape 4' : 'Step 4', name: fr ? 'Attributs' : 'Attributes' },
    { ico: 'kpi', num: fr ? 'Étape 5' : 'Step 5', name: 'KPI' },
    { ico: 'rules', num: fr ? 'Étape 6' : 'Step 6', name: fr ? 'Règles métier' : 'Business rules' },
    { ico: 'validation', num: fr ? 'Étape 7' : 'Step 7', name: 'Validation' },
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
          <div className="ml-kpi"><div className="v">7</div><div className="l">{L.kSteps}</div></div>
          <div className="ml-kpi"><div className="v">6</div><div className="l">{L.kDeliv}</div></div>
          <div className="ml-kpi"><div className="v">0</div><div className="l">{L.kCode}</div></div>
        </div>
      </header>

      {/* DIAGRAMME PRODUIT — INPUT -> IA -> OUTPUT */}
      <section className="ml-diagram-wrap ml-reveal">
        <div className="ml-diagram">
          <div className="mld-inner">
            <div className="mld-title">{L.diagTitle}</div>
            {/* Stepper 7 étapes */}
            <div className="mld-steps">
              {steps.map((s) => (
                <div key={s.name} className="mld-step">
                  <div className="mld-step-ico"><Icon name={s.ico} /></div>
                  <div className="mld-step-l">{s.name}</div>
                </div>
              ))}
            </div>

            {/* Flux INPUT -> IA -> OUTPUT */}
            <div className="mld-flow">
              {/* INPUT */}
              <div className="mld-panel">
                <div className="mld-panel-t">{L.diagInput}</div>
                <div className="mld-sub">{L.diagNeed}</div>
                <div className="mld-bubble">{L.diagNeedEx}</div>
                <div className="mld-sub">{L.diagSources}</div>
                {inputs.map((src) => (
                  <div key={src} className="mld-row mld-row-in"><Icon name="import" />{src}</div>
                ))}
              </div>

              <div className="mld-arrow"><Icon name="arrow" /></div>

              {/* CORE MARTY + ERD */}
              <div className="mld-core">
                <div className="mld-ai">MARTY</div>
                <div className="mld-ai-l">{fr ? 'Chatbot IA · Data Architect' : 'AI Chatbot · Data Architect'}</div>
                <div className="mld-erd">
                  <div className="mld-erd-t">{L.diagCore}</div>
                  <div className="mld-erd-grid">
                    <div className="mld-tbl"><div className="mld-tbl-h">CLIENT</div><div className="mld-tbl-b">client_id (PK)<br />nom · segment</div></div>
                    <div className="mld-tbl"><div className="mld-tbl-h">AGENCE</div><div className="mld-tbl-b">agence_id (PK)<br />region</div></div>
                    <div className="mld-tbl"><div className="mld-tbl-h">CREDIT</div><div className="mld-tbl-b">credit_id (PK)<br />client_id (FK)<br />agence_id (FK)</div></div>
                    <div className="mld-tbl"><div className="mld-tbl-h">RISQUE</div><div className="mld-tbl-b">risque_id (PK)<br />credit_id (FK)</div></div>
                  </div>
                  <div className="mld-rel">
                    <span>CLIENT 1—N CREDIT</span>
                    <span>AGENCE 1—N CREDIT</span>
                    <span>CREDIT 1—N RISQUE</span>
                  </div>
                </div>
              </div>

              {/* Lineage animé ERD -> livrables */}
              <div className="mld-lineage" aria-hidden="true">
                <svg viewBox="0 0 54 300" preserveAspectRatio="none">
                  {delivColors.map((c, i) => {
                    const y = 25 + i * 50;
                    return <path key={c} className="mld-wire" d={`M0,150 C 27,150 27,${y} 54,${y}`} stroke={c} style={{ animationDelay: `${i * 0.12}s` }} />;
                  })}
                </svg>
              </div>

              {/* OUTPUT */}
              <div className="mld-panel">
                <div className="mld-panel-t">{L.diagOutput}</div>
                <div className="mld-sub">{L.diagOut6}</div>
                {deliverables.map((d, i) => (
                  <div key={d.name} className="mld-row mld-row-out" style={{ '--c': delivColors[i] } as React.CSSProperties}>
                    <span style={{ color: delivColors[i], display: 'flex' }}><Icon name={d.ico} /></span>
                    {d.name}<span className="mld-tag" style={{ background: delivColors[i] }}>{L.export}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bandeau atouts */}
            <div className="mld-feats">
              {features.map((f) => (
                <div key={f.t}>
                  <div className="mld-feat-t"><Icon name={f.icon} />{f.t}</div>
                  <p>{f.d}</p>
                  <div className="mld-bar"><span style={{ '--w': f.w } as React.CSSProperties} /></div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-muted)' }}>{L.showCaption}</p>
      </section>

      {/* DÉMO INTERACTIVE GUIDÉE */}
      <section className="ml-sec-alt">
        <div className="ml-reveal">
          <GuidedDemo onStart={() => onEnter('signup')} />
        </div>
      </section>

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
              <div className="ml-feat-ico"><Icon name="entities" /></div>
              <div><h3>{L.visualTitle}</h3><p>{L.visualDesc}</p></div>
            </div>
            <div className="ml-feat ml-reveal">
              <div className="ml-feat-ico"><Icon name="relations" /></div>
              <div><h3>{L.syncTitle}</h3><p>{L.syncDesc}</p></div>
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
