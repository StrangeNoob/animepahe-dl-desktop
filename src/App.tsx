import { useEffect, useState, useMemo, useRef, type ReactNode } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { open as selectDirectory } from "@tauri-apps/plugin-dialog";
import UpdateDialog from "./components/UpdateDialog";
import { SplashScreen } from "./components/SplashScreen";
import { checkForUpdates } from "./utils/updateChecker";
import {
  measureSearchPerformance,
  measureDownloadSpeed,
  trackAppStartupTime,
  SessionTracker
} from "./lib/analytics-utils";

import {
  loadSettings,
  saveSettings,
  searchAnime,
  fetchEpisodes,
  previewSources,
  startDownload,
  checkRequirements,
  cancelDownload,
} from "./api";
import type {
  Settings,
  SearchItem,
  FetchEpisodesResponse,
  PreviewItem,
  DownloadStatusEvent,
  DownloadProgressEvent,
  RequirementsCheckResponse,
} from "./types";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./components/ui/dialog";
import { Progress } from "./components/ui/progress";
import { cn } from "./lib/utils";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./components/ui/select";
import {
  DownloadCloud,
  FolderSearch,
  FolderOpen,
  ListChecks,
  Loader2,
  MonitorPlay,
  Search as SearchIcon,
  Sparkles,
  HelpCircle,
  X,
  RefreshCw,
} from "lucide-react";
import { Autocomplete, type AutocompleteOption } from "./components/ui/autocomplete";
import { RequirementsDialog } from "./components/RequirementsDialog";
import { TourProvider } from "./components/tour/TourProvider";
import { useTour } from "./components/tour/TourProvider";
import { PostHogProvider } from "./lib/posthog";
import { usePostHog } from "posthog-js/react";
import { AnalyticsDashboard } from "./components/AnalyticsDashboard";
import { SettingsDropdown } from "./components/SettingsDropdown";
import { ResumeDownloadsDialog } from "./components/ResumeDownloadsDialog";
import { ResumeNotificationBanner } from "./components/ResumeNotificationBanner";
import { useAutoResumeDetection } from "./hooks/useAutoResumeDetection";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./components/ui/tabs";
import { Library as LibraryIcon, Download } from "lucide-react";
import { LibraryView } from "./components/LibraryView";
import { DuplicateWarning } from "./components/DuplicateWarning";
import { useDuplicateDetection } from "./hooks/useDuplicateDetection";
import { NotificationProvider, useNotificationContext } from "./contexts/NotificationContext";
import { useDownloadNotifications } from "./hooks/useDownloadNotifications";
import { NotificationToastContainer } from "./components/NotificationToast";
import { NotificationSettingsDialog } from "./components/NotificationSettingsDialog";

const defaultSettings: Settings = {
  downloadDir: null,
  themeDark: true,
  hostUrl: "https://animepahe.si",
  tourCompleted: false,
  analyticsEnabled: true,
};

const RESOLUTION_PRESETS = ["1080", "720", "480", "360", "240"] as const;

const isPresetResolution = (value: string): value is (typeof RESOLUTION_PRESETS)[number] =>
  RESOLUTION_PRESETS.includes(value as (typeof RESOLUTION_PRESETS)[number]);

interface EpisodeSummary {
  resolutions: string[];
  audios: string[];
  message?: string;
}

const formatEpisodesSpec = (episodes: number[]): string =>
  episodes
    .slice()
    .sort((a, b) => a - b)
    .join(",");

const parseEpisodeSpec = (value: string, availableEpisodes: number[]): { episodes: number[]; error: string | null } => {
  const cleaned = value.trim();
  if (!cleaned) {
    return { episodes: [], error: null };
  }

  const parts = cleaned
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (!parts.length) {
    return { episodes: [], error: null };
  }

  const sortedAvailable = [...availableEpisodes].sort((a, b) => a - b);
  if (!sortedAvailable.length) {
    return { episodes: [], error: "No episodes available to match." };
  }

  const availableSet = new Set(sortedAvailable);

  if (parts.some((part) => part.includes("*"))) {
    return { episodes: sortedAvailable, error: null };
  }

  const result = new Set<number>();

  for (const part of parts) {
    const rangeParts = part.split("-").map((n) => n.trim());
    if (rangeParts.length === 2) {
      const [startStr, endStr] = rangeParts;
      if (!startStr || !endStr) {
        return { episodes: [], error: `Range '${part}' is incomplete.` };
      }
      const start = Number(startStr);
      const end = Number(endStr);
      if (!Number.isInteger(start) || !Number.isInteger(end)) {
        return { episodes: [], error: `Range '${part}' must use whole numbers.` };
      }
      if (start > end) {
        return { episodes: [], error: `Range '${part}' is inverted.` };
      }
      for (let current = start; current <= end; current += 1) {
        if (!availableSet.has(current)) {
          return { episodes: [], error: `Episode ${current} is not available.` };
        }
        result.add(current);
      }
      continue;
    }

    const numberValue = Number(part);
    if (!Number.isInteger(numberValue)) {
      return { episodes: [], error: `'${part}' is not a valid episode number.` };
    }
    if (!availableSet.has(numberValue)) {
      return { episodes: [], error: `Episode ${numberValue} is not available.` };
    }
    result.add(numberValue);
  }

  return { episodes: [...result].sort((a, b) => a - b), error: null };
};

const formatResolutionLabel = (value: string) => {
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    return `${trimmed}p`;
  }
  return trimmed;
};

const formatAudioLabel = (value: string) => {
  switch (value.trim().toLowerCase()) {
    case "eng":
      return "Dub (ENG)";
    case "jpn":
      return "Sub (JPN)";
    case "ja":
      return "Sub (JA)";
    default:
      return value.trim().toUpperCase();
  }
};

