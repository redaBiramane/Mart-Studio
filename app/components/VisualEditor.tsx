'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow, Background, Controls, MiniMap, Handle, Position, MarkerType, ConnectionMode,
  type Node, type Edge, type NodeProps, type Connection, type NodeChange, type EdgeChange,
} from '@xyflow/react';
import { toPng, toSvg } from 'html-to-image';
import '@xyflow/react/dist/style.css';
import dagre from '@dagrejs/dagre';
import { parseDDL } from '@/lib/ddl';
import { useWorkshopStore } from '@/lib/store';
import type { WorkshopSession, Entity, Attribute, Relation } from '@/lib/types';

const SQL_TYPES = ['bigint', 'int', 'varchar', 'text', 'decimal', 'numeric', 'date', 'timestamp', 'boolean', 'uuid'];
const REL_TYPES: Relation['type'][] = ['1:N', 'N:1', '1:1', 'N:N'];

function genId(p: string) { return `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; }

const toolBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', color: 'var(--text)', fontSize: 13, fontWeight: 600 };
const expItem: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left', background: 'none', border: 'none', borderRadius: 8, padding: '9px 11px', cursor: 'pointer', color: 'var(--text)', fontSize: 13 };

const VE_TIP_CSS = `
.ve-tip { position: relative; display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; border-radius: 50%; background: var(--primary-glow); color: var(--primary); font-size: 10px; font-weight: 800; cursor: help; border: 1px solid var(--border-active); outline: none; }
.ve-tip-box { position: absolute; bottom: calc(100% + 8px); left: 50%; width: 250px; transform: translateX(-50%) translateY(4px); background: #0d1b2a; color: #e6edf3; font-size: 11.5px; font-weight: 500; line-height: 1.55; padding: 11px 13px; border-radius: 10px; box-shadow: 0 12px 30px rgba(0,0,0,0.35); opacity: 0; visibility: hidden; transition: all .18s ease; z-index: 60; text-align: left; }
.ve-tip-box::after { content: ''; position: absolute; top: 100%; left: 50%; transform: translateX(-50%); border: 6px solid transparent; border-top-color: #0d1b2a; }
.ve-tip:hover .ve-tip-box, .ve-tip:focus .ve-tip-box { opacity: 1; visibility: visible; transform: translateX(-50%) translateY(0); }
/* Poignées de connexion : plus grandes, visibles et faciles à saisir */
.react-flow__handle { width: 15px; height: 15px; background: var(--primary); border: 2.5px solid var(--bg-surface); box-shadow: 0 0 0 1px var(--border-active); transition: transform .12s ease, box-shadow .12s ease; z-index: 5; }
.react-flow__handle:hover { transform: scale(1.5); box-shadow: 0 0 0 5px var(--primary-glow); cursor: crosshair; }
.react-flow__node:hover .react-flow__handle { box-shadow: 0 0 0 4px var(--primary-glow); }
.react-flow__handle.connectingfrom, .react-flow__handle.connectingto { transform: scale(1.6); box-shadow: 0 0 0 6px var(--primary-glow); }
.react-flow__connection-path { stroke: var(--primary); stroke-width: 2.4; stroke-dasharray: 6 4; }
.react-flow__edge-path { transition: stroke-width .1s ease; }
.react-flow__edge:hover .react-flow__edge-path { stroke-width: 3 !important; }
`;

// Champ texte « validé » : édite en local et n'écrit dans le store qu'à la
// sortie du champ (blur) ou sur Entrée — évite de reconstruire tout le graphe
// à chaque frappe (grosse source de lenteur avec beaucoup de tables/colonnes).
function CommitInput({ value, onCommit, className, placeholder, style }: { value: string; onCommit: (v: string) => void; className?: string; placeholder?: string; style?: React.CSSProperties }) {
  const [local, setLocal] = useState(value);
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setLocal(value); }, [value]);
  return (
    <input
      className={className}
      value={local}
      placeholder={placeholder}
      style={style}
      onFocus={() => { focused.current = true; }}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => { focused.current = false; if (local !== value) onCommit(local); }}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }}
    />
  );
}

// Sélecteur de type uniforme (affichage majuscules, casse normalisée)
function TypeSelect({ value, onChange, style }: { value: string; onChange: (v: string) => void; style?: React.CSSProperties }) {
  const v = (value || 'varchar').toLowerCase();
  const custom = !SQL_TYPES.includes(v) && v;
  return (
    <select className="nodrag" value={v} onChange={(e) => onChange(e.target.value)} title="Type SQL" style={{ border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', borderRadius: 6, cursor: 'pointer', textTransform: 'uppercase', fontSize: 12, ...style }}>
      {custom && <option value={v}>{v}</option>}
      {SQL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
    </select>
  );
}

// ---- Nœud table personnalisé ----
type TableData = {
  entity: Entity;
  attrs: Attribute[];
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onAddAttr: (entityId: string) => void;
  onAttr: (attrId: string, patch: Partial<Attribute>) => void;
  onDelAttr: (attrId: string) => void;
  onExpand: (entityId: string) => void;
  onFocus: (entityId: string) => void;
};

const TableNode = memo(function TableNode({ data }: NodeProps<Node<TableData>>) {
  const { entity, attrs } = data;
  const [collapsed, setCollapsed] = useState(false);
  // Poignées source+cible de chaque côté : on peut démarrer/terminer un lien
  // depuis la gauche comme la droite (bien plus facile à connecter).
  const handleStyle = (side: 'left' | 'right'): React.CSSProperties => ({ top: 18, [side]: -8 } as React.CSSProperties);
  return (
    <div style={{ minWidth: 285, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow-md)', overflow: 'hidden', fontSize: 12, cursor: 'grab' }}>
      <Handle id="l" type="source" position={Position.Left} title="Tirer pour relier" style={handleStyle('left')} />
      <Handle id="lt" type="target" position={Position.Left} title="Tirer pour relier" style={handleStyle('left')} />
      <Handle id="r" type="source" position={Position.Right} title="Tirer pour relier" style={handleStyle('right')} />
      <Handle id="rt" type="target" position={Position.Right} title="Tirer pour relier" style={handleStyle('right')} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 9px', background: 'var(--primary-glow)', borderBottom: '1px solid var(--border)', cursor: 'grab' }}>
        <button className="nodrag" onClick={() => setCollapsed((c) => !c)} title={collapsed ? 'Déplier' : 'Replier'} style={{ display: 'flex', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0, padding: 0 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform .15s' }}><path d="M6 9l6 6 6-6" /></svg>
        </button>
        <CommitInput
          className="nodrag"
          value={entity.name}
          onCommit={(v) => data.onRename(entity.id, v)}
          placeholder="NOM_TABLE"
          style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', fontWeight: 700, fontSize: 12.5, color: 'var(--primary-light)', textTransform: 'uppercase', outline: 'none' }}
        />
        <span style={{ fontSize: 10.5, color: 'var(--text-muted)', flexShrink: 0 }}>{attrs.length}</span>
        <button className="nodrag" onClick={() => data.onFocus(entity.id)} title="Focus : cette table et ses voisines" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, flexShrink: 0, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-secondary)', cursor: 'pointer' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M12 5V3M12 21v-2M5 12H3M21 12h-2" /></svg>
        </button>
        <button className="nodrag" onClick={() => data.onExpand(entity.id)} title="Voir toutes les colonnes" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, flexShrink: 0, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-secondary)', cursor: 'pointer' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" /></svg>
        </button>
        <button className="nodrag" onClick={() => data.onDelete(entity.id)} title="Supprimer la table" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, flexShrink: 0, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--accent-red)', cursor: 'pointer', lineHeight: 1, fontSize: 18, fontWeight: 700 }}>×</button>
      </div>
      {!collapsed && (
        <div className="nowheel" style={{ padding: 6, maxHeight: 360, overflowY: 'auto' }}>
          {attrs.map((a) => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0' }}>
              <button className="nodrag" onClick={() => data.onAttr(a.id, { isPrimaryKey: !a.isPrimaryKey })} title="Basculer clé primaire" style={{ width: 24, flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: a.isPrimaryKey ? 'var(--accent-amber)' : a.isForeignKey ? 'var(--accent-blue)' : 'var(--text-muted)', fontSize: 11, fontWeight: 700 }}>
                {a.isPrimaryKey ? 'PK' : a.isForeignKey ? 'FK' : '·'}
              </button>
              <CommitInput className="nodrag" value={a.name} onCommit={(v) => data.onAttr(a.id, { name: v })} placeholder="colonne" style={{ flex: 1, minWidth: 0, border: '1px solid transparent', background: 'transparent', fontSize: 12.5, color: 'var(--text)', outline: 'none', padding: '2px 4px', borderRadius: 4 }} />
              <TypeSelect value={a.type} onChange={(v) => data.onAttr(a.id, { type: v })} style={{ padding: '4px 5px', minWidth: 82, maxWidth: 110 }} />
              <button className="nodrag" onClick={() => data.onDelAttr(a.id)} title="Supprimer la colonne" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, flexShrink: 0, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--accent-red)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
            </div>
          ))}
          <button className="nodrag" onClick={() => data.onAddAttr(entity.id)} style={{ marginTop: 4, width: '100%', background: 'var(--bg-elevated)', border: '1px dashed var(--border)', borderRadius: 6, color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 11, padding: '4px 0' }}>+ colonne</button>
        </div>
      )}
    </div>
  );
});

const nodeTypes = { table: TableNode };

export default function VisualEditor({ session }: { session: WorkshopSession }) {
  const { updateSessionData } = useWorkshopStore();
  const rf = useRef<{ fitView: (o?: { padding?: number; duration?: number; nodes?: { id: string }[]; maxZoom?: number }) => void; getNodes: () => Node<TableData>[] } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportMenu, setExportMenu] = useState(false);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const posKey = `mart-erd-pos-${session.id}`;
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>(() => {
    if (typeof window === 'undefined') return {};
    try { return JSON.parse(localStorage.getItem(posKey) || '{}'); } catch { return {}; }
  });

  useEffect(() => {
    try { localStorage.setItem(posKey, JSON.stringify(positions)); } catch { /* ignore */ }
  }, [positions, posKey]);

  const [hintOpen, setHintOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('mart-erd-hint') !== 'off';
  });
  const [selectedRel, setSelectedRel] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [ddlText, setDdlText] = useState('');
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [columnsFor, setColumnsFor] = useState<string | null>(null);
  const [colSearch, setColSearch] = useState('');
  const [colDraft, setColDraft] = useState<Attribute[] | null>(null);

  // Charge les colonnes dans un tampon éditable (validation par bouton)
  useEffect(() => {
    const s = useWorkshopStore.getState().session;
    const ent = s?.entities.find((e) => e.id === columnsFor);
    if (!ent) { setColDraft(null); return; }
    setColDraft((s?.attributes.filter((a) => a.entityId === ent.id || a.entityId === ent.name) || []).map((a) => ({ ...a })));
    setColSearch('');
  }, [columnsFor]);
  const [deleteTableId, setDeleteTableId] = useState<string | null>(null);
  const [relEdit, setRelEdit] = useState<{ type: Relation['type']; fkColumn: string; refColumn: string; isHierarchy: boolean } | null>(null);

  // Charge les valeurs de la relation sélectionnée dans un tampon (validation par bouton)
  useEffect(() => {
    const r = useWorkshopStore.getState().session?.relations.find((x) => x.id === selectedRel);
    setRelEdit(r ? { type: r.type, fkColumn: r.fkColumn || '', refColumn: r.refColumn || '', isHierarchy: r.isHierarchy } : null);
  }, [selectedRel]);

  // Recadrer/centrer à l'entrée en plein écran (et au montage)
  useEffect(() => {
    const t = setTimeout(() => rf.current?.fitView({ padding: 0.2, duration: 300 }), 130);
    return () => clearTimeout(t);
  }, [fullscreen]);

  // Agencement automatique par graphe (dagre) : place les tables en couches selon
  // leurs relations et minimise les croisements. Bien plus lisible qu'une grille.
  const arrange = useCallback(() => {
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: 'LR', nodesep: 70, ranksep: 140, marginx: 40, marginy: 40 });
    g.setDefaultEdgeLabel(() => ({}));

    const attrsCount = (e: Entity) => session.attributes.filter((a) => a.entityId === e.id || a.entityId === e.name).length;
    session.entities.forEach((e) => {
      g.setNode(e.id, { width: 290, height: 60 + attrsCount(e) * 28 + 34 });
    });

    // Résolution des extrémités par id OU nom (comme pour les arêtes)
    const byId = new Set(session.entities.map((e) => e.id));
    const byName = new Map(session.entities.map((e) => [e.name.toLowerCase(), e.id]));
    const resolve = (id?: string, name?: string) =>
      (id && byId.has(id)) ? id : (name && byName.get(name.toLowerCase())) || (id && byName.get(id.toLowerCase())) || undefined;
    session.relations.forEach((r) => {
      const s = resolve(r.sourceEntityId, r.sourceEntityName);
      const t = resolve(r.targetEntityId, r.targetEntityName);
      if (s && t && s !== t) g.setEdge(s, t);
    });

    dagre.layout(g);

    const next: Record<string, { x: number; y: number }> = {};
    session.entities.forEach((e) => {
      const n = g.node(e.id);
      if (n) next[e.id] = { x: n.x - n.width / 2, y: n.y - n.height / 2 };
    });
    setPositions(next);
    setTimeout(() => rf.current?.fitView({ padding: 0.15, duration: 400 }), 60);
  }, [session.entities, session.relations, session.attributes]);

  // Export du diagramme complet : on ajuste la vue (fitView) pour afficher tout le
  // graphe, puis on capture la zone visible. Robuste (aucun calcul de bornes fragile).
  const exportImage = useCallback(async (format: 'png' | 'svg') => {
    const el = document.querySelector('.react-flow') as HTMLElement | null;
    const nodes = rf.current?.getNodes() || [];
    if (!el || nodes.length === 0) return;
    setExporting(true);
    const prevSearch = search, prevFocus = focusId;
    setSearch(''); setFocusId(null);
    // Exclut les contrôles, la mini-carte, le fond quadrillé et l'attribution de l'image.
    const filter = (n: HTMLElement) => {
      const c = n.classList;
      return !c || !(c.contains('react-flow__controls') || c.contains('react-flow__minimap') || c.contains('react-flow__background') || c.contains('react-flow__attribution'));
    };
    try {
      rf.current?.fitView({ padding: 0.12, duration: 0 });
      await new Promise((r) => setTimeout(r, 350)); // laisse le fitView + rendu se stabiliser
      const opts = { backgroundColor: '#ffffff', filter, cacheBust: true };
      const dataUrl = format === 'svg'
        ? await toSvg(el, opts)
        : await toPng(el, { ...opts, pixelRatio: 2.5 }); // HD
      const base = (session.productName || 'data_product').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '') || 'data_product';
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `MCD_${base}.${format}`;
      a.click();
    } catch {
      /* export impossible : on ignore silencieusement */
    } finally {
      setSearch(prevSearch); setFocusId(prevFocus);
      setExporting(false);
      setExportMenu(false);
    }
  }, [search, focusId, session.productName]);

  // Agencement automatique une fois par Data Product : à l'ouverture du Visuel ET
  // quand on change de session sans quitter le Visuel (le composant ne se re-monte pas).
  const lastArrangedId = useRef<string | null>(null);
  useEffect(() => {
    if (lastArrangedId.current === session.id) return;
    lastArrangedId.current = session.id;
    const t = setTimeout(() => { if (session.entities.length > 0) arrange(); }, 250);
    return () => clearTimeout(t);
  }, [session.id, session.entities.length, arrange]);
  function closeHint() {
    setHintOpen(false);
    try { localStorage.setItem('mart-erd-hint', 'off'); } catch { /* ignore */ }
  }

  // Réconciliation : le visuel reste iso avec les données collectées.
  // 1) On renomme les entités au nom technique (ex. entity_123..._abc) si une
  //    relation fournit un vrai nom pour cet id. 2) On crée les tables manquantes
  //    citées par des relations, mais UNIQUEMENT avec un nom propre (jamais un id).
  useEffect(() => {
    const isTech = (n: string) => /^(e|entity|ws|a|r)[_-]\d/i.test(n.trim());

    // Meilleur nom propre connu pour chaque id d'entité (via les relations)
    const cleanNameFor = new Map<string, string>();
    session.relations.forEach((r) => {
      if (r.sourceEntityName && !isTech(r.sourceEntityName)) cleanNameFor.set(r.sourceEntityId, r.sourceEntityName);
      if (r.targetEntityName && !isTech(r.targetEntityName)) cleanNameFor.set(r.targetEntityId, r.targetEntityName);
    });

    let changed = false;
    let entities = session.entities.map((e) => {
      if (isTech(e.name) && cleanNameFor.has(e.id)) { changed = true; return { ...e, name: cleanNameFor.get(e.id) as string }; }
      return e;
    });

    const haveId = new Set(entities.map((e) => e.id));
    const haveName = new Set(entities.map((e) => e.name.toLowerCase()));
    const missing = new Map<string, string>();
    session.relations.forEach((r) => {
      ([[r.sourceEntityId, r.sourceEntityName], [r.targetEntityId, r.targetEntityName]] as const).forEach(([id, name]) => {
        const ok = (id && haveId.has(id)) || (name && haveName.has(name.toLowerCase())) || (id && haveName.has(id.toLowerCase()));
        const disp = (name || '').trim(); // seulement le NOM, jamais l'id
        if (!ok && disp && !isTech(disp)) missing.set(disp.toLowerCase(), disp);
      });
    });
    const newEnts: Entity[] = Array.from(missing.values()).map((nm) => ({ id: genId('e'), name: nm, definition: '', description: '', example: '', responsible: '', type: 'reference', lifecycle: 'created' }));

    if (changed || newEnts.length > 0) {
      updateSessionData({ entities: [...entities, ...newEnts] });
    }
  }, [session.entities, session.relations]); // eslint-disable-line react-hooks/exhaustive-deps

  const attrsOf = useCallback(
    (e: Entity) => session.attributes.filter((a) => a.entityId === e.id || a.entityId === e.name),
    [session.attributes]
  );

  // ---- Mutations (écrivent dans le store → lues par le chatbot) ----
  // Elles lisent l'état frais via getState() pour rester stables (useCallback [])
  // et permettre la mémoïsation des nœuds (pas de re-render inutile en tapant).
  const cur = () => useWorkshopStore.getState().session;
  const addEntity = useCallback(() => {
    const s = cur(); if (!s) return;
    const id = genId('e');
    const entity: Entity = { id, name: `TABLE_${s.entities.length + 1}`, definition: '', description: '', example: '', responsible: '', type: 'transactional', lifecycle: 'created' };
    setPositions((p) => ({ ...p, [id]: { x: 40 + (s.entities.length % 3) * 340, y: 40 + Math.floor(s.entities.length / 3) * 320 } }));
    updateSessionData({ entities: [...s.entities, entity] });
  }, [updateSessionData]);
  const renameEntity = useCallback((id: string, name: string) => {
    const s = cur(); if (!s) return;
    updateSessionData({
      entities: s.entities.map((e) => (e.id === id ? { ...e, name } : e)),
      relations: s.relations.map((r) => ({
        ...r,
        sourceEntityName: r.sourceEntityId === id ? name : r.sourceEntityName,
        targetEntityName: r.targetEntityId === id ? name : r.targetEntityName,
      })),
    });
  }, [updateSessionData]);
  const deleteEntity = useCallback((id: string) => {
    const s = cur(); if (!s) return;
    const ent = s.entities.find((e) => e.id === id);
    const nm = ent?.name?.toLowerCase();
    updateSessionData({
      entities: s.entities.filter((e) => e.id !== id),
      attributes: s.attributes.filter((a) => a.entityId !== id && a.entityId !== ent?.name),
      // Retirer toute relation touchant cette table (par id OU par nom), sinon la
      // réconciliation la recréerait immédiatement.
      relations: s.relations.filter((r) =>
        r.sourceEntityId !== id && r.targetEntityId !== id &&
        r.sourceEntityName?.toLowerCase() !== nm && r.targetEntityName?.toLowerCase() !== nm
      ),
    });
    setPositions((p) => { const n = { ...p }; delete n[id]; return n; });
  }, [updateSessionData]);
  const addAttribute = useCallback((entityId: string) => {
    const s = cur(); if (!s) return;
    const attr: Attribute = { id: genId('a'), entityId, name: 'nouvelle_colonne', type: 'varchar', description: '', isPrimaryKey: false, isForeignKey: false, isNaturalKey: false, isRequired: false, isSensitive: false, isHistorized: false };
    updateSessionData({ attributes: [...s.attributes, attr] });
  }, [updateSessionData]);
  const patchAttribute = useCallback((attrId: string, patch: Partial<Attribute>) => {
    const s = cur(); if (!s) return;
    updateSessionData({ attributes: s.attributes.map((a) => (a.id === attrId ? { ...a, ...patch } : a)) });
  }, [updateSessionData]);
  const deleteAttribute = useCallback((attrId: string) => {
    const s = cur(); if (!s) return;
    updateSessionData({ attributes: s.attributes.filter((a) => a.id !== attrId) });
  }, [updateSessionData]);
  const addRelation = useCallback((sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const st = cur(); if (!st) return;
    const s = st.entities.find((e) => e.id === sourceId);
    const t = st.entities.find((e) => e.id === targetId);
    if (!s || !t) return;
    if (st.relations.some((r) => r.sourceEntityId === sourceId && r.targetEntityId === targetId)) return;
    const rel: Relation = { id: genId('r'), sourceEntityId: sourceId, targetEntityId: targetId, sourceEntityName: s.name, targetEntityName: t.name, type: '1:N', isRequired: false, description: '', isHierarchy: false };
    updateSessionData({ relations: [...st.relations, rel] });
  }, [updateSessionData]);
  const deleteRelation = useCallback((relId: string) => {
    const s = cur(); if (!s) return;
    updateSessionData({ relations: s.relations.filter((r) => r.id !== relId) });
  }, [updateSessionData]);

  // Importer un script Snowflake / SQL / PROC SQL : crée tables, colonnes, PK/FK et relations.
  function importDDL() {
    const { tables, relations } = parseDDL(ddlText);
    if (tables.length === 0) { setImportMsg('Aucune table CREATE TABLE détectée. Vérifiez le script.'); return; }

    const entities = [...session.entities];
    const attributes = [...session.attributes];
    const rels = [...session.relations];
    const findEnt = (name: string) => entities.find((e) => e.name.toLowerCase() === name.toLowerCase());

    let nbTables = 0, nbCols = 0, nbUpdated = 0;
    tables.forEach((t) => {
      let ent = findEnt(t.name);
      if (!ent) {
        ent = { id: genId('e'), name: t.name, definition: '', description: '', example: '', responsible: '', type: 'transactional', lifecycle: 'created' };
        entities.push(ent); nbTables++;
      }
      t.columns.forEach((c) => {
        const idx = attributes.findIndex((a) => (a.entityId === ent!.id || a.entityId === ent!.name) && a.name.toLowerCase() === c.name.toLowerCase());
        if (idx === -1) {
          attributes.push({ id: genId('a'), entityId: ent!.id, name: c.name, type: c.type, description: '', isPrimaryKey: c.isPrimaryKey, isForeignKey: c.isForeignKey, isNaturalKey: false, isRequired: c.isPrimaryKey, isSensitive: false, isHistorized: false });
          nbCols++;
        } else {
          // Round-trip : la colonne existe déjà → on met à jour type / PK / FK si le DDL a changé.
          const prev = attributes[idx];
          const next = { ...prev, type: c.type || prev.type, isPrimaryKey: c.isPrimaryKey || prev.isPrimaryKey, isForeignKey: c.isForeignKey || prev.isForeignKey };
          if (next.type !== prev.type || next.isPrimaryKey !== prev.isPrimaryKey || next.isForeignKey !== prev.isForeignKey) {
            attributes[idx] = next; nbUpdated++;
          }
        }
      });
    });

    let nbRels = 0;
    relations.forEach((r) => {
      const s = findEnt(r.source), tg = findEnt(r.target);
      if (!s || !tg) return;
      if (rels.some((x) => x.sourceEntityId === s.id && x.targetEntityId === tg.id && x.fkColumn === r.fkColumn)) return;
      rels.push({ id: genId('r'), sourceEntityId: s.id, targetEntityId: tg.id, sourceEntityName: s.name, targetEntityName: tg.name, type: '1:N', isRequired: false, description: '', isHierarchy: false, fkColumn: r.fkColumn, refColumn: r.refColumn });
      nbRels++;
    });

    updateSessionData({ entities, attributes, relations: rels });
    lastArrangedId.current = null; // forcer un ré-agencement
    setImportMsg(`✓ Synchronisé : ${nbTables} table(s), ${nbCols} colonne(s) ajoutée(s), ${nbUpdated} mise(s) à jour, ${nbRels} relation(s).`);
    setDdlText('');
    setTimeout(() => { setShowImport(false); setImportMsg(null); arrange(); }, 1400);
  }

  // ---- Construction nodes / edges depuis le modèle ----
  // On mémoïse d'abord le `data` de chaque nœud (change seulement si les entités
  // ou attributs changent), puis on assemble les nœuds avec leur position. Ainsi
  // un simple déplacement ne recrée pas `data` → TableNode (mémoïsé) ne re-render pas.
  // Voisins directs d'une table (résolus par id OU par nom, comme les relations).
  const neighborsOf = useCallback((id: string): Set<string> => {
    const set = new Set<string>([id]);
    const self = session.entities.find((e) => e.id === id);
    const nm = self?.name.toLowerCase();
    const idOf = (idOrName?: string, name?: string) => {
      const byId = session.entities.find((e) => e.id === idOrName);
      if (byId) return byId.id;
      const byName = session.entities.find((e) => e.name.toLowerCase() === (name || idOrName || '').toLowerCase());
      return byName?.id;
    };
    session.relations.forEach((r) => {
      const s = idOf(r.sourceEntityId, r.sourceEntityName);
      const t = idOf(r.targetEntityId, r.targetEntityName);
      const touches = s === id || t === id || r.sourceEntityName?.toLowerCase() === nm || r.targetEntityName?.toLowerCase() === nm;
      if (touches) { if (s) set.add(s); if (t) set.add(t); }
    });
    return set;
  }, [session.entities, session.relations]);

  const focusNeighbors = useMemo(() => (focusId ? neighborsOf(focusId) : null), [focusId, neighborsOf]);

  const onFocus = useCallback((id: string) => {
    setSearch('');
    setFocusId((cur) => (cur === id ? null : id));
    const ids = Array.from(neighborsOf(id)).map((x) => ({ id: x }));
    rf.current?.fitView({ nodes: ids, duration: 500, padding: 0.3, maxZoom: 1.15 });
  }, [neighborsOf]);

  const nodeData = useMemo(() => {
    const m: Record<string, TableData> = {};
    session.entities.forEach((e) => {
      m[e.id] = { entity: e, attrs: attrsOf(e), onRename: renameEntity, onDelete: setDeleteTableId, onAddAttr: addAttribute, onAttr: patchAttribute, onDelAttr: deleteAttribute, onExpand: setColumnsFor, onFocus };
    });
    return m;
  }, [session.entities, session.attributes, attrsOf, renameEntity, addAttribute, patchAttribute, deleteAttribute, onFocus]);

  // Recherche : tables dont le nom OU une colonne correspond au terme cherché.
  const sq = search.trim().toLowerCase();
  const matched = useMemo(() => {
    if (!sq) return { ids: new Set<string>(), list: [] as { id: string; name: string; hitCols: string[] }[] };
    const list: { id: string; name: string; hitCols: string[] }[] = [];
    session.entities.forEach((e) => {
      const cols = attrsOf(e).filter((a) => a.name.toLowerCase().includes(sq));
      const nameHit = e.name.toLowerCase().includes(sq);
      if (nameHit || cols.length) list.push({ id: e.id, name: e.name, hitCols: cols.map((c) => c.name) });
    });
    return { ids: new Set(list.map((l) => l.id)), list };
  }, [sq, session.entities, session.attributes, attrsOf]); // eslint-disable-line react-hooks/exhaustive-deps

  const focusNode = useCallback((id: string) => {
    setSelectedRel(null);
    rf.current?.fitView({ nodes: [{ id }], duration: 500, padding: 0.35, maxZoom: 1.15 });
  }, []);

  const nodes: Node<TableData>[] = useMemo(() => session.entities.map((e, i) => {
    let style: React.CSSProperties = {};
    if (sq) {
      style = matched.ids.has(e.id)
        ? { boxShadow: '0 0 0 3px var(--primary), 0 0 26px rgba(0,107,79,0.35)', borderRadius: 12, zIndex: 10 }
        : { opacity: 0.25 };
    } else if (focusNeighbors) {
      style = e.id === focusId
        ? { boxShadow: '0 0 0 3px var(--primary), 0 0 26px rgba(0,107,79,0.35)', borderRadius: 12, zIndex: 10 }
        : focusNeighbors.has(e.id) ? {} : { opacity: 0.12, pointerEvents: 'none' };
    }
    return {
      id: e.id,
      type: 'table',
      position: positions[e.id] || { x: 40 + (i % 3) * 340, y: 40 + Math.floor(i / 3) * 320 },
      data: nodeData[e.id],
      style,
    };
  }), [session.entities, nodeData, positions, sq, matched, focusNeighbors, focusId]);

  const edges: Edge[] = useMemo(() => {
    // Les relations issues du chat peuvent référencer les entités par NOM (ou un id
    // différent de celui des nœuds). On résout chaque extrémité vers l'id du nœud.
    const byId = new Set(session.entities.map((e) => e.id));
    const byName = new Map(session.entities.map((e) => [e.name.toLowerCase(), e.id]));
    const resolve = (idOrName?: string, name?: string): string | undefined => {
      if (idOrName && byId.has(idOrName)) return idOrName;
      if (name && byName.has(name.toLowerCase())) return byName.get(name.toLowerCase());
      if (idOrName && byName.has(idOrName.toLowerCase())) return byName.get(idOrName.toLowerCase());
      return undefined;
    };
    return session.relations
      .map((r) => {
        const source = resolve(r.sourceEntityId, r.sourceEntityName);
        const target = resolve(r.targetEntityId, r.targetEntityName);
        if (!source || !target) return null; // entité absente du canvas (ex. Region)
        const sel = r.id === selectedRel;
        return {
          id: r.id,
          source,
          target,
          // Routage cohérent : sortie à droite de la source, entrée à gauche de la cible.
          sourceHandle: 'r',
          targetHandle: 'lt',
          label: r.fkColumn ? `${r.type} · ${r.fkColumn}` : r.type,
          labelStyle: { fontSize: 11, fontWeight: 700, fill: sel ? 'var(--accent-amber)' : 'var(--primary)' },
          labelBgStyle: { fill: 'var(--bg-surface)' },
          labelBgPadding: [4, 2] as [number, number],
          style: { stroke: sel ? 'var(--accent-amber)' : 'var(--primary)', strokeWidth: sel ? 2.6 : 1.6 },
          markerEnd: { type: MarkerType.ArrowClosed, color: sel ? 'var(--accent-amber)' : 'var(--primary)' },
          interactionWidth: 26,
        } as Edge;
      })
      .filter((e): e is Edge => e !== null);
  }, [session.relations, session.entities, selectedRel]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setPositions((prev) => {
      let next = prev;
      let changed = false;
      for (const c of changes) {
        if (c.type === 'position' && c.position) { next = { ...next, [c.id]: c.position }; changed = true; }
      }
      return changed ? next : prev;
    });
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    changes.forEach((c) => { if (c.type === 'remove') deleteRelation(c.id); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onConnect = useCallback((c: Connection) => {
    if (c.source && c.target) addRelation(c.source, c.target);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selRel = session.relations.find((r) => r.id === selectedRel) || null;
  const relSrc = selRel ? session.entities.find((e) => e.id === selRel.sourceEntityId || e.name === selRel.sourceEntityName) : null;
  const relTgt = selRel ? session.entities.find((e) => e.id === selRel.targetEntityId || e.name === selRel.targetEntityName) : null;
  const delTableEnt = deleteTableId ? session.entities.find((e) => e.id === deleteTableId) : null;

  const containerStyle: React.CSSProperties = fullscreen
    ? { position: 'fixed', inset: 0, zIndex: 300, background: 'var(--bg-surface)' }
    : { flex: 1, position: 'relative' };

  return (
    <div style={containerStyle}>
      <style dangerouslySetInnerHTML={{ __html: VE_TIP_CSS }} />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgeClick={(_, e) => setSelectedRel(e.id)}
        onPaneClick={() => { setSelectedRel(null); setFocusId(null); }}
        onInit={(inst) => { rf.current = inst as unknown as typeof rf.current; }}
        connectionMode={ConnectionMode.Loose}
        connectionRadius={55}
        fitView
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ type: 'smoothstep' }}
      >
        <Background gap={18} color="var(--border)" />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable nodeColor="var(--primary)" style={{ background: 'var(--bg-elevated)' }} />
      </ReactFlow>

      {/* Export du diagramme (bas centre) — PNG HD ou SVG vectoriel */}
      <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 5 }}>
        {exportMenu && <div onClick={() => setExportMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 4 }} />}
        {exportMenu && (
          <div style={{ position: 'absolute', bottom: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)', minWidth: 220, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow-lg)', padding: 6, zIndex: 6 }}>
            <button onClick={() => exportImage('png')} disabled={exporting} className="nodrag" onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'} style={expItem}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="1.6" /><path d="m21 15-5-5L5 21" /></svg>
              <span><strong>PNG</strong> — image HD <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>(présentations, mail)</span></span>
            </button>
            <button onClick={() => exportImage('svg')} disabled={exporting} className="nodrag" onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'} style={expItem}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7V4h16v3M9 20h6M12 4v16" /></svg>
              <span><strong>SVG</strong> — vectoriel <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>(doc, zoom infini)</span></span>
            </button>
          </div>
        )}
        <button onClick={() => setExportMenu((o) => !o)} disabled={exporting} title="Télécharger le diagramme" style={{ ...toolBtn, boxShadow: 'var(--shadow-md)', color: 'var(--primary)', borderColor: 'var(--border-active)', opacity: exporting ? 0.6 : 1 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /><path d="M12 3v13M8 12l4 4 4-4" /></svg>
          {exporting ? 'Export…' : 'Télécharger'}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: exportMenu ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}><path d="M6 9l6 6 6-6" /></svg>
        </button>
      </div>

      <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 5, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="cta-btn" onClick={addEntity} style={{ padding: '8px 14px' }}>+ Table</button>
        <button onClick={() => { setShowImport(true); setImportMsg(null); }} title="Coller un script Snowflake / SQL" style={{ ...toolBtn, color: 'var(--primary)', borderColor: 'var(--border-active)' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 8l-4 4 4 4M16 8l4 4-4 4M13 4l-2 16" /></svg>
          Importer SQL
        </button>
        <button onClick={arrange} title="Réorganiser les tables" style={toolBtn}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
          Arranger
        </button>
        <button onClick={() => setFullscreen((f) => !f)} title={fullscreen ? 'Réduire' : 'Plein écran'} style={toolBtn}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            {fullscreen ? <path d="M9 3H5a2 2 0 0 0-2 2v4M15 3h4a2 2 0 0 1 2 2v4M9 21H5a2 2 0 0 1-2-2v-4M15 21h4a2 2 0 0 0 2-2v-4" /> : <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" />}
          </svg>
          {fullscreen ? 'Réduire' : 'Plein écran'}
        </button>
      </div>

      {/* Bandeau « focus voisins » actif */}
      {focusId && (
        <div style={{ position: 'absolute', top: 62, right: 12, zIndex: 6, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--primary-glow)', border: '1px solid var(--border-active)', borderRadius: 10, padding: '7px 12px', boxShadow: 'var(--shadow-md)' }}>
          <span style={{ fontSize: 12.5, color: 'var(--primary-light)', fontWeight: 600 }}>Focus : {session.entities.find((e) => e.id === focusId)?.name} + voisines</span>
          <button onClick={() => setFocusId(null)} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 9px', cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)' }}>✕ Quitter</button>
        </div>
      )}

      {/* Recherche de table / colonne sur le canvas */}
      <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 6, width: 300 }}>
        <div style={{ position: 'relative' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setSearchOpen(true); }}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && matched.list[0]) { focusNode(matched.list[0].id); setSearchOpen(false); }
              if (e.key === 'Escape') { setSearch(''); setSearchOpen(false); }
            }}
            placeholder="Rechercher une table / colonne…"
            style={{ width: '100%', height: 40, padding: '0 34px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-surface)', color: 'var(--text)', fontSize: 13, outline: 'none', boxShadow: 'var(--shadow-md)' }}
          />
          {search && <button onClick={() => { setSearch(''); setSearchOpen(false); }} title="Effacer" style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 15 }}>✕</button>}
        </div>
        {sq && searchOpen && (
          <div style={{ marginTop: 6, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow-md)', maxHeight: 320, overflowY: 'auto' }}>
            <div style={{ padding: '7px 12px', fontSize: 11, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>{matched.list.length} table(s) trouvée(s)</div>
            {matched.list.length === 0 && <div style={{ padding: '12px', fontSize: 12.5, color: 'var(--text-muted)' }}>Aucun résultat.</div>}
            {matched.list.map((m) => (
              <button key={m.id} onClick={() => { focusNode(m.id); setSearchOpen(false); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text)' }}>
                <div style={{ fontWeight: 700, fontSize: 12.5, textTransform: 'uppercase', color: 'var(--primary-light)' }}>{m.name}</div>
                {m.hitCols.length > 0 && <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>colonnes : {m.hitCols.slice(0, 5).join(', ')}{m.hitCols.length > 5 ? '…' : ''}</div>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Fenêtre : toutes les colonnes d'une table (édition tampon + Valider) */}
      {(() => {
        const ent = columnsFor ? session.entities.find((e) => e.id === columnsFor) : null;
        if (!ent || !colDraft) return null;
        const cols = colDraft.filter((a) => !colSearch || a.name.toLowerCase().includes(colSearch.toLowerCase()));
        const setCol = (id: string, patch: Partial<Attribute>) => setColDraft(colDraft.map((a) => a.id === id ? { ...a, ...patch } : a));
        const delCol = (id: string) => setColDraft(colDraft.filter((a) => a.id !== id));
        const addCol = () => setColDraft([...colDraft, { id: genId('a'), entityId: ent.id, name: 'nouvelle_colonne', type: 'varchar', description: '', isPrimaryKey: false, isForeignKey: false, isNaturalKey: false, isRequired: false, isSensitive: false, isHistorized: false }]);
        const save = () => {
          const others = session.attributes.filter((a) => a.entityId !== ent.id && a.entityId !== ent.name);
          updateSessionData({ attributes: [...others, ...colDraft] });
          setColumnsFor(null);
        };
        return (
          <div onClick={() => setColumnsFor(null)} style={{ position: 'absolute', inset: 0, zIndex: 55, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(680px, 96%)', maxHeight: '86%', display: 'flex', flexDirection: 'column', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.35)', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                <strong style={{ fontSize: 16, color: 'var(--primary-light)', textTransform: 'uppercase' }}>{ent.name}</strong>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{colDraft.length} colonnes</span>
                <button onClick={() => setColumnsFor(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
              </div>
              <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
                <input value={colSearch} onChange={(e) => setColSearch(e.target.value)} placeholder="Rechercher une colonne…" autoFocus style={{ width: '100%', height: 40, padding: '0 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-elevated)', color: 'var(--text)', fontSize: 13.5, outline: 'none' }} />
              </div>
              <div style={{ overflowY: 'auto', padding: '8px 12px', flex: 1 }}>
                {cols.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Aucune colonne.</div>}
                {cols.map((a) => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderBottom: '1px solid var(--border-light)' }}>
                    <button onClick={() => setCol(a.id, { isPrimaryKey: !a.isPrimaryKey })} title="Clé primaire" style={{ width: 30, flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: a.isPrimaryKey ? 'var(--accent-amber)' : a.isForeignKey ? 'var(--accent-blue)' : 'var(--text-muted)', fontSize: 12, fontWeight: 700 }}>{a.isPrimaryKey ? 'PK' : a.isForeignKey ? 'FK' : '·'}</button>
                    <input value={a.name} onChange={(e) => setCol(a.id, { name: e.target.value })} style={{ flex: 1, minWidth: 0, border: '1px solid var(--border)', background: 'var(--bg-elevated)', fontSize: 13, color: 'var(--text)', outline: 'none', padding: '6px 8px', borderRadius: 6 }} />
                    <TypeSelect value={a.type} onChange={(v) => setCol(a.id, { type: v })} style={{ fontSize: 12.5, padding: '6px', minWidth: 120 }} />
                    <button onClick={() => delCol(a.id)} title="Supprimer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, flexShrink: 0, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--accent-red)', cursor: 'pointer', fontSize: 16 }}>×</button>
                  </div>
                ))}
              </div>
              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button className="suggested-chip" onClick={addCol} style={{ width: '100%', padding: '9px 0' }}>+ Ajouter une colonne</button>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="suggested-chip" onClick={() => setColumnsFor(null)} style={{ flex: 1 }}>Annuler</button>
                  <button className="cta-btn" onClick={save} style={{ flex: 2 }}>Valider</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modale : importer un script SQL/Snowflake */}
      {showImport && (
        <div onClick={() => setShowImport(false)} style={{ position: 'absolute', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(640px, 96%)', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.35)', padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <strong style={{ fontSize: 16 }}>Importer un script SQL / Snowflake</strong>
              <button onClick={() => setShowImport(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18 }}>×</button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 12px' }}>Collez un ou plusieurs <code>CREATE TABLE</code> (Snowflake, SQL standard, PROC SQL). Les colonnes, types, clés <strong>PK</strong> et <strong>FK</strong> (et les relations) sont créés automatiquement. Ré-importer un script <strong>met à jour</strong> les tables existantes (nouveaux champs ajoutés, types/clés resynchronisés) sans écraser le reste.</p>
            <textarea
              value={ddlText}
              onChange={(e) => setDdlText(e.target.value)}
              placeholder={'CREATE TABLE CLIENT (\n  client_id NUMBER(38,0) PRIMARY KEY,\n  nom VARCHAR(255),\n  ...\n);\nCREATE TABLE COMMANDE (\n  commande_id NUMBER PRIMARY KEY,\n  client_id NUMBER,\n  FOREIGN KEY (client_id) REFERENCES CLIENT(client_id)\n);'}
              spellCheck={false}
              style={{ width: '100%', height: 240, resize: 'vertical', padding: 12, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-code, #0d1b2a)', color: '#e6edf3', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12.5, lineHeight: 1.5, outline: 'none' }}
            />
            {importMsg && <div style={{ marginTop: 10, fontSize: 13, color: importMsg.startsWith('✓') ? 'var(--primary)' : 'var(--accent-red)' }}>{importMsg}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button className="suggested-chip" onClick={() => setShowImport(false)}>Annuler</button>
              <button className="cta-btn" onClick={importDDL} disabled={!ddlText.trim()} style={{ opacity: ddlText.trim() ? 1 : 0.5 }}>Analyser &amp; importer</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation : suppression de table */}
      {delTableEnt && (
        <div onClick={() => setDeleteTableId(null)} style={{ position: 'absolute', inset: 0, zIndex: 56, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(420px, 94%)', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.35)', padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ color: 'var(--accent-red)', display: 'flex' }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" /></svg></span>
              <h3 style={{ fontSize: 17, margin: 0 }}>Supprimer la table ?</h3>
            </div>
            <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
              La table <strong style={{ textTransform: 'uppercase' }}>{delTableEnt.name}</strong>, ses <strong>colonnes</strong> et ses <strong>relations</strong> seront supprimées. Cette action est irréversible.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button className="suggested-chip" onClick={() => setDeleteTableId(null)}>Annuler</button>
              <button onClick={() => { deleteEntity(delTableEnt.id); setDeleteTableId(null); }} style={{ background: 'var(--accent-red)', color: '#fff', border: 'none', borderRadius: 9, padding: '10px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modale d'édition de relation (validation par bouton) */}
      {selRel && relEdit && (
        <div onClick={() => setSelectedRel(null)} style={{ position: 'absolute', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(370px, 94%)', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.35)', padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <strong style={{ fontSize: 15 }}>Relation</strong>
              <button onClick={() => setSelectedRel(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
            </div>
            <div style={{ fontSize: 14, color: 'var(--text)', marginBottom: 16, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
              <strong>{selRel.sourceEntityName}</strong> <span style={{ color: 'var(--primary)', fontWeight: 700 }}>→</span> <strong>{selRel.targetEntityName}</strong>
            </div>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)' }}>Cardinalité</label>
            <select
              value={relEdit.type}
              onChange={(e) => setRelEdit({ ...relEdit, type: e.target.value as Relation['type'] })}
              style={{ width: '100%', height: 42, marginTop: 6, marginBottom: 14, padding: '0 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-elevated)', color: 'var(--text)', fontSize: 14 }}
            >
              {REL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>

            <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)' }}>Jointure sur les colonnes</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, marginBottom: 14 }}>
              <select
                value={relEdit.refColumn}
                onChange={(e) => setRelEdit({ ...relEdit, refColumn: e.target.value })}
                title={`Colonne dans ${relSrc?.name || 'source'}`}
                style={{ flex: 1, minWidth: 0, height: 38, padding: '0 8px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-elevated)', color: 'var(--text)', fontSize: 12.5 }}
              >
                <option value="">{relSrc?.name || 'source'}…</option>
                {(relSrc ? attrsOf(relSrc) : []).map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
              </select>
              <span style={{ color: 'var(--primary)', fontWeight: 700 }}>→</span>
              <select
                value={relEdit.fkColumn}
                onChange={(e) => setRelEdit({ ...relEdit, fkColumn: e.target.value })}
                title={`Colonne FK dans ${relTgt?.name || 'cible'}`}
                style={{ flex: 1, minWidth: 0, height: 38, padding: '0 8px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-elevated)', color: 'var(--text)', fontSize: 12.5 }}
              >
                <option value="">{relTgt?.name || 'cible'} (FK)…</option>
                {(relTgt ? attrsOf(relTgt) : []).map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <input type="checkbox" checked={relEdit.isHierarchy} onChange={(e) => setRelEdit({ ...relEdit, isHierarchy: e.target.checked })} />
                Hiérarchie
              </label>
              <span className="ve-tip" tabIndex={0} role="button" aria-label="À quoi sert la hiérarchie ?">i
                <span className="ve-tip-box">
                  Lien <strong>parent → enfant</strong> entre niveaux d&apos;un même axe (ex. Région → Agence → Client). Coché ⇒ dimension <strong>normalisée en flocon</strong> (snowflake) et analyses drill-down. À laisser décoché pour une relation classique (ex. Client → Crédit).
                </span>
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { deleteRelation(selRel.id); setSelectedRel(null); }} title="Supprimer la relation" style={{ flexShrink: 0, background: 'var(--bg-surface)', color: 'var(--accent-red)', border: '1px solid var(--border)', borderRadius: 9, padding: '11px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Supprimer</button>
              <button
                onClick={() => {
                  updateSessionData({
                    relations: session.relations.map((r) => r.id === selRel.id ? { ...r, type: relEdit.type, fkColumn: relEdit.fkColumn || undefined, refColumn: relEdit.refColumn || undefined, isHierarchy: relEdit.isHierarchy } : r),
                    attributes: (relEdit.fkColumn && relTgt) ? session.attributes.map((a) => ((a.entityId === relTgt.id || a.entityId === relTgt.name) && a.name === relEdit.fkColumn) ? { ...a, isForeignKey: true } : a) : session.attributes,
                  });
                  setSelectedRel(null);
                }}
                style={{ flex: 1, background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 9, padding: '11px 0', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
              >Valider</button>
            </div>
          </div>
        </div>
      )}

      {hintOpen && !selRel && (
        <div style={{ position: 'absolute', bottom: 12, left: 12, zIndex: 5, fontSize: 11.5, color: 'var(--text-muted)', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 30px 8px 10px', maxWidth: 340, boxShadow: 'var(--shadow)' }}>
          Tirez d&apos;une table à l&apos;autre (point à droite → point à gauche) pour créer une relation · cliquez une relation pour l&apos;éditer ou la supprimer. Marty lit ce schéma en temps réel.
          <button onClick={closeHint} title="Masquer" style={{ position: 'absolute', top: 4, right: 6, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 15, lineHeight: 1 }}>×</button>
        </div>
      )}
    </div>
  );
}
