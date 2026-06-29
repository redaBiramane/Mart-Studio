'use client';

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useWorkshopStore } from '@/lib/store';
import { STEPS } from '@/lib/constants';
import StepSidebar from '@/app/components/StepSidebar';
import ContextPanel from '@/app/components/ContextPanel';

export default function Workshop() {
  const { session, setCurrentStep, addMessage, updateSessionData, completeSession, setCurrentPage } = useWorkshopStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showContext, setShowContext] = useState(true);
  const [input, setInput] = useState('');
  const hasInitialized = useRef(false);

  const currentStep = session?.currentStep || 1;
  const stepDef = STEPS[currentStep - 1];

  const getMessageText = useCallback((message: any) => {
    if (!message || !message.parts) return '';
    return message.parts
      .filter((p: any) => p.type === 'text')
      .map((p: any) => p.text)
      .join('');
  }, []);

  // Create transport that dynamically fetches latest session data from the store
  const transport = useMemo(() => new DefaultChatTransport({
    api: '/api/chat',
    body: () => {
      const currentSession = useWorkshopStore.getState().session;
      const llmSettings = useWorkshopStore.getState().llmSettings;
      return {
        currentStep: currentSession?.currentStep || 1,
        llmSettings,
        sessionData: currentSession ? {
          productName: currentSession.productName,
          contextSummary: currentSession.contextSummary,
          entities: currentSession.entities,
          granularity: currentSession.granularity,
          relations: currentSession.relations,
          attributes: currentSession.attributes,
          kpis: currentSession.kpis,
        } : undefined,
      };
    },
  }), []);

  const { messages, setMessages, status, sendMessage } = useChat({
    transport,
    onFinish: ({ message }) => {
      if (session) {
        const text = getMessageText(message);
        addMessage({
          id: message.id,
          role: 'assistant',
          content: text,
          timestamp: Date.now(),
          step: currentStep,
        });
        extractData(text);
      }
    },
  });

  const isLoading = status === 'submitted' || status === 'streaming';

  // Initialize with a welcome message when session starts
  useEffect(() => {
    if (session && messages.length === 0 && !hasInitialized.current) {
      hasInitialized.current = true;
      // Restore previous messages
      const savedMessages = session.messages.filter(m => m.step === currentStep);
      if (savedMessages.length > 0) {
        setMessages(savedMessages.map(m => ({
          id: m.id,
          role: m.role as 'user' | 'assistant' | 'system',
          parts: [{ type: 'text', text: m.content }],
        })));
      } else {
        // Trigger initial AI message
        sendMessage({ text: `[SYSTÈME] Démarre l'étape ${currentStep} sur 5 : "${stepDef.title}". ${currentStep === 1 ? 'Présente-toi en une phrase, puis' : 'Sans te re-présenter,'} affiche directement les questions de cette étape en une seule fois.` });
      }
    }
  }, [session, currentStep]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  const handleTextareaInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }, []);

  // Extract structured data from AI responses
  function extractData(content: string) {
    const jsonRegex = /```json(?::extract)?\n([\s\S]*?)\n```/g;
    let match;
    while ((match = jsonRegex.exec(content)) !== null) {
      try {
        const parsed = JSON.parse(match[1]);
        processExtraction(parsed);
      } catch { /* skip invalid JSON */ }
    }
  }

  function processExtraction(extraction: { type: string; data: Record<string, unknown> }) {
    // Read the LATEST session state from the store, not the stale React closure.
    // This is critical: when one AI message emits several extract blocks, each call
    // must build on the result of the previous one — otherwise only the last block
    // of each type survives (e.g. 6 entities collapse into 1).
    const session = useWorkshopStore.getState().session;
    if (!session) return;
    const { type, data } = extraction;

    switch (type) {
      case 'context':
        updateSessionData({
          productName: (data.productName as string) || session.productName,
          businessProblem: (data.businessProblem as string) || session.businessProblem,
          objective: (data.objective as string) || session.objective,
          domain: (data.domain as string) || session.domain,
          productOwner: (data.productOwner as string) || session.productOwner,
          dataSteward: (data.dataSteward as string) || session.dataSteward,
          contextSummary: (data.summary as string) || session.contextSummary,
        });
        break;
      case 'entity':
        if (data.name) {
          const existing = session.entities.find(e => e.name === data.name);
          if (!existing) {
            updateSessionData({
              entities: [...session.entities, {
                id: `entity_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
                name: data.name as string,
                definition: (data.definition as string) || '',
                description: (data.description as string) || '',
                example: (data.example as string) || '',
                responsible: (data.responsible as string) || '',
                type: (data.type as 'transactional' | 'reference' | 'event' | 'aggregate') || 'transactional',
                lifecycle: (data.lifecycle as 'created' | 'evolving' | 'archived') || 'created',
              }],
            });
          }
        }
        break;
      case 'granularity':
        updateSessionData({
          granularity: {
            observationUnit: (data.observationUnit as string) || '',
            lineRepresents: (data.lineRepresents as string) || '',
            detailLevel: (data.detailLevel as string) || '',
            multipleLinesPerObject: (data.multipleLinesPerObject as boolean) ?? false,
            temporality: (data.temporality as 'daily' | 'monthly' | 'transactional' | 'snapshot' | 'other') || 'transactional',
            isHistorized: (data.isHistorized as boolean) ?? false,
            description: (data.description as string) || '',
          }
        });
        break;
      case 'relation':
        if (data.source && data.target) {
          updateSessionData({
            relations: [...session.relations, {
              id: `rel_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
              sourceEntityId: (data.sourceId as string) || '',
              targetEntityId: (data.targetId as string) || '',
              sourceEntityName: data.source as string,
              targetEntityName: data.target as string,
              type: (data.cardinality as '1:1' | '1:N' | 'N:1' | 'N:N') || '1:N',
              isRequired: (data.required as boolean) ?? true,
              description: (data.description as string) || '',
              isHierarchy: (data.hierarchy as boolean) ?? false,
            }],
          });
        }
        break;
      case 'attribute':
        if (data.name && (data.entityId || data.entityName)) {
          // If entityName is given, try to find matching entity ID
          let targetEntityId = (data.entityId as string) || '';
          if (!targetEntityId && data.entityName) {
            const found = session.entities.find(e => e.name.toLowerCase() === (data.entityName as string).toLowerCase());
            if (found) targetEntityId = found.id;
          }
          // Skip duplicates: same entity + same normalized column name (handles
          // snake_case vs camelCase and the step 2 / step 4 overlap).
          const normName = (data.name as string).replace(/[^a-z0-9]/gi, '').toLowerCase();
          const entityKeys = [targetEntityId, (data.entityName as string) || ''].filter(Boolean).map(k => k.toLowerCase());
          const isDuplicate = session.attributes.some(a => {
            const sameName = a.name.replace(/[^a-z0-9]/gi, '').toLowerCase() === normName;
            const sameEntity = entityKeys.includes((a.entityId || '').toLowerCase());
            return sameName && (sameEntity || entityKeys.length === 0);
          });
          if (isDuplicate) break;
          updateSessionData({
            attributes: [...session.attributes, {
              id: `attr_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
              entityId: targetEntityId,
              name: data.name as string,
              type: (data.type as string) || 'VARCHAR',
              description: (data.description as string) || '',
              isPrimaryKey: (data.isPK as boolean) ?? false,
              isForeignKey: (data.isFK as boolean) ?? false,
              isNaturalKey: (data.isNaturalKey as boolean) ?? false,
              isRequired: (data.required as boolean) ?? true,
              isSensitive: (data.sensitive as boolean) ?? false,
              isHistorized: (data.historized as boolean) ?? false,
            }],
          });
        }
        break;
      case 'kpi':
        if (data.name) {
          const existing = session.kpis.find(k => k.name === data.name);
          if (!existing) {
            updateSessionData({
              kpis: [...session.kpis, {
                id: `kpi_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
                name: data.name as string,
                formula: (data.formula as string) || '',
                frequency: (data.frequency as string) || '',
                aggregationLevels: (data.aggregationLevels as string[]) || [],
                filters: (data.filters as string[]) || [],
                analysisAxes: (data.analysisAxes as string[]) || [],
                description: (data.description as string) || '',
              }]
            });
          }
        }
        break;
      case 'rule':
        if (data.name) {
          const existing = session.businessRules.find(r => r.name === data.name);
          if (!existing) {
            updateSessionData({
              businessRules: [...session.businessRules, {
                id: `rule_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
                name: data.name as string,
                description: (data.description as string) || '',
                type: (data.type as any) || 'validation',
                entities: (data.entities as string[]) || [],
                expression: (data.expression as string) || '',
              }]
            });
          }
        }
        break;
      case 'source':
        if (data.name) {
          const existing = session.dataSources.find(s => s.name === data.name);
          if (!existing) {
            updateSessionData({
              dataSources: [...session.dataSources, {
                id: `src_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
                name: data.name as string,
                system: (data.system as string) || '',
                type: (data.type as any) || 'database',
                isReliable: (data.isReliable as boolean) ?? true,
                isReference: (data.isReference as boolean) ?? false,
                isHistorized: (data.isHistorized as boolean) ?? false,
                loadFrequency: (data.loadFrequency as string) || '',
                entities: (data.entities as string[]) || [],
                description: (data.description as string) || '',
              }]
            });
          }
        }
        break;
      case 'quality':
        if (data.name) {
          const existing = session.qualityRules.find(q => q.name === data.name);
          if (!existing) {
            updateSessionData({
              qualityRules: [...session.qualityRules, {
                id: `qual_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
                name: data.name as string,
                type: (data.type as any) || 'validity',
                columns: (data.columns as string[]) || [],
                threshold: (data.threshold as number) || 100,
                description: (data.description as string) || '',
                anomalyDetection: (data.anomalyDetection as string) || '',
              }]
            });
          }
        }
        break;
      case 'governance':
        updateSessionData({
          governance: {
            dataOwner: (data.dataOwner as string) || '',
            definitionValidator: (data.definitionValidator as string) || '',
            confidentialityLevel: (data.confidentialityLevel as any) || 'internal',
            gdprConstraints: (data.gdprConstraints as string) || '',
            isSensitive: (data.isSensitive as boolean) ?? false,
            retentionPeriod: (data.retentionPeriod as string) || '',
            description: (data.description as string) || '',
          }
        });
        break;
      case 'architecture':
        updateSessionData({
          architecture: {
            datamartObjects: (data.datamartObjects as string[]) || [],
            semanticModelObjects: (data.semanticModelObjects as string[]) || [],
            reportObjects: (data.reportObjects as string[]) || [],
            technicalObjects: (data.technicalObjects as string[]) || [],
            collibraObjects: (data.collibraObjects as string[]) || [],
            description: (data.description as string) || '',
          }
        });
        break;
      case 'maturity':
        updateSessionData({
          maturityScores: {
            businessUnderstanding: (data.businessUnderstanding as number) || 0,
            modeling: (data.modeling as number) || 0,
            documentation: (data.documentation as number) || 0,
            governance: (data.governance as number) || 0,
            dataQuality: (data.dataQuality as number) || 0,
            architecture: (data.architecture as number) || 0,
            dadReadiness: (data.dadReadiness as number) || 0,
          },
        });
        break;
    }
  }

  function hasStepData(stepId: number): boolean {
    if (!session) return false;
    switch (stepId) {
      case 1: return !!session.productName;
      case 2: return session.entities.length > 0;
      case 3: return session.relations.length > 0;
      case 4: return session.attributes.length > 0;
      case 5: return session.maturityScores !== null;
      default: return false;
    }
  }

  function handleStepChange(step: number) {
    hasInitialized.current = false;
    setMessages([]);
    setCurrentStep(step);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    
    if (session) {
      addMessage({
        id: `user_${Date.now()}`,
        role: 'user',
        content: input.trim(),
        timestamp: Date.now(),
        step: currentStep,
      });
    }
    
    sendMessage({ text: input.trim() });
    setInput('');

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit(e as unknown as React.FormEvent);
    }
  }

  if (!session) {
    return (
      <div className="welcome-message">
        <div className="welcome-icon">🧠</div>
        <h3>Aucune session active</h3>
        <p>Créez un nouvel atelier depuis le tableau de bord pour commencer la conception de votre Data Product avec l&apos;IA.</p>
      </div>
    );
  }

  // Suggested questions for current step
  const suggestions = stepDef.questions.slice(0, 3);

  // Filter system messages from display
  const displayMessages = messages.filter(m => !getMessageText(m).startsWith('[SYSTÈME]'));

  // Only offer "Valider la réponse" once the user has actually answered in THIS
  // step. Data may already exist (deduced earlier), but we don't want the banner
  // to appear before the user has had a chance to type.
  const userHasMessagedThisStep = displayMessages.some(m => m.role === 'user');
  const showStepBanner = hasStepData(currentStep) && userHasMessagedThisStep;

  return (
    <div className="workshop-layout">
      <StepSidebar currentStep={currentStep} onStepChange={handleStepChange} session={session} />

      <div className="chat-panel">
        <div className="chat-messages">
          {displayMessages.length === 0 && !isLoading && (
            <div className="welcome-message">
              <div className="welcome-icon">{stepDef.icon}</div>
              <h3>Étape {currentStep} — {stepDef.title}</h3>
              <p>{stepDef.description}</p>
            </div>
          )}

          {displayMessages.map((message) => {
            const text = getMessageText(message);
            if (!text) return null;
            const isAssistant = message.role === 'assistant';
            const html = formatMarkdown(text);
            // After stripping the json:extract blocks, an assistant message can be
            // visually empty (Marty answered only with extraction). Show a clear
            // confirmation instead of an empty bubble.
            const isEmpty = html.replace(/<[^>]*>/g, '').trim().length === 0;
            return (
              <div key={message.id} className={`chat-message ${message.role}`}>
                <MartyAvatar role={message.role} />
                <div>
                  {isAssistant && (
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', marginBottom: 4 }}>
                      Marty <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>· Assistant Data Architect</span>
                    </div>
                  )}
                  {isEmpty && isAssistant ? (
                    <div className="message-bubble" style={{ color: 'var(--primary)', fontWeight: 600 }}>
                      ✓ Informations extraites et enregistrées dans « Données collectées ».
                    </div>
                  ) : (
                    <div className="message-bubble" dangerouslySetInnerHTML={{ __html: html }} />
                  )}
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="chat-message assistant">
              <MartyAvatar role="assistant" />
              <div className="message-bubble">
                <div className="typing-indicator">
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-area">
          {showStepBanner && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--primary-glow)',
              border: '1px solid var(--border-active)',
              padding: '16px 20px',
              borderRadius: 'var(--radius)',
              marginBottom: '16px',
              animation: 'fadeSlideUp 0.3s ease',
              gap: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '20px' }}>✓</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text)' }}>
                    Données collectées pour l&apos;étape {currentStep} !
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {currentStep < 5 
                      ? 'Les informations requises ont été extraites. Vous pouvez valider ou affiner la réponse.' 
                      : 'Toutes les informations ont été validées. Vous pouvez maintenant clore l\'atelier.'}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="cta-btn cta-btn-secondary"
                  style={{ padding: '10px 16px', fontSize: '13px', whiteSpace: 'nowrap' }}
                  disabled={isLoading}
                  onClick={() => {
                    sendMessage({ text: "Je souhaite donner plus d'informations pour affiner cette étape." });
                  }}
                >
                  Donner plus d&apos;infos 💬
                </button>
                {currentStep < 5 ? (
                  <button
                    type="button"
                    className="cta-btn"
                    style={{ padding: '10px 16px', fontSize: '13px', whiteSpace: 'nowrap' }}
                    onClick={() => handleStepChange(currentStep + 1)}
                  >
                    Valider la réponse ➔
                  </button>
                ) : (
                  <button
                    type="button"
                    className="cta-btn"
                    style={{ padding: '10px 16px', fontSize: '13px', whiteSpace: 'nowrap', background: 'linear-gradient(135deg, var(--primary), #10B981)' }}
                    onClick={() => {
                      completeSession();
                      setCurrentPage('deliverables');
                    }}
                  >
                    Terminer l&apos;atelier ✓
                  </button>
                )}
              </div>
            </div>
          )}

          {suggestions.length > 0 && displayMessages.length < 3 && (
            <div className="suggested-chips">
              {suggestions.map((q, i) => (
                <button key={i} className="suggested-chip" onClick={() => {
                  if (session) {
                    addMessage({ id: `user_${Date.now()}`, role: 'user', content: q, timestamp: Date.now(), step: currentStep });
                  }
                  sendMessage({ text: q });
                }}>
                  {q}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={onSubmit} className="chat-input-wrapper">
            <textarea
              ref={textareaRef}
              className="chat-input"
              value={input}
              onChange={handleTextareaInput}
              onKeyDown={handleKeyDown}
              placeholder="Décrivez votre Data Product..."
              rows={1}
              disabled={isLoading}
            />
            <button type="submit" className="chat-send-btn" disabled={isLoading || !input.trim()}>
              ➤
            </button>
          </form>
        </div>
      </div>

      {showContext && <ContextPanel session={session} onClose={() => setShowContext(false)} />}
      {!showContext && (
        <button
          style={{ position: 'fixed', right: 16, top: 80, zIndex: 5 }}
          className="suggested-chip"
          onClick={() => setShowContext(true)}
        >
          📋 Contexte
        </button>
      )}
    </div>
  );
}

// Marty — the Crédit Agricole assistant avatar
function MartyAvatar({ role }: { role: string }) {
  if (role !== 'assistant') {
    return <div className="message-avatar">👤</div>;
  }
  return (
    <div
      className="message-avatar"
      style={{ background: '#fff', padding: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)' }}
      title="Marty — Assistant Data Architect"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/marty-avatar.svg" alt="Marty" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </div>
  );
}

// Simple markdown formatter
function formatMarkdown(text: string): string {
  // Remove JSON extract blocks from display (the UI consumes them separately)
  let html = text.replace(/```json:extract[\s\S]*?```/g, '');
  // Also drop a generic "Blocs JSON" wrapper heading and any heading that is left
  // empty once its JSON block was stripped (e.g. "#### Maturity" with nothing after).
  html = html.replace(/^#{1,4}\s*Blocs?\s*JSON.*$/gim, '');
  html = html.replace(/^#{1,4}\s*(Maturity|Exemple[^\n]*|JSON[^\n]*)\s*$/gim, '');
  html = html.replace(/\n{3,}/g, '\n\n').trim();

  // Code blocks
  html = html.replace(/```(\w+)?\n([\s\S]*?)\n```/g, '<pre><code>$2</code></pre>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Bold/italic
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  
  // Headers
  html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
  
  // Lists
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>');
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');
  
  // Paragraphs
  html = html.replace(/\n\n/g, '</p><p>');
  html = `<p>${html}</p>`;
  html = html.replace(/<p>\s*<\/p>/g, '');
  
  // Emojis are already native
  return html;
}