const formatSpeed = (bps: number): string => {
  if (bps === 0) return "—";
  if (bps < 1024) return `${bps.toFixed(0)} B/s`;
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(1)} KB/s`;
  return `${(bps / (1024 * 1024)).toFixed(1)} MB/s`;
};

const formatElapsedTime = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (minutes < 60) return `${minutes}m ${secs}s`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m ${secs}s`;
};

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const sortResolutionValues = (values: Iterable<string>) => {
  return Array.from(new Set(
    Array.from(values, (value) => value.trim()).filter((value) => value.length > 0),
  )).sort((a, b) => {
    const aNum = parseInt(a.replace(/[^0-9]/g, ""), 10) || 0;
    const bNum = parseInt(b.replace(/[^0-9]/g, ""), 10) || 0;
    return bNum - aNum;
  });
};

const sortAudioValues = (values: Iterable<string>) => {
  return Array.from(new Set(
    Array.from(values, (value) => value.trim().toLowerCase()).filter((value) => value.length > 0),
  )).sort((a, b) => {
    const rank = (input: string) => {
      if (input === "eng") return 0;
      if (input === "jpn") return 1;
      return 2;
    };
    const diff = rank(a) - rank(b);
    return diff !== 0 ? diff : a.localeCompare(b);
  });
};

const ACTIVE_STATUS_KEYWORDS = ["fetching", "extracting", "downloading"];

const isActiveStatus = (status: string) => {
  const normalized = status.toLowerCase();
  if (
    normalized.startsWith("failed") ||
    normalized.startsWith("done") ||
    normalized.includes("no matching") ||
    normalized.includes("m3u8") ||
    normalized.includes("no episodes selected")
  ) {
    return false;
  }
  return ACTIVE_STATUS_KEYWORDS.some((keyword) => normalized.includes(keyword));
};

const selectCandidate = (
  candidates: PreviewItem["sources"],
  audioPref?: string,
  resolutionPref?: string,
) => {
  if (!candidates.length) {
    return null;
  }

  const nonAv1 = candidates.filter((candidate) => candidate.av1 !== "1");
  let pool = nonAv1.length ? nonAv1 : [...candidates];

  if (audioPref) {
    const matchingAudio = pool.filter((candidate) => candidate.audio === audioPref);
    if (matchingAudio.length) {
      pool = matchingAudio;
    }
  }

  if (resolutionPref) {
    const matchingResolution = pool.filter((candidate) => candidate.resolution === resolutionPref);
    if (matchingResolution.length) {
      pool = matchingResolution;
    }
  }

  const preferred = [...pool].reverse().find((candidate) => candidate.src.includes("kwik"));
  return preferred ?? pool[pool.length - 1] ?? null;
};

interface StatusMap {
  [episode: number]: string;
}

interface ProgressMap {
  [episode: number]: {
    done: number;
    total: number;
    speedBps: number;
    elapsedSeconds: number;
  };
}

