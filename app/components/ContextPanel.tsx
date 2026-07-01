'use client';

import { useState } from 'react';
import { useWorkshopStore } from '@/lib/store';
import { WorkshopSession, Entity, Relation, Attribute, KPI, BusinessRule, DataSource } from '@/lib/types';

interface ContextPanelProps {
  session: WorkshopSession;
  onClose: () => void;
}

type DetailKey = 'product' | 'context' | 'entities' | 'relations' | 'attributes' | 'kpis' | 'rules' | 'sources' | null;

function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export default function ContextPanel({ session, onClose }: ContextPanelProps) {
  const [detail, setDetail] = useState<DetailKey>(null);

  const clickHint = <span style={{ float: 'right', fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>modifier ›</span>;
  const cardStyle: React.CSSProperties = { cursor: 'pointer' };

  return (
    <div className="context-panel slide-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
          Données collectées
        </span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16 }}>✕</button>
      </div>

      <div className="context-card" style={cardStyle} onClick={() => setDetail('product')}>
        <div className="context-card-title">🎯 Produit {clickHint}</div>
        <div className="context-card-content">
          <strong>{session.productName || 'À définir'}</strong>
          {session.domain && <div style={{ marginTop: 4 }}>Domaine: {session.domain}</div>}
          {session.productOwner && <div>PO: {session.productOwner}</div>}
          {session.dataSteward && <div>Data Steward: {session.dataSteward}</div>}
        </div>
      </div>

      <div className="context-card" style={cardStyle} onClick={() => setDetail('context')}>
        <div className="context-card-title">📝 Contexte {clickHint}</div>
        <div className="context-card-content">{session.contextSummary || 'Cliquez pour ajouter un contexte.'}</div>
      </div>

      <div className="context-card" style={cardStyle} onClick={() => setDetail('entities')}>
        <div className="context-card-title">🧩 Entités ({session.entities.length}) {clickHint}</div>
        <div className="context-card-content">
          {session.entities.map(e => <span key={e.id} className="context-tag">{e.name}</span>)}
          {session.entities.length === 0 && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Aucune — cliquez pour ajouter.</span>}
        </div>
      </div>

      <div className="context-card" style={cardStyle} onClick={() => setDetail('relations')}>
        <div className="context-card-title">🔗 Relations ({session.relations.length}) {clickHint}</div>
        <div className="context-card-content">
          {session.relations.slice(0, 6).map(r => (
            <div key={r.id} style={{ fontSize: 12, marginBottom: 4 }}>{r.sourceEntityName} → {r.targetEntityName} ({r.type})</div>
          ))}
          {session.relations.length > 6 && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>+{session.relations.length - 6} autres</span>}
        </div>
      </div>

      <div className="context-card" style={cardStyle} onClick={() => setDetail('attributes')}>
        <div className="context-card-title">📋 Attributs ({session.attributes.length}) {clickHint}</div>
        <div className="context-card-content">
          {session.attributes.slice(0, 10).map(a => (
            <span key={a.id} className="context-tag">{a.name} {a.isPrimaryKey ? '🔑' : ''}</span>
          ))}
          {session.attributes.length > 10 && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}> +{session.attributes.length - 10} autres</span>}
        </div>
      </div>

      <div className="context-card" style={cardStyle} onClick={() => setDetail('kpis')}>
        <div className="context-card-title">📊 KPIs ({session.kpis.length}) {clickHint}</div>
        <div className="context-card-content">
          {session.kpis.map(k => <span key={k.id} className="context-tag">{k.name}</span>)}
          {session.kpis.length === 0 && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Aucun — cliquez pour ajouter.</span>}
        </div>
      </div>

      <div className="context-card" style={cardStyle} onClick={() => setDetail('rules')}>
        <div className="context-card-title">⚖️ Règles métier ({session.businessRules.length}) {clickHint}</div>
        <div className="context-card-content">
          {session.businessRules.map(r => <span key={r.id} className="context-tag">{r.name}</span>)}
          {session.businessRules.length === 0 && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Aucune — cliquez pour ajouter.</span>}
        </div>
      </div>

      <div className="context-card" style={cardStyle} onClick={() => setDetail('sources')}>
        <div className="context-card-title">🗄️ Sources ({session.dataSources.length}) {clickHint}</div>
        <div className="context-card-content">
          {session.dataSources.map(s => <span key={s.id} className="context-tag">{s.name}</span>)}
          {session.dataSources.length === 0 && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Aucune — cliquez pour ajouter.</span>}
        </div>
      </div>

      {session.maturityScores && (
        <div className="context-card">
          <div className="context-card-title">🏁 Score de maturité</div>
          <div className="context-card-content">
            {Object.entries(session.maturityScores).map(([key, value]) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                <span>{key}</span>
                <span style={{ fontWeight: 700, color: value >= 70 ? 'var(--accent-emerald)' : value >= 40 ? 'var(--accent-amber)' : 'var(--accent-red)' }}>{value}/100</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {detail && <EditModal session={session} detail={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

// ---- Éditeur ------------------------------------------------------------

const inp: React.CSSProperties = {
  width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8,
  fontSize: 13, background: 'var(--bg-input)', color: 'var(--text)', fontFamily: 'inherit',
};
const rowBox: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginBottom: 10, background: 'var(--bg-elevated)' };
const delBtn: React.CSSProperties = { background: 'none', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', fontSize: 13, fontWeight: 600 };

function EditModal({ session, detail, onClose }: { session: WorkshopSession; detail: Exclude<DetailKey, null>; onClose: () => void }) {
  const { updateSessionData } = useWorkshopStore();
  const titles: Record<string, string> = {
    product: '🎯 Produit', context: '📝 Contexte', entities: '🧩 Entités', relations: '🔗 Relations',
    attributes: '📋 Attributs', kpis: '📊 KPIs', rules: '⚖️ Règles métier', sources: '🗄️ Sources de données',
  };

  // Helpers génériques sur les tableaux (persistés via updateSessionData -> DB)
  function setArr<K extends keyof WorkshopSession>(key: K, arr: WorkshopSession[K]) {
    updateSessionData({ [key]: arr } as Partial<WorkshopSession>);
  }
  const patch = <T extends { id: string }>(key: keyof WorkshopSession, id: string, p: Partial<T>) => {
    const arr = (session[key] as unknown as T[]).map((x) => (x.id === id ? { ...x, ...p } : x));
    setArr(key, arr as never);
  };
  const remove = (key: keyof WorkshopSession, id: string) => {
    const arr = (session[key] as unknown as { id: string }[]).filter((x) => x.id !== id);
    setArr(key, arr as never);
  };
  const add = (key: keyof WorkshopSession, item: unknown) => {
    setArr(key, [...(session[key] as unknown as unknown[]), item] as never);
  };

  const addBtnStyle: React.CSSProperties = { marginTop: 4, padding: '8px 14px', border: '1px dashed var(--border-active)', borderRadius: 8, background: 'var(--primary-glow)', color: 'var(--primary-light)', cursor: 'pointer', fontSize: 13, fontWeight: 600, width: '100%' };
  const label = (t: string) => <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', margin: '8px 0 3px' }}>{t}</div>;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', width: 'min(680px, 100%)', maxHeight: '85vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}>
        <div style={{ position: 'sticky', top: 0, background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 16, margin: 0 }}>Modifier — {titles[detail]}</h3>
          <button onClick={onClose} className="cta-btn" style={{ padding: '6px 14px', fontSize: 13 }}>✓ Terminé</button>
        </div>
        <div style={{ padding: 20 }}>

          {detail === 'product' && (
            <>
              {label('Nom du produit')}
              <input style={inp} value={session.productName} onChange={(e) => updateSessionData({ productName: e.target.value })} />
              {label('Domaine')}
              <input style={inp} value={session.domain} onChange={(e) => updateSessionData({ domain: e.target.value })} />
              {label('Objectif')}
              <input style={inp} value={session.objective} onChange={(e) => updateSessionData({ objective: e.target.value })} />
              {label('Product Owner')}
              <input style={inp} value={session.productOwner} onChange={(e) => updateSessionData({ productOwner: e.target.value })} />
              {label('Data Steward')}
              <input style={inp} value={session.dataSteward} onChange={(e) => updateSessionData({ dataSteward: e.target.value })} />
            </>
          )}

          {detail === 'context' && (
            <>
              {label('Problème métier')}
              <textarea style={{ ...inp, minHeight: 60 }} value={session.businessProblem} onChange={(e) => updateSessionData({ businessProblem: e.target.value })} />
              {label('Résumé du contexte')}
              <textarea style={{ ...inp, minHeight: 120 }} value={session.contextSummary} onChange={(e) => updateSessionData({ contextSummary: e.target.value })} />
            </>
          )}

          {detail === 'entities' && (
            <>
              {session.entities.map((e: Entity) => (
                <div key={e.id} style={rowBox}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input style={inp} placeholder="Nom" value={e.name} onChange={(ev) => patch<Entity>('entities', e.id, { name: ev.target.value })} />
                    <select style={{ ...inp, width: 130 }} value={e.type} onChange={(ev) => patch<Entity>('entities', e.id, { type: ev.target.value as Entity['type'] })}>
                      <option value="transactional">Fait</option>
                      <option value="reference">Dimension</option>
                      <option value="event">Événement</option>
                      <option value="aggregate">Agrégat</option>
                    </select>
                  </div>
                  <input style={{ ...inp, marginTop: 6 }} placeholder="Définition" value={e.definition} onChange={(ev) => patch<Entity>('entities', e.id, { definition: ev.target.value })} />
                  <div style={{ textAlign: 'right', marginTop: 6 }}><button style={delBtn} onClick={() => remove('entities', e.id)}>🗑 Supprimer</button></div>
                </div>
              ))}
              <button style={addBtnStyle} onClick={() => add('entities', { id: genId('entity'), name: 'NouvelleEntite', definition: '', description: '', example: '', responsible: '', type: 'reference', lifecycle: 'created' })}>+ Ajouter une entité</button>
            </>
          )}

          {detail === 'relations' && (
            <>
              {session.relations.map((r: Relation) => (
                <div key={r.id} style={rowBox}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input style={inp} placeholder="Source" value={r.sourceEntityName} onChange={(ev) => patch<Relation>('relations', r.id, { sourceEntityName: ev.target.value })} />
                    <span style={{ color: 'var(--text-muted)' }}>→</span>
                    <input style={inp} placeholder="Cible" value={r.targetEntityName} onChange={(ev) => patch<Relation>('relations', r.id, { targetEntityName: ev.target.value })} />
                    <select style={{ ...inp, width: 90 }} value={r.type} onChange={(ev) => patch<Relation>('relations', r.id, { type: ev.target.value as Relation['type'] })}>
                      <option>1:1</option><option>1:N</option><option>N:1</option><option>N:N</option>
                    </select>
                  </div>
                  <input style={{ ...inp, marginTop: 6 }} placeholder="Description" value={r.description} onChange={(ev) => patch<Relation>('relations', r.id, { description: ev.target.value })} />
                  <div style={{ textAlign: 'right', marginTop: 6 }}><button style={delBtn} onClick={() => remove('relations', r.id)}>🗑 Supprimer</button></div>
                </div>
              ))}
              <button style={addBtnStyle} onClick={() => add('relations', { id: genId('rel'), sourceEntityId: '', targetEntityId: '', sourceEntityName: '', targetEntityName: '', type: '1:N', isRequired: true, description: '', isHierarchy: false })}>+ Ajouter une relation</button>
            </>
          )}

          {detail === 'attributes' && (
            <>
              {session.entities.map((entity) => {
                const attrs = session.attributes.filter((a) => a.entityId === entity.id || a.entityId === entity.name);
                return (
                  <div key={entity.id} style={{ marginBottom: 16 }}>
                    <div style={{ fontWeight: 700, color: 'var(--primary-light)', marginBottom: 6 }}>{entity.name}</div>
                    {attrs.map((a: Attribute) => (
                      <div key={a.id} style={{ ...rowBox, marginBottom: 8 }}>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input style={inp} placeholder="Nom colonne" value={a.name} onChange={(ev) => patch<Attribute>('attributes', a.id, { name: ev.target.value })} />
                          <input style={{ ...inp, width: 110 }} placeholder="Type" value={a.type} onChange={(ev) => patch<Attribute>('attributes', a.id, { type: ev.target.value })} />
                        </div>
                        <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: 6, fontSize: 12 }}>
                          <label style={{ display: 'flex', gap: 4, alignItems: 'center', cursor: 'pointer' }}><input type="checkbox" checked={a.isPrimaryKey} onChange={(ev) => patch<Attribute>('attributes', a.id, { isPrimaryKey: ev.target.checked })} /> PK</label>
                          <label style={{ display: 'flex', gap: 4, alignItems: 'center', cursor: 'pointer' }}><input type="checkbox" checked={a.isForeignKey} onChange={(ev) => patch<Attribute>('attributes', a.id, { isForeignKey: ev.target.checked })} /> FK</label>
                          <label style={{ display: 'flex', gap: 4, alignItems: 'center', cursor: 'pointer' }}><input type="checkbox" checked={a.isSensitive} onChange={(ev) => patch<Attribute>('attributes', a.id, { isSensitive: ev.target.checked })} /> Sensible</label>
                          <button style={{ ...delBtn, marginLeft: 'auto' }} onClick={() => remove('attributes', a.id)}>🗑</button>
                        </div>
                      </div>
                    ))}
                    <button style={{ ...addBtnStyle, padding: '6px 12px' }} onClick={() => add('attributes', { id: genId('attr'), entityId: entity.id, name: 'colonne', type: 'VARCHAR', description: '', isPrimaryKey: false, isForeignKey: false, isNaturalKey: false, isRequired: true, isSensitive: false, isHistorized: false })}>+ Ajouter une colonne à {entity.name}</button>
                  </div>
                );
              })}
            </>
          )}

          {detail === 'kpis' && (
            <>
              {session.kpis.map((k: KPI) => (
                <div key={k.id} style={rowBox}>
                  <input style={inp} placeholder="Nom du KPI" value={k.name} onChange={(ev) => patch<KPI>('kpis', k.id, { name: ev.target.value })} />
                  <input style={{ ...inp, marginTop: 6 }} placeholder="Formule" value={k.formula} onChange={(ev) => patch<KPI>('kpis', k.id, { formula: ev.target.value })} />
                  <input style={{ ...inp, marginTop: 6 }} placeholder="Description" value={k.description} onChange={(ev) => patch<KPI>('kpis', k.id, { description: ev.target.value })} />
                  <div style={{ textAlign: 'right', marginTop: 6 }}><button style={delBtn} onClick={() => remove('kpis', k.id)}>🗑 Supprimer</button></div>
                </div>
              ))}
              <button style={addBtnStyle} onClick={() => add('kpis', { id: genId('kpi'), name: 'Nouveau KPI', formula: '', frequency: '', aggregationLevels: [], filters: [], analysisAxes: [], description: '' })}>+ Ajouter un KPI</button>
            </>
          )}

          {detail === 'rules' && (
            <>
              {session.businessRules.map((r: BusinessRule) => (
                <div key={r.id} style={rowBox}>
                  <input style={inp} placeholder="Nom de la règle" value={r.name} onChange={(ev) => patch<BusinessRule>('businessRules', r.id, { name: ev.target.value })} />
                  <input style={{ ...inp, marginTop: 6 }} placeholder="Description" value={r.description} onChange={(ev) => patch<BusinessRule>('businessRules', r.id, { description: ev.target.value })} />
                  <div style={{ textAlign: 'right', marginTop: 6 }}><button style={delBtn} onClick={() => remove('businessRules', r.id)}>🗑 Supprimer</button></div>
                </div>
              ))}
              <button style={addBtnStyle} onClick={() => add('businessRules', { id: genId('rule'), name: 'Nouvelle règle', description: '', type: 'validation', entities: [], expression: '' })}>+ Ajouter une règle</button>
            </>
          )}

          {detail === 'sources' && (
            <>
              {session.dataSources.map((s: DataSource) => (
                <div key={s.id} style={rowBox}>
                  <input style={inp} placeholder="Nom de la source" value={s.name} onChange={(ev) => patch<DataSource>('dataSources', s.id, { name: ev.target.value })} />
                  <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                    <input style={inp} placeholder="Système" value={s.system} onChange={(ev) => patch<DataSource>('dataSources', s.id, { system: ev.target.value })} />
                    <select style={inp} value={s.loadFrequency} onChange={(ev) => patch<DataSource>('dataSources', s.id, { loadFrequency: ev.target.value })}>
                      <option value="">Fréquence…</option>
                      <optgroup label="Temps réel">
                        <option value="Temps réel">Temps réel</option>
                        <option value="Quasi temps réel">Quasi temps réel</option>
                        <option value="Micro-batch">Micro-batch</option>
                      </optgroup>
                      <optgroup label="Périodique">
                        <option value="Horaire">Horaire</option>
                        <option value="Quotidienne">Quotidienne</option>
                        <option value="Hebdomadaire">Hebdomadaire</option>
                        <option value="Mensuelle">Mensuelle</option>
                        <option value="Trimestrielle">Trimestrielle</option>
                        <option value="Annuelle">Annuelle</option>
                      </optgroup>
                      <optgroup label="À la demande">
                        <option value="À la demande">À la demande</option>
                        <option value="Manuelle">Manuelle</option>
                        <option value="Chargement initial">Chargement initial (one-shot)</option>
                      </optgroup>
                    </select>
                  </div>
                  <div style={{ textAlign: 'right', marginTop: 6 }}><button style={delBtn} onClick={() => remove('dataSources', s.id)}>🗑 Supprimer</button></div>
                </div>
              ))}
              <button style={addBtnStyle} onClick={() => add('dataSources', { id: genId('src'), name: 'Nouvelle source', system: '', type: 'database', isReliable: true, isReference: false, isHistorized: false, loadFrequency: '', entities: [], description: '' })}>+ Ajouter une source</button>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
