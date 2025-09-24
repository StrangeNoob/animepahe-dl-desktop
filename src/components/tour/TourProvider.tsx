import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { TourContextType, TourState, Settings } from "../../types";
import { tourSteps } from "./tourSteps";
import { TourOverlay } from "./TourOverlay";

const TourContext = createContext<TourContextType | undefined>(undefined);

interface TourProviderProps {
  children: ReactNode;
  settings: Settings;
  onSettingsUpdate: (settings: Settings) => void;
}

export function TourProvider({ children, settings, onSettingsUpdate }: TourProviderProps) {
  const [tourState, setTourState] = useState<TourState>({
    isActive: false,
    currentStep: 0,
    steps: tourSteps,
  });

  const startTour = useCallback(() => {
    setTourState((prev) => ({
      ...prev,
      isActive: true,
      currentStep: 0,
    }));
  }, []);

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
        return {
          ...prev,
          isActive: false,
          currentStep: 0,
        };
      }
    });
  }, []);

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
    endTour();
  }, [endTour]);

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