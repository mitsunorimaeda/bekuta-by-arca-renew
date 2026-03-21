// src/components/TutorialController.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  // ✅ インタラクティブ拡張
  waitForSelector?: string;       // ユーザーがこの要素を操作したら次へ
  waitForEvent?: 'click' | 'input' | 'change'; // 待つイベント種別（デフォルト: click）
  allowInteraction?: boolean;     // ハイライト要素のクリックを透過するか
  autoAdvanceDelay?: number;      // イベント検知後のディレイ（ms）
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
  const isWaitingStep = !!currentStep?.waitForSelector;

  // handleNextをrefで保持（イベントリスナーから安全に呼ぶため）
  const handleNextRef = useRef<() => void>(() => {});

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

  // ✅ ターゲット要素にハイライトアニメーションを直接付与
  useEffect(() => {
    if (!isActive || !currentStep) return;
    const selector = currentStep.waitForSelector || currentStep.targetSelector;
    if (!selector) return;

    let el: HTMLElement | null = null;
    const HIGHLIGHT_CLASS = 'tutorial-highlight-target';

    const applyHighlight = () => {
      el = document.querySelector(selector) as HTMLElement | null;
      if (el && !el.classList.contains(HIGHLIGHT_CLASS)) {
        el.classList.add(HIGHLIGHT_CLASS);
      }
    };

    applyHighlight();
    const observer = new MutationObserver(applyHighlight);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      if (el) el.classList.remove(HIGHLIGHT_CLASS);
    };
  }, [isActive, currentStep, currentStepIndex]);

  // ✅ wait-for-action: ユーザーの操作を待って自動遷移
  useEffect(() => {
    if (!isActive || !currentStep?.waitForSelector) return;

    let cancelled = false;
    let cleanupFn: (() => void) | null = null;

    let listenerAttached = false;

    const setupListener = () => {
      if (cancelled || listenerAttached) return;
      const waitEl = document.querySelector(currentStep.waitForSelector!) as HTMLElement | null;
      if (!waitEl) {
        const retryTimer = setTimeout(setupListener, 300);
        cleanupFn = () => clearTimeout(retryTimer);
        return;
      }

      listenerAttached = true;
      const baseEvent = currentStep.waitForEvent || 'click';
      const delay = currentStep.autoAdvanceDelay || 500;

      // input/changeの両方をリッスン（モバイルのrange対応）
      const events = baseEvent === 'input'
        ? ['input', 'change', 'touchend']
        : [baseEvent];

      let fired = false;
      const handler = () => {
        if (cancelled || fired) return;
        fired = true;
        setTimeout(() => {
          if (!cancelled) {
            handleNextRef.current();
          }
        }, delay);
      };

      const cleanups: (() => void)[] = [];
      for (const evt of events) {
        waitEl.addEventListener(evt, handler, { once: true });
        cleanups.push(() => waitEl.removeEventListener(evt, handler));
      }
      cleanupFn = () => cleanups.forEach((c) => c());
    };

    setupListener();
    const observer = new MutationObserver(setupListener);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelled = true;
      observer.disconnect();
      if (cleanupFn) cleanupFn();
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

  // refを更新
  handleNextRef.current = handleNext;

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
      } else if (e.key === 'Enter' && !isWaitingStep) {
        handleNext();
      } else if (e.key === 'ArrowLeft' && currentStepIndex > 0) {
        handlePrev();
      } else if (e.key === 'ArrowRight' && currentStepIndex < steps.length - 1 && !isWaitingStep) {
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, currentStepIndex, steps.length, handleNext, handlePrev, handleSkip, isWaitingStep]);

  if (!isActive || !currentStep) {
    return null;
  }

  return (
    <>
      {/* ✅ Overlayは「背面」(z:10000) — インタラクティブステップでは非表示 */}
      {!isWaitingStep && (
        <TutorialOverlay
          targetElement={targetElement}
          onClick={handleSkip}
          allowInteraction={false}
        />
      )}

      {/* ✅ ツールチップ（z:10001） */}
      <div className="fixed inset-0 z-[10001] pointer-events-none">
        <TutorialTooltip
          targetElement={targetElement}
          position={currentStep.position || 'bottom'}
          title={currentStep.title}
          description={currentStep.description}
          currentStep={currentStepIndex + 1}
          totalSteps={steps.length}
          onNext={isWaitingStep ? undefined : handleNext}
          onPrev={currentStepIndex > 0 ? handlePrev : undefined}
          onSkip={handleSkip}
          showPrev={currentStepIndex > 0}
          isWaiting={isWaitingStep}
        />
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
