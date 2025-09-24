import { useState } from "react";
import { AlertTriangle, CheckCircle, ExternalLink, RefreshCw, Terminal, XCircle } from "lucide-react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Badge } from "./ui/badge";
import type { RequirementsCheckResponse, RequirementStatus } from "../types";
import { checkRequirements } from "../api";

interface RequirementsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requirements: RequirementsCheckResponse | null;
  onRequirementsUpdate: (requirements: RequirementsCheckResponse) => void;
}

const REQUIREMENT_LINKS = {
  "Node.js": "https://github.com/StrangeNoob/animepahe-dl-desktop/blob/main/requirements/NodeJS.md",
  "ffmpeg": "https://github.com/StrangeNoob/animepahe-dl-desktop/blob/main/requirements/FFMPEG.md",
  "OpenSSL": "https://github.com/StrangeNoob/animepahe-dl-desktop/blob/main/requirements/OpenSSL.md",
} as const;

export function RequirementsDialog({ open, onOpenChange, requirements, onRequirementsUpdate }: RequirementsDialogProps) {
  const [checking, setChecking] = useState(false);

  const handleCheckAgain = async () => {
    setChecking(true);
    try {
      const newRequirements = await checkRequirements();
      onRequirementsUpdate(newRequirements);
    } catch (error) {
      console.error("Failed to check requirements:", error);
    } finally {
      setChecking(false);
    }
  };

  const openInstallationGuide = (requirementName: string) => {
    const url = REQUIREMENT_LINKS[requirementName as keyof typeof REQUIREMENT_LINKS];
    if (url) {
      window.open(url, "_blank");
    }
  };

  if (!requirements) return null;

  const missingRequirements = requirements.requirements.filter(req => !req.available);
  const availableRequirements = requirements.requirements.filter(req => req.available);

  return (
    <Dialog open={open} onOpenChange={requirements.allAvailable ? onOpenChange : undefined}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" onEscapeKeyDown={requirements.allAvailable ? undefined : (e) => e.preventDefault()} onPointerDownOutside={requirements.allAvailable ? undefined : (e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {requirements.allAvailable ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
            )}
            System Requirements Check
          </DialogTitle>
          <DialogDescription>
            {requirements.allAvailable
              ? "All required dependencies are installed and ready to use."
              : "Some required dependencies are missing. Please install them to enable full functionality."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {!requirements.allAvailable && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-destructive flex items-center gap-2">
                <XCircle className="h-4 w-4" />
                Missing Dependencies
              </h4>
              <div className="space-y-3">
                {missingRequirements.map((req) => (
                  <RequirementCard
                    key={req.name}
                    requirement={req}
                    onOpenGuide={() => openInstallationGuide(req.name)}
                  />
                ))}
              </div>
            </div>
          )}

          {availableRequirements.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-green-600 dark:text-green-400 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Available Dependencies
              </h4>
              <div className="space-y-3">
                {availableRequirements.map((req) => (
                  <RequirementCard key={req.name} requirement={req} />
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleCheckAgain}
              disabled={checking}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${checking ? "animate-spin" : ""}`} />
              {checking ? "Checking..." : "Check Again"}
            </Button>

            {requirements.allAvailable && (
              <Button onClick={() => onOpenChange(false)}>
                Continue
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface RequirementCardProps {
  requirement: RequirementStatus;
  onOpenGuide?: () => void;
}

function RequirementCard({ requirement, onOpenGuide }: RequirementCardProps) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/60 p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {requirement.available ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <span className="font-medium">{requirement.name}</span>
            </div>
            <Badge variant={requirement.available ? "default" : "destructive"} className="text-xs">
              {requirement.available ? "Available" : "Missing"}
            </Badge>
          </div>

          {requirement.available && requirement.path && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Terminal className="h-3 w-3" />
              <code className="text-xs bg-muted px-1 py-0.5 rounded">{requirement.path}</code>
            </div>
          )}

          {!requirement.available && requirement.error && (
            <p className="text-sm text-muted-foreground">{requirement.error}</p>
          )}
        </div>

        {!requirement.available && onOpenGuide && (
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenGuide}
            className="flex items-center gap-1 text-xs"
          >
            <ExternalLink className="h-3 w-3" />
            Install Guide
          </Button>
        )}
      </div>
    </div>
  );
}