import { useState } from "react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  Shield,
  Trash2,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  Info
} from "lucide-react";
import posthog from "posthog-js";
import { open } from "@tauri-apps/plugin-shell";

interface AnalyticsDashboardProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

const EVENT_CATEGORIES = [
  {
    category: "User Actions",
    events: [
      { name: "anime_searched", description: "When you search for anime (query length only)" },
      { name: "anime_selected", description: "When you select an anime from results" },
      { name: "episode_selected", description: "When you select episodes" },
      { name: "download_initiated", description: "When you start a download (episode count, no titles)" },
      { name: "download_completed", description: "When a download finishes (success/failure only)" },
    ]
  },
  {
    category: "App Usage",
    events: [
      { name: "app_launched", description: "When the app starts" },
      { name: "session_started", description: "When the app gains focus" },
      { name: "session_duration", description: "When the app loses focus (duration only)" },
      { name: "settings_changed", description: "When you modify settings (setting type only)" },
      { name: "theme_toggled", description: "When you switch themes" },
    ]
  },
  {
    category: "Feature Usage",
    events: [
      { name: "tour_started", description: "When you start the app tour" },
      { name: "tour_completed", description: "When you complete the tour" },
      { name: "tour_skipped", description: "When you skip the tour (step index only)" },
      { name: "requirements_checked", description: "When dependency check runs" },
    ]
  },
  {
    category: "Performance",
    events: [
      { name: "search_performance", description: "Search response time (categorized as fast/medium/slow)" },
      { name: "download_performance", description: "Download speed category and file size category" },
      { name: "app_startup_time", description: "Time to app ready (categorized)" },
    ]
  },
  {
    category: "Errors",
    events: [
      { name: "download_error", description: "When a download fails (error type only, no details)" },
      { name: "app_error", description: "When an error occurs (error type only, no stack traces)" },
    ]
  }
];

const DATA_COLLECTED = [
  { label: "App Version", value: "Current version number", icon: Info },
  { label: "OS Type", value: "Windows/macOS/Linux (no version)", icon: Info },
  { label: "Environment", value: "Development or Production", icon: Info },
  { label: "Theme", value: "Dark or Light mode", icon: Info },
  { label: "Session ID", value: "Random anonymous ID (not tied to you)", icon: Info },
];

const DATA_NOT_COLLECTED = [
  "Anime titles or search queries",
  "File names or paths",
  "Personal information",
  "IP addresses (handled by PostHog)",
  "Exact error messages or stack traces",
  "System specifications beyond OS type"
];

export function AnalyticsDashboard({ enabled, onToggle }: AnalyticsDashboardProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const handleClearData = () => {
    if (confirm("This will clear all locally stored analytics data. Continue?")) {
      // Clear PostHog data
      posthog.reset();

      // Clear session ID
      localStorage.removeItem('analytics_session_id');

      alert("Analytics data cleared successfully. The app will generate a new session ID on next launch.");
    }
  };

  const handleResetId = () => {
    if (confirm("This will generate a new anonymous session ID. Your previous analytics data will remain but won't be linked to the new ID. Continue?")) {
      const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      localStorage.setItem('analytics_session_id', newSessionId);

      // Update PostHog with new session ID
      posthog.register({
        session_id: newSessionId
      });

      alert("New session ID generated successfully.");
    }
  };

  const toggleCategory = (category: string) => {
    setExpandedCategory(expandedCategory === category ? null : category);
  };

  return (
    <div className="space-y-6">
        {/* Status Section */}
        <div className="flex items-center justify-between p-4 rounded-lg border border-border/60 bg-background/60">
          <div className="flex items-center gap-3">
            {enabled ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500" />
            )}
            <div>
              <p className="font-medium">
                Analytics {enabled ? "Enabled" : "Disabled"}
              </p>
              <p className="text-sm text-muted-foreground">
                {enabled
                  ? "Helping us improve the app with anonymous usage data"
                  : "No data is being collected"}
              </p>
            </div>
          </div>
          <Badge variant={enabled ? "default" : "secondary"}>
            {enabled ? "Active" : "Inactive"}
          </Badge>
        </div>

        {/* What We Collect Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              What We Collect
            </h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDetails(!showDetails)}
            >
              {showDetails ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-1" />
                  Hide Details
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-1" />
                  Show Details
                </>
              )}
            </Button>
          </div>

          {showDetails && (
            <div className="space-y-4">
              {/* Super Properties */}
              <div className="rounded-lg border border-border/60 bg-background/60 p-4">
                <h5 className="text-xs font-medium text-muted-foreground mb-3">
                  Super Properties (sent with every event)
                </h5>
                <div className="grid gap-2">
                  {DATA_COLLECTED.map((item) => (
                    <div key={item.label} className="flex items-start gap-2 text-sm">
                      <item.icon className="h-4 w-4 mt-0.5 text-muted-foreground" />
                      <div>
                        <span className="font-medium">{item.label}:</span>{" "}
                        <span className="text-muted-foreground">{item.value}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* What We Don't Collect */}
              <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-4">
                <h5 className="text-xs font-medium text-green-600 dark:text-green-400 mb-3">
                  What We DON'T Collect
                </h5>
                <ul className="space-y-1.5">
                  {DATA_NOT_COLLECTED.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0" />
                      <span className="text-muted-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Event Types Section */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Event Types Tracked</h4>
          <div className="space-y-2">
            {EVENT_CATEGORIES.map((cat) => (
              <div key={cat.category} className="rounded-lg border border-border/60 bg-background/60">
                <button
                  onClick={() => toggleCategory(cat.category)}
                  className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/50 transition-colors rounded-lg"
                >
                  <span className="font-medium text-sm">{cat.category}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {cat.events.length} events
                    </Badge>
                    {expandedCategory === cat.category ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </button>
                {expandedCategory === cat.category && (
                  <div className="px-3 pb-3 space-y-2">
                    {cat.events.map((event) => (
                      <div key={event.name} className="pl-4 py-2 border-l-2 border-primary/30">
                        <code className="text-xs font-mono text-primary">{event.name}</code>
                        <p className="text-xs text-muted-foreground mt-1">{event.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Why We Collect */}
        <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
          <h5 className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-2">
            Why We Collect This Data
          </h5>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">•</span>
              <span>Understand which features are most useful</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">•</span>
              <span>Identify and fix bugs and performance issues</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">•</span>
              <span>Improve app stability and user experience</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">•</span>
              <span>Make data-driven decisions about new features</span>
            </li>
          </ul>
        </div>

        {/* Actions */}
        <div className="space-y-3 pt-3 border-t">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetId}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Reset Anonymous ID
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearData}
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Clear Analytics Data
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => open("https://github.com/StrangeNoob/animepahe-dl-desktop/blob/main/PRIVACY.md")}
              className="flex items-center gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Privacy Policy
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            All analytics data is processed by PostHog with privacy-first defaults. We never sell your data.
          </p>
        </div>
    </div>
  );
}
