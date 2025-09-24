import { useEffect, useState, useMemo, type ReactNode } from "react";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";

import {
  loadSettings,
  saveSettings,
  searchAnime,
  fetchEpisodes,
  previewSources,
  startDownload,
  checkRequirements,
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
import { Switch } from "./components/ui/switch";
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
  ListChecks,
  MonitorPlay,
  Search as SearchIcon,
  Sparkles,
  HelpCircle,
} from "lucide-react";
import { Autocomplete, type AutocompleteOption } from "./components/ui/autocomplete";
import { RequirementsDialog } from "./components/RequirementsDialog";
import { TourProvider } from "./components/tour/TourProvider";
import { useTour } from "./components/tour/TourProvider";

const defaultSettings: Settings = {
  downloadDir: null,
  themeDark: true,
  hostUrl: "https://animepahe.ru",
  tourCompleted: false,
};

const RESOLUTION_PRESETS = ["1080", "720", "480", "360", "240"] as const;

const isPresetResolution = (value: string): value is (typeof RESOLUTION_PRESETS)[number] =>
  RESOLUTION_PRESETS.includes(value as (typeof RESOLUTION_PRESETS)[number]);

interface StatusMap {
  [episode: number]: string;
}

interface ProgressMap {
  [episode: number]: {
    done: number;
    total: number;
  };
}

