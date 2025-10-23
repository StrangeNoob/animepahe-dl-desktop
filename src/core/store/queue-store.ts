import { create } from 'zustand';
import type { QueueState, QueueItem } from './types';
import { listen } from '@tauri-apps/api/event';
import type { DownloadStatusEvent, DownloadProgressEvent } from '../types';

export const useQueueStore = create<QueueState>((set, get) => ({
  items: [],
  statusMap: {},
  progressMap: {},
  downloadPaths: {},
  isBusy: false,

  // Actions
  addToQueue: (item) => {
    const id = `${item.animeSlug}-${item.episode}`;
    const queueItem: QueueItem = {
      ...item,
      id,
      status: 'queued',
      progress: {
        done: 0,
        total: 0,
        speedBps: 0,
        elapsedSeconds: 0,
      },
    };
    set((state) => ({
      items: [...state.items, queueItem],
    }));
  },

  removeFromQueue: (id) => {
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
    }));
  },

  updateStatus: (episode, status, path) => {
    set((state) => {
      const newStatusMap = { ...state.statusMap, [episode]: status };
      const hasActive = Object.entries(newStatusMap).some(([ep, st]) => {
        if (Number(ep) === 0) return false;
        const normalized = st.toLowerCase();
        return (
          !normalized.startsWith('failed') &&
          !normalized.startsWith('done') &&
          !normalized.includes('no matching') &&
          !normalized.includes('m3u8') &&
          !normalized.includes('no episodes selected') &&
          (normalized.includes('fetching') ||
            normalized.includes('extracting') ||
            normalized.includes('downloading'))
        );
      });

      return {
        statusMap: newStatusMap,
        downloadPaths: path ? { ...state.downloadPaths, [episode]: path } : state.downloadPaths,
        isBusy: hasActive,
      };
    });
  },

  updateProgress: (episode, progress) => {
    set((state) => ({
      progressMap: {
        ...state.progressMap,
        [episode]: progress,
      },
    }));
  },

  cancelDownload: async (episode) => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('cancel_download', { episode });
    } catch (err) {
      console.error('Failed to cancel download:', err);
    }
  },

  retryDownload: async (episode) => {
    // Clear failed status
    set((state) => {
      const newStatusMap = { ...state.statusMap };
      delete newStatusMap[episode];
      return { statusMap: newStatusMap };
    });
  },

  clearCompleted: () => {
    set((state) => ({
      items: state.items.filter((item) => item.status !== 'completed'),
    }));
  },

  clearAll: () => {
    set({
      items: [],
      statusMap: {},
      progressMap: {},
      downloadPaths: {},
      isBusy: false,
    });
  },
}));

// Setup event listeners for download status and progress
listen<DownloadStatusEvent>('download-status', (event) => {
  const { episode, status, path } = event.payload;
  useQueueStore.getState().updateStatus(episode, status, path ?? undefined);
});

listen<DownloadProgressEvent>('download-progress', (event) => {
  useQueueStore.getState().updateProgress(event.payload.episode, {
    done: event.payload.done,
    total: event.payload.total,
    speedBps: event.payload.speedBps,
    elapsedSeconds: event.payload.elapsedSeconds,
  });
});
