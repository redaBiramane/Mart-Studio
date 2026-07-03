'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow, Background, Controls, MiniMap, Handle, Position, MarkerType,
  type Node, type Edge, type NodeProps, type Connection, type NodeChange, type EdgeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useWorkshopStore } from '@/lib/store';
import type { WorkshopSession, Entity, Attribute, Relation } from '@/lib/types';

const SQL_TYPES = ['bigint', 'int', 'varchar', 'text', 'decimal', 'numeric', 'date', 'timestamp', 'boolean', 'uuid'];
const REL_TYPES: Relation['type'][] = ['1:N', 'N:1', '1:1', 'N:N'];

function genId(p: string) { return `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; }

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
    <div style={{ minWidth: 220, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow-md)', overflow: 'hidden', fontSize: 12 }}>
      <Handle type="target" position={Position.Left} style={{ background: 'var(--primary)', width: 9, height: 9 }} />
      <Handle type="source" position={Position.Right} style={{ background: 'var(--primary)', width: 9, height: 9 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 9px', background: 'var(--primary-glow)', borderBottom: '1px solid var(--border)' }}>
        <input
          className="nodrag"
          value={entity.name}
          onChange={(e) => data.onRename(entity.id, e.target.value)}
          placeholder="NOM_TABLE"
          style={{ flex: 1, border: 'none', background: 'transparent', fontWeight: 700, fontSize: 12.5, color: 'var(--primary-light)', textTransform: 'uppercase', outline: 'none' }}
        />
        <button className="nodrag" onClick={() => data.onDelete(entity.id)} title="Supprimer la table" style={{ background: 'none', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', lineHeight: 1, fontSize: 14 }}>×</button>
      </div>
      <div style={{ padding: 6 }}>
        {attrs.map((a) => (
          <div key={a.id} className="nodrag" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 0' }}>
            <button onClick={() => data.onAttr(a.id, { isPrimaryKey: !a.isPrimaryKey })} title="Clé primaire" style={{ width: 20, flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: a.isPrimaryKey ? 'var(--accent-amber)' : 'var(--text-muted)', fontSize: 11, fontWeight: 700 }}>
              {a.isPrimaryKey ? 'PK' : a.isForeignKey ? 'FK' : '·'}
            </button>
            <input value={a.name} onChange={(e) => data.onAttr(a.id, { name: e.target.value })} placeholder="colonne" style={{ flex: 1, minWidth: 0, border: '1px solid transparent', background: 'transparent', fontSize: 11.5, color: 'var(--text)', outline: 'none', padding: '1px 3px', borderRadius: 4 }} />
            <select value={a.type || 'varchar'} onChange={(e) => data.onAttr(a.id, { type: e.target.value })} style={{ border: '1px solid var(--border)', background: 'var(--bg-elevated)', fontSize: 10.5, color: 'var(--text-secondary)', borderRadius: 4, padding: '1px 2px' }}>
              {SQL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <button onClick={() => data.onDelAttr(a.id)} title="Supprimer" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12 }}>×</button>
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
  const posKey = `mart-erd-pos-${session.id}`;
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>(() => {
    if (typeof window === 'undefined') return {};
    try { return JSON.parse(localStorage.getItem(posKey) || '{}'); } catch { return {}; }
  });

  useEffect(() => {
    try { localStorage.setItem(posKey, JSON.stringify(positions)); } catch { /* ignore */ }
  }, [positions, posKey]);

  const attrsOf = useCallback(
    (e: Entity) => session.attributes.filter((a) => a.entityId === e.id || a.entityId === e.name),
    [session.attributes]
  );

  // ---- Mutations (écrivent dans le store → lues par le chatbot) ----
  const addEntity = () => {
    const id = genId('e');
    const entity: Entity = { id, name: `TABLE_${session.entities.length + 1}`, definition: '', description: '', example: '', responsible: '', type: 'transactional', lifecycle: 'created' };
    setPositions((p) => ({ ...p, [id]: { x: 60 + (session.entities.length % 4) * 260, y: 60 + Math.floor(session.entities.length / 4) * 220 } }));
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
    updateSessionData({
      entities: session.entities.filter((e) => e.id !== id),
      attributes: session.attributes.filter((a) => a.entityId !== id && a.entityId !== ent?.name),
      relations: session.relations.filter((r) => r.sourceEntityId !== id && r.targetEntityId !== id),
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
  const cycleRelation = (relId: string) => {
    updateSessionData({
      relations: session.relations.map((r) => r.id === relId ? { ...r, type: REL_TYPES[(REL_TYPES.indexOf(r.type) + 1) % REL_TYPES.length] } : r),
    });
  };
  const deleteRelation = (relId: string) => {
    updateSessionData({ relations: session.relations.filter((r) => r.id !== relId) });
  };

  // ---- Construction nodes / edges depuis le modèle ----
  const nodes: Node<TableData>[] = useMemo(() => session.entities.map((e, i) => ({
    id: e.id,
    type: 'table',
    position: positions[e.id] || { x: 60 + (i % 4) * 260, y: 60 + Math.floor(i / 4) * 220 },
    data: { entity: e, attrs: attrsOf(e), onRename: renameEntity, onDelete: deleteEntity, onAddAttr: addAttribute, onAttr: patchAttribute, onDelAttr: deleteAttribute },
  })), [session.entities, session.attributes, positions, attrsOf]); // eslint-disable-line react-hooks/exhaustive-deps

  const edges: Edge[] = useMemo(() => session.relations.map((r) => ({
    id: r.id,
    source: r.sourceEntityId,
    target: r.targetEntityId,
    label: r.type,
    labelStyle: { fontSize: 11, fontWeight: 700, fill: 'var(--primary)' },
    labelBgStyle: { fill: 'var(--bg-surface)' },
    style: { stroke: 'var(--primary)', strokeWidth: 1.6 },
    markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--primary)' },
  })), [session.relations]);

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

  return (
    <div style={{ flex: 1, position: 'relative' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgeClick={(_, e) => cycleRelation(e.id)}
        fitView
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ type: 'smoothstep' }}
      >
        <Background gap={18} color="var(--border)" />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable nodeColor="var(--primary)" style={{ background: 'var(--bg-elevated)' }} />
      </ReactFlow>

      <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 5, display: 'flex', gap: 8 }}>
        <button className="cta-btn" onClick={addEntity} style={{ padding: '8px 14px' }}>+ Table</button>
      </div>
      <div style={{ position: 'absolute', bottom: 12, left: 12, zIndex: 5, fontSize: 11.5, color: 'var(--text-muted)', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', maxWidth: 320 }}>
        Tirez d&apos;une table à l&apos;autre pour créer une relation · cliquez une relation pour changer sa cardinalité · Suppr. pour l&apos;effacer. Marty lit ce schéma en temps réel.
      </div>
    </div>
  );
}
