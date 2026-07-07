'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n';

const CARD_W = 180, GAP = 14, STEP = CARD_W + GAP;

// Icône fournisseur (marque stylisée, teintée à la couleur de l'éditeur).
function VendorIcon({ vendor, color }: { vendor: string; color: string }) {
  const paths: Record<string, React.ReactNode> = {
    Anthropic: <path d="M12 3l2.4 5.6L20 11l-5.6 2.4L12 19l-2.4-5.6L4 11l5.6-2.4Z" />,
    OpenAI: <><circle cx="12" cy="12" r="4" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2" /></>,
    Google: <><path d="M12 4v16M4 12h16M6.5 6.5l11 11M17.5 6.5l-11 11" /></>,
  };
  return (
    <span style={{ width: 38, height: 38, borderRadius: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: `${color}22`, flexShrink: 0 }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[vendor] || <circle cx="12" cy="12" r="6" />}</svg>
    </span>
  );
}

const CSS = `
.msc { max-width: 1000px; margin: 0 auto; }
.msc-head { text-align: center; margin-bottom: 30px; }
.msc-head h2 { font-size: 30px; font-weight: 800; letter-spacing: -0.6px; line-height: 1.1; margin: 0; }
.msc-head h2 .msc-accent { color: var(--primary); }
.msc-head p { font-size: 15px; color: var(--text-secondary); line-height: 1.6; max-width: 560px; margin: 12px auto 0; }
.msc-stage { position: relative; padding: 28px 0 20px; border: 1px solid var(--border); border-radius: 20px; background: var(--bg-surface); }
.msc-viewport { position: relative; overflow: hidden; padding: 16px 0 6px; }
.msc-viewport::before, .msc-viewport::after { content: ''; position: absolute; top: 0; bottom: 0; width: 80px; z-index: 3; pointer-events: none; }
.msc-viewport::before { left: 0; background: linear-gradient(90deg, var(--bg-surface), transparent); }
.msc-viewport::after { right: 0; background: linear-gradient(270deg, var(--bg-surface), transparent); }
.msc-track { display: flex; gap: 14px; width: max-content; transition: transform .6s cubic-bezier(.22,.61,.36,1); }
.msc-card { width: 180px; flex-shrink: 0; background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 14px; padding: 16px; display: flex; align-items: center; gap: 11px; opacity: .5; transform: scale(.9); transition: all .5s cubic-bezier(.22,.61,.36,1); }
.msc-card.active { opacity: 1; transform: scale(1.06); border-color: var(--border-active); box-shadow: 0 0 0 2px var(--primary), 0 14px 40px var(--primary-glow); }
.msc-card .msc-name { font-size: 14.5px; font-weight: 700; color: var(--text); line-height: 1.2; }
.msc-card .msc-vendor { font-size: 11.5px; color: var(--text-muted); margin-top: 2px; }
.msc-badge { position: absolute; top: 10px; left: 50%; transform: translateX(-50%); z-index: 4; background: var(--primary); color: #fff; font-size: 10.5px; font-weight: 800; letter-spacing: 0.8px; padding: 5px 12px; border-radius: 999px; box-shadow: 0 6px 18px var(--primary-glow); white-space: nowrap; }
.msc-pills { display: flex; gap: 10px; justify-content: center; margin-top: 22px; flex-wrap: wrap; }
.msc-pill { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 600; padding: 6px 14px; border-radius: 999px; border: 1px solid var(--border); }
.msc-pill.ok { color: var(--accent-emerald); background: rgba(16,185,129,0.08); border-color: rgba(16,185,129,0.3); }
.msc-pill.trait { color: var(--primary); background: var(--primary-glow); border-color: var(--border-active); }
@keyframes mscGlow { 0%,100% { box-shadow: 0 0 0 2px var(--primary), 0 14px 40px var(--primary-glow); } 50% { box-shadow: 0 0 0 2px var(--primary), 0 14px 54px var(--primary-glow); } }
.msc-card.active { animation: mscGlow 2.4s ease-in-out infinite; }
@media (max-width: 640px) { .msc-head h2 { font-size: 24px; } }
@media (prefers-reduced-motion: reduce) { .msc-track, .msc-card { transition: none; } .msc-card.active { animation: none; } }
`;

export default function ModelShowcase() {
  const { lang } = useI18n();
  const fr = lang === 'fr';
  const models = useMemo(() => [
    { name: 'Claude Sonnet', vendor: 'Anthropic', color: '#D97757', trait: fr ? 'Équilibré' : 'Balanced' },
    { name: 'Gemini 2.5 Flash', vendor: 'Google', color: '#4285F4', trait: fr ? 'Rapide & économique' : 'Fast & cheap' },
    { name: 'Claude Opus 4.8', vendor: 'Anthropic', color: '#D97757', trait: fr ? 'Hautes performances' : 'High performance' },
    { name: 'GPT-4o', vendor: 'OpenAI', color: '#10A37F', trait: fr ? 'Polyvalent' : 'Versatile' },
    { name: 'Gemini 2.5 Pro', vendor: 'Google', color: '#4285F4', trait: fr ? 'Raisonnement' : 'Reasoning' },
    { name: 'Claude Haiku 4.5', vendor: 'Anthropic', color: '#D97757', trait: fr ? 'Ultra-rapide' : 'Ultra-fast' },
  ], [fr]);

  const [active, setActive] = useState(2);
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageW, setStageW] = useState(0);

  // Largeur du conteneur (pour centrer la carte active en pixels — indispensable :
  // un translateX en % serait relatif au rail, pas au conteneur).
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const update = () => setStageW(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = setInterval(() => setActive((a) => (a + 1) % models.length), 2600);
    return () => clearInterval(id);
  }, [models.length]);

  const cur = models[active];
  const offset = stageW / 2 - (active * STEP + CARD_W / 2);

  return (
    <div className="msc">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="msc-head">
        <h2>{fr ? 'Tous les modèles.' : 'Every model.'} <span className="msc-accent">{fr ? 'Votre choix.' : 'Your choice.'}</span></h2>
        <p>{fr
          ? "Choisissez le modèle d'IA adapté à votre activité — performance maximale ou coût réduit — et changez quand vous voulez. Aucun verrouillage."
          : 'Pick the AI model that fits your work — top performance or lower cost — and switch anytime. No lock-in.'}</p>
      </div>

      <div className="msc-stage">
        <div className="msc-badge">{fr ? 'VOTRE CHOIX' : 'YOUR CHOICE'}</div>
        <div className="msc-viewport" ref={stageRef}>
          <div className="msc-track" style={{ transform: `translateX(${offset}px)` }}>
            {models.map((m, i) => (
              <div key={i} className={`msc-card ${i === active ? 'active' : ''}`}>
                <VendorIcon vendor={m.vendor} color={m.color} />
                <div style={{ minWidth: 0 }}>
                  <div className="msc-name">{m.name}</div>
                  <div className="msc-vendor">{m.vendor}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="msc-pills">
        <span className="msc-pill ok">✓ {cur.name}</span>
        <span className="msc-pill trait">+ {cur.trait}</span>
      </div>
    </div>
  );
}
