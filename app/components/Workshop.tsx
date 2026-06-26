'use client';

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useWorkshopStore } from '@/lib/store';
import { STEPS } from '@/lib/constants';
import StepSidebar from '@/app/components/StepSidebar';
import ContextPanel from '@/app/components/ContextPanel';

export default function Workshop() {
  const { session, setCurrentStep, addMessage, updateSessionData } = useWorkshopStore();
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
      return {
        currentStep: currentSession?.currentStep || 1,
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
        sendMessage({ text: `[SYSTÈME] Début de l'étape ${currentStep}: "${stepDef.title}". Présente-toi et commence l'entretien.` });
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
    const jsonRegex = /```json:extract\n([\s\S]*?)\n```/g;
    let match;
    while ((match = jsonRegex.exec(content)) !== null) {
      try {
        const parsed = JSON.parse(match[1]);
        processExtraction(parsed);
      } catch { /* skip invalid JSON */ }
    }
  }

  function processExtraction(extraction: { type: string; data: Record<string, unknown> }) {
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
                id: `entity_${Date.now()}`,
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
      case 'relation':
        if (data.source && data.target) {
          updateSessionData({
            relations: [...session.relations, {
              id: `rel_${Date.now()}`,
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
        if (data.name && data.entityId) {
          updateSessionData({
            attributes: [...session.attributes, {
              id: `attr_${Date.now()}`,
              entityId: data.entityId as string,
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

  function handleStepChange(step: number) {
    if (step <= currentStep + 1) {
      hasInitialized.current = false;
      setMessages([]);
      setCurrentStep(step);
    }
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
            return (
              <div key={message.id} className={`chat-message ${message.role}`}>
                <div className="message-avatar">
                  {message.role === 'assistant' ? '🧠' : '👤'}
                </div>
                <div>
                  <div className="message-bubble" dangerouslySetInnerHTML={{ __html: formatMarkdown(text) }} />
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="chat-message assistant">
              <div className="message-avatar">🧠</div>
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

// Simple markdown formatter
function formatMarkdown(text: string): string {
  // Remove JSON extract blocks from display
  let html = text.replace(/```json:extract[\s\S]*?```/g, '');
  
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