function AppContent() {
  const { startTour } = useTour();
  const posthog = usePostHog();
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [appVersion, setAppVersion] = useState('0.2.5');
  const [showSplash, setShowSplash] = useState(true);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedAnime, setSelectedAnime] = useState<SearchItem | null>(null);

  const [slug, setSlug] = useState("");
  const [episodesSpec, setEpisodesSpec] = useState("");
  const [episodesSpecError, setEpisodesSpecError] = useState<string | null>(null);
  const [resolution, setResolution] = useState("");
  const [resolutionChoice, setResolutionChoice] = useState("any");
  const [customResolution, setCustomResolution] = useState("");
  const [audio, setAudio] = useState("");
  const [threads, setThreads] = useState(10);
  const [listOnly] = useState(false);

  const [episodes, setEpisodes] = useState<FetchEpisodesResponse | null>(null);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [episodeSummaries, setEpisodeSummaries] = useState<Record<number, EpisodeSummary>>({});
  const [episodeSummaryLoading, setEpisodeSummaryLoading] = useState(false);
  const [episodeSummaryError, setEpisodeSummaryError] = useState<string | null>(null);
  const [selectedEpisodes, setSelectedEpisodes] = useState<number[]>([]);

  // Library tab state
  const [activeTab, setActiveTab] = useState("download");

  // Duplicate detection
  const { duplicates, isLoading: duplicatesLoading } = useDuplicateDetection(
    slug || null,
    selectedEpisodes
  );
  const [previewData, setPreviewData] = useState<PreviewItem[] | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewCache, setPreviewCache] = useState<Record<number, PreviewItem>>({});
  const [statusMap, setStatusMap] = useState<StatusMap>({});
  const [downloadPaths, setDownloadPaths] = useState<Record<number, string>>({});
  const [progressMap, setProgressMap] = useState<ProgressMap>({});
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requirements, setRequirements] = useState<RequirementsCheckResponse | null>(null);
  const [requirementsDialogOpen, setRequirementsDialogOpen] = useState(false);
  const [showAnalyticsDashboard, setShowAnalyticsDashboard] = useState(false);
  const episodesRequestId = useRef(0);
  const summaryRequestId = useRef(0);
  const specUpdateSource = useRef<"input" | "selection" | null>(null);
  const downloadStartTimes = useRef<Record<number, number>>({});

  // Resume downloads feature
  const { incompleteCount, showNotification, dismissNotification } = useAutoResumeDetection();
  const [resumeDialogOpen, setResumeDialogOpen] = useState(false);

  // Download notifications
  const { toasts, removeToast } = useDownloadNotifications();
  const { startBatch } = useNotificationContext();

  const availableResolutions = useMemo(() => {
    const values = new Set<string>();
    Object.values(previewCache).forEach((item) => {
      item.sources.forEach((source) => {
        if (source.resolution) {
          values.add(source.resolution);
        }
      });
    });
    return sortResolutionValues(values);
  }, [previewCache]);

  const availableAudios = useMemo(() => {
    const values = new Set<string>();
    Object.values(previewCache).forEach((item) => {
      item.sources.forEach((source) => {
        if (source.audio) {
          values.add(source.audio);
        }
      });
    });

    return sortAudioValues(values);
  }, [previewCache]);

  const slugMissing = slug.trim().length === 0;

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Load settings
        const loadedSettings = await loadSettings();
        setSettings(loadedSettings);

        // Load app version from Tauri backend
        const version = await invoke<string>('get_app_version');
        setAppVersion(version);

        // Check for updates (with 5 second timeout)
        const updateInfo = await checkForUpdates(version, 'StrangeNoob', 'animepahe-dl-desktop', 5000);

        // Hide splash screen after check completes
        setShowSplash(false);

        // If update available, show update dialog
        if (updateInfo?.updateAvailable) {
          setTimeout(() => setUpdateDialogOpen(true), 500);
        }

        // Auto-start tour for first-time users (if no update dialog)
        if (!loadedSettings.tourCompleted && !updateInfo?.updateAvailable) {
          setTimeout(() => startTour(), 1000);
        }
      } catch (err) {
        console.error("Failed to initialize app", err);
        setShowSplash(false);
      }
    };

    initializeApp();
  }, [startTour]);

  useEffect(() => {
    // Check requirements on app startup
    checkRequirements()
      .then((reqs) => {
        setRequirements(reqs);
        if (!reqs.allAvailable) {
          setRequirementsDialogOpen(true);
        }
      })
      .catch((err) => console.error("Failed to check requirements", err));
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", settings.themeDark);
    document.documentElement.classList.toggle("light", !settings.themeDark);
  }, [settings.themeDark]);

  useEffect(() => {
    const statusUnlisten = listen<DownloadStatusEvent>("download-status", (event) => {
      const { episode, status, path } = event.payload;
      setStatusMap((prev) => {
        const next = { ...prev, [episode]: status };
        const hasActive = Object.entries(next).some(([ep, st]) => {
          if (Number(ep) === 0) return false;
          return isActiveStatus(st);
        });
        setIsBusy(hasActive);
        return next;
      });
      if (path) {
        setDownloadPaths((prev) => ({ ...prev, [episode]: path }));
      }

      // Track download completion or failure
      const statusLower = status.toLowerCase();
      if (statusLower.includes('done')) {
        posthog?.capture('download_completed', {
          success: true
        });

        // Track download performance
        const startTime = downloadStartTimes.current[episode];
        const progress = progressMap[episode];
        if (startTime && progress && progress.total > 0) {
          const duration = Date.now() - startTime;
          measureDownloadSpeed(posthog, progress.total, duration);
          delete downloadStartTimes.current[episode];
        }
      } else if (statusLower.includes('failed')) {
        posthog?.capture('download_completed', {
          success: false
        });
        delete downloadStartTimes.current[episode];
      }
    });
    const progressUnlisten = listen<DownloadProgressEvent>("download-progress", (event) => {
      setProgressMap((prev) => ({
        ...prev,
        [event.payload.episode]: {
          done: event.payload.done,
          total: event.payload.total,
          speedBps: event.payload.speedBps,
          elapsedSeconds: event.payload.elapsedSeconds,
        },
      }));
    });
    return () => {
      statusUnlisten.then((fn) => fn());
      progressUnlisten.then((fn) => fn());
    };
  }, [posthog]);

  // Session tracking
  useEffect(() => {
    if (!posthog) return;

    const sessionTracker = new SessionTracker(posthog);

    const handleFocus = () => {
      sessionTracker.startSession();
    };

    const handleBlur = () => {
      sessionTracker.endSession();
    };

    // Start session on mount
    sessionTracker.startSession();

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      sessionTracker.endSession();
    };
  }, [posthog]);

  useEffect(() => {
    if (resolution && !isPresetResolution(resolution) && customResolution !== resolution) {
      setCustomResolution(resolution);
    }
  }, [resolution, customResolution]);

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    let active = true;
    setSearchLoading(true);
    const searchStartTime = Date.now();

    // Track search event
    posthog?.capture('anime_searched', {
      query_length: searchQuery.trim().length,
      timestamp: new Date().toISOString()
    });

    const timer = window.setTimeout(() => {
      searchAnime(searchQuery.trim(), settings.hostUrl)
        .then((results) => {
          if (active) {
            setSearchResults(results);

            const searchDuration = Date.now() - searchStartTime;

            // Track search results received
            posthog?.capture('search_results_received', {
              result_count: results.length,
              search_duration_ms: searchDuration
            });

            // Track search performance
            measureSearchPerformance(posthog, searchDuration, results.length);
          }
        })
        .catch((err) => {
          console.error(err);
          if (active) {
            setSearchResults([]);
          }
        })
        .finally(() => {
          if (active) {
            setSearchLoading(false);
          }
        });
    }, 350);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [searchQuery, settings.hostUrl, posthog]);

  const handleSelectAnime = (item: SearchItem) => {
    setSelectedAnime(item);
    setSlug(item.session);
    setSearchQuery(item.title);
    setEpisodes(null);
    setSelectedEpisodes([]);
    setEpisodeSummaries({});
    setEpisodeSummaryLoading(false);
    setEpisodeSummaryError(null);
    setPreviewCache({});
    setEpisodesSpec("");
    setEpisodesSpecError(null);
    specUpdateSource.current = null;
    setStatusMap({});
    setDownloadPaths({});
    setProgressMap({});
    setPreviewData(null);
    setError(null);

    // Track anime selection
    posthog?.capture('anime_selected', {
      has_episodes: false // Will be updated when episodes are fetched
    });
  };

  const handleSearchInput = (value: string, source: "input" | "selection" = "input") => {
    setSearchQuery(value);
    if (source === "selection") {
      return;
    }
    if (!selectedAnime || selectedAnime.title !== value) {
      setSelectedAnime(null);
      setSlug("");
      setEpisodes(null);
      setSelectedEpisodes([]);
      setDownloadPaths({});
      setEpisodeSummaries({});
      setEpisodeSummaryLoading(false);
      setEpisodeSummaryError(null);
      setPreviewCache({});
      setEpisodesSpec("");
      setEpisodesSpecError(null);
      specUpdateSource.current = null;
      setStatusMap({});
      setProgressMap({});
      setPreviewData(null);
    }
  };

  const handleResolutionSelect = (value: string) => {
    setResolutionChoice(value);
    if (value === "any") {
      setResolution("");
      return;
    }
    if (value === "custom") {
      setResolution(customResolution);
      return;
    }
    setResolution(value);
  };

  const handleEpisodesSpecChange = (value: string) => {
    setEpisodesSpec(value);

    if (!episodes) {
      setSelectedEpisodes([]);
      if (value.trim()) {
        setEpisodesSpecError("Select an anime to load episodes first.");
      } else {
        setEpisodesSpecError(null);
      }
      return;
    }

    const available = episodes.episodes.map((ep) => ep.number);
    const { episodes: parsedEpisodes, error } = parseEpisodeSpec(value, available);

    if (error) {
      setEpisodesSpecError(error);
      return;
    }

    setEpisodesSpecError(null);
    specUpdateSource.current = "input";
    setSelectedEpisodes(parsedEpisodes);

    // Track episode selection via range/manual input
    if (parsedEpisodes.length > 0) {
      const selectionType = value.includes('-') ? 'range' : value === '*' ? 'all' : 'manual';
      posthog?.capture('episode_selected', {
        selection_type: selectionType
      });
    }
  };

  const autocompleteItems: AutocompleteOption[] = useMemo(
    () =>
      searchResults.map((item) => ({
        value: item.session,
        label: item.title,
        description: `slug: ${item.session}`,
      })),
    [searchResults],
  );
  useEffect(() => {
    if (!selectedAnime) {
      setEpisodesLoading(false);
      return;
    }

    const trimmedSlug = selectedAnime.session.trim();
    if (!trimmedSlug) {
      setEpisodesLoading(false);
      return;
    }

    const requestId = ++episodesRequestId.current;
    let active = true;

    setEpisodesLoading(true);
    setError(null);

    fetchEpisodes(trimmedSlug, settings.hostUrl, selectedAnime.title)
      .then((data) => {
        if (!active || episodesRequestId.current !== requestId) {
          return;
        }
        setEpisodes(data);
        setSelectedEpisodes([]);
      })
      .catch((err) => {
        console.error(err);
        if (!active || episodesRequestId.current !== requestId) {
          return;
        }
        setError(String(err));
        setEpisodes(null);
      })
      .finally(() => {
        if (!active || episodesRequestId.current !== requestId) {
          return;
        }
        setEpisodesLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedAnime, settings.hostUrl]);

  useEffect(() => {
    if (!episodes || slugMissing) {
      setEpisodeSummaries({});
      setPreviewCache({});
      setEpisodeSummaryLoading(false);
      setEpisodeSummaryError(null);
      summaryRequestId.current += 1;
      return;
    }

    const episodeNumbers = episodes.episodes.map((ep) => ep.number);
    if (!episodeNumbers.length) {
      setEpisodeSummaries({});
      setPreviewCache({});
      setEpisodeSummaryLoading(false);
      setEpisodeSummaryError(null);
      return;
    }

    const requestId = ++summaryRequestId.current;
    let active = true;

    setEpisodeSummaries({});
    setPreviewCache({});
    setEpisodeSummaryLoading(true);
    setEpisodeSummaryError(null);

    previewSources(slug, settings.hostUrl, episodeNumbers, episodes)
      .then((items) => {
        if (!active || summaryRequestId.current !== requestId) {
          return;
        }

        const cacheMap: Record<number, PreviewItem> = {};

        items.forEach((item) => {
          cacheMap[item.episode] = item;
        });

        setPreviewCache(cacheMap);
      })
      .catch((err) => {
        console.error(err);
        if (!active || summaryRequestId.current !== requestId) {
          return;
        }
        setPreviewCache({});
        setEpisodeSummaryError(String(err));
      })
      .finally(() => {
        if (!active || summaryRequestId.current !== requestId) {
          return;
        }
        setEpisodeSummaryLoading(false);
      });

    return () => {
      active = false;
    };
  }, [episodes, slug, settings.hostUrl, slugMissing]);

  useEffect(() => {
    if (resolutionChoice !== "any" && resolutionChoice !== "custom") {
      if (!availableResolutions.includes(resolutionChoice)) {
        setResolutionChoice("any");
        setResolution("");
      }
    }
  }, [availableResolutions, resolutionChoice]);

  useEffect(() => {
    if (audio && !availableAudios.includes(audio)) {
      setAudio("");
    }
  }, [availableAudios, audio]);

  useEffect(() => {
    if (!episodes) {
      setEpisodeSummaries({});
      return;
    }

    const audioPref = audio || undefined;
    const resolutionPref = resolution || undefined;

    const summaryMap: Record<number, EpisodeSummary> = {};

    episodes.episodes.forEach((ep) => {
      const preview = previewCache[ep.number];
      if (!preview) {
        return;
      }

      const resValues = new Set<string>();
      const audioValues = new Set<string>();

      preview.sources.forEach((source) => {
        if (source.resolution) {
          resValues.add(source.resolution);
        }
        if (source.audio) {
          audioValues.add(source.audio);
        }
      });

      const sortedResolutions = sortResolutionValues(resValues);
      const sortedAudios = sortAudioValues(audioValues);

      const candidate = selectCandidate(preview.sources, audioPref, resolutionPref);
      const message = !candidate && (audioPref || resolutionPref)
        ? "Not available with current filters"
        : undefined;

      summaryMap[ep.number] = {
        resolutions: sortedResolutions,
        audios: sortedAudios,
        message,
      };
    });

    setEpisodeSummaries(summaryMap);
  }, [previewCache, episodes, audio, resolution]);

  useEffect(() => {
    if (!episodes) {
      specUpdateSource.current = "input";
      setSelectedEpisodes([]);
      return;
    }

    if (!episodesSpec.trim()) {
      setEpisodesSpecError(null);
      specUpdateSource.current = "input";
      setSelectedEpisodes([]);
      return;
    }

    const available = episodes.episodes.map((ep) => ep.number);
    const { episodes: parsedEpisodes, error } = parseEpisodeSpec(episodesSpec, available);

    if (error) {
      setEpisodesSpecError(error);
      return;
    }

    setEpisodesSpecError(null);
    specUpdateSource.current = "input";
    setSelectedEpisodes(parsedEpisodes);
  }, [episodes]);

  const handleToggleEpisode = (episode: number) => {
    setSelectedEpisodes((prev) =>
      prev.includes(episode) ? prev.filter((n) => n !== episode) : [...prev, episode]
    );
  };

  useEffect(() => {
    if (specUpdateSource.current === "input") {
      specUpdateSource.current = null;
      return;
    }

    if (!episodes) {
      if (!episodesSpec && selectedEpisodes.length === 0) {
        return;
      }
      specUpdateSource.current = "selection";
      setEpisodesSpec("");
      setEpisodesSpecError(null);
      specUpdateSource.current = null;
      return;
    }

    const formatted = formatEpisodesSpec(selectedEpisodes);
    specUpdateSource.current = "selection";
    setEpisodesSpec(formatted);
    setEpisodesSpecError(null);
    specUpdateSource.current = null;
  }, [selectedEpisodes, episodes]);

  const handleSelectAll = () => {
    if (!episodes) return;
    setSelectedEpisodes(episodes.episodes.map((ep) => ep.number));

    // Track episode selection
    posthog?.capture('episode_selected', {
      selection_type: 'all'
    });
  };

  const handleClearSelection = () => {
    setSelectedEpisodes([]);

    // Track episode deselection
    posthog?.capture('episode_selected', {
      selection_type: 'clear'
    });
  };

  const handleChooseDir = async () => {
    const directory = await selectDirectory({ directory: true, multiple: false });
    if (directory && typeof directory === "string") {
      const next = { ...settings, downloadDir: directory };
      setSettings(next);
      await saveSettings(next);

      // Track settings change
      posthog?.capture('settings_changed', {
        changed_setting: 'download_directory',
        theme: settings.themeDark ? 'dark' : 'light'
      });
    }
  };

  const handleClearDir = async () => {
    const next = { ...settings, downloadDir: null };
    setSettings(next);
    await saveSettings(next);

    // Track settings change
    posthog?.capture('settings_changed', {
      changed_setting: 'download_directory',
      theme: settings.themeDark ? 'dark' : 'light'
    });
  };

  const handleOpenDownload = async (path?: string) => {
    if (!path) return;
    try {
      await invoke("open_path", { path });
    } catch (err) {
      console.error("Failed to open path", err);
      setError("Failed to open download folder.");
    }
  };

  const handleCancelDownload = async (episode: number) => {
    try {
      await cancelDownload(episode);
    } catch (err) {
      console.error("Failed to cancel download", err);
      setError(`Failed to cancel download for episode ${episode}`);
    }
  };

  const handleRetryDownload = async (episode: number) => {
    if (slugMissing) {
      setError("Select an anime before retrying download.");
      return;
    }

    setError(null);

    // Clear the failed status for this episode
    setStatusMap((prev) => {
      const next = { ...prev };
      delete next[episode];
      return next;
    });

    // Track retry event
    posthog?.capture('download_retry', {
      episode,
      resolution: resolution || 'any',
      audio: audio || 'any'
    });

    try {
      await startDownload({
        animeName: selectedAnime?.title ?? searchQuery,
        animeSlug: slug,
        episodes: [episode], // Only retry this specific episode
        audioType: audio,
        resolution,
        downloadDir: settings.downloadDir,
        host: settings.hostUrl,
      });

      // Record download start time
      downloadStartTimes.current[episode] = Date.now();
    } catch (err) {
      console.error(err);
      const errorMessage = String(err);
      setError(`Failed to retry episode ${episode}: ${errorMessage}`);

      // Track retry error
      posthog?.capture('download_retry_error', {
        episode,
        error_type: errorMessage.includes('network') ? 'network_error' : 'unknown_error'
      });
    }
  };

  const handleRemoveDuplicates = () => {
    const duplicateEpisodes = new Set(duplicates.map(d => d.episode));
    const filtered = selectedEpisodes.filter(ep => !duplicateEpisodes.has(ep));
    setSelectedEpisodes(filtered);

    // Update the spec to reflect the filtered episodes
    if (filtered.length === 0) {
      setEpisodesSpec("");
    } else {
      setEpisodesSpec(filtered.join(","));
    }
  };

  const handleViewLibrary = () => {
    setActiveTab("library");
  };

  const toggleTheme = async (dark: boolean) => {
    const next = { ...settings, themeDark: dark };
    setSettings(next);
    await saveSettings(next);

    // Track theme toggle
    posthog?.capture('theme_toggled', {
      new_theme: dark ? 'dark' : 'light'
    });
  };

  const handleHostChange = (value: string) => {
    const next = { ...settings, hostUrl: value };
    setSettings(next);
  };

  const persistHost = async () => {
    await saveSettings(settings);

    // Track settings change
    posthog?.capture('settings_changed', {
      changed_setting: 'host_url',
      theme: settings.themeDark ? 'dark' : 'light'
    });
  };

  const handleResetHost = async () => {
    const next = { ...settings, hostUrl: "https://animepahe.ru" };
    setSettings(next);
    await saveSettings(next);

    // Track settings change
    posthog?.capture('settings_changed', {
      changed_setting: 'host_url',
      theme: settings.themeDark ? 'dark' : 'light'
    });
  };

  const handleDownload = async () => {
    if (slugMissing) {
      setError("Select an anime before downloading.");
      return;
    }
    setError(null);
    setIsBusy(true);

    const downloadStartTime = Date.now();

    // Start batch tracking for notifications
    startBatch(selectedEpisodes.length);

    // Track download initiation
    posthog?.capture('download_initiated', {
      episode_count: selectedEpisodes.length,
      resolution: resolution || 'any',
      audio: audio || 'any',
      download_mode: listOnly ? 'list' : 'download',
      has_custom_dir: !!settings.downloadDir
    });

    try {
      await startDownload({
        animeName: selectedAnime?.title ?? searchQuery,
        animeSlug: slug,
        episodes: selectedEpisodes,
        audioType: audio,
        resolution,
        downloadDir: settings.downloadDir,
        host: settings.hostUrl,
      });

      // Record download start time for each episode for performance tracking
      const now = Date.now();
      selectedEpisodes.forEach((episode) => {
        downloadStartTimes.current[episode] = now;
      });
    } catch (err) {
      console.error(err);
      const errorMessage = String(err);
      setError(errorMessage);

      // Track download error
      const errorType = errorMessage.includes('Missing required dependencies')
        ? 'missing_dependencies'
        : errorMessage.includes('network')
          ? 'network_error'
          : 'unknown_error';

      posthog?.capture('download_error', {
        error_type: errorType,
        duration_seconds: Math.round((Date.now() - downloadStartTime) / 1000)
      });

      // If the error mentions missing dependencies, check requirements and show dialog
      if (errorMessage.includes("Missing required dependencies")) {
        try {
          const reqs = await checkRequirements();
          setRequirements(reqs);
          if (!reqs.allAvailable) {
            setRequirementsDialogOpen(true);
          }
        } catch (reqErr) {
          console.error("Failed to check requirements after download error:", reqErr);
        }
      }
      setIsBusy(false);
    }
  };

  // Show splash screen while initializing
  if (showSplash) {
    return <SplashScreen />;
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground transition-colors">
      {/* Resume downloads notification banner */}
      {showNotification && incompleteCount > 0 && (
        <ResumeNotificationBanner
          count={incompleteCount}
          onResume={() => setResumeDialogOpen(true)}
          onDismiss={dismissNotification}
        />
      )}

      {/* Resume downloads dialog */}
      <ResumeDownloadsDialog
        open={resumeDialogOpen}
        onOpenChange={setResumeDialogOpen}
      />

      <div className="pointer-events-none absolute -left-20 top-10 h-64 w-64 rounded-full bg-gradient-to-br from-purple-500/40 via-pink-500/30 to-cyan-400/30 blur-3xl" />
      <div className="pointer-events-none absolute right-10 bottom-10 h-72 w-72 rounded-full bg-gradient-to-br from-cyan-400/30 via-purple-500/25 to-transparent blur-3xl" />
      <div className="pointer-events-none absolute right-16 top-16 text-5xl opacity-70 animate-pulse">🌸</div>
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col gap-6 p-6">
        <Card className="border border-white/10 bg-white/5 backdrop-blur-xl shadow-[0_25px_65px_-35px_rgba(59,130,246,0.55)]">
          <CardContent className="flex flex-col gap-4 py-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xl font-semibold">
                <Sparkles className="h-5 w-5 text-primary" />
                Animepahe DL Desktop
              </div>
              <p className="text-sm text-muted-foreground">Search, preview, and download anime with neon flair.</p>
            </div>
            <div className="flex items-center gap-2" data-tour="settings-section">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setResumeDialogOpen(true)}
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Resume Downloads
              </Button>
              <NotificationSettingsDialog />
              <SettingsDropdown
                settings={settings}
                onThemeToggle={toggleTheme}
                onAnalyticsToggle={async (checked) => {
                  const next = { ...settings, analyticsEnabled: checked };
                  setSettings(next);
                  await saveSettings(next);

                  // Track settings change (only if enabling analytics)
                  if (checked) {
                    posthog?.capture('settings_changed', {
                      changed_setting: 'analytics_enabled',
                      theme: settings.themeDark ? 'dark' : 'light'
                    });
                  }
                }}
                onHostChange={handleHostChange}
                onHostSave={persistHost}
                onHostReset={handleResetHost}
                onTourStart={startTour}
                onViewAnalyticsDetails={() => setShowAnalyticsDashboard(true)}
                showCheckUpdates={false}
              />
              <UpdateDialog
                currentVersion={appVersion}
                repoOwner="StrangeNoob"
                repoName="animepahe-dl-desktop"
                open={updateDialogOpen}
                onOpenChange={setUpdateDialogOpen}
              />
            </div>
          </CardContent>
        </Card>

        {/* Analytics Dashboard Dialog */}
        <Dialog open={showAnalyticsDashboard} onOpenChange={setShowAnalyticsDashboard}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Analytics Dashboard</DialogTitle>
              <DialogDescription>
                View what data we collect and manage your analytics preferences
              </DialogDescription>
            </DialogHeader>
            <AnalyticsDashboard
              enabled={settings.analyticsEnabled}
              onToggle={async (checked) => {
                const next = { ...settings, analyticsEnabled: checked };
                setSettings(next);
                await saveSettings(next);

                // Track settings change (only if enabling analytics)
                if (checked) {
                  posthog?.capture('settings_changed', {
                    changed_setting: 'analytics_enabled',
                    theme: settings.themeDark ? 'dark' : 'light'
                  });
                }
              }}
            />
          </DialogContent>
        </Dialog>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-6">
            <TabsTrigger value="download" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Download
            </TabsTrigger>
            <TabsTrigger value="library" className="flex items-center gap-2">
              <LibraryIcon className="h-4 w-4" />
              Library
            </TabsTrigger>
          </TabsList>

          <TabsContent value="download" className="mt-0">
            {/* Duplicate Warning */}
            {duplicates.length > 0 && (
              <DuplicateWarning
                duplicates={duplicates}
                onRemoveDuplicates={handleRemoveDuplicates}
                onViewLibrary={handleViewLibrary}
              />
            )}

            <div className="grid gap-6 xl:grid-cols-3">
              <Card className="xl:col-span-1 glass-card overflow-visible">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <SearchIcon className="h-5 w-5 text-primary" />
                    Search & Filters
                  </CardTitle>
                </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Anime</label>
                <div data-tour="search-input">
                  <Autocomplete
                    value={selectedAnime?.session ?? null}
                    onChange={(option) => {
                      if (!option) {
                        handleSearchInput("", "input");
                        setSelectedAnime(null);
                        setSlug("");
                        return;
                      }
                      const match = searchResults.find((item) => item.session === option.value);
                      if (match) {
                        handleSearchInput(match.title, "selection");
                        handleSelectAnime(match);
                      } else {
                        handleSearchInput(option.label, "selection");
                        handleSelectAnime({ session: option.value, title: option.label });
                      }
                    }}
                    query={searchQuery}
                    onQueryChange={(value) => handleSearchInput(value, "input")}
                    items={autocompleteItems}
                    isLoading={searchLoading}
                  />
                </div>
                {selectedAnime ? (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full bg-primary/20 px-2 py-0.5 text-primary">chibi ✓</span>
                    <span>
                      Slug: <code className="rounded bg-muted px-1 py-0.5">{selectedAnime.session}</code>
                    </span>
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">Select an anime to enable downloads.</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Episodes (type or select)</label>
                <Input
                  value={episodesSpec}
                  onChange={(e) => handleEpisodesSpecChange(e.target.value)}
                  placeholder="1,3-5,*"
                />
                {episodesSpecError ? (
                  <p className="text-xs text-destructive">{episodesSpecError}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Patterns like <code>1,3-5</code> or <code>*</code> stay in sync with the grid below.
                  </p>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-3" data-tour="filters-section">
                <div className="space-y-1 truncate">
                  <label className="text-xs text-muted-foreground h-5 flex items-center">Resolution</label>
                  <Select value={resolutionChoice} onValueChange={handleResolutionSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Highest available" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="any">Highest available</SelectItem>
                        {availableResolutions.map((option) => (
                          <SelectItem key={option} value={option}>
                            {formatResolutionLabel(option)}
                          </SelectItem>
                        ))}
                        <SelectItem value="custom">Custom…</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {resolutionChoice === "custom" && (
                    <Input
                      value={customResolution}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^0-9]/g, "");
                        setCustomResolution(value);
                        setResolution(value);
                      }}
                      placeholder="Enter resolution (e.g. 810)"
                      inputMode="numeric"
                    />
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-xs truncate text-muted-foreground h-5 flex items-center">Audio</label>
                  <Select
                    value={audio || "any"}
                    onValueChange={(value) => setAudio(value === "any" ? "" : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Any audio" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="any">Any audio</SelectItem>
                        {availableAudios.map((option) => (
                          <SelectItem key={option} value={option}>
                            {formatAudioLabel(option)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs truncate text-muted-foreground h-5 flex items-center gap-1">
                    Threads
                    <div className="relative group">
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/80 cursor-help" />
                      <div className="absolute bottom-full right-0 mb-2 px-3 py-1.5 text-xs text-white bg-gray-900 rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[9999] pointer-events-none w-80 max-w-[90vw] text-left leading-snug">
                        Controls how many video segments download in parallel. Higher values can finish episodes faster on fast connections but consume more bandwidth and CPU.
                        <div className="absolute top-full right-3 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                      </div>
                    </div>
                  </label>
                  <Input
                    type="number"
                    min={2}
                    max={64}
                    value={threads}
                    onChange={(e) =>
                      setThreads(Math.min(64, Math.max(2, Number(e.target.value) || 2)))
                    }
                  />
                </div>
              </div>
              <div className="space-y-1" data-tour="output-folder">
                <label className="text-sm text-muted-foreground">Output folder</label>
                <div className="flex items-center gap-2 text-sm">
                  <span className="flex-1 truncate rounded-md border border-border/60 bg-background/60 px-3 py-2">
                    {settings.downloadDir ?? "(project folder)"}
                  </span>
                  <Button variant="outline" size="sm" onClick={handleChooseDir}>
                    Choose
                  </Button>
                  {settings.downloadDir && (
                    <Button variant="ghost" size="sm" onClick={handleClearDir}>
                      Clear
                    </Button>
                  )}
                </div>
              </div>
              <div>
                <Button
                  variant="default"
                  onClick={handleDownload}
                  disabled={slugMissing || isBusy}
                  data-tour="download-button"
                >
                  Download
                </Button>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </CardContent>
          </Card>

          <Card className="xl:col-span-1 glass-card overflow-visible" data-tour="episodes-section">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MonitorPlay className="h-5 w-5 text-cyan-300" />
                Episodes
              </CardTitle>
            </CardHeader>
            <CardContent className="flex h-full flex-col gap-3">
              {episodeSummaryError && (
                <p className="text-xs text-destructive">
                  Failed to fetch source details: {episodeSummaryError}
                </p>
              )}
              {episodes ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                    <span>Fetched: {episodes.episodes.length}</span>
                    {episodesLoading && (
                      <span className="flex items-center gap-1 text-xs">
                        <Loader2 className="h-3 w-3 animate-spin" /> Refreshing…
                      </span>
                    )}
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleSelectAll}>
                        Select all
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleClearSelection}>
                        Clear
                      </Button>
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="grid grid-cols-1 gap-2 overflow-y-auto pr-2" style={{ maxHeight: "65vh" }}>
                      {episodes.episodes.map((ep) => {
                        const checked = selectedEpisodes.includes(ep.number);
                        const summary = episodeSummaries[ep.number];
                        const preview = previewCache[ep.number];
                        const showSpinner = episodeSummaryLoading && !preview;
                        const resolutionText = summary?.resolutions.length
                          ? summary.resolutions.map((value) => formatResolutionLabel(value)).join(" / ")
                          : "—";
                        const audioText = summary?.audios.length
                          ? summary.audios.map((value) => formatAudioLabel(value)).join(", ")
                          : "—";

                        return (
                          <label
                            key={ep.number}
                            className={cn(
                              "flex items-center gap-3 rounded-md border border-border/60 bg-background/60 px-3 py-2 text-sm",
                              checked && "border-primary/80"
                            )}
                          >
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-border accent-primary"
                              checked={checked}
                              onChange={() => handleToggleEpisode(ep.number)}
                            />
                            <div className="flex w-full items-center justify-between gap-3">
                              <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 leading-tight">
                                <span className="font-medium">E{ep.number}</span>
                                {showSpinner ? (
                                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    Checking sources…
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">Audio: {audioText}</span>
                                )}
                                {!showSpinner && summary?.message && (
                                  <span className="text-xs text-destructive sm:ml-2">{summary.message}</span>
                                )}
                              </div>
                              {!showSpinner && (
                                <span className="text-xs text-muted-foreground whitespace-nowrap">Res: {resolutionText}</span>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : episodesLoading ? (
                <EmptyState
                  icon={<MonitorPlay className="h-8 w-8 text-cyan-300" />}
                  title="Loading episodes"
                  message="Hang tight while we grab the latest list."
                />
              ) : (
                <EmptyState
                  icon={<MonitorPlay className="h-8 w-8 text-cyan-300" />}
                  title="No episodes yet"
                  message="Select an anime to load episodes."
                />
              )}
            </CardContent>
          </Card>

          <Card className="xl:col-span-1 glass-card overflow-visible" data-tour="download-status">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <DownloadCloud className="h-5 w-5 text-pink-400" />
                Download status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.keys(statusMap).length === 0 ? (
                <EmptyState
                  icon={<DownloadCloud className="h-8 w-8 text-pink-400" />}
                  title="No downloads yet"
                  message="Start a download to see detailed progress here."
                />
              ) : (
                <ul className="space-y-3 overflow-y-auto pr-2" style={{ maxHeight: "65vh" }}>
                  {Object.entries(statusMap)
                    .sort((a, b) => Number(a[0]) - Number(b[0]))
                    .map(([episode, status]) => {
                      const progress = progressMap[Number(episode)];
                      const value = progress && progress.total > 0 ? (progress.done / progress.total) * 100 : 0;
                      const downloadPath = downloadPaths[Number(episode)];
                      const isActive = isActiveStatus(status);
                      const isFailed = status.toLowerCase().startsWith('failed');
                      const speed = progress?.speedBps ?? 0;
                      const elapsedSeconds = progress?.elapsedSeconds ?? 0;

                      // Check if any downloads are still active
                      const hasActiveDownloads = Object.values(statusMap).some(s => isActiveStatus(s));

                      // Extract error message from status if failed
                      const errorMessage = isFailed ? status.replace(/^failed:\s*/i, '').trim() : null;

                      return (
                        <li key={episode} className="space-y-2 rounded-md border border-border/60 bg-background/60 p-3">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-semibold">Episode {episode}</span>
                            <div className="flex items-center gap-2">
                              <span className={isFailed ? "text-destructive font-medium" : "text-muted-foreground"}>
                                {isFailed ? "Failed" : status}
                              </span>
                              {isActive && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleCancelDownload(Number(episode))}
                                  aria-label="Cancel download"
                                  title="Cancel download"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                              {isFailed && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRetryDownload(Number(episode))}
                                  disabled={hasActiveDownloads}
                                  aria-label="Retry download"
                                  title={hasActiveDownloads ? "Will be available after whole download is complete" : "Retry download"}
                                >
                                  <RefreshCw className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenDownload(downloadPath)}
                                disabled={!downloadPath}
                                aria-label="Open download folder"
                              >
                                <FolderOpen className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          {errorMessage && (
                            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-2">
                              <p className="text-xs text-destructive/90 break-words">{errorMessage}</p>
                            </div>
                          )}
                          {progress && progress.total > 0 && (
                            <>
                              <Progress value={value} />
                              {isActive && (
                                <div className="space-y-1">
                                  <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>{formatBytes(progress.done)} / {formatBytes(progress.total)}</span>
                                    <span>{value.toFixed(1)}%</span>
                                  </div>
                                  <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>Speed: {formatSpeed(speed)}</span>
                                    <span>Time: {formatElapsedTime(elapsedSeconds)}</span>
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </li>
                      );
                    })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
          </TabsContent>

          <TabsContent value="library" className="mt-0">
            <LibraryView />
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Available sources</DialogTitle>
            <DialogDescription>Review audio/resolution combinations before downloading.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {previewData?.map((item) => (
              <div key={item.episode} className="space-y-3">
                <h4 className="flex items-center gap-2 text-base font-semibold">
                  <ListChecks className="h-4 w-4 text-primary" /> Episode {item.episode}
                </h4>
                {item.sources.length === 0 ? (
                  <EmptyState
                    icon={<FolderSearch className="h-8 w-8 text-primary" />}
                    title="No sources found"
                    message="Try another resolution or audio preference."
                    compact
                  />
                ) : (
                  <div className="overflow-hidden rounded-lg border border-border/60">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40">
                        <tr className="text-left text-muted-foreground">
                          <th className="px-3 py-2 font-medium">Audio</th>
                          <th className="px-3 py-2 font-medium">Resolution</th>
                          <th className="px-3 py-2 font-medium">URL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {item.sources.map((source, idx) => (
                          <tr key={idx} className="border-t border-border/40">
                            <td className="px-3 py-2">{source.audio ?? "-"}</td>
                            <td className="px-3 py-2">{source.resolution ?? "-"}</td>
                            <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{source.src}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <RequirementsDialog
        open={requirementsDialogOpen}
        onOpenChange={setRequirementsDialogOpen}
        requirements={requirements}
        onRequirementsUpdate={setRequirements}
      />

      {/* Notification Toasts */}
      <NotificationToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}

type EmptyStateProps = {
  icon: ReactNode;
  title: string;
  message: string;
  compact?: boolean;
};

function EmptyState({ icon, title, message, compact }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-white/15 bg-white/5 text-center",
        compact ? "px-4 py-6" : "px-6 py-10"
      )}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-primary">
        {icon}
      </div>
      <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      <p className="mt-1 text-xs text-muted-foreground">{message}</p>
    </div>
  );
}

export default function App() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);

  // Load settings on initial mount for the provider
  useEffect(() => {
    loadSettings()
      .then(setSettings)
      .catch((err) => console.error("Failed to load settings", err));
  }, []);

  const handleSettingsUpdate = async (newSettings: Settings) => {
    setSettings(newSettings);
    await saveSettings(newSettings);
  };

  return (
    <PostHogProvider
      enabled={settings.analyticsEnabled}
      theme={settings.themeDark ? 'dark' : 'light'}
    >
      <NotificationProvider>
        <TourProvider settings={settings} onSettingsUpdate={handleSettingsUpdate}>
          <AppContent />
        </TourProvider>
      </NotificationProvider>
    </PostHogProvider>
  );
}