function AppContent() {
  const { startTour } = useTour();
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedAnime, setSelectedAnime] = useState<SearchItem | null>(null);

  const [slug, setSlug] = useState("");
  const [episodesSpec, setEpisodesSpec] = useState("");
  const [resolution, setResolution] = useState("");
  const [resolutionChoice, setResolutionChoice] = useState("any");
  const [customResolution, setCustomResolution] = useState("");
  const [audio, setAudio] = useState("");
  const [threads, setThreads] = useState(1);
  const [listOnly, setListOnly] = useState(false);

  const [episodes, setEpisodes] = useState<FetchEpisodesResponse | null>(null);
  const [selectedEpisodes, setSelectedEpisodes] = useState<number[]>([]);
  const [previewData, setPreviewData] = useState<PreviewItem[] | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [statusMap, setStatusMap] = useState<StatusMap>({});
  const [progressMap, setProgressMap] = useState<ProgressMap>({});
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requirements, setRequirements] = useState<RequirementsCheckResponse | null>(null);
  const [requirementsDialogOpen, setRequirementsDialogOpen] = useState(false);

  const slugMissing = slug.trim().length === 0;

  useEffect(() => {
    loadSettings()
      .then((loadedSettings) => {
        setSettings(loadedSettings);
        // Auto-start tour for first-time users
        if (!loadedSettings.tourCompleted) {
          setTimeout(() => startTour(), 1000);
        }
      })
      .catch((err) => console.error("Failed to load settings", err));
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
      setStatusMap((prev) => ({ ...prev, [event.payload.episode]: event.payload.status }));
    });
    const progressUnlisten = listen<DownloadProgressEvent>("download-progress", (event) => {
      setProgressMap((prev) => ({
        ...prev,
        [event.payload.episode]: {
          done: event.payload.done,
          total: event.payload.total,
        },
      }));
    });
    return () => {
      statusUnlisten.then((fn) => fn());
      progressUnlisten.then((fn) => fn());
    };
  }, []);

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
    const timer = window.setTimeout(() => {
      searchAnime(searchQuery.trim(), settings.hostUrl)
        .then((results) => {
          if (active) {
            setSearchResults(results);
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
  }, [searchQuery, settings.hostUrl]);

  const handleSelectAnime = (item: SearchItem) => {
    setSelectedAnime(item);
    setSlug(item.session);
    setSearchQuery(item.title);
    setEpisodes(null);
    setSelectedEpisodes([]);
    setStatusMap({});
    setProgressMap({});
    setPreviewData(null);
    setError(null);
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

  const autocompleteItems: AutocompleteOption[] = useMemo(
    () =>
      searchResults.map((item) => ({
        value: item.session,
        label: item.title,
        description: `slug: ${item.session}`,
      })),
    [searchResults],
  );

  const handleFetchEpisodes = async () => {
    if (slugMissing) {
      setError("Select an anime before fetching episodes.");
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      const data = await fetchEpisodes(slug.trim(), settings.hostUrl, selectedAnime?.title ?? searchQuery);
      setEpisodes(data);
      setSelectedEpisodes([]);
    } catch (err) {
      console.error(err);
      setError(String(err));
    } finally {
      setIsBusy(false);
    }
  };

  const handleToggleEpisode = (episode: number) => {
    setSelectedEpisodes((prev) =>
      prev.includes(episode) ? prev.filter((n) => n !== episode) : [...prev, episode]
    );
  };

  const handleSelectAll = () => {
    if (!episodes) return;
    setSelectedEpisodes(episodes.episodes.map((ep) => ep.number));
  };

  const handleClearSelection = () => setSelectedEpisodes([]);

  const handleUseSelectionAsSpec = () => {
    if (!selectedEpisodes.length) return;
    setEpisodesSpec(selectedEpisodes.sort((a, b) => a - b).join(","));
  };

  const handleChooseDir = async () => {
    const directory = await open({ directory: true, multiple: false });
    if (directory && typeof directory === "string") {
      const next = { ...settings, downloadDir: directory };
      setSettings(next);
      await saveSettings(next);
    }
  };

  const handleClearDir = async () => {
    const next = { ...settings, downloadDir: null };
    setSettings(next);
    await saveSettings(next);
  };

  const toggleTheme = async (dark: boolean) => {
    const next = { ...settings, themeDark: dark };
    setSettings(next);
    await saveSettings(next);
  };

  const handleHostChange = (value: string) => {
    const next = { ...settings, hostUrl: value };
    setSettings(next);
  };

  const persistHost = async () => {
    await saveSettings(settings);
  };

  const handleResetHost = async () => {
    const next = { ...settings, hostUrl: "https://animepahe.ru" };
    setSettings(next);
    await saveSettings(next);
  };

  const handlePreview = async () => {
    if (!episodes || slugMissing) {
      setError("Fetch episodes before previewing sources.");
      return;
    }
    const previewEpisodes = selectedEpisodes.length
      ? selectedEpisodes
      : episodes.episodes.map((e) => e.number);
    if (!previewEpisodes.length) {
      setError("No episodes selected to preview.");
      return;
    }

    setIsBusy(true);
    setError(null);
    try {
      const data = await previewSources(slug, settings.hostUrl, previewEpisodes, episodes);
      setPreviewData(data);
      setPreviewOpen(true);
    } catch (err) {
      console.error(err);
      setError(String(err));
    } finally {
      setIsBusy(false);
    }
  };

  const handleDownload = async () => {
    if (slugMissing) {
      setError("Select an anime before downloading.");
      return;
    }
    setError(null);
    try {
      await startDownload({
        animeName: selectedAnime?.title ?? searchQuery,
        slug,
        host: settings.hostUrl,
        resolution,
        audio,
        threads,
        listOnly,
        episodesSpec: episodesSpec.trim() || undefined,
        selected: selectedEpisodes,
        downloadDir: settings.downloadDir,
      });
    } catch (err) {
      console.error(err);
      const errorMessage = String(err);
      setError(errorMessage);

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
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground transition-colors">
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
                {(
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={startTour}
                    className="ml-2 text-xs"
                    data-tour-trigger
                  >
                    <HelpCircle className="h-3 w-3 mr-1" />
                    Take Tour
                  </Button>
                )}
              </div>
              <p className="text-sm text-muted-foreground">Search, preview, and download anime with neon flair.</p>
            </div>
            <div className="flex flex-col gap-3 md:flex-row md:items-center" data-tour="settings-section">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Light</span>
                <Switch checked={settings.themeDark} onCheckedChange={toggleTheme} />
                <span className="text-sm text-muted-foreground">Dark</span>
              </div>
              <div className="flex flex-col gap-1 md:flex-row md:items-center md:gap-2">
                <label className="text-xs uppercase tracking-wide text-muted-foreground">Base URL</label>
                <Input
                  value={settings.hostUrl}
                  onChange={(e) => handleHostChange(e.target.value)}
                  onBlur={persistHost}
                  className="w-64"
                />
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={persistHost}>
                    Save
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleResetHost}>
                    Reset
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

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
                <label className="text-sm text-muted-foreground">Episodes (spec)</label>
                <Input
                  value={episodesSpec}
                  onChange={(e) => setEpisodesSpec(e.target.value)}
                  placeholder="1,3-5,*"
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-3" data-tour="filters-section">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Resolution</label>
                  <Select value={resolutionChoice} onValueChange={handleResolutionSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Highest available" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="any">Highest available</SelectItem>
                        {RESOLUTION_PRESETS.map((option) => (
                          <SelectItem key={option} value={option}>{option}p</SelectItem>
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
                  <label className="text-xs text-muted-foreground">Audio</label>
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
                        <SelectItem value="eng">Dub - ENG</SelectItem>
                        <SelectItem value="jpn">Sub - JPN</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Threads</label>
                  <Input
                    type="number"
                    min={1}
                    max={64}
                    value={threads}
                    onChange={(e) => setThreads(Math.min(64, Math.max(1, Number(e.target.value))))}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border/60 bg-background/60 px-3 py-2">
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">List m3u8 only</p>
                  <p className="text-[11px] text-muted-foreground/70">Emit playlist URLs without downloading.</p>
                </div>
                <Switch checked={listOnly} onCheckedChange={(checked) => setListOnly(checked)} />
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
              <div className="grid gap-2 sm:grid-cols-2">
                <Button onClick={handleFetchEpisodes} disabled={isBusy || slugMissing} data-tour="fetch-button">
                  Fetch episodes
                </Button>
                <Button variant="outline" onClick={handlePreview} disabled={isBusy || slugMissing} data-tour="preview-button">
                  Preview sources
                </Button>
                <Button variant="default" onClick={handleDownload} disabled={slugMissing} className="sm:col-span-2" data-tour="download-button">
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
              {episodes ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                    <span>Fetched: {episodes.episodes.length}</span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleSelectAll}>
                        Select all
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleClearSelection}>
                        Clear
                      </Button>
                      <Button variant="ghost" size="sm" onClick={handleUseSelectionAsSpec}>
                        Use as spec
                      </Button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                      {episodes.episodes.map((ep) => {
                        const checked = selectedEpisodes.includes(ep.number);
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
                            <span className="font-medium">E{ep.number}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <EmptyState
                  icon={<MonitorPlay className="h-8 w-8 text-cyan-300" />}
                  title="No episodes yet"
                  message="Fetch episodes to pick your favorites."
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
                <ul className="space-y-3">
                  {Object.entries(statusMap)
                    .sort((a, b) => Number(a[0]) - Number(b[0]))
                    .map(([episode, status]) => {
                      const progress = progressMap[Number(episode)];
                      const value = progress && progress.total > 0 ? (progress.done / progress.total) * 100 : 0;
                      return (
                        <li key={episode} className="space-y-2 rounded-md border border-border/60 bg-background/60 p-3">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-semibold">Episode {episode}</span>
                            <span className="text-muted-foreground">{status}</span>
                          </div>
                          {progress && progress.total > 0 && <Progress value={value} />}
                        </li>
                      );
                    })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
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
    <TourProvider settings={settings} onSettingsUpdate={handleSettingsUpdate}>
      <AppContent />
    </TourProvider>
  );
}
