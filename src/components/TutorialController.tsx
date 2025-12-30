// src/components/TutorialController.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { TutorialOverlay } from './TutorialOverlay';
import { TutorialTooltip, TooltipPosition } from './TutorialTooltip';
import { TutorialProgress } from './TutorialProgress';

export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  targetSelector?: string;
  position?: TooltipPosition;
  action?: () => void | Promise<void>;
  beforeStep?: () => void | Promise<void>;
  afterStep?: () => void | Promise<void>;
}

interface TutorialControllerProps {
  steps: TutorialStep[];
  isActive: boolean;
  onComplete: () => void;
  onSkip: () => void;
  currentStepIndex?: number;
  onStepChange?: (stepIndex: number) => void;
  showProgress?: boolean;
}

export function TutorialController({
  steps,
  isActive,
  onComplete,
  onSkip,
  currentStepIndex: externalStepIndex,
  onStepChange,
  showProgress = true,
}: TutorialControllerProps) {
  const [internalStepIndex, setInternalStepIndex] = useState(0);
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const [isExecutingAction, setIsExecutingAction] = useState(false);

  const currentStepIndex = externalStepIndex ?? internalStepIndex;
  const setCurrentStepIndex = onStepChange ?? setInternalStepIndex;

  const currentStep = steps[currentStepIndex];

  useEffect(() => {
    if (!isActive || !currentStep) {
      setTargetElement(null);
      return;
    }

    let cancelled = false;

    const updateTargetElement = () => {
      if (cancelled) return;

      if (currentStep.targetSelector) {
        const element = document.querySelector(currentStep.targetSelector) as HTMLElement | null;
        if (element) {
          setTargetElement(element);
          // 画面がガタつく場合は 'auto' にしてもOK
          try {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          } catch {
            // ignore
          }
        } else {
          setTargetElement(null);
        }
      } else {
        setTargetElement(null);
      }
    };

    const executeBeforeStep = async () => {
      try {
        if (currentStep.beforeStep) {
          await currentStep.beforeStep();
        }
      } catch (e) {
        console.warn('[Tutorial] beforeStep error', e);
      }
    };

    executeBeforeStep().then(updateTargetElement);

    const observer = new MutationObserver(updateTargetElement);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [isActive, currentStep, currentStepIndex]);

  const handleNext = useCallback(async () => {
    if (isExecutingAction) return;
    if (!currentStep) return;

    try {
      setIsExecutingAction(true);

      try {
        if (currentStep.afterStep) await currentStep.afterStep();
      } catch (e) {
        console.warn('[Tutorial] afterStep error', e);
      }

      try {
        if (currentStep.action) await currentStep.action();
      } catch (e) {
        console.warn('[Tutorial] action error', e);
      }

      if (currentStepIndex < steps.length - 1) {
        setCurrentStepIndex(currentStepIndex + 1);
      } else {
        onComplete();
      }
    } finally {
      setIsExecutingAction(false);
    }
  }, [currentStepIndex, steps.length, currentStep, onComplete, setCurrentStepIndex, isExecutingAction]);

  const handlePrev = useCallback(() => {
    if (currentStepIndex > 0 && !isExecutingAction) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  }, [currentStepIndex, setCurrentStepIndex, isExecutingAction]);

  const handleSkip = useCallback(() => {
    if (!isExecutingAction) {
      onSkip();
    }
  }, [onSkip, isExecutingAction]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isActive) return;

      if (e.key === 'Escape') {
        handleSkip();
      } else if (e.key === 'Enter') {
        handleNext();
      } else if (e.key === 'ArrowLeft' && currentStepIndex > 0) {
        handlePrev();
      } else if (e.key === 'ArrowRight' && currentStepIndex < steps.length - 1) {
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, currentStepIndex, steps.length, handleNext, handlePrev, handleSkip]);

  if (!isActive || !currentStep) {
    return null;
  }

  return (
    <>
      {/* ✅ Overlayは「背面」(z:10000) */}
      <TutorialOverlay targetElement={targetElement} onClick={handleSkip} />

      {/* ✅ クリックがOverlayへ抜けないようにガード（z:10001） */}
      <div className="fixed inset-0 z-[10001] pointer-events-none">
        <div
          className="pointer-events-auto"
          onClick={(e) => {
            // Tooltip内クリックが Overlay に伝播するのを防ぐ
            e.stopPropagation();
          }}
        >
          <TutorialTooltip
            targetElement={targetElement}
            position={currentStep.position || 'bottom'}
            title={currentStep.title}
            description={currentStep.description}
            currentStep={currentStepIndex + 1}
            totalSteps={steps.length}
            onNext={handleNext}
            onPrev={currentStepIndex > 0 ? handlePrev : undefined}
            onSkip={handleSkip}
            showPrev={currentStepIndex > 0}
          />
        </div>
      </div>

      {showProgress && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[10002] pointer-events-none">
          <TutorialProgress
            currentStep={currentStepIndex + 1}
            totalSteps={steps.length}
            stepTitles={steps.map((s) => s.title)}
          />
        </div>
      )}
    </>
  );
}