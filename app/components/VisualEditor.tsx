'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow, Background, Controls, MiniMap, Handle, Position, MarkerType, ConnectionMode,
  type Node, type Edge, type NodeProps, type Connection, type NodeChange, type EdgeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useWorkshopStore } from '@/lib/store';
import type { WorkshopSession, Entity, Attribute, Relation } from '@/lib/types';

const SQL_TYPES = ['bigint', 'int', 'varchar', 'text', 'decimal', 'numeric', 'date', 'timestamp', 'boolean', 'uuid'];
const REL_TYPES: Relation['type'][] = ['1:N', 'N:1', '1:1', 'N:N'];

function genId(p: string) { return `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; }

const toolBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', color: 'var(--text)', fontSize: 13, fontWeight: 600 };

// ---- Nœud table personnalisé ----
type TableData = {
  entity: Entity;
  attrs: Attribute[];
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onAddAttr: (entityId: string) => void;
  onAttr: (attrId: string, patch: Partial<Attribute>) => void;
  onDelAttr: (attrId: string) => void;
};

function TableNode({ data }: NodeProps<Node<TableData>>) {
  const { entity, attrs } = data;
  return (
    <div style={{ minWidth: 275, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow-md)', overflow: 'hidden', fontSize: 12, cursor: 'grab' }}>
      <Handle type="target" position={Position.Left} title="Tirer pour relier" style={{ background: 'var(--primary)', width: 14, height: 14, border: '2px solid var(--bg-surface)', left: -7 }} />
      <Handle type="source" position={Position.Right} title="Tirer pour relier" style={{ background: 'var(--primary)', width: 14, height: 14, border: '2px solid var(--bg-surface)', right: -7 }} />
      <div className="gd-drag" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 9px', background: 'var(--primary-glow)', borderBottom: '1px solid var(--border)', cursor: 'grab' }}>
        <span style={{ display: 'flex', color: 'var(--text-muted)', flexShrink: 0 }} title="Glisser pour déplacer">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="8" cy="6" r="1.6" /><circle cx="8" cy="12" r="1.6" /><circle cx="8" cy="18" r="1.6" /><circle cx="15" cy="6" r="1.6" /><circle cx="15" cy="12" r="1.6" /><circle cx="15" cy="18" r="1.6" /></svg>
        </span>
        <input
          className="nodrag"
          value={entity.name}
          onChange={(e) => data.onRename(entity.id, e.target.value)}
          placeholder="NOM_TABLE"
          style={{ flex: 1, border: 'none', background: 'transparent', fontWeight: 700, fontSize: 12.5, color: 'var(--primary-light)', textTransform: 'uppercase', outline: 'none' }}
        />
        <button className="nodrag" onClick={() => data.onDelete(entity.id)} title="Supprimer la table" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, flexShrink: 0, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--accent-red)', cursor: 'pointer', lineHeight: 1, fontSize: 18, fontWeight: 700 }}>×</button>
      </div>
      <div style={{ padding: 6 }}>
        {attrs.map((a) => (
          <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0' }}>
            <button className="nodrag" onClick={() => data.onAttr(a.id, { isPrimaryKey: !a.isPrimaryKey })} title="Basculer clé primaire" style={{ width: 24, flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: a.isPrimaryKey ? 'var(--accent-amber)' : 'var(--text-muted)', fontSize: 11, fontWeight: 700 }}>
              {a.isPrimaryKey ? 'PK' : a.isForeignKey ? 'FK' : '·'}
            </button>
            <input className="nodrag" value={a.name} onChange={(e) => data.onAttr(a.id, { name: e.target.value })} placeholder="colonne" style={{ flex: 1, minWidth: 0, border: '1px solid transparent', background: 'transparent', fontSize: 12.5, color: 'var(--text)', outline: 'none', padding: '2px 4px', borderRadius: 4 }} />
            <select className="nodrag" value={a.type || 'varchar'} onChange={(e) => data.onAttr(a.id, { type: e.target.value })} title="Type SQL" style={{ border: '1px solid var(--border)', background: 'var(--bg-elevated)', fontSize: 12, color: 'var(--text-secondary)', borderRadius: 6, padding: '4px 5px', minWidth: 82, cursor: 'pointer' }}>
              {SQL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <button className="nodrag" onClick={() => data.onDelAttr(a.id)} title="Supprimer la colonne" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, flexShrink: 0, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--accent-red)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
          </div>
        ))}
        <button className="nodrag" onClick={() => data.onAddAttr(entity.id)} style={{ marginTop: 4, width: '100%', background: 'var(--bg-elevated)', border: '1px dashed var(--border)', borderRadius: 6, color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 11, padding: '4px 0' }}>+ colonne</button>
      </div>
    </div>
  );
}

const nodeTypes = { table: TableNode };

export default function VisualEditor({ session }: { session: WorkshopSession }) {
  const { updateSessionData } = useWorkshopStore();
  const rf = useRef<{ fitView: (o?: { padding?: number; duration?: number }) => void } | null>(null);
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

  // Recadrer/centrer à l'entrée en plein écran (et au montage)
  useEffect(() => {
    const t = setTimeout(() => rf.current?.fitView({ padding: 0.2, duration: 300 }), 130);
    return () => clearTimeout(t);
  }, [fullscreen]);

  // Réorganiser les tables proprement en grille, puis recadrer
  const arrange = useCallback(() => {
    const next: Record<string, { x: number; y: number }> = {};
    session.entities.forEach((e, i) => { next[e.id] = { x: 40 + (i % 3) * 360, y: 40 + Math.floor(i / 3) * 340 }; });
    setPositions(next);
    setTimeout(() => rf.current?.fitView({ padding: 0.2, duration: 300 }), 60);
  }, [session.entities]);
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
  const addEntity = () => {
    const id = genId('e');
    const entity: Entity = { id, name: `TABLE_${session.entities.length + 1}`, definition: '', description: '', example: '', responsible: '', type: 'transactional', lifecycle: 'created' };
    setPositions((p) => ({ ...p, [id]: { x: 40 + (session.entities.length % 3) * 340, y: 40 + Math.floor(session.entities.length / 3) * 320 } }));
    updateSessionData({ entities: [...session.entities, entity] });
  };
  const renameEntity = (id: string, name: string) => {
    updateSessionData({
      entities: session.entities.map((e) => (e.id === id ? { ...e, name } : e)),
      relations: session.relations.map((r) => ({
        ...r,
        sourceEntityName: r.sourceEntityId === id ? name : r.sourceEntityName,
        targetEntityName: r.targetEntityId === id ? name : r.targetEntityName,
      })),
    });
  };
  const deleteEntity = (id: string) => {
    const ent = session.entities.find((e) => e.id === id);
    const nm = ent?.name?.toLowerCase();
    updateSessionData({
      entities: session.entities.filter((e) => e.id !== id),
      attributes: session.attributes.filter((a) => a.entityId !== id && a.entityId !== ent?.name),
      // Retirer toute relation touchant cette table (par id OU par nom), sinon la
      // réconciliation la recréerait immédiatement.
      relations: session.relations.filter((r) =>
        r.sourceEntityId !== id && r.targetEntityId !== id &&
        r.sourceEntityName?.toLowerCase() !== nm && r.targetEntityName?.toLowerCase() !== nm
      ),
    });
    setPositions((p) => { const n = { ...p }; delete n[id]; return n; });
  };
  const addAttribute = (entityId: string) => {
    const attr: Attribute = { id: genId('a'), entityId, name: 'nouvelle_colonne', type: 'varchar', description: '', isPrimaryKey: false, isForeignKey: false, isNaturalKey: false, isRequired: false, isSensitive: false, isHistorized: false };
    updateSessionData({ attributes: [...session.attributes, attr] });
  };
  const patchAttribute = (attrId: string, patch: Partial<Attribute>) => {
    updateSessionData({ attributes: session.attributes.map((a) => (a.id === attrId ? { ...a, ...patch } : a)) });
  };
  const deleteAttribute = (attrId: string) => {
    updateSessionData({ attributes: session.attributes.filter((a) => a.id !== attrId) });
  };
  const addRelation = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const s = session.entities.find((e) => e.id === sourceId);
    const t = session.entities.find((e) => e.id === targetId);
    if (!s || !t) return;
    if (session.relations.some((r) => r.sourceEntityId === sourceId && r.targetEntityId === targetId)) return;
    const rel: Relation = { id: genId('r'), sourceEntityId: sourceId, targetEntityId: targetId, sourceEntityName: s.name, targetEntityName: t.name, type: '1:N', isRequired: false, description: '', isHierarchy: false };
    updateSessionData({ relations: [...session.relations, rel] });
  };
  const deleteRelation = (relId: string) => {
    updateSessionData({ relations: session.relations.filter((r) => r.id !== relId) });
  };

  // ---- Construction nodes / edges depuis le modèle ----
  const nodes: Node<TableData>[] = useMemo(() => session.entities.map((e, i) => ({
    id: e.id,
    type: 'table',
    position: positions[e.id] || { x: 40 + (i % 3) * 340, y: 40 + Math.floor(i / 3) * 320 },
    data: { entity: e, attrs: attrsOf(e), onRename: renameEntity, onDelete: deleteEntity, onAddAttr: addAttribute, onAttr: patchAttribute, onDelAttr: deleteAttribute },
  })), [session.entities, session.attributes, positions, attrsOf]); // eslint-disable-line react-hooks/exhaustive-deps

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
          label: r.type,
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

  const containerStyle: React.CSSProperties = fullscreen
    ? { position: 'fixed', inset: 0, zIndex: 300, background: 'var(--bg-surface)' }
    : { flex: 1, position: 'relative' };

  return (
    <div style={containerStyle}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgeClick={(_, e) => setSelectedRel(e.id)}
        onPaneClick={() => setSelectedRel(null)}
        onInit={(inst) => { rf.current = inst as unknown as typeof rf.current; }}
        connectionMode={ConnectionMode.Loose}
        fitView
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ type: 'smoothstep' }}
      >
        <Background gap={18} color="var(--border)" />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable nodeColor="var(--primary)" style={{ background: 'var(--bg-elevated)' }} />
      </ReactFlow>

      <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 5, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="cta-btn" onClick={addEntity} style={{ padding: '8px 14px' }}>+ Table</button>
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

      {/* Panneau d'édition de relation */}
      {selRel && (
        <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 6, width: 250, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow-lg)', padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <strong style={{ fontSize: 13 }}>Relation</strong>
            <button onClick={() => setSelectedRel(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text)', marginBottom: 12 }}>
            <strong>{selRel.sourceEntityName}</strong> <span style={{ color: 'var(--text-muted)' }}>→</span> <strong>{selRel.targetEntityName}</strong>
          </div>
          <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)' }}>Cardinalité</label>
          <select
            value={selRel.type}
            onChange={(e) => updateSessionData({ relations: session.relations.map((r) => r.id === selRel.id ? { ...r, type: e.target.value as Relation['type'] } : r) })}
            style={{ width: '100%', height: 38, marginTop: 5, marginBottom: 10, padding: '0 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-elevated)', color: 'var(--text)', fontSize: 13 }}
          >
            {REL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 14, cursor: 'pointer' }}>
            <input type="checkbox" checked={selRel.isHierarchy} onChange={(e) => updateSessionData({ relations: session.relations.map((r) => r.id === selRel.id ? { ...r, isHierarchy: e.target.checked } : r) })} />
            Hiérarchie
          </label>
          <button onClick={() => { deleteRelation(selRel.id); setSelectedRel(null); }} style={{ width: '100%', background: 'var(--accent-red)', color: '#fff', border: 'none', borderRadius: 9, padding: '9px 0', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Supprimer la relation</button>
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
