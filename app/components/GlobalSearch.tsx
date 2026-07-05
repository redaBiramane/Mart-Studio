'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useWorkshopStore } from '@/lib/store';
import { useI18n } from '@/lib/i18n';

const gGroup: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-muted)', padding: '10px 12px 4px' };
const gRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', background: 'none', border: 'none', borderRadius: 10, padding: '8px 12px', cursor: 'pointer', color: 'var(--text)' };
const gIco: React.CSSProperties = { width: 34, height: 34, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 };
const gTitle: React.CSSProperties = { display: 'block', fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
const gSub: React.CSSProperties = { display: 'block', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
const hoverIn = (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.background = 'var(--bg-elevated)'; };
const hoverOut = (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.background = 'transparent'; };

const CSS = `@keyframes gsGrow { from { width: 40px; opacity: .3; } to { width: var(--gs-w); opacity: 1; } }`;

export default function GlobalSearch({ onOpen }: { onOpen: (id: string) => void }) {
  const { sessions } = useWorkshopStore();
  const { lang } = useI18n();
  const en = lang === 'en';
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  const res = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return { products: [], tables: [], columns: [], total: 0 };
    const products: { id: string; name: string }[] = [];
    const tables: { id: string; name: string; product: string }[] = [];
    const columns: { id: string; name: string; table: string; product: string; type: string }[] = [];
    for (const ss of sessions) {
      const pname = ss.productName || 'Data Product';
      if (`${ss.productName} ${ss.domain}`.toLowerCase().includes(s) && products.length < 5) products.push({ id: ss.id, name: pname });
      const entName = new Map(ss.entities.map(e => [e.id, e.name] as const));
      for (const e of ss.entities) if (e.name.toLowerCase().includes(s) && tables.length < 10) tables.push({ id: ss.id, name: e.name, product: pname });
      for (const a of ss.attributes) if (a.name.toLowerCase().includes(s) && columns.length < 16) columns.push({ id: ss.id, name: a.name, table: entName.get(a.entityId) || a.entityId, product: pname, type: a.type });
    }
    return { products, tables, columns, total: products.length + tables.length + columns.length };
  }, [q, sessions]);

  const highlight = (text: string) => {
    const s = q.trim();
    if (!s) return text;
    const i = text.toLowerCase().indexOf(s.toLowerCase());
    if (i < 0) return text;
    return (<>{text.slice(0, i)}<mark style={{ background: 'var(--primary-glow)', color: 'var(--primary)', borderRadius: 3, padding: '0 1px' }}>{text.slice(i, i + s.length)}</mark>{text.slice(i + s.length)}</>);
  };
  const pick = (id: string) => { setQ(''); setOpen(false); onOpen(id); };

  const L = {
    ph: en ? 'Search a table or column…' : 'Rechercher une table, une colonne…',
    products: 'Data Products', tables: en ? 'Tables' : 'Tables', cols: en ? 'Columns' : 'Colonnes',
    none: en ? 'No result.' : 'Aucun résultat.', in: en ? 'in' : 'dans', title: en ? 'Search' : 'Rechercher',
  };

  if (!open) {
    return (
      <button className="header-icon-btn" title={L.title} onClick={() => setOpen(true)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
      </button>
    );
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 30 }} />
      <div style={{ position: 'relative', zIndex: 31 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') { setQ(''); setOpen(false); } }}
          placeholder={L.ph}
          style={{ ['--gs-w' as string]: 'min(300px, 60vw)', width: 'min(300px, 60vw)', height: 38, padding: '0 34px', border: '1px solid var(--border-active)', borderRadius: 10, background: 'var(--bg-surface)', color: 'var(--text)', fontSize: 13, outline: 'none', animation: 'gsGrow .18s ease' }}
        />
        {q && <button onClick={() => setQ('')} title="Effacer" style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 15 }}>✕</button>}

        {q.trim() && (
          <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 'min(380px, 88vw)', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow-lg)', maxHeight: 440, overflowY: 'auto', padding: 6 }}>
            {res.total === 0 && <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>{L.none}</div>}

            {res.products.length > 0 && <div style={gGroup}>{L.products}</div>}
            {res.products.map((r) => (
              <button key={`p-${r.id}`} onClick={() => pick(r.id)} onMouseEnter={hoverIn} onMouseLeave={hoverOut} style={gRow}>
                <span style={{ ...gIco, background: 'var(--primary-glow)', color: 'var(--primary)' }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8 12 3 3 8l9 5 9-5Z" /><path d="M3 8v8l9 5 9-5V8" /></svg></span>
                <span style={{ minWidth: 0 }}><span style={gTitle}>{highlight(r.name)}</span></span>
              </button>
            ))}

            {res.tables.length > 0 && <div style={gGroup}>{L.tables}</div>}
            {res.tables.map((r, i) => (
              <button key={`t-${r.id}-${r.name}-${i}`} onClick={() => pick(r.id)} onMouseEnter={hoverIn} onMouseLeave={hoverOut} style={gRow}>
                <span style={{ ...gIco, background: 'rgba(139,92,246,0.12)', color: '#8B5CF6' }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="7" height="7" rx="1.5" /><rect x="14" y="4" width="7" height="7" rx="1.5" /><rect x="8.5" y="14" width="7" height="6" rx="1.5" /></svg></span>
                <span style={{ minWidth: 0 }}><span style={gTitle}>{highlight(r.name)}</span><span style={gSub}>{L.in} {r.product}</span></span>
              </button>
            ))}

            {res.columns.length > 0 && <div style={gGroup}>{L.cols}</div>}
            {res.columns.map((r, i) => (
              <button key={`c-${r.id}-${r.name}-${i}`} onClick={() => pick(r.id)} onMouseEnter={hoverIn} onMouseLeave={hoverOut} style={gRow}>
                <span style={{ ...gIco, background: 'rgba(16,185,129,0.12)', color: '#10B981' }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10.5 13.5 4H6a2 2 0 0 0-2 2v7.5L10.5 20a2 2 0 0 0 2.8 0l6.7-6.7a2 2 0 0 0 0-2.8Z" /><circle cx="9" cy="9" r="1.4" /></svg></span>
                <span style={{ minWidth: 0 }}><span style={gTitle}>{highlight(r.name)} <span style={{ fontSize: 10.5, fontWeight: 400, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{r.type}</span></span><span style={gSub}>{r.table} · {r.product}</span></span>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
