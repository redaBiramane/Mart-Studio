'use client';

import { useEffect, useRef, useState } from 'react';
import { WorkshopSession } from '@/lib/types';

const STEPS = [
  'Analyse des entités…',
  'Traçage des relations…',
  'Génération du DDL SQL…',
  'Schéma dbt & dictionnaire…',
  'Modèle prêt ✓',
];

// Écran de célébration après « Terminer l'atelier » : Marty « construit » le MCD
// (les vraies tables et relations du modèle apparaissent), 3 s, sautable.
export default function GenerationOverlay({ session, onDone }: { session: WorkshopSession; onDone: () => void }) {
  const doneRef = useRef(false);
  const [stepIdx, setStepIdx] = useState(0);

  const finish = () => { if (doneRef.current) return; doneRef.current = true; onDone(); };

  useEffect(() => {
    const t = setTimeout(finish, 3000);
    const iv = setInterval(() => setStepIdx((i) => Math.min(i + 1, STEPS.length - 1)), 620);
    return () => { clearTimeout(t); clearInterval(iv); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const entities = session.entities.slice(0, 12);
  const relations = session.relations.slice(0, 8);
  const entStagger = entities.length ? Math.min(150, 1500 / entities.length) : 0;

  return (
    <div
      onClick={finish}
      style={{
        position: 'fixed', inset: 0, zIndex: 600, cursor: 'pointer',
        background: 'linear-gradient(135deg, #04352A 0%, #065F46 45%, #0D9488 100%)',
        color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 24, overflow: 'hidden', animation: 'mgoFade .3s ease',
      }}
    >
      <style>{`
        @keyframes mgoFade{from{opacity:0}to{opacity:1}}
        @keyframes mgoPop{from{opacity:0;transform:translateY(10px) scale(.92)}to{opacity:1;transform:none}}
        @keyframes mgoFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
        @keyframes mgoHalo{0%,100%{transform:scale(1);opacity:.32}50%{transform:scale(1.22);opacity:.1}}
        @keyframes mgoBar{from{width:0}to{width:100%}}
      `}</style>

      {/* Logo Marty (CA) + halo */}
      <div style={{ position: 'relative', marginBottom: 18 }}>
        <div style={{ position: 'absolute', inset: -20, borderRadius: '50%', background: 'rgba(255,255,255,0.28)', animation: 'mgoHalo 1.8s ease-in-out infinite' }} />
        <div style={{ position: 'relative', width: 92, height: 92, borderRadius: '50%', background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, padding: '10px 6px 8px', animation: 'mgoFloat 2.4s ease-in-out infinite', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ca-monogram.svg" alt="Marty" style={{ width: '72%', maxHeight: '56%', objectFit: 'contain' }} />
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.5, color: '#006A4F', lineHeight: 1 }}>MARTY</span>
        </div>
      </div>

      <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.3 }}>Marty construit votre MCD…</div>
      <div style={{ fontSize: 13.5, opacity: 0.92, marginTop: 6, minHeight: 20 }}>{STEPS[stepIdx]}</div>

      {/* Barre de progression 0→100 en 3 s */}
      <div style={{ width: 'min(420px, 82vw)', height: 8, borderRadius: 99, background: 'rgba(255,255,255,0.2)', overflow: 'hidden', marginTop: 18 }}>
        <div style={{ height: '100%', borderRadius: 99, background: '#fff', animation: 'mgoBar 3s linear forwards' }} />
      </div>

      {/* Tables qui apparaissent une à une */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 'min(700px, 92vw)', marginTop: 26 }}>
        {entities.map((e, i) => (
          <div key={e.id} style={{ background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 9, padding: '7px 12px', fontSize: 12.5, fontWeight: 700, opacity: 0, animation: 'mgoPop .45s ease forwards', animationDelay: `${Math.round(i * entStagger)}ms` }}>
            <span style={{ opacity: 0.7 }}>▦ </span>{e.name}
          </div>
        ))}
      </div>

      {/* Relations qui se tracent ensuite */}
      {relations.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', maxWidth: 'min(700px, 92vw)', marginTop: 12 }}>
          {relations.map((r, i) => (
            <div key={r.id} style={{ fontSize: 11, opacity: 0, color: 'rgba(255,255,255,0.9)', background: 'rgba(255,255,255,0.09)', borderRadius: 99, padding: '3px 10px', animation: 'mgoPop .4s ease forwards', animationDelay: `${1500 + i * 90}ms` }}>
              {r.sourceEntityName} → {r.targetEntityName}
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); finish(); }}
        style={{ marginTop: 30, background: '#fff', color: '#065F46', border: 'none', borderRadius: 10, padding: '10px 22px', fontWeight: 800, fontSize: 13.5, cursor: 'pointer', boxShadow: '0 6px 18px rgba(0,0,0,0.2)' }}
      >
        Voir les livrables →
      </button>
      <div style={{ fontSize: 11, opacity: 0.7, marginTop: 10 }}>Cliquez n’importe où pour passer</div>
    </div>
  );
}
