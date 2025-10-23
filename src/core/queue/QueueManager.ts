/**
 * Download Queue Manager
 * Abstraction layer for managing anime episode downloads
 *
 * Responsibilities:
 * - Validate download requests
 * - Initiate downloads via Tauri backend
 * - Track download lifecycle
 * - Integrate with QueueStore for state management
 * - Provide analytics integration
 */

import { startDownload, cancelDownload as cancelDownloadApi } from '../animepahe/api';
import type { StartDownloadRequest } from '../animepahe/api';
import { useQueueStore } from '../store/queue-store';
import { usePreferenceStore } from '../store/preference-store';
import { useNetworkStore } from '../store/network-store';

export interface DownloadOptions {
  animeName: string;
  animeSlug: string;
  episodes: number[];
  resolution?: string;
  audioType?: string;
  threads?: number;
}

export interface DownloadValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Queue Manager Class
 * Provides methods for managing the download queue
 */
export class QueueManager {
  /**
   * Validate download options before initiating
   */
  static validate(options: DownloadOptions): DownloadValidationResult {
    // Check if anime slug is provided
    if (!options.animeSlug || options.animeSlug.trim().length === 0) {
      return {
        valid: false,
        error: 'Anime slug is required. Please select an anime first.',
      };
    }

    // Check if episodes are selected
    if (!options.episodes || options.episodes.length === 0) {
      return {
        valid: false,
        error: 'No episodes selected. Please select at least one episode.',
      };
    }

    // Validate episode numbers
    const hasInvalidEpisode = options.episodes.some((ep) => !Number.isInteger(ep) || ep < 1);
    if (hasInvalidEpisode) {
      return {
        valid: false,
        error: 'Invalid episode number detected. Episodes must be positive integers.',
      };
    }

    return { valid: true };
  }

  /**
   * Start downloading episodes
   * Validates options, checks network policies, updates queue store, and initiates download via backend
   */
  static async startDownload(
    options: DownloadOptions,
    analyticsCallback?: (eventName: string, properties: Record<string, any>) => void
  ): Promise<{ success: boolean; error?: string }> {
    // Validate options
    const validation = this.validate(options);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Check network policies
    const networkState = useNetworkStore.getState();
    if (!networkState.canDownload()) {
      let errorMessage = 'Download blocked by network policy';

      if (!networkState.isOnline) {
        errorMessage = 'Cannot download while offline';
      } else if (networkState.shouldPauseForNetwork()) {
        if (networkState.downloadPolicy === 'wifi-only' && networkState.isMobileData) {
          errorMessage = 'Downloads paused on mobile data (WiFi only mode)';
        } else if (networkState.downloadPolicy === 'manual') {
          errorMessage = 'Downloads are in manual mode';
        }
      } else if (networkState.shouldPauseForBattery()) {
        if (networkState.batteryPolicy === 'pause-when-low') {
          errorMessage = `Battery too low (${networkState.batteryLevel}% < ${networkState.batteryThreshold}%)`;
        } else if (networkState.batteryPolicy === 'wifi-only-when-low') {
          errorMessage = `Battery too low for mobile data (${networkState.batteryLevel}% < ${networkState.batteryThreshold}%)`;
        }
      }

      return { success: false, error: errorMessage };
    }

    try {
      // Get download directory from preferences
      const downloadDir = usePreferenceStore.getState().downloadDir;
      const hostUrl = usePreferenceStore.getState().hostUrl;
      const maxThreads = usePreferenceStore.getState().maxThreads;

      // Add episodes to queue store
      options.episodes.forEach((episode) => {
        useQueueStore.getState().addToQueue({
          animeName: options.animeName,
          animeSlug: options.animeSlug,
          episode,
          audioType: options.audioType,
          resolution: options.resolution,
        });
      });

      // Track download initiation
      if (analyticsCallback) {
        analyticsCallback('download_initiated', {
          episode_count: options.episodes.length,
          resolution: options.resolution || 'any',
          audio: options.audioType || 'any',
          has_custom_dir: !!downloadDir,
          thread_count: options.threads || maxThreads,
        });
      }

      // Build request for backend
      const request: StartDownloadRequest = {
        animeName: options.animeName,
        animeSlug: options.animeSlug,
        episodes: options.episodes,
        resolution: options.resolution,
        audioType: options.audioType,
        downloadDir: downloadDir,
        host: hostUrl,
        threads: options.threads || maxThreads,
      };

      // Initiate download via Tauri backend
      await startDownload(request);

      return { success: true };
    } catch (error) {
      console.error('Failed to start download:', error);

      // Track download failure
      if (analyticsCallback) {
        analyticsCallback('download_failed', {
          error_type: 'initiation_error',
          episode_count: options.episodes.length,
        });
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start download',
      };
    }
  }

