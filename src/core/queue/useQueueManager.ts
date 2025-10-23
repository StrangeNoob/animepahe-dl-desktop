/**
 * useQueueManager Hook
 * React hook for managing downloads with the QueueManager
 *
 * Provides:
 * - Download initiation with validation
 * - Cancel/retry operations
 * - Queue state management
 * - Analytics integration
 */

import { useCallback } from 'react';
import { usePostHog } from 'posthog-js/react';
import { QueueManager, type DownloadOptions } from './QueueManager';
import { useQueueStore } from '../store/queue-store';

export function useQueueManager() {
  const posthog = usePostHog();

  // Subscribe to queue state
  const items = useQueueStore((state) => state.items);
  const statusMap = useQueueStore((state) => state.statusMap);
  const progressMap = useQueueStore((state) => state.progressMap);
  const downloadPaths = useQueueStore((state) => state.downloadPaths);
  const isBusy = useQueueStore((state) => state.isBusy);

  /**
   * Analytics callback for tracking events
   */
  const trackEvent = useCallback(
    (eventName: string, properties: Record<string, any>) => {
      if (posthog) {
        posthog.capture(eventName, properties);
      }
    },
    [posthog]
  );

  /**
   * Start downloading episodes
   */
  const startDownload = useCallback(
    async (options: DownloadOptions) => {
      return await QueueManager.startDownload(options, trackEvent);
    },
    [trackEvent]
  );

  /**
   * Cancel a downloading episode
   */
  const cancelDownload = useCallback(
    async (episode: number) => {
      return await QueueManager.cancelDownload(episode, trackEvent);
    },
    [trackEvent]
  );

  /**
   * Retry a failed download
   */
  const retryDownload = useCallback(
    async (options: DownloadOptions, episode: number) => {
      return await QueueManager.retryDownload(options, episode, trackEvent);
    },
    [trackEvent]
  );

  /**
   * Clear completed downloads
   */
  const clearCompleted = useCallback(() => {
    QueueManager.clearCompleted(trackEvent);
  }, [trackEvent]);

  /**
   * Clear all downloads
   */
  const clearAll = useCallback(() => {
    QueueManager.clearAll(trackEvent);
  }, [trackEvent]);

  /**
   * Clear failed downloads
   */
  const clearFailed = useCallback(() => {
    QueueManager.clearFailed(trackEvent);
  }, [trackEvent]);

  /**
   * Pause all active downloads
   */
  const pauseAll = useCallback(async () => {
    return await QueueManager.pauseAll(trackEvent);
  }, [trackEvent]);

  /**
   * Resume all paused downloads
   */
  const resumeAll = useCallback(async () => {
    return await QueueManager.resumeAll(trackEvent);
  }, [trackEvent]);

  /**
   * Get episode status
   */
  const getEpisodeStatus = useCallback((episode: number) => {
    return QueueManager.getEpisodeStatus(episode);
  }, []);

  /**
   * Get episode progress
   */
  const getEpisodeProgress = useCallback((episode: number) => {
    return QueueManager.getEpisodeProgress(episode);
  }, []);

  /**
   * Get episode download path
   */
  const getEpisodePath = useCallback((episode: number) => {
    return QueueManager.getEpisodePath(episode);
  }, []);

  return {
    // State
    items,
    statusMap,
    progressMap,
    downloadPaths,
    isBusy,

    // Actions
    startDownload,
    cancelDownload,
    retryDownload,
    clearCompleted,
    clearAll,
    clearFailed,
    pauseAll,
    resumeAll,

    // Getters
    getEpisodeStatus,
    getEpisodeProgress,
    getEpisodePath,
  };
}
