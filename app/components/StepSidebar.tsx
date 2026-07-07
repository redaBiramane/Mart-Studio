'use client';

import { STEPS, stepHasData } from '@/lib/constants';
import { useWorkshopStore } from '@/lib/store';
import { WorkshopSession } from '@/lib/types';

interface StepSidebarProps {
  currentStep: number;
  onStepChange: (step: number) => void;
  session: WorkshopSession;
}

export default function StepSidebar({ currentStep, onStepChange, session }: StepSidebarProps) {
  const configured = useWorkshopStore((s) => s.steps);
  const steps = configured && configured.length ? configured : STEPS;

  // La position (1-based) fait foi partout — pas step.id — pour rester cohérent
  // avec l'atelier quand les étapes sont réordonnées/supprimées par l'admin.
  function getStepStatus(pos: number): 'completed' | 'active' | 'pending' {
    if (pos < currentStep) return 'completed';
    if (pos === currentStep) return 'active';
    return 'pending';
  }

  const curDone = stepHasData(steps[currentStep - 1], session);
  const done = (currentStep - 1) + (curDone ? 1 : 0);
  const progress = Math.round((Math.min(done, steps.length) / steps.length) * 100);

  return (
    <div className="step-sidebar">
      <div className="step-sidebar-header">
        <div className="step-progress-label">Progression — {progress}%</div>
        <div className="step-progress-bar">
          <div className="step-progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="step-list">
        {steps.map((step, i) => {
          const pos = i + 1;
          const status = getStepStatus(pos);
          const hasData = stepHasData(step, session);
          return (
            <div
              key={step.key + i}
              className={`step-item ${status}`}
              onClick={() => onStepChange(pos)}
              style={{ cursor: 'pointer' }}
            >
              <div className="step-number">
                {status === 'completed' ? '✓' : pos}
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
