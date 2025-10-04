import { X, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";

interface ResumeNotificationBannerProps {
  count: number;
  onResume: () => void;
  onDismiss: () => void;
}

export function ResumeNotificationBanner({ count, onResume, onDismiss }: ResumeNotificationBannerProps) {
  return (
    <div className="bg-blue-500 text-white px-4 py-3 flex items-center justify-between shadow-md">
      <div className="flex items-center gap-3">
        <RefreshCw className="w-5 h-5" />
        <div>
          <p className="font-semibold">
            {count} incomplete download{count !== 1 ? "s" : ""} detected
          </p>
          <p className="text-sm text-blue-100">
            You have downloads that can be resumed
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={onResume}
          className="bg-white text-blue-600 hover:bg-blue-50"
        >
          Resume Downloads
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={onDismiss}
          className="hover:bg-blue-600 text-white h-8 w-8"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
