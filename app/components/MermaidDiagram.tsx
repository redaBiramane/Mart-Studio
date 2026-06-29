'use client';

import { useEffect, useRef, useState } from 'react';

let initialized = false;

export default function MermaidDiagram({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

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
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg;
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError((e as Error)?.message || 'Erreur de rendu du diagramme');
      }
    })();
    return () => { cancelled = true; };
  }, [code]);

  if (error) {
    return (
      <div style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-surface)', color: 'var(--text-muted)', fontSize: 13 }}>
        Le diagramme n&apos;a pas pu être rendu automatiquement. Vous pouvez copier le code ci-dessous dans mermaid.live.
      </div>
    );
  }

  return (
    <div
      ref={ref}
      style={{ overflow: 'auto', background: '#ffffff', borderRadius: 8, padding: 16, border: '1px solid var(--border)', textAlign: 'center' }}
    />
  );
}
