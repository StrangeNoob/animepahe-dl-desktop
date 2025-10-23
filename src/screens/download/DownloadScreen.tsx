import { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/components/base/card';
import { Input } from '../../ui/components/base/input';
import { Button } from '../../ui/components/base/button';
import { Progress } from '../../ui/components/base/progress';
import { Autocomplete, AutocompleteOption } from '../../ui/components/base/autocomplete';
import {
  Download as DownloadIcon,
  Search as SearchIcon,
  Loader2,
  X,
  CheckCircle2,
  AlertCircle,
  Pause,
  Play,
  Trash2,
} from 'lucide-react';
import { cn } from '../../core/utils/cn';
import { useQueueManager } from '../../core/queue';
import { formatSpeed, formatElapsedTime, formatBytes } from '../../core/utils/format';
import { parseEpisodeSpec } from '../../core/utils/episodeSpec';
import { Segmented, SegmentedOption } from '../../ui/components/base/segmented';
import { searchAnime } from '../../core/animepahe/api';
import { usePreferenceStore } from '../../core/store';
import { SearchItem } from '../../core/types';

type DownloadTab = 'active' | 'completed' | 'failed';

/**
 * Download Screen 
 * Main screen for downloading and managing anime episodes
 *
 * Features:
 * - Tabbed interface (Active, Completed, Failed)
 * - Pause/Resume all functionality
 * - Clear completed/failed downloads
 * - Real-time progress tracking
 * - Episode spec parsing (e.g., "1,3-5,*")
 * - Resolution and audio preferences
 * - Mobile-responsive layout
 */
export function DownloadScreen() {
  // Autocomplete state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedAnime, setSelectedAnime] = useState<string | null>(null);

  // Download options
  const [animeName, setAnimeName] = useState('');
  const [animeSlug, setAnimeSlug] = useState('');
  const [episodeSpec, setEpisodeSpec] = useState('');
  const [resolution, setResolution] = useState('');
  const [audio, setAudio] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DownloadTab>('active');

  const hostUrl = usePreferenceStore((state) => state.hostUrl);

  // Queue manager integration
  const {
    items,
    statusMap,
    progressMap,
    isBusy,
    startDownload,
    cancelDownload,
    clearCompleted,
    clearFailed,
    pauseAll,
    resumeAll,
  } = useQueueManager();

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchAnime(searchQuery.trim(), hostUrl);
        setSearchResults(results);
      } catch (error) {
        console.error('Search failed:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, hostUrl]);

  // Convert search results to autocomplete options
  const autocompleteOptions: AutocompleteOption[] = useMemo(() => {
    return searchResults.map((item) => ({
      value: item.session, // slug
      label: item.title, // anime name
    }));
  }, [searchResults]);

  // Handle anime selection from autocomplete
  const handleAnimeSelect = useCallback((option: AutocompleteOption | null) => {
    if (option) {
      setSelectedAnime(option.value);
      setAnimeName(option.label);
      setAnimeSlug(option.value);
      setSearchQuery(option.label);
    } else {
      setSelectedAnime(null);
      setAnimeName('');
      setAnimeSlug('');
    }
  }, []);

  // Tab options
  const tabOptions: SegmentedOption[] = [
    { value: 'active', label: 'Active' },
    { value: 'completed', label: 'Completed' },
    { value: 'failed', label: 'Failed' },
  ];

  // Filter items by tab
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const status = statusMap[item.episode]?.toLowerCase() || '';

      if (activeTab === 'active') {
        return (
          !status.includes('done') &&
          !status.includes('completed') &&
          !status.includes('failed') &&
          !status.includes('error')
        );
      }

      if (activeTab === 'completed') {
        return status.includes('done') || status.includes('completed');
      }

      if (activeTab === 'failed') {
        return status.includes('failed') || status.includes('error');
      }

      return false;
    });
  }, [items, statusMap, activeTab]);

  // Count by status
  const counts = useMemo(() => {
    const active = items.filter((item) => {
      const status = statusMap[item.episode]?.toLowerCase() || '';
      return (
        !status.includes('done') &&
        !status.includes('completed') &&
        !status.includes('failed') &&
        !status.includes('error')
      );
    }).length;

    const completed = items.filter((item) => {
      const status = statusMap[item.episode]?.toLowerCase() || '';
      return status.includes('done') || status.includes('completed');
    }).length;

    const failed = items.filter((item) => {
      const status = statusMap[item.episode]?.toLowerCase() || '';
      return status.includes('failed') || status.includes('error');
    }).length;

    return { active, completed, failed };
  }, [items, statusMap]);

  const handleDownload = async () => {
    setError(null);

    if (!animeSlug || animeSlug.trim().length === 0) {
      setError('Please provide an anime slug');
      return;
    }

    // Parse episode specification
    // For demo purposes, assuming episodes 1-12 are available
    const availableEpisodes = Array.from({ length: 12 }, (_, i) => i + 1);
    const parseResult = parseEpisodeSpec(episodeSpec, availableEpisodes);

    if (parseResult.error) {
      setError(parseResult.error);
      return;
    }

    if (parseResult.episodes.length === 0) {
      setError('No episodes selected');
      return;
    }

    // Start download using queue manager
    const result = await startDownload({
      animeName: animeName || animeSlug,
      animeSlug: animeSlug,
      episodes: parseResult.episodes,
      resolution: resolution || undefined,
      audioType: audio || undefined,
    });

    if (!result.success) {
      setError(result.error || 'Failed to start download');
    } else {
      // Switch to active tab to show downloads
      setActiveTab('active');
    }
  };

  const handleClearFailed = () => {
    clearFailed();
  };

  const handlePauseAll = async () => {
    const result = await pauseAll();
    if (result.success) {
      console.log(`Paused ${result.count} downloads`);
    }
  };

  const handleResumeAll = async () => {
    const result = await resumeAll();
    if (result.success) {
      console.log(`Resumed ${result.count} downloads`);
    }
  };

  const getStatusDisplay = (episode: number) => {
    const status = statusMap[episode];
    const progress = progressMap[episode];

    if (!status) {
      return { text: 'Queued', icon: null, variant: 'default' as const };
    }

    const normalized = status.toLowerCase();

    if (normalized.includes('done') || normalized.includes('completed')) {
      return {
        text: 'Completed',
        icon: <CheckCircle2 className="h-4 w-4" />,
        variant: 'success' as const,
      };
    }

    if (normalized.includes('failed') || normalized.includes('error')) {
      return {
        text: status,
        icon: <AlertCircle className="h-4 w-4" />,
        variant: 'destructive' as const,
      };
    }

    if (normalized.includes('downloading')) {
      return {
        text: progress
          ? `${Math.round((progress.done / progress.total) * 100)}% - ${formatSpeed(progress.speedBps)}`
          : 'Downloading...',
        icon: <Loader2 className="h-4 w-4 animate-spin" />,
        variant: 'default' as const,
      };
    }

    return {
      text: status,
      icon: <Loader2 className="h-4 w-4 animate-spin" />,
      variant: 'default' as const,
    };
  };

  // Get tab label with count
  const getTabLabel = (tab: DownloadTab): string => {
    const count = counts[tab];
    if (count > 0) {
      return `${tab.charAt(0).toUpperCase() + tab.slice(1)} (${count})`;
    }
    return tab.charAt(0).toUpperCase() + tab.slice(1);
  };

  // Update tab options with counts
  const tabOptionsWithCounts: SegmentedOption[] = tabOptions.map((opt) => ({
    ...opt,
    label: getTabLabel(opt.value as DownloadTab),
  }));

  return (
    <main className="container mx-auto p-4 md:p-6 space-y-6 max-w-6xl">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Downloads</h1>
        <p className="text-muted-foreground mt-1">
          Search for anime and download episodes
        </p>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Sidebar - Search & Filters */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SearchIcon className="h-5 w-5 text-primary" aria-hidden="true" />
              Search & Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Anime Search with Autocomplete */}
            <div className="space-y-2">
              <label htmlFor="anime-search" className="text-sm font-medium">
                Search Anime
              </label>
              <Autocomplete
                value={selectedAnime}
                onChange={handleAnimeSelect}
                query={searchQuery}
                onQueryChange={setSearchQuery}
                items={autocompleteOptions}
                isLoading={isSearching}
                placeholder="Search for an anime..."
                emptyMessage="No anime found. Try a different search."
              />
              {animeSlug && (
                <p className="text-xs text-muted-foreground">
                  Selected: <span className="font-mono">{animeSlug}</span>
                </p>
              )}
            </div>

            {/* Episode Selection */}
            <div className="space-y-2">
              <label htmlFor="episode-spec" className="text-sm font-medium">Episodes</label>
              <Input
                id="episode-spec"
                value={episodeSpec}
                onChange={(e) => setEpisodeSpec(e.target.value)}
                placeholder="1,3-5,*"
                disabled={!animeSlug}
                aria-describedby="episode-help"
              />
              <p id="episode-help" className="text-xs text-muted-foreground">
                Use patterns like 1,3-5 or *
              </p>
            </div>

            {/* Resolution Filter */}
            <div className="space-y-2">
              <label htmlFor="resolution" className="text-sm font-medium">Resolution (optional)</label>
              <Input
                id="resolution"
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                placeholder="1080, 720, etc."
                disabled={!animeSlug}
              />
            </div>

            {/* Audio Filter */}
            <div className="space-y-2">
              <label htmlFor="audio" className="text-sm font-medium">Audio (optional)</label>
              <Input
                id="audio"
                value={audio}
                onChange={(e) => setAudio(e.target.value)}
                placeholder="eng, jpn, etc."
                disabled={!animeSlug}
              />
            </div>

            {/* Error Display */}
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md" role="alert">
                {error}
              </div>
            )}

            {/* Download Action */}
            <Button
              className="w-full"
              disabled={!animeSlug || !episodeSpec || isBusy}
              onClick={handleDownload}
              aria-label={isBusy ? "Downloading episodes..." : "Start download"}
            >
              {isBusy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Downloading...
                </>
              ) : (
                <>
                  <DownloadIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                  Start Download
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Right Content - Download Queue */}
        <Card className="lg:col-span-2">
          <CardHeader className="space-y-4">
            <div className="flex flex-row items-center justify-between">
              <CardTitle>Download Queue</CardTitle>
              {/* Action Buttons */}
              {items.length > 0 && (
                <div className="flex items-center gap-2">
                  {activeTab === 'active' && counts.active > 0 && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handlePauseAll}
                        title="Pause all active downloads"
                      >
                        <Pause className="h-4 w-4 mr-1" />
                        Pause All
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleResumeAll}
                        title="Resume all paused downloads"
                      >
                        <Play className="h-4 w-4 mr-1" />
                        Resume All
                      </Button>
                    </>
                  )}
                  {activeTab === 'completed' && counts.completed > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearCompleted}>
                      <Trash2 className="h-4 w-4 mr-1" />
                      Clear Completed
                    </Button>
                  )}
                  {activeTab === 'failed' && counts.failed > 0 && (
                    <Button variant="ghost" size="sm" onClick={handleClearFailed}>
                      <Trash2 className="h-4 w-4 mr-1" />
                      Clear Failed
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Tabs */}
            {items.length > 0 && (
              <Segmented
                options={tabOptionsWithCounts}
                value={activeTab}
                onChange={(value) => setActiveTab(value as DownloadTab)}
                fullWidth
              />
            )}
          </CardHeader>
          <CardContent>
            {filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center" role="status" aria-live="polite">
                <DownloadIcon className="h-12 w-12 text-muted-foreground/50 mb-4" aria-hidden="true" />
                <h3 className="text-lg font-semibold">
                  {items.length === 0
                    ? 'No downloads in queue'
                    : activeTab === 'active'
                      ? 'No active downloads'
                      : activeTab === 'completed'
                        ? 'No completed downloads'
                        : 'No failed downloads'}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {items.length === 0
                    ? 'Configure download settings and start downloading'
                    : 'Try switching to a different tab'}
                </p>
              </div>
            ) : (
              <div className="space-y-3" role="list" aria-label="Download queue items">
                {filteredItems.map((item) => {
                  const statusDisplay = getStatusDisplay(item.episode);
                  const progress = progressMap[item.episode];

                  return (
                    <div
                      key={item.id}
                      className="border rounded-lg p-4 space-y-2"
                      role="listitem"
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium">
                            {item.animeName} - Episode {item.episode}
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            {item.resolution && `${item.resolution}p`}
                            {item.resolution && item.audioType && ' • '}
                            {item.audioType && item.audioType.toUpperCase()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 text-sm" role="status" aria-live="polite">
                            {statusDisplay.icon && <span aria-hidden="true">{statusDisplay.icon}</span>}
                            <span
                              className={cn(
                                statusDisplay.variant === 'success' &&
                                'text-green-600',
                                statusDisplay.variant === 'destructive' &&
                                'text-destructive'
                              )}
                            >
                              {statusDisplay.text}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => cancelDownload(item.episode)}
                            aria-label={`Cancel download of episode ${item.episode}`}
                          >
                            <X className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      {progress && progress.total > 0 && (
                        <div className="space-y-1">
                          <Progress
                            value={(progress.done / progress.total) * 100}
                            className="h-2"
                          />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>
                              {formatBytes(progress.done)} /{' '}
                              {formatBytes(progress.total)}
                            </span>
                            <span>
                              {formatElapsedTime(progress.elapsedSeconds)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
