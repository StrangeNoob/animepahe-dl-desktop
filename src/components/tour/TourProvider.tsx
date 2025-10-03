import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import type { TourContextType, TourState, Settings } from "../../types";
import { tourSteps } from "./tourSteps";
import { TourOverlay } from "./TourOverlay";
import { usePostHog } from "posthog-js/react";

const TourContext = createContext<TourContextType | undefined>(undefined);

interface TourProviderProps {
  children: ReactNode;
  settings: Settings;
  onSettingsUpdate: (settings: Settings) => void;
}

export function TourProvider({ children, settings, onSettingsUpdate }: TourProviderProps) {
  const posthog = usePostHog();
  const [tourState, setTourState] = useState<TourState>({
    isActive: false,
    currentStep: 0,
    steps: tourSteps,
  });

  // Track step changes
  useEffect(() => {
    if (tourState.isActive) {
      posthog?.capture('tour_step_viewed', {
        step_index: tourState.currentStep,
        step_id: tourState.steps[tourState.currentStep]?.id
      });
    }
  }, [tourState.currentStep, tourState.isActive, tourState.steps, posthog]);

  const startTour = useCallback(() => {
    setTourState((prev) => ({
      ...prev,
      isActive: true,
      currentStep: 0,
    }));

    // Track tour start
    posthog?.capture('tour_started');
  }, [posthog]);

  const endTour = useCallback(async () => {
    setTourState((prev) => ({
      ...prev,
      isActive: false,
      currentStep: 0,
    }));

    // Mark tour as completed in settings
    const updatedSettings = { ...settings, tourCompleted: true };
    onSettingsUpdate(updatedSettings);
  }, [settings, onSettingsUpdate]);

  const nextStep = useCallback(() => {
    setTourState((prev) => {
      if (prev.currentStep < prev.steps.length - 1) {
        return {
          ...prev,
          currentStep: prev.currentStep + 1,
        };
      } else {
        // Tour completed, end it
        posthog?.capture('tour_completed');

        return {
          ...prev,
          isActive: false,
          currentStep: 0,
        };
      }
    });
  }, [posthog]);

  const prevStep = useCallback(() => {
    setTourState((prev) => ({
      ...prev,
      currentStep: Math.max(0, prev.currentStep - 1),
    }));
  }, []);

  const goToStep = useCallback((step: number) => {
    setTourState((prev) => ({
      ...prev,
      currentStep: Math.max(0, Math.min(step, prev.steps.length - 1)),
    }));
  }, []);

  const skipTour = useCallback(() => {
    // Track tour skip
    posthog?.capture('tour_skipped', {
      skipped_at_step: tourState.currentStep
    });

    endTour();
  }, [endTour, posthog, tourState.currentStep]);

  const contextValue: TourContextType = {
    tourState,
    startTour,
    endTour,
    nextStep,
    prevStep,
    goToStep,
    skipTour,
  };

  return (
    <TourContext.Provider value={contextValue}>
      {children}
      {tourState.isActive && (
        <TourOverlay
          currentStep={tourState.currentStep}
          steps={tourState.steps}
          onNext={nextStep}
          onPrev={prevStep}
          onSkip={skipTour}
          onComplete={endTour}
        />
      )}
    </TourContext.Provider>
  );
}

export const useTour = () => {
  const context = useContext(TourContext);
  if (context === undefined) {
    throw new Error("useTour must be used within a TourProvider");
  }
  return context;
};