import React, { createContext, useContext, useState, useCallback } from 'react';
import { useTutorial, TutorialProgress } from '../hooks/useTutorial';
import type { AppRole } from '../lib/roles';

interface TutorialContextValue {
  progress: TutorialProgress | null;
  loading: boolean;
  error: string | null;
  isActive: boolean;
  currentStepIndex: number;
  startTutorial: () => void;
  stopTutorial: () => void;
  completeStep: (stepId: string) => Promise<void>;
  setCurrentStep: (stepId: string | null) => Promise<void>;
  completeTutorial: () => Promise<void>;
  skipTutorial: () => Promise<void>;
  resetTutorial: () => Promise<void>;
  shouldShowTutorial: () => boolean;
  setCurrentStepIndex: (index: number) => void;
}

const TutorialContext = createContext<TutorialContextValue | undefined>(undefined);

interface TutorialProviderProps {
  userId: string;
  role: AppRole;
  children: React.ReactNode;
}

export function TutorialProvider({ userId, role, children }: TutorialProviderProps) {
  const tutorial = useTutorial(userId, role);
  const [isActive, setIsActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const startTutorial = useCallback(() => {
    setIsActive(true);
    setCurrentStepIndex(0);
  }, []);

  const stopTutorial = useCallback(() => {
    setIsActive(false);
  }, []);

  const handleCompleteTutorial = useCallback(async () => {
    await tutorial.completeTutorial();
    setIsActive(false);
  }, [tutorial]);

  const handleSkipTutorial = useCallback(async () => {
    await tutorial.skipTutorial();
    setIsActive(false);
  }, [tutorial]);

  const value: TutorialContextValue = {
    ...tutorial,
    isActive,
    currentStepIndex,
    startTutorial,
    stopTutorial,
    completeTutorial: handleCompleteTutorial,
    skipTutorial: handleSkipTutorial,
    setCurrentStepIndex,
  };

  return (
    <TutorialContext.Provider value={value}>
      {children}
    </TutorialContext.Provider>
  );
}

export function useTutorialContext() {
  const context = useContext(TutorialContext);
  if (context === undefined) {
    throw new Error('useTutorialContext must be used within a TutorialProvider');
  }
  return context;
}
