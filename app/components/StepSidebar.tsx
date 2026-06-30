'use client';

import { STEPS } from '@/lib/constants';
import { WorkshopSession } from '@/lib/types';

interface StepSidebarProps {
  currentStep: number;
  onStepChange: (step: number) => void;
  session: WorkshopSession;
}

export default function StepSidebar({ currentStep, onStepChange, session }: StepSidebarProps) {
  function getStepStatus(stepId: number): 'completed' | 'active' | 'pending' {
    if (stepId < currentStep) return 'completed';
    if (stepId === currentStep) return 'active';
    return 'pending';
  }

  function hasStepData(stepId: number): boolean {
    switch (stepId) {
      case 1: return !!session.productName;
      case 2: return session.entities.length > 0;
      case 3: return session.relations.length > 0;
      case 4: return session.attributes.length > 0;
      case 5: return session.maturityScores !== null;
      default: return false;
    }
  }

  // Progression = étapes réellement complétées (atteint 100% une fois l'étape 5 validée).
  const completedSteps = STEPS.filter((s) => hasStepData(s.id)).length;
  const progress = Math.round((completedSteps / STEPS.length) * 100);

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
              style={{ cursor: 'pointer' }}
            >
              <div className="step-number">
                {status === 'completed' ? '✓' : step.id}
              </div>
              <div className="step-info">
                <div className="step-title">
                  <span className="step-icon">{step.icon}</span> {step.titleShort}
                </div>
                {hasData && (
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
