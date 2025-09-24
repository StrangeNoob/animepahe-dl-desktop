import { useEffect, useState, useCallback } from "react";
import { TourTooltip } from "./TourTooltip";
import type { TourStep } from "../../types";

interface TourOverlayProps {
  currentStep: number;
  steps: TourStep[];
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onComplete: () => void;
}

export function TourOverlay({ currentStep, steps, onNext, onPrev, onSkip, onComplete }: TourOverlayProps) {
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const [spotlightStyle, setSpotlightStyle] = useState<string>("");

  const currentStepData = steps[currentStep];

  const updateTargetElement = useCallback(() => {
    if (!currentStepData?.target) {
      setTargetElement(null);
      setSpotlightStyle("none");
      return;
    }

    const element = document.querySelector(currentStepData.target) as HTMLElement;
    setTargetElement(element);

    if (element) {
      const rect = element.getBoundingClientRect();
      const padding = 8; // padding around the highlighted element

      // Create a spotlight effect using CSS clip-path
      const spotlightClip = `polygon(
        0% 0%,
        0% 100%,
        ${rect.left - padding}px 100%,
        ${rect.left - padding}px ${rect.top - padding}px,
        ${rect.right + padding}px ${rect.top - padding}px,
        ${rect.right + padding}px ${rect.bottom + padding}px,
        ${rect.left - padding}px ${rect.bottom + padding}px,
        ${rect.left - padding}px 100%,
        100% 100%,
        100% 0%
      )`;

      setSpotlightStyle(spotlightClip);

      // Scroll element into view if it's not visible
      element.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "center"
      });
    } else {
      setSpotlightStyle("none");
    }
  }, [currentStepData?.target]);

  useEffect(() => {
    // Small delay to ensure DOM has updated
    const timer = setTimeout(updateTargetElement, 100);
    return () => clearTimeout(timer);
  }, [updateTargetElement]);

  useEffect(() => {
    const handleResize = () => updateTargetElement();
    const handleScroll = () => updateTargetElement();

    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [updateTargetElement]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onSkip();
      } else if (event.key === "ArrowRight" || event.key === " ") {
        event.preventDefault();
        if (currentStep < steps.length - 1) {
          onNext();
        } else {
          onComplete();
        }
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        if (currentStep > 0) {
          onPrev();
        }
      }
    };

    document.addEventListener("keydown", handleKeyPress);
    return () => document.removeEventListener("keydown", handleKeyPress);
  }, [currentStep, steps.length, onNext, onPrev, onSkip, onComplete]);

  const handleOverlayClick = (event: React.MouseEvent) => {
    // Only allow clicks through the spotlight hole if specified
    if (currentStepData?.allowClicksThruHole && targetElement) {
      const rect = targetElement.getBoundingClientRect();
      const clickX = event.clientX;
      const clickY = event.clientY;

      if (
        clickX >= rect.left &&
        clickX <= rect.right &&
        clickY >= rect.top &&
        clickY <= rect.bottom
      ) {
        // Click is within the target element, allow it through
        return;
      }
    }

    // Prevent clicks from propagating to elements behind the overlay
    event.stopPropagation();
  };

  return (
    <>
      {/* Overlay with spotlight effect */}
      <div
        className="fixed inset-0 bg-black/60 transition-all duration-300 ease-in-out"
        style={{
          zIndex: 10001,
          clipPath: spotlightStyle === "none" ? "none" : spotlightStyle,
        }}
        onClick={handleOverlayClick}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-description"
      />

      {/* Highlighted element border */}
      {targetElement && (
        <div
          className="fixed pointer-events-none border-2 border-primary rounded-md transition-all duration-300 ease-in-out"
          style={{
            top: `${targetElement.getBoundingClientRect().top - 4}px`,
            left: `${targetElement.getBoundingClientRect().left - 4}px`,
            width: `${targetElement.getBoundingClientRect().width + 8}px`,
            height: `${targetElement.getBoundingClientRect().height + 8}px`,
            zIndex: 10001,
          }}
        />
      )}

      {/* Tour Tooltip */}
      <TourTooltip
        step={currentStepData}
        currentStep={currentStep}
        totalSteps={steps.length}
        onNext={onNext}
        onPrev={onPrev}
        onSkip={onSkip}
        onComplete={onComplete}
        targetElement={targetElement}
      />
    </>
  );
}