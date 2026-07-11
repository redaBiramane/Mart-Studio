'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { WorkshopSession, Entity } from '@/lib/types';

const STEPS = [
  'Analyse des entités…',
  'Placement des tables…',
  'Traçage des relations…',
  'Génération du DDL SQL…',
  'Modèle prêt ✓',
];

const CARD: Record<string, [string, string]> = {
  '1:1': ['1', '1'],
  '1:N': ['1', '1..N'],
  'N:1': ['1..N', '1'],
  'N:N': ['1..N', '1..N'],
};

type Box = { cx: number; cy: number; w: number; h: number };
type Line = { id: string; x1: number; y1: number; x2: number; y2: number; len: number; l1: { x: number; y: number; t: string }; l2: { x: number; y: number; t: string }; i: number };

function edgePoint(b: Box, tx: number, ty: number) {
  const dx = tx - b.cx, dy = ty - b.cy;
  if (dx === 0 && dy === 0) return { x: b.cx, y: b.cy };
  const sx = dx !== 0 ? (b.w / 2) / Math.abs(dx) : Infinity;
  const sy = dy !== 0 ? (b.h / 2) / Math.abs(dy) : Infinity;
  const s = Math.min(sx, sy);
  return { x: b.cx + dx * s, y: b.cy + dy * s };
}

