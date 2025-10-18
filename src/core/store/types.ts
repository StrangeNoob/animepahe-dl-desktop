/**
 * Type definitions for all stores
 */

import type { Settings, DownloadRecord, LibraryEntry, AnimeStats } from '../types';

// ============================================================
// Preference Store Types
// ============================================================

export interface PreferenceState extends Settings {
  // Actions
  setDownloadDir: (dir: string | null) => void;
  setTheme: (dark: boolean) => void;
  toggleTheme: () => void;
  setHostUrl: (url: string) => void;
  setTourCompleted: (completed: boolean) => void;
  setAnalyticsEnabled: (enabled: boolean) => void;
  setMaxThreads: (threads: number) => void;
  updateSettings: (settings: Partial<Settings>) => void;
  loadSettings: () => Promise<void>;
  saveSettings: () => Promise<void>;
}

// ============================================================
// Queue Store Types
// ============================================================

export interface QueueItem {
  id: string;
  animeName: string;
  animeSlug: string;
  episode: number;
  audioType?: string;
  resolution?: string;
  status: 'queued' | 'active' | 'paused' | 'completed' | 'failed';
  progress: {
    done: number;
    total: number;
    speedBps: number;
    elapsedSeconds: number;
  };
  path?: string;
  error?: string;
  startTime?: number;
}

export interface QueueState {
  items: QueueItem[];
  statusMap: Record<number, string>;
  progressMap: Record<number, { done: number; total: number; speedBps: number; elapsedSeconds: number }>;
  downloadPaths: Record<number, string>;
  isBusy: boolean;

  // Actions
  addToQueue: (item: Omit<QueueItem, 'id' | 'status' | 'progress'>) => void;
  removeFromQueue: (id: string) => void;
  updateStatus: (episode: number, status: string, path?: string) => void;
  updateProgress: (episode: number, progress: QueueItem['progress']) => void;
  cancelDownload: (episode: number) => void;
  retryDownload: (episode: number) => void;
  clearCompleted: () => void;
  clearAll: () => void;
}

// ============================================================
// Library Store Types
// ============================================================

export interface LibraryState {
  entries: LibraryEntry[];
  animeStats: AnimeStats[];
  selectedAnime: string | null;
  isLoading: boolean;

  // Actions
  loadLibrary: () => Promise<void>;
  getAnimeEntries: (slug: string) => LibraryEntry[];
  deleteEntry: (id: number) => Promise<void>;
  exportLibrary: (path: string) => Promise<void>;
  importLibrary: (path: string) => Promise<void>;
  updateWatchCount: (id: number) => Promise<void>;
  setSelectedAnime: (slug: string | null) => void;
}

// ============================================================
// Network Store Types
// ============================================================

export interface NetworkState {
  isOnline: boolean;
  isMobileData: boolean;
  batterySaver: boolean;
  downloadPolicy: 'always' | 'wifi-only' | 'manual';

  // Actions
  setOnlineStatus: (online: boolean) => void;
  setMobileDataStatus: (mobileData: boolean) => void;
  setBatterySaver: (enabled: boolean) => void;
  setDownloadPolicy: (policy: NetworkState['downloadPolicy']) => void;
  canDownload: () => boolean;
}
