'use client';

import { useState, useEffect } from 'react';
import { useWorkshopStore } from '@/lib/store';
import { llmLabel, llmEmoji, fmtTokens, estimateCostUsd } from '@/lib/llm-labels';
import { ConsumptionTab } from './Deliverables';

export default function AdminPanel() {
  const { llmSettings, updateLLMSettings, sessions, sharedInfo } = useWorkshopStore();
  const [consOpen, setConsOpen] = useState<string | null>(null);

  // Consommation IA de MES Data Products (hors produits partagés avec moi)
  const myProducts = sessions.filter((s) => !sharedInfo[s.id]);
  const consList = myProducts
    .map((s) => ({ s, tu: s.tokenUsage || { input: 0, output: 0, total: 0, requests: 0 } }))
    .filter((x) => x.tu.total > 0)
    .sort((a, b) => b.tu.total - a.tu.total);
  const grand = consList.reduce((acc, x) => ({
    input: acc.input + x.tu.input, output: acc.output + x.tu.output, total: acc.total + x.tu.total,
    requests: acc.requests + x.tu.requests, cost: acc.cost + estimateCostUsd(x.s.llmModel, x.tu.input, x.tu.output),
  }), { input: 0, output: 0, total: 0, requests: 0, cost: 0 });

  const [provider, setProvider] = useState(llmSettings.provider);
  const [apiKey, setApiKey] = useState(llmSettings.apiKey);
  const [model, setModel] = useState(llmSettings.model);
  const [customBaseUrl, setCustomBaseUrl] = useState(llmSettings.customBaseUrl || '');
  const [showKey, setShowKey] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Suggested models based on provider
  const modelsByProvider = {
    openai: [
      { value: 'gpt-4o', label: 'GPT-4o (Recommandé)' },
      { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Rapide)' },
      { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
      { value: 'o1-mini', label: 'o1 Mini' },
    ],
    google: [
      { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (Recommandé)' },
      { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro (Avancé)' },
      { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
      { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    ],
    anthropic: [
      { value: 'claude-opus-4-8', label: 'Claude Opus 4.8 (Recommandé)' },
      { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (Équilibré)' },
      { value: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 (Rapide)' },
      { value: 'claude-fable-5', label: 'Claude Fable 5 (Max capacité)' },
    ],
    custom: [
      { value: 'custom-model', label: 'Modèle personnalisé' },
    ],
  };

  // Sync state if store updates externally
  useEffect(() => {
    setProvider(llmSettings.provider);
    setApiKey(llmSettings.apiKey);
    setModel(llmSettings.model);
    setCustomBaseUrl(llmSettings.customBaseUrl || '');
  }, [llmSettings]);

  // Handle provider change to auto-set a valid model
  const handleProviderChange = (newProvider: 'openai' | 'google' | 'anthropic' | 'custom') => {
    setProvider(newProvider);
    if (newProvider === 'openai') {
      setModel('gpt-4o');
    } else if (newProvider === 'google') {
      setModel('gemini-1.5-flash');
    } else if (newProvider === 'anthropic') {
      setModel('claude-opus-4-8');
    } else {
      setModel('');
    }
    setStatusMessage(null);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    if (!apiKey.trim() && provider !== 'custom') {
      setStatusMessage({ type: 'error', text: 'La clé API est requise pour ce fournisseur.' });
      return;
    }

    updateLLMSettings({
      provider,
      apiKey: apiKey.trim(),
      model: model.trim(),
      customBaseUrl: provider === 'custom' ? customBaseUrl.trim() : '',
    });

    setStatusMessage({ type: 'success', text: 'Configuration LLM enregistrée avec succès ! ✓' });

    // Clear success message after 3 seconds
    setTimeout(() => {
      setStatusMessage(null);
    }, 3000);
  };

  return (
    <div style={{ padding: '40px', overflowY: 'auto', flex: 1, maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--primary)', marginBottom: '8px' }}>
          Configuration du modèle d&apos;IA
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: 1.6 }}>
          Configurez ici la connexion au modèle de langage (LLM) de votre choix. Ces paramètres sont enregistrés localement dans votre navigateur et ne transitent que vers les routes d&apos;API de votre instance Mart Studio.
        </p>
      </div>

      <form onSubmit={handleSave} className="context-card" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Provider Selection */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>Fournisseur d&apos;IA</label>
          <select
            value={provider}
            onChange={(e) => handleProviderChange(e.target.value as any)}
            className="chat-input"
            style={{ width: '100%', padding: '12px', height: '48px' }}
          >
            <option value="anthropic">Anthropic (Claude) — recommandé</option>
            <option value="openai">OpenAI (GPT)</option>
            <option value="google">Google Gemini</option>
            <option value="custom">Autre (Compatible OpenAI API, local, etc.)</option>
          </select>
        </div>

        {/* API Key */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>Clé API</label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); setStatusMessage(null); }}
              placeholder={provider === 'openai' ? 'sk-...' : provider === 'google' ? 'AIzaSy...' : provider === 'anthropic' ? 'sk-ant-api03-...' : 'Votre clé API'}
              className="chat-input"
              style={{ width: '100%', paddingRight: '50px' }}
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              style={{
                position: 'absolute', right: '12px', background: 'none', border: 'none',
                cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '18px'
              }}
            >
              {showKey ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {provider === 'openai' && 'Nécessite une clé API valide provenant du tableau de bord de développeur OpenAI.'}
            {provider === 'anthropic' && 'Nécessite une clé API Anthropic (console.anthropic.com → API Keys). Format : sk-ant-api03-…'}
            {provider === 'google' && 'Nécessite une clé API Google AI Studio pour Gemini.'}
            {provider === 'custom' && 'Clé API requise par votre fournisseur personnalisé (laisser vide si non requise).'}
          </span>
        </div>

        {/* Model Selection / Input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>Modèle LLM</label>
          {provider !== 'custom' ? (
            <select
              value={model}
              onChange={(e) => { setModel(e.target.value); setStatusMessage(null); }}
              className="chat-input"
              style={{ width: '100%', padding: '12px', height: '48px' }}
            >
              {modelsByProvider[provider].map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
              <option value="_custom_">Saisir un modèle personnalisé...</option>
            </select>
          ) : null}

          {(provider === 'custom' || model === '_custom_' || !modelsByProvider[provider]?.find(m => m.value === model)) && (
            <input
              type="text"
              value={model === '_custom_' ? '' : model}
              onChange={(e) => { setModel(e.target.value); setStatusMessage(null); }}
              placeholder="Ex: claude-3-5-sonnet-latest, mistral-large, etc."
              className="chat-input"
              style={{ width: '100%', marginTop: provider !== 'custom' ? '8px' : '0px' }}
            />
          )}
        </div>

        {/* Base URL (only shown for Custom) */}
        {provider === 'custom' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', animation: 'fadeSlideUp 0.2s ease' }}>
            <label style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>URL de base de l&apos;API (Base URL)</label>
            <input
              type="text"
              value={customBaseUrl}
              onChange={(e) => { setCustomBaseUrl(e.target.value); setStatusMessage(null); }}
              placeholder="Ex: http://localhost:11434/v1 ou https://openrouter.ai/api/v1"
              className="chat-input"
              style={{ width: '100%' }}
            />
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              L&apos;URL de point d&apos;accès compatible avec les spécifications de l&apos;API OpenAI.
            </span>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '12px' }}>
          <button type="submit" className="cta-btn" style={{ padding: '12px 32px' }}>
            💾 Sauvegarder la configuration
          </button>
          
          {statusMessage && (
            <div
              style={{
                fontSize: '14px',
                fontWeight: 500,
                color: statusMessage.type === 'success' ? '#00664F' : 'var(--accent-red)',
                animation: 'fadeIn 0.2s ease'
              }}
            >
              {statusMessage.text}
            </div>
          )}
        </div>

      </form>

      {/* ── Consommation IA de mes Data Products ── */}
      <div style={{ marginTop: 40 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>Consommation IA</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 18 }}>
          Tokens consommés pour construire vos Data Products avec Marty.
        </p>

        {consList.length === 0 ? (
          <div style={{ background: 'var(--bg-surface)', border: '1px dashed var(--border)', borderRadius: 12, padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
            Aucune consommation pour l’instant. Échangez avec Marty : les tokens apparaîtront ici.
          </div>
        ) : (
          <>
            {/* Totaux */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 16 }}>
              {[
                { l: 'Total tokens', v: fmtTokens(grand.total), c: '#059669' },
                { l: 'Entrée', v: fmtTokens(grand.input), c: '#2563EB' },
                { l: 'Sortie', v: fmtTokens(grand.output), c: '#7C3AED' },
                { l: 'Échanges', v: String(grand.requests), c: '#D97706' },
                { l: 'Coût estimé', v: `$${grand.cost.toFixed(4)}`, c: '#0D9488' },
              ].map((k) => (
                <div key={k.l} style={{ position: 'relative', overflow: 'hidden', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: k.c }} />
                  <div style={{ fontSize: 22, fontWeight: 800, color: k.c, letterSpacing: -0.3 }}>{k.v}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{k.l}</div>
                </div>
              ))}
            </div>

            {/* Par produit */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {consList.map(({ s, tu }) => (
                <div key={s.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                  <div onClick={() => setConsOpen(consOpen === s.id ? null : s.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', cursor: 'pointer', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{s.productName || 'Data Product'}</div>
                      {s.llmModel && <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{llmEmoji(s.llmProvider)} {llmLabel(s.llmProvider, s.llmModel)}</div>}
                    </div>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--primary-light)', background: 'var(--primary-glow)', border: '1px solid var(--border-active)', borderRadius: 999, padding: '3px 10px', whiteSpace: 'nowrap' }}>▦ {fmtTokens(tu.total)} tokens</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{tu.requests} échanges · ${estimateCostUsd(s.llmModel, tu.input, tu.output).toFixed(4)}</span>
                    <span style={{ color: 'var(--text-muted)', transition: 'transform .2s', transform: consOpen === s.id ? 'rotate(90deg)' : 'none' }}>›</span>
                  </div>
                  {consOpen === s.id && (
                    <div style={{ borderTop: '1px solid var(--border)', padding: 16, background: 'var(--bg-elevated)' }}>
                      <ConsumptionTab session={s} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
