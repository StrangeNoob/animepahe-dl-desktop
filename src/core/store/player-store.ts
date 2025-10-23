import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PlayerSettings } from "../types";
import {
  getLocalVideoUrl,
  validateVideoFile,
} from "../animepahe/api";

export interface EpisodeQueueItem {
  slug: string;
  animeName: string;
  episode: number;
  source: "local" | "remote";
  filePath?: string; // For local playback
  remoteUrl?: string; // For remote streaming
  posterUrl?: string;
}

interface PlayerState {
  // Current playback state
  currentEpisode: EpisodeQueueItem | null;
  isPlaying: boolean;
  isPaused: boolean;
  isSeeking: boolean;
  currentTime: number;
  duration: number;
  buffered: number;

  // Queue management
  queue: EpisodeQueueItem[];
  currentQueueIndex: number;

  // PiP state
  isPipMode: boolean;
  isPipSupported: boolean;

  // Player settings (persisted)
  settings: PlayerSettings;

  // Error state
  error: string | null;

  // Actions
  playEpisode: (episode: EpisodeQueueItem) => Promise<void>;
  pause: () => void;
  resume: () => void;
  seek: (time: number) => void;
  setDuration: (duration: number) => void;
  updateCurrentTime: (time: number) => void;
  updateBuffered: (buffered: number) => void;

  // Queue actions
  addToQueue: (episode: EpisodeQueueItem) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  playNext: () => Promise<void>;
  playPrevious: () => Promise<void>;

  // PiP actions
  enterPip: () => void;
  exitPip: () => void;
  setPipSupported: (supported: boolean) => void;

  // Settings actions
  setVolume: (volume: number) => void;
  setPlaybackSpeed: (speed: number) => void;
  setAutoplay: (autoplay: boolean) => void;
  setPipEnabled: (enabled: boolean) => void;

  // Error handling
  setError: (error: string | null) => void;
  clearError: () => void;

  // History tracking (TODO: Implement when history tracking backend is ready)
  saveProgress: () => Promise<void>;
  recordWatchHistory: () => Promise<void>;

  // Cleanup
  reset: () => void;
}

const initialSettings: PlayerSettings = {
  volume: 1.0,
  playbackSpeed: 1.0,
  autoplay: false,
  pipEnabled: true,
};

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentEpisode: null,
      isPlaying: false,
      isPaused: false,
      isSeeking: false,
      currentTime: 0,
      duration: 0,
      buffered: 0,
      queue: [],
      currentQueueIndex: -1,
      isPipMode: false,
      isPipSupported: false,
      settings: initialSettings,
      error: null,

      // Play episode
      playEpisode: async (episode: EpisodeQueueItem) => {
        try {
          set({ error: null });

          // Validate local file if playing from library
          if (episode.source === "local" && episode.filePath) {
            await validateVideoFile(episode.filePath);
          }

          // TODO: Load saved progress when history tracking is implemented
          set({
            currentEpisode: episode,
            isPlaying: true,
            isPaused: false,
            currentTime: 0,
            duration: 0,
            error: null,
          });
        } catch (error) {
          set({
            error:
              error instanceof Error ? error.message : "Failed to play episode",
            isPlaying: false,
          });
        }
      },

      pause: () => {
        set({ isPaused: true, isPlaying: false });
        // TODO: Auto-save progress on pause when history tracking is implemented
      },

      resume: () => {
        set({ isPaused: false, isPlaying: true });
      },

      seek: (time: number) => {
        set({ currentTime: time, isSeeking: true });
        // TODO: Save progress after seeking when history tracking is implemented
        setTimeout(() => {
          set({ isSeeking: false });
        }, 500);
      },

      setDuration: (duration: number) => {
        set({ duration });
      },

      updateCurrentTime: (time: number) => {
        set({ currentTime: time });
      },

      updateBuffered: (buffered: number) => {
        set({ buffered });
      },

      // Queue management
      addToQueue: (episode: EpisodeQueueItem) => {
        const { queue } = get();
        set({ queue: [...queue, episode] });
      },

      removeFromQueue: (index: number) => {
        const { queue } = get();
        set({ queue: queue.filter((_, i) => i !== index) });
      },

      clearQueue: () => {
        set({ queue: [], currentQueueIndex: -1 });
      },

      playNext: async () => {
        const { queue, currentQueueIndex, settings } = get();
        if (currentQueueIndex < queue.length - 1) {
          const nextIndex = currentQueueIndex + 1;
          const nextEpisode = queue[nextIndex];
          set({ currentQueueIndex: nextIndex });

          if (settings.autoplay) {
            await get().playEpisode(nextEpisode);
          }
        }
      },

      playPrevious: async () => {
        const { queue, currentQueueIndex } = get();
        if (currentQueueIndex > 0) {
          const prevIndex = currentQueueIndex - 1;
          const prevEpisode = queue[prevIndex];
          set({ currentQueueIndex: prevIndex });
          await get().playEpisode(prevEpisode);
        }
      },

      // PiP actions
      enterPip: () => {
        const { settings } = get();
        if (settings.pipEnabled) {
          set({ isPipMode: true });
        }
      },

      exitPip: () => {
        set({ isPipMode: false });
      },

      setPipSupported: (supported: boolean) => {
        set({ isPipSupported: supported });
      },

      // Settings actions
      setVolume: (volume: number) => {
        set((state) => ({
          settings: { ...state.settings, volume },
        }));
      },

      setPlaybackSpeed: (speed: number) => {
        set((state) => ({
          settings: { ...state.settings, playbackSpeed: speed },
        }));
      },

      setAutoplay: (autoplay: boolean) => {
        set((state) => ({
          settings: { ...state.settings, autoplay },
        }));
      },

      setPipEnabled: (enabled: boolean) => {
        set((state) => ({
          settings: { ...state.settings, pipEnabled: enabled },
        }));
      },

      // Error handling
      setError: (error: string | null) => {
        set({ error });
      },

      clearError: () => {
        set({ error: null });
      },

      // History tracking stubs (TODO: Implement when history tracking backend is ready)
      saveProgress: async () => {
        // TODO: Save current playback progress to history store
        // Should save currentEpisode, currentTime, duration, etc.
        console.log("saveProgress called - not yet implemented");
      },

      recordWatchHistory: async () => {
        // TODO: Record that this episode was watched to completion
        // Should update watch history in the database
        console.log("recordWatchHistory called - not yet implemented");
      },

      // Cleanup
      reset: () => {
        set({
          currentEpisode: null,
          isPlaying: false,
          isPaused: false,
          isSeeking: false,
          currentTime: 0,
          duration: 0,
          buffered: 0,
          queue: [],
          currentQueueIndex: -1,
          isPipMode: false,
          error: null,
        });
      },
    }),
    {
      name: "player-storage",
      partialize: (state) => ({
        settings: state.settings,
        queue: state.queue,
      }),
    }
  )
);
