import { useEffect, useState, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight, X, HelpCircle } from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import type { TourStep } from "../../types";

interface TourTooltipProps {
  step: TourStep;
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onComplete: () => void;
  targetElement?: HTMLElement | null;
}

export function TourTooltip({
  step,
  currentStep,
  totalSteps,
  onNext,
  onPrev,
  onSkip,
  onComplete,
  targetElement,
}: TourTooltipProps) {
  const [position, setPosition] = useState<CSSProperties>({});
  const [arrowClass, setArrowClass] = useState("");

  useEffect(() => {
    if (!targetElement && step.target) {
      // Element not found but target specified, position in center
      setPosition({
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 10002,
      });
      setArrowClass("");
      return;
    }

    if (!targetElement) {
      // No target, position in center
      setPosition({
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 10002,
      });
      setArrowClass("");
      return;
    }

    const rect = targetElement.getBoundingClientRect();
    const tooltipWidth = 420; // increased width
    const tooltipHeight = 320; // increased height for better content fit
    const spacing = 24; // increased spacing from target element
    const arrowSize = 8;

    let top = 0;
    let left = 0;
    let transform = "";
    let arrow = "";

    const placement = step.placement || "bottom";

    // Check viewport dimensions first
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    // Determine best placement dynamically if placement would cause overlap
    let actualPlacement = placement;

    // For "right" placement, check if there's enough space
    if (placement === "right" && rect.right + spacing + tooltipWidth > viewport.width - spacing) {
      // Try left instead
      if (rect.left - spacing - tooltipWidth > spacing) {
        actualPlacement = "left";
      } else {
        // Fall back to bottom
        actualPlacement = "bottom";
      }
    }

    // For "top" placement, check if there's enough space
    if (placement === "top" && rect.top - tooltipHeight - spacing < spacing) {
      actualPlacement = "bottom";
    }

    switch (actualPlacement) {
      case "top":
        top = rect.top - tooltipHeight - spacing;
        left = rect.left + rect.width / 2;
        transform = "translateX(-50%)";
        arrow = "after:absolute after:top-full after:left-1/2 after:transform after:-translate-x-1/2 after:border-l-[8px] after:border-r-[8px] after:border-t-[8px] after:border-l-transparent after:border-r-transparent after:border-t-white";
        break;

      case "bottom":
        top = rect.bottom + spacing;
        left = rect.left + rect.width / 2;
        transform = "translateX(-50%)";
        arrow = "before:absolute before:bottom-full before:left-1/2 before:transform before:-translate-x-1/2 before:border-l-[8px] before:border-r-[8px] before:border-b-[8px] before:border-l-transparent before:border-r-transparent before:border-b-white";
        break;

      case "left":
        top = rect.top + rect.height / 2;
        left = rect.left - tooltipWidth - spacing;
        transform = "translateY(-50%)";
        arrow = "after:absolute after:top-1/2 after:left-full after:transform after:-translate-y-1/2 after:border-t-[8px] after:border-b-[8px] after:border-l-[8px] after:border-t-transparent after:border-b-transparent after:border-l-white";
        break;

      case "right":
        top = rect.top + rect.height / 2;
        left = rect.right + spacing;
        transform = "translateY(-50%)";
        arrow = "before:absolute before:top-1/2 before:right-full before:transform before:-translate-y-1/2 before:border-t-[8px] before:border-b-[8px] before:border-r-[8px] before:border-t-transparent before:border-b-transparent before:border-r-white";
        break;
    }

    // Adjust position if tooltip would go off-screen

    if (left < spacing) {
      left = spacing;
      if (placement === "top" || placement === "bottom") {
        transform = "translateX(0)";
      }
    } else if (left + tooltipWidth > viewport.width - spacing) {
      left = viewport.width - tooltipWidth - spacing;
      if (placement === "top" || placement === "bottom") {
        transform = "translateX(0)";
      }
    }

    if (top < spacing) {
      top = spacing;
      if (placement === "left" || placement === "right") {
        transform = "translateY(0)";
      }
    } else if (top + tooltipHeight > viewport.height - spacing) {
      top = viewport.height - tooltipHeight - spacing;
      if (placement === "left" || placement === "right") {
        transform = "translateY(0)";
      }
    }

    setPosition({
      position: "fixed",
      top: `${top}px`,
      left: `${left}px`,
      transform,
      zIndex: 10002,
    });

    setArrowClass(arrow);
  }, [targetElement, step.placement, step.target]);

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;

  return (
    <Card
      className={`w-[420px] max-w-[90vw] border border-white/20 bg-white/95 backdrop-blur-xl shadow-2xl ${arrowClass}`}
      style={position}
    >
      <CardContent className="p-8">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium text-muted-foreground">
              Step {currentStep + 1} of {totalSteps}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onSkip}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="mb-8">
          <h3 className="text-xl font-semibold text-foreground mb-4">{step.title}</h3>
          <p className="text-base text-muted-foreground leading-relaxed">{step.content}</p>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex justify-center">
            <div className="flex gap-1.5">
              {Array.from({ length: totalSteps }).map((_, index) => (
                <div
                  key={index}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index === currentStep ? "bg-primary" : "bg-muted-foreground/30"
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={onPrev}
              disabled={isFirstStep}
              className="flex items-center gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>

            {isLastStep ? (
              <Button onClick={onComplete} className="flex items-center gap-2">
                Finish Tour
              </Button>
            ) : (
              <Button onClick={onNext} className="flex items-center gap-2">
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}