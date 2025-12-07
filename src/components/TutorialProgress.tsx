import React from 'react';
import { CheckCircle, Circle } from 'lucide-react';

interface TutorialProgressProps {
  currentStep: number;
  totalSteps: number;
  stepTitles?: string[];
  className?: string;
}

export function TutorialProgress({
  currentStep,
  totalSteps,
  stepTitles,
  className = '',
}: TutorialProgressProps) {
  return (
    <div className={`flex items-center justify-center gap-2 ${className}`}>
      {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => {
        const isCompleted = step < currentStep;
        const isCurrent = step === currentStep;
        const stepTitle = stepTitles?.[step - 1];

        return (
          <div
            key={step}
            className="flex items-center gap-2"
            title={stepTitle}
          >
            <div className="relative flex items-center justify-center">
              {isCompleted ? (
                <CheckCircle className="w-6 h-6 text-green-500 dark:text-green-400" />
              ) : (
                <Circle
                  className={`w-6 h-6 ${
                    isCurrent
                      ? 'text-blue-600 dark:text-blue-400 fill-blue-100 dark:fill-blue-900'
                      : 'text-gray-300 dark:text-gray-600'
                  }`}
                />
              )}
              {isCurrent && (
                <div className="absolute inset-0 rounded-full border-2 border-blue-600 dark:border-blue-400 animate-ping" />
              )}
            </div>
            {step < totalSteps && (
              <div
                className={`w-8 h-0.5 ${
                  isCompleted
                    ? 'bg-green-500 dark:bg-green-400'
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