// Écran de célébration après « Terminer l'atelier » : Marty construit le MCD
// (les vraies tables apparaissent puis les relations se tracent), 3 s, sautable.
export default function GenerationOverlay({ session, onDone }: { session: WorkshopSession; onDone: () => void }) {
  const doneRef = useRef(false);
  const [stepIdx, setStepIdx] = useState(0);
  const finish = () => { if (doneRef.current) return; doneRef.current = true; onDone(); };

  useEffect(() => {
    const t = setTimeout(finish, 3200);
    const iv = setInterval(() => setStepIdx((i) => Math.min(i + 1, STEPS.length - 1)), 640);
    return () => { clearTimeout(t); clearInterval(iv); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const entities = session.entities.slice(0, 8);
  const shownNames = new Set(entities.map((e) => e.name));
  const relations = session.relations
    .filter((r) => shownNames.has(r.sourceEntityName) && shownNames.has(r.targetEntityName) && r.sourceEntityName !== r.targetEntityName)
    .slice(0, 10);
  const cols = Math.min(3, Math.max(1, Math.ceil(Math.sqrt(entities.length))));

  const attrsOf = (e: Entity) => {
    const a = session.attributes.filter((x) => x.entityId === e.id || x.entityId === e.name);
    return [...a].sort((x, y) => (y.isPrimaryKey ? 1 : 0) - (x.isPrimaryKey ? 1 : 0) || (y.isForeignKey ? 1 : 0) - (x.isForeignKey ? 1 : 0)).slice(0, 4);
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [lines, setLines] = useState<Line[]>([]);

  useLayoutEffect(() => {
    const measure = () => {
      const boxOf = (name: string): Box | null => {
        const el = cardRefs.current[name];
        if (!el) return null;
        return { cx: el.offsetLeft + el.offsetWidth / 2, cy: el.offsetTop + el.offsetHeight / 2, w: el.offsetWidth, h: el.offsetHeight };
      };
      const out: Line[] = [];
      relations.forEach((r, i) => {
        const s = boxOf(r.sourceEntityName), t = boxOf(r.targetEntityName);
        if (!s || !t) return;
        const p1 = edgePoint(s, t.cx, t.cy);
        const p2 = edgePoint(t, s.cx, s.cy);
        const len = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1;
        const ux = (p2.x - p1.x) / len, uy = (p2.y - p1.y) / len;
        const [c1, c2] = CARD[r.type] || ['1', 'N'];
        out.push({
          id: r.id, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, len, i,
          l1: { x: p1.x + ux * 16, y: p1.y + uy * 16 - 4, t: c1 },
          l2: { x: p2.x - ux * 16, y: p2.y - uy * 16 - 4, t: c2 },
        });
      });
      setLines(out);
    };
    measure();
    const t = setTimeout(measure, 60);
    window.addEventListener('resize', measure);
    return () => { clearTimeout(t); window.removeEventListener('resize', measure); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entities.length, relations.length]);

  return (
    <div
      onClick={finish}
      style={{
        position: 'fixed', inset: 0, zIndex: 600, cursor: 'pointer',
        background: 'linear-gradient(135deg, #04352A 0%, #065F46 45%, #0D9488 100%)',
        color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '20px 24px', overflow: 'hidden', animation: 'mgoFade .3s ease',
      }}
    >
      <style>{`
        @keyframes mgoFade{from{opacity:0}to{opacity:1}}
        @keyframes mgoPop{from{opacity:0;transform:translateY(10px) scale(.94)}to{opacity:1;transform:none}}
        @keyframes mgoFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
        @keyframes mgoHalo{0%,100%{transform:scale(1);opacity:.3}50%{transform:scale(1.2);opacity:.1}}
        @keyframes mgoBar{from{width:0}to{width:100%}}
        @keyframes mgoDraw{to{stroke-dashoffset:0}}
      `}</style>

      {/* En-tête : logo Marty + titre + progression */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', inset: -12, borderRadius: '50%', background: 'rgba(255,255,255,0.28)', animation: 'mgoHalo 1.8s ease-in-out infinite' }} />
          <div style={{ position: 'relative', width: 56, height: 56, borderRadius: '50%', background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, padding: '7px 4px 5px', animation: 'mgoFloat 2.4s ease-in-out infinite', boxShadow: '0 6px 18px rgba(0,0,0,0.2)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/ca-monogram.svg" alt="Marty" style={{ width: '72%', maxHeight: '56%', objectFit: 'contain' }} />
            <span style={{ fontSize: 6.5, fontWeight: 800, letterSpacing: 0.3, color: '#006A4F', lineHeight: 1 }}>MARTY</span>
          </div>
        </div>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.3 }}>Marty construit votre MCD…</div>
          <div style={{ fontSize: 12.5, opacity: 0.9, minHeight: 18 }}>{STEPS[stepIdx]}</div>
        </div>
      </div>
      <div style={{ width: 'min(420px, 82vw)', height: 7, borderRadius: 99, background: 'rgba(255,255,255,0.2)', overflow: 'hidden', marginBottom: 18 }}>
        <div style={{ height: '100%', borderRadius: 99, background: '#fff', animation: 'mgoBar 3.2s linear forwards' }} />
      </div>

      {/* Mini-MCD : tables + relations tracées */}
      <div
        ref={containerRef}
        style={{ position: 'relative', width: 'min(940px, 94vw)', maxHeight: '58vh', overflow: 'auto', padding: 4 }}
      >
        {/* Liens (SVG) au-dessus, sous les cartes en z-index */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1, overflow: 'visible' }}>
          {lines.map((ln) => (
            <g key={ln.id}>
              <line x1={ln.x1} y1={ln.y1} x2={ln.x2} y2={ln.y2} stroke="rgba(255,255,255,0.85)" strokeWidth={2}
                strokeDasharray={ln.len} strokeDashoffset={ln.len}
                style={{ animation: 'mgoDraw .6s ease forwards', animationDelay: `${1200 + ln.i * 90}ms` }} />
              <text x={ln.l1.x} y={ln.l1.y} fontSize={11} fontWeight={700} fill="#fff" textAnchor="middle" style={{ opacity: 0, animation: 'mgoPop .4s ease forwards', animationDelay: `${1700 + ln.i * 90}ms` }}>{ln.l1.t}</text>
              <text x={ln.l2.x} y={ln.l2.y} fontSize={11} fontWeight={700} fill="#fff" textAnchor="middle" style={{ opacity: 0, animation: 'mgoPop .4s ease forwards', animationDelay: `${1700 + ln.i * 90}ms` }}>{ln.l2.t}</text>
            </g>
          ))}
        </svg>

        <div style={{ position: 'relative', zIndex: 2, display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: '44px 36px', justifyItems: 'center', alignItems: 'start' }}>
          {entities.map((e, i) => {
            const attrs = attrsOf(e);
            return (
              <div
                key={e.id}
                ref={(el) => { cardRefs.current[e.name] = el; }}
                style={{ width: '100%', maxWidth: 210, background: '#fff', borderRadius: 10, overflow: 'hidden', boxShadow: '0 8px 22px rgba(0,0,0,0.18)', opacity: 0, animation: 'mgoPop .45s ease forwards', animationDelay: `${i * 120}ms` }}
              >
                <div style={{ background: 'linear-gradient(135deg,#0F766E,#0D9488)', color: '#fff', fontWeight: 800, fontSize: 12, letterSpacing: 0.3, padding: '6px 10px', textAlign: 'center' }}>{e.name}</div>
                <div style={{ padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {attrs.length === 0 && <div style={{ fontSize: 10.5, color: '#94A3B8', fontStyle: 'italic' }}>—</div>}
                  {attrs.map((a) => (
                    <div key={a.id} style={{ fontSize: 10.5, color: '#0F172A', display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
                      {(a.isPrimaryKey || a.isForeignKey) && <span style={{ fontSize: 8.5, fontWeight: 800, color: a.isPrimaryKey ? '#B45309' : '#0D9488' }}>{a.isPrimaryKey ? 'PK' : 'FK'}</span>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); finish(); }}
        style={{ marginTop: 22, background: '#fff', color: '#065F46', border: 'none', borderRadius: 10, padding: '10px 22px', fontWeight: 800, fontSize: 13.5, cursor: 'pointer', boxShadow: '0 6px 18px rgba(0,0,0,0.2)' }}
      >
        Voir les livrables →
      </button>
      <div style={{ fontSize: 11, opacity: 0.7, marginTop: 8 }}>Cliquez n’importe où pour passer</div>
    </div>
  );
}
