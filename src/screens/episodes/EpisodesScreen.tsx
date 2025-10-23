import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Download,
  CheckSquare,
  Square,
  X,
  Filter,
  Hash,
} from 'lucide-react';
import { fetchEpisodes } from '../../core/animepahe/api';
import { usePreferenceStore } from '../../core/store';
import { QueueManager } from '../../core/queue/QueueManager';
import { FetchEpisodesResponse, EpisodeInfo } from '../../core/types';
import { useChromeSlots } from '../../ui/contexts/ChromeSlots';
import { EpisodeRow, EpisodeRowSkeleton } from '../../ui/components/content/EpisodeRow';
import { Button } from '../../ui/components/base/button';
import { cn } from '../../core/utils/cn';

/**
 * Episodes Screen
 * Episode selection and batch download interface
 *
 * Features:
 * - Episode list with checkboxes
 * - Batch selection (select all/none)
 * - Pattern helper for range selection (1-5, latest 10, etc.)
 * - Context bar with download action
 * - Filter options (resolution, audio type)
 * - Downloaded episode indicators
 */
export function EpisodesScreen() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const hostUrl = usePreferenceStore((state) => state.hostUrl);
  const slots = useChromeSlots();

  const [data, setData] = useState<FetchEpisodesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEpisodes, setSelectedEpisodes] = useState<Set<number>>(
    new Set()
  );
  const [patternInput, setPatternInput] = useState('');
  const [showPatternHelper, setShowPatternHelper] = useState(false);

  // Fetch episodes
  useEffect(() => {
    if (!slug) return;

    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await fetchEpisodes(slug, hostUrl, slug);
        setData(result);
      } catch (err) {
        console.error('Failed to fetch episodes:', err);
        setError('Failed to load episodes');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [slug, hostUrl]);

  // Setup chrome slots
  useEffect(() => {
    slots.setMobileTopBarTitle(data?.displayName || 'Episodes');

    return () => {
      slots.clearSlots();
    };
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  // Context bar when episodes are selected
  useEffect(() => {
    if (selectedEpisodes.size > 0) {
      slots.setContextBar(
        <div className="fixed bottom-16 md:bottom-0 left-0 right-0 bg-card border-t border-border safe-bottom">
          <div className="container mx-auto px-4 md:px-6 py-3">
            <div className="flex items-center justify-between gap-4">
              {/* Selection Info */}
              <div className="flex items-center gap-3">
                <span className="font-semibold">
                  {selectedEpisodes.size} selected
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearSelection}
                  className="h-8"
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPatternHelper(!showPatternHelper)}
                  className="hidden md:inline-flex"
                >
                  <Hash className="h-4 w-4 mr-1" />
                  Pattern
                </Button>
                <Button onClick={handleDownload} size="sm">
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>
              </div>
            </div>
          </div>
        </div>
      );
    } else {
      slots.setContextBar(null);
    }

    return () => {
      if (selectedEpisodes.size === 0) {
        slots.setContextBar(null);
      }
    };
  }, [selectedEpisodes]); // eslint-disable-line react-hooks/exhaustive-deps

  // Episode toggle handler
  const handleToggle = useCallback((episode: number) => {
    setSelectedEpisodes((prev) => {
      const next = new Set(prev);
      if (next.has(episode)) {
        next.delete(episode);
      } else {
        next.add(episode);
      }
      return next;
    });
  }, []);

  // Select all episodes
  const handleSelectAll = () => {
    if (!data) return;
    const all = new Set(data.episodes.map((ep) => ep.number));
    setSelectedEpisodes(all);
  };

  // Clear selection
  const handleClearSelection = () => {
    setSelectedEpisodes(new Set());
    setPatternInput('');
  };

  // Pattern helper - parse and apply pattern
  const handleApplyPattern = () => {
    if (!data || !patternInput.trim()) return;

    const pattern = patternInput.trim().toLowerCase();
    const episodes = data.episodes.map((ep) => ep.number);
    let selected: number[] = [];

    try {
      if (pattern === 'all') {
        selected = episodes;
      } else if (pattern.startsWith('latest')) {
        const count = parseInt(pattern.replace('latest', '').trim()) || 1;
        selected = episodes.slice(-count);
      } else if (pattern.includes('-')) {
        // Range pattern: "1-5", "10-20"
        const [start, end] = pattern.split('-').map((n) => parseInt(n.trim()));
        if (!isNaN(start) && !isNaN(end)) {
          selected = episodes.filter((ep) => ep >= start && ep <= end);
        }
      } else if (pattern.includes(',')) {
        // Comma-separated: "1,3,5,7"
        const nums = pattern.split(',').map((n) => parseInt(n.trim()));
        selected = episodes.filter((ep) => nums.includes(ep));
      } else {
        // Single episode
        const num = parseInt(pattern);
        if (!isNaN(num) && episodes.includes(num)) {
          selected = [num];
        }
      }

      if (selected.length > 0) {
        setSelectedEpisodes(new Set(selected));
        setPatternInput('');
        setShowPatternHelper(false);
      }
    } catch (err) {
      console.error('Invalid pattern:', err);
    }
  };

  // Handle download
  const handleDownload = async () => {
    if (!slug || !data || selectedEpisodes.size === 0) return;

    // Check if download folder is configured
    const downloadDir = usePreferenceStore.getState().downloadDir;
    if (!downloadDir) {
      // TODO: Show dialog prompting user to set download folder
      alert('Please set a download folder in Settings before downloading.');
      navigate('/settings');
      return;
    }

    try {
      // Start the download using QueueManager (adds to queue and starts download)
      const result = await QueueManager.startDownload({
        animeName: data.displayName,
        animeSlug: slug,
        episodes: Array.from(selectedEpisodes).sort((a, b) => a - b),
        // TODO: Add resolution and audio type selection in future sprint
        // audioType: undefined,
        // resolution: undefined,
      });

      if (!result.success) {
        // TODO: Show error toast/notification in future sprint
        console.error('Failed to start download:', result.error);
        alert(result.error || 'Failed to start download');
        return;
      }

      // Navigate to downloads screen to show progress
      navigate('/downloads');
    } catch (error) {
      console.error('Failed to start download:', error);
      // TODO: Show error toast/notification in future sprint
      alert('An error occurred while starting download');
    }
  };

  // Computed values
  const allSelected = useMemo(() => {
    return data
      ? data.episodes.length > 0 &&
      selectedEpisodes.size === data.episodes.length
      : false;
  }, [data, selectedEpisodes]);

  if (isLoading) {
    return (
      <main className="container mx-auto px-4 md:px-6 py-6">
        <div className="mb-6" role="status" aria-live="polite">
          <span className="sr-only">Loading episodes...</span>
          <div className="h-8 w-48 bg-muted rounded animate-pulse mb-2" />
          <div className="h-4 w-32 bg-muted rounded animate-pulse" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <EpisodeRowSkeleton key={i} />
          ))}
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md px-4" role="alert">
          <Download className="h-16 w-16 text-muted-foreground mx-auto mb-4" aria-hidden="true" />
          <h1 className="text-xl font-semibold mb-2">Failed to load</h1>
          <p className="text-muted-foreground mb-4">
            {error || 'Could not load episodes. Please try again.'}
          </p>
          <Button onClick={() => navigate(`/title/${slug}`)} variant="outline">
            Back to Title
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className={cn('pb-8', selectedEpisodes.size > 0 && 'pb-24 md:pb-20')}>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b pb-4 mb-6">
        <div className="container mx-auto px-4 md:px-6 pt-4">
          <h1 className="text-2xl md:text-3xl font-bold mb-2">
            {data.displayName}
          </h1>
          <p className="text-muted-foreground text-sm md:text-base">
            {data.episodes.length} episodes available
          </p>

          {/* Actions Row */}
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={allSelected ? handleClearSelection : handleSelectAll}
            >
              {allSelected ? (
                <>
                  <Square className="h-4 w-4 mr-1" />
                  Deselect All
                </>
              ) : (
                <>
                  <CheckSquare className="h-4 w-4 mr-1" />
                  Select All
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPatternHelper(!showPatternHelper)}
            >
              <Hash className="h-4 w-4 mr-1" />
              Pattern Helper
            </Button>
          </div>

          {/* Pattern Helper */}
          {showPatternHelper && (
            <div className="mt-4 p-4 rounded-lg bg-muted/50 border border-border" role="region" aria-label="Episode pattern selector">
              <label htmlFor="episode-pattern" className="text-sm font-medium mb-2 block">
                Episode Pattern
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  id="episode-pattern"
                  type="text"
                  value={patternInput}
                  onChange={(e) => setPatternInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleApplyPattern();
                  }}
                  placeholder="e.g., 1-5, latest 10, all"
                  aria-describedby="pattern-help"
                  className={cn(
                    'flex-1 h-9 px-3 rounded-md',
                    'bg-background border border-border',
                    'text-sm',
                    'focus:outline-none focus:ring-2 focus:ring-ring'
                  )}
                />
                <Button onClick={handleApplyPattern} size="sm" aria-label="Apply episode pattern">
                  Apply
                </Button>
              </div>
              <p id="pattern-help" className="text-xs text-muted-foreground">
                Examples: <code className="px-1 py-0.5 rounded bg-background">1-5</code>,{' '}
                <code className="px-1 py-0.5 rounded bg-background">latest 10</code>,{' '}
                <code className="px-1 py-0.5 rounded bg-background">all</code>,{' '}
                <code className="px-1 py-0.5 rounded bg-background">1,3,5</code>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Episodes List */}
      <div className="container mx-auto px-4 md:px-6">
        <div className="space-y-1" role="list" aria-label="Episode list">
          {data.episodes.map((episode) => (
            <div key={episode.number} role="listitem">
              <EpisodeRow
                episode={episode}
                selected={selectedEpisodes.has(episode.number)}
                onToggle={handleToggle}
                isDownloaded={false} // TODO: Check library in future sprint
              />
            </div>
          ))}
        </div>

        {/* Empty State */}
        {data.episodes.length === 0 && (
          <div className="text-center py-16 px-4">
            <Download className="h-16 w-16 text-muted-foreground mx-auto mb-4" aria-hidden="true" />
            <h2 className="text-xl font-semibold mb-2">No episodes found</h2>
            <p className="text-muted-foreground">
              This anime doesn't have any episodes available yet.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
