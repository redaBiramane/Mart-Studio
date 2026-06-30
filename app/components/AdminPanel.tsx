'use client';

import { useState, useEffect } from 'react';
import { useWorkshopStore } from '@/lib/store';

export default function AdminPanel() {
  const { llmSettings, updateLLMSettings } = useWorkshopStore();

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
            <option value="openai">OpenAI (GPT)</option>
            <option value="anthropic">Anthropic (Claude)</option>
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
    </div>
  );
}
