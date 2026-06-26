'use client';

import { STEPS } from '@/lib/constants';
import { WorkshopSession } from '@/lib/types';

interface StepSidebarProps {
  currentStep: number;
  onStepChange: (step: number) => void;
  session: WorkshopSession;
}

export default function StepSidebar({ currentStep, onStepChange, session }: StepSidebarProps) {
  const progress = Math.round(((currentStep - 1) / 12) * 100);

  function getStepStatus(stepId: number): 'completed' | 'active' | 'pending' {
    if (stepId < currentStep) return 'completed';
    if (stepId === currentStep) return 'active';
    return 'pending';
  }

  function hasStepData(stepId: number): boolean {
    switch (stepId) {
      case 1: return !!session.productName;
      case 2: return session.entities.length > 0;
      case 3: return session.granularity !== null;
      case 4: return session.relations.length > 0;
      case 5: return session.attributes.length > 0;
      case 6: return session.kpis.length > 0;
      case 7: return session.businessRules.length > 0;
      case 8: return session.dataSources.length > 0;
      case 9: return session.qualityRules.length > 0;
      case 10: return session.governance !== null;
      case 11: return session.architecture !== null;
      case 12: return session.maturityScores !== null;
      default: return false;
    }
  }

  return (
    <div className="step-sidebar">
      <div className="step-sidebar-header">
        <div className="step-progress-label">Progression — {progress}%</div>
        <div className="step-progress-bar">
          <div className="step-progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="step-list">
        {STEPS.map((step) => {
          const status = getStepStatus(step.id);
          const hasData = hasStepData(step.id);
          return (
            <div
              key={step.id}
              className={`step-item ${status}`}
              onClick={() => onStepChange(step.id)}
              style={{ opacity: step.id > currentStep + 1 ? 0.4 : 1, cursor: step.id > currentStep + 1 ? 'not-allowed' : 'pointer' }}
            >
              <div className="step-number">
                {status === 'completed' ? '✓' : step.id}
              </div>
              <div className="step-info">
                <div className="step-title">
                  <span className="step-icon">{step.icon}</span> {step.titleShort}
                </div>
                {hasData && status === 'completed' && (
                  <div style={{ fontSize: 11, color: 'var(--accent-emerald)', marginTop: 2 }}>
                    ✓ Données collectées
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