  /**
   * Cancel a downloading episode
   */
  static async cancelDownload(
    episode: number,
    analyticsCallback?: (eventName: string, properties: Record<string, any>) => void
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await useQueueStore.getState().cancelDownload(episode);

      // Track cancellation
      if (analyticsCallback) {
        analyticsCallback('download_cancelled', {
          episode,
        });
      }

      return { success: true };
    } catch (error) {
      console.error('Failed to cancel download:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel download',
      };
    }
  }

  /**
   * Retry a failed download
   */
  static async retryDownload(
    options: DownloadOptions,
    episode: number,
    analyticsCallback?: (eventName: string, properties: Record<string, any>) => void
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Retry the download by clearing the failed status and restarting
      await useQueueStore.getState().retryDownload(episode);

      // Track retry
      if (analyticsCallback) {
        analyticsCallback('download_retried', {
          episode,
          resolution: options.resolution || 'any',
          audio: options.audioType || 'any',
        });
      }

      // Restart download for single episode
      return await this.startDownload(
        {
          ...options,
          episodes: [episode],
        },
        analyticsCallback
      );
    } catch (error) {
      console.error('Failed to retry download:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retry download',
      };
    }
  }

  /**
   * Clear completed downloads from queue
   */
  static clearCompleted(
    analyticsCallback?: (eventName: string, properties: Record<string, any>) => void
  ): void {
    useQueueStore.getState().clearCompleted();

    // Track clear action
    if (analyticsCallback) {
      analyticsCallback('queue_cleared', {
        action: 'completed',
      });
    }
  }

  /**
   * Clear all downloads from queue
   */
  static clearAll(
    analyticsCallback?: (eventName: string, properties: Record<string, any>) => void
  ): void {
    useQueueStore.getState().clearAll();

    // Track clear action
    if (analyticsCallback) {
      analyticsCallback('queue_cleared', {
        action: 'all',
      });
    }
  }

  /**
   * Clear failed downloads from queue
   */
  static clearFailed(
    analyticsCallback?: (eventName: string, properties: Record<string, any>) => void
  ): void {
    const { items, statusMap } = useQueueStore.getState();

    // Find all failed episodes
    const failedEpisodes = items
      .filter((item) => {
        const status = statusMap[item.episode]?.toLowerCase() || '';
        return status.includes('failed') || status.includes('error');
      })
      .map((item) => item.episode);

    // Remove failed items from queue
    failedEpisodes.forEach((episode) => {
      const item = items.find((i) => i.episode === episode);
      if (item) {
        useQueueStore.getState().removeFromQueue(item.id);
      }
    });

    // Track clear action
    if (analyticsCallback) {
      analyticsCallback('queue_cleared', {
        action: 'failed',
        count: failedEpisodes.length,
      });
    }
  }

  /**
   * Pause all active downloads
   * Note: This cancels active downloads but keeps them in queue for resume
   */
  static async pauseAll(
    analyticsCallback?: (eventName: string, properties: Record<string, any>) => void
  ): Promise<{ success: boolean; count: number }> {
    const { items, statusMap } = useQueueStore.getState();

    // Find all active episodes
    const activeEpisodes = items
      .filter((item) => {
        const status = statusMap[item.episode]?.toLowerCase() || '';
        return (
          !status.includes('done') &&
          !status.includes('completed') &&
          !status.includes('failed') &&
          !status.includes('error') &&
          (status.includes('fetching') ||
            status.includes('extracting') ||
            status.includes('downloading'))
        );
      })
      .map((item) => item.episode);

    // Cancel each active download
    let successCount = 0;
    for (const episode of activeEpisodes) {
      try {
        await this.cancelDownload(episode);
        successCount++;
      } catch (error) {
        console.error(`Failed to pause episode ${episode}:`, error);
      }
    }

    // Track pause all action
    if (analyticsCallback) {
      analyticsCallback('downloads_paused_all', {
        count: successCount,
        total: activeEpisodes.length,
      });
    }

    return { success: successCount > 0, count: successCount };
  }

  /**
   * Resume all paused/queued downloads
   * Note: This restarts downloads for items that were cancelled/paused
   */
  static async resumeAll(
    analyticsCallback?: (eventName: string, properties: Record<string, any>) => void
  ): Promise<{ success: boolean; count: number }> {
    const { items, statusMap } = useQueueStore.getState();

    // Find all paused/queued episodes (not active, not completed, not failed)
    const pausedItems = items.filter((item) => {
      const status = statusMap[item.episode]?.toLowerCase() || '';
      const isActive =
        status.includes('fetching') ||
        status.includes('extracting') ||
        status.includes('downloading');
      const isCompleted = status.includes('done') || status.includes('completed');
      const isFailed = status.includes('failed') || status.includes('error');

      return !isActive && !isCompleted && !isFailed;
    });

    // Group by anime to batch downloads
    const downloadsByAnime = new Map<
      string,
      { animeName: string; animeSlug: string; episodes: number[]; resolution?: string; audioType?: string }
    >();

    pausedItems.forEach((item) => {
      const key = item.animeSlug;
      const existing = downloadsByAnime.get(key);

      if (existing) {
        existing.episodes.push(item.episode);
      } else {
        downloadsByAnime.set(key, {
          animeName: item.animeName,
          animeSlug: item.animeSlug,
          episodes: [item.episode],
          resolution: item.resolution,
          audioType: item.audioType,
        });
      }
    });

    // Resume downloads for each anime
    let successCount = 0;
    for (const download of downloadsByAnime.values()) {
      try {
        const result = await this.startDownload(download, analyticsCallback);
        if (result.success) {
          successCount += download.episodes.length;
        }
      } catch (error) {
        console.error(`Failed to resume downloads for ${download.animeSlug}:`, error);
      }
    }

    // Track resume all action
    if (analyticsCallback) {
      analyticsCallback('downloads_resumed_all', {
        count: successCount,
        total: pausedItems.length,
      });
    }

    return { success: successCount > 0, count: successCount };
  }

  /**
   * Get current queue state
   */
  static getQueueState() {
    return useQueueStore.getState();
  }

  /**
   * Check if queue is busy (has active downloads)
   */
  static isBusy(): boolean {
    return useQueueStore.getState().isBusy;
  }

  /**
   * Get download status for a specific episode
   */
  static getEpisodeStatus(episode: number): string | undefined {
    return useQueueStore.getState().statusMap[episode];
  }

  /**
   * Get download progress for a specific episode
   */
  static getEpisodeProgress(episode: number) {
    return useQueueStore.getState().progressMap[episode];
  }

  /**
   * Get download path for a specific episode
   */
  static getEpisodePath(episode: number): string | undefined {
    return useQueueStore.getState().downloadPaths[episode];
  }
}
