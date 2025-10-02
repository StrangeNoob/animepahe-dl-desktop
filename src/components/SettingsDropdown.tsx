import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Switch } from "./ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  Settings as SettingsIcon,
  Sun,
  Moon,
  Globe,
  BarChart3,
  RefreshCw,
  Save,
  HelpCircle,
} from "lucide-react";
import type { Settings } from "../types";

interface SettingsDropdownProps {
  settings: Settings;
  onThemeToggle: (dark: boolean) => void;
  onAnalyticsToggle: (enabled: boolean) => void;
  onHostChange: (url: string) => void;
  onHostSave: () => void;
  onHostReset: () => void;
  onTourStart: () => void;
  onViewAnalyticsDetails: () => void;
  showCheckUpdates?: boolean;
}

export function SettingsDropdown({
  settings,
  onThemeToggle,
  onAnalyticsToggle,
  onHostChange,
  onHostSave,
  onHostReset,
  onTourStart,
  onViewAnalyticsDetails,
  showCheckUpdates = true,
}: SettingsDropdownProps) {
  const [open, setOpen] = useState(false);
  const [hostUrl, setHostUrl] = useState(settings.hostUrl);

  const handleHostChange = (value: string) => {
    setHostUrl(value);
    onHostChange(value);
  };

  const handleHostSave = () => {
    onHostSave();
  };

  const handleHostReset = () => {
    onHostReset();
    setHostUrl(settings.hostUrl);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <SettingsIcon className="h-4 w-4" />
          Settings
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>App Settings</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Theme Toggle */}
        <div className="px-2 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {settings.themeDark ? (
                <Moon className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Sun className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-sm">Theme</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Light</span>
              <Switch checked={settings.themeDark} onCheckedChange={(checked) => onThemeToggle(checked)} />
              <span className="text-xs text-muted-foreground">Dark</span>
            </div>
          </div>
        </div>

        <DropdownMenuSeparator />

        {/* Analytics Toggle */}
        <div className="px-2 py-2 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Analytics</span>
            </div>
            <Switch
              checked={settings.analyticsEnabled}
              onCheckedChange={onAnalyticsToggle}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Share anonymous usage data to help improve the app
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onViewAnalyticsDetails();
              setOpen(false);
            }}
            className="w-full justify-start text-xs"
          >
            View Analytics Details
          </Button>
        </div>

        <DropdownMenuSeparator />

        {/* Base URL */}
        <div className="px-2 py-2 space-y-2">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Base URL</span>
          </div>
          <Input
            value={hostUrl}
            onChange={(e) => handleHostChange(e.target.value)}
            onBlur={handleHostSave}
            className="text-sm"
            placeholder="https://animepahe.si"
          />
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleHostSave} className="flex-1">
              <Save className="h-3 w-3 mr-1" />
              Save
            </Button>
            <Button variant="ghost" size="sm" onClick={handleHostReset} className="flex-1">
              <RefreshCw className="h-3 w-3 mr-1" />
              Reset
            </Button>
          </div>
        </div>

        <DropdownMenuSeparator />

        {/* Tour */}
        <DropdownMenuItem
          onClick={() => {
            onTourStart();
            setOpen(false);
          }}
        >
          <HelpCircle className="h-4 w-4 mr-2" />
          Take App Tour
        </DropdownMenuItem>

        {showCheckUpdates && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                // This will be handled by the UpdateDialog in App.tsx
                setOpen(false);
              }}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Check for Updates
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
