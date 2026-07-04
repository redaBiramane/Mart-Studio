'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

let initialized = false;

// Mermaid laisse traîner des nœuds temporaires (#dmmd-…) et, en cas d'erreur,
// un SVG « bombe » directement dans <body>. On les supprime pour ne pas polluer l'UI.
function cleanupOrphans(keepId?: string) {
  document.querySelectorAll('body > svg[id^="dmmd-"], body > svg[id^="mmd-"], body > [id^="dmmd-"]').forEach((el) => {
    if (keepId && el.id === keepId) return;
    el.remove();
  });
}

export default function MermaidDiagram({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const baseWidth = useRef<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(0.6);

  function centerScroll() {
    const c = containerRef.current;
    if (c) c.scrollLeft = Math.max(0, (c.scrollWidth - c.clientWidth) / 2);
  }

  // Render the diagram whenever the code changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        if (!initialized) {
          mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose' });
          initialized = true;
        }
        const id = 'mmd-' + Math.random().toString(36).slice(2);
        const { svg } = await mermaid.render(id, code);
        cleanupOrphans(id);
        if (cancelled || !ref.current) return;
        ref.current.innerHTML = svg;
        const el = ref.current.querySelector('svg');
        if (el) {
          const vb = el.viewBox?.baseVal;
          baseWidth.current = vb && vb.width ? vb.width : el.getBoundingClientRect().width || 800;
          el.removeAttribute('height');
          el.style.maxWidth = 'none';
          el.style.height = 'auto';
          el.style.width = baseWidth.current * scale + 'px';
          requestAnimationFrame(centerScroll);
        }
        setError(null);
      } catch (e) {
        // En cas d'échec, Mermaid injecte un SVG « bombe » dans le <body> : on le retire.
        cleanupOrphans();
        if (!cancelled) setError((e as Error)?.message || 'Erreur de rendu du diagramme');
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // Apply zoom without re-rendering the diagram
  useEffect(() => {
    const el = ref.current?.querySelector('svg');
    if (el && baseWidth.current) el.style.width = baseWidth.current * scale + 'px';
  }, [scale]);

  const downloadPng = useCallback(() => {
    const svgEl = ref.current?.querySelector('svg');
    if (!svgEl) return;
    const vb = svgEl.viewBox?.baseVal;
    const width = vb && vb.width ? vb.width : svgEl.getBoundingClientRect().width;
    const height = vb && vb.height ? vb.height : svgEl.getBoundingClientRect().height;

    const clone = svgEl.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('width', String(width));
    clone.setAttribute('height', String(height));
    const xml = new XMLSerializer().serializeToString(clone);
    const src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(xml)));

    const img = new Image();
    img.onload = () => {
      const factor = 2; // export en haute résolution
      const canvas = document.createElement('canvas');
      canvas.width = width * factor;
      canvas.height = height * factor;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(factor, factor);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'mcd-diagram.png';
        a.click();
        URL.revokeObjectURL(url);
      }, 'image/png');
    };
    img.src = src;
  }, []);

  if (error) {
    return (
      <div style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-surface)', color: 'var(--text-muted)', fontSize: 13 }}>
        <div style={{ marginBottom: 10 }}>Le diagramme n&apos;a pas pu être rendu automatiquement. Vous pouvez copier le code ci-dessous dans mermaid.live.</div>
        <div style={{ color: 'var(--accent-red)', fontSize: 12, marginBottom: 8 }}>{error}</div>
        <pre style={{ background: '#0d1117', color: '#e6edf3', padding: 12, borderRadius: 6, overflow: 'auto', maxHeight: 320, fontSize: 12, lineHeight: 1.5, margin: 0 }}>{code}</pre>
      </div>
    );
  }

  const btn: React.CSSProperties = {
    background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6,
    padding: '4px 10px', cursor: 'pointer', fontSize: 13, color: 'var(--text)',
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
        <button style={btn} onClick={() => setScale(s => Math.max(0.3, +(s - 0.2).toFixed(2)))} title="Dézoomer">➖</button>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 44, textAlign: 'center' }}>{Math.round(scale * 100)}%</span>
        <button style={btn} onClick={() => setScale(s => Math.min(3, +(s + 0.2).toFixed(2)))} title="Zoomer">➕</button>
        <button style={btn} onClick={() => { setScale(0.6); requestAnimationFrame(centerScroll); }} title="Ajuster et centrer">⤢ Ajuster</button>
        <button style={{ ...btn, marginLeft: 'auto' }} onClick={downloadPng} title="Télécharger en PNG">⬇ Télécharger PNG</button>
      </div>
      <div ref={containerRef} style={{ overflow: 'auto', maxHeight: 620, background: '#ffffff', borderRadius: 8, padding: 16, border: '1px solid var(--border)', textAlign: 'center' }}>
        <div ref={ref} style={{ display: 'inline-block' }} />
      </div>
    </div>
  );
}
