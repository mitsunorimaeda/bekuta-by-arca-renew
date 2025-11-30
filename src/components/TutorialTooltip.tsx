import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right' | 'center';

interface TutorialTooltipProps {
  targetElement?: HTMLElement | null;
  position?: TooltipPosition;
  title: string;
  description: string;
  currentStep: number;
  totalSteps: number;
  onNext?: () => void;
  onPrev?: () => void;
  onSkip?: () => void;
  onClose?: () => void;
  showPrev?: boolean;
  nextLabel?: string;
  zIndex?: number;
}

export function TutorialTooltip({
  targetElement,
  position = 'bottom',
  title,
  description,
  currentStep,
  totalSteps,
  onNext,
  onPrev,
  onSkip,
  onClose,
  showPrev = true,
  nextLabel = '次へ',
  zIndex = 9999,
}: TutorialTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (targetElement && tooltipRef.current) {
      const updatePosition = () => {
        const targetRect = targetElement.getBoundingClientRect();
        const tooltipRect = tooltipRef.current!.getBoundingClientRect();
        const padding = 16;
        let top = 0;
        let left = 0;

        if (position === 'center') {
          top = window.innerHeight / 2 - tooltipRect.height / 2;
          left = window.innerWidth / 2 - tooltipRect.width / 2;
        } else {
          switch (position) {
            case 'top':
              top = targetRect.top - tooltipRect.height - padding;
              left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
              break;
            case 'bottom':
              top = targetRect.bottom + padding;
              left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
              break;
            case 'left':
              top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
              left = targetRect.left - tooltipRect.width - padding;
              break;
            case 'right':
              top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
              left = targetRect.right + padding;
              break;
          }

          left = Math.max(padding, Math.min(left, window.innerWidth - tooltipRect.width - padding));
          top = Math.max(padding, Math.min(top, window.innerHeight - tooltipRect.height - padding));
        }

        setTooltipStyle({
          position: 'fixed',
          top: `${top}px`,
          left: `${left}px`,
          zIndex,
        });
      };

      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);

      return () => {
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition, true);
      };
    } else if (!targetElement && position === 'center') {
      setTooltipStyle({
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex,
      });
    }
  }, [targetElement, position, zIndex]);

  return (
    <div
      ref={tooltipRef}
      style={tooltipStyle}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border-2 border-blue-500 dark:border-blue-400 w-[90vw] max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-300"
      role="dialog"
      aria-labelledby="tutorial-title"
      aria-describedby="tutorial-description"
    >
      <div className="p-5 sm:p-6 md:p-8">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                {currentStep} / {totalSteps}
              </span>
            </div>
            <h3
              id="tutorial-title"
              className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-900 dark:text-white pr-1"
            >
              {title}
            </h3>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="ml-1 flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              aria-label="チュートリアルを閉じる"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          )}
        </div>

        <p
          id="tutorial-description"
          className="text-sm sm:text-base md:text-lg text-gray-600 dark:text-gray-300 mb-5 sm:mb-6 leading-relaxed"
        >
          {description}
        </p>

        <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
          <div className="flex gap-1.5 sm:gap-2">
            {showPrev && onPrev && currentStep > 1 && (
              <button
                onClick={onPrev}
                className="px-4 py-2 sm:px-5 sm:py-2.5 text-sm sm:text-base font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                戻る
              </button>
            )}
            {onSkip && (
              <button
                onClick={onSkip}
                className="px-4 py-2 sm:px-5 sm:py-2.5 text-sm sm:text-base font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                スキップ
              </button>
            )}
          </div>

          {onNext && (
            <button
              onClick={onNext}
              className="px-5 py-2 sm:px-7 sm:py-2.5 text-sm sm:text-base font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors shadow-sm"
            >
              {currentStep === totalSteps ? '完了' : nextLabel}
            </button>
          )}
        </div>
      </div>

      <div className="h-1 bg-gray-200 dark:bg-gray-700">
        <div
          className="h-full bg-blue-600 dark:bg-blue-500 transition-all duration-300"
          style={{ width: `${(currentStep / totalSteps) * 100}%` }}
        />
      </div>
    </div>
  );
}
