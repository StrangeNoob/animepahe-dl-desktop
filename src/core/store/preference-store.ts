import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { PreferenceState } from './types';
import { isTauri, safeInvoke } from '../utils/tauri';

const defaultSettings = {
  downloadDir: null,
  themeDark: true,
  hostUrl: 'https://animepahe.si',
  tourCompleted: false,
  analyticsEnabled: true,
  maxThreads: 8,
};

export const usePreferenceStore = create<PreferenceState>()(
  persist(
    (set, get) => ({
      ...defaultSettings,

      // Actions
      setDownloadDir: (dir) => {
        set({ downloadDir: dir });
        get().saveSettings();
      },

      setTheme: (dark) => {
        set({ themeDark: dark });
        get().saveSettings();
      },

      toggleTheme: () => {
        set((state) => ({ themeDark: !state.themeDark }));
        get().saveSettings();
      },

      setHostUrl: (url) => {
        set({ hostUrl: url });
        get().saveSettings();
      },

      setTourCompleted: (completed) => {
        set({ tourCompleted: completed });
        get().saveSettings();
      },

      setAnalyticsEnabled: (enabled) => {
        set({ analyticsEnabled: enabled });
        get().saveSettings();
      },

      setMaxThreads: (threads) => {
        set({ maxThreads: threads });
        get().saveSettings();
      },

      updateSettings: (settings) => {
        set(settings);
        get().saveSettings();
      },

      loadSettings: async () => {
        if (!isTauri()) {
          // In browser mode, settings are handled by zustand persist middleware
          return;
        }
        // Try to load from Tauri backend
        const settings = await safeInvoke<typeof defaultSettings>('load_settings');
        if (settings) {
          set(settings);
        }
        // If null (command not found), just use default settings
      },

      saveSettings: async () => {
        if (!isTauri()) {
          // In browser mode, settings are handled by zustand persist middleware
          return;
        }
        // Try to save to Tauri backend
        const state = get();
        const settings = {
          downloadDir: state.downloadDir,
          themeDark: state.themeDark,
          hostUrl: state.hostUrl,
          tourCompleted: state.tourCompleted,
          analyticsEnabled: state.analyticsEnabled,
          maxThreads: state.maxThreads,
        };
        await safeInvoke('save_settings', { settings });
        // If command not found, localStorage will handle persistence
      },
    }),
    {
      name: 'animepahe-preferences',
      storage: createJSONStorage(() => {
        // Always use localStorage - it works in both browser and Tauri
        // Tauri storage commands may not be available in all versions
        return localStorage;
      }),
    }
  )
);

// Initialize settings on app load
usePreferenceStore.getState().loadSettings();
