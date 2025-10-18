import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { invoke } from '@tauri-apps/api/core';
import type { PreferenceState } from './types';

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
        try {
          const settings = await invoke<typeof defaultSettings>('load_settings');
          set(settings);
        } catch (err) {
          console.error('Failed to load settings:', err);
        }
      },

      saveSettings: async () => {
        try {
          const state = get();
          const settings = {
            downloadDir: state.downloadDir,
            themeDark: state.themeDark,
            hostUrl: state.hostUrl,
            tourCompleted: state.tourCompleted,
            analyticsEnabled: state.analyticsEnabled,
            maxThreads: state.maxThreads,
          };
          await invoke('save_settings', { settings });
        } catch (err) {
          console.error('Failed to save settings:', err);
        }
      },
    }),
    {
      name: 'animepahe-preferences',
      storage: createJSONStorage(() => ({
        getItem: async (name) => {
          try {
            const value = await invoke<string>('get_storage_item', { key: name });
            return value;
          } catch {
            return null;
          }
        },
        setItem: async (name, value) => {
          try {
            await invoke('set_storage_item', { key: name, value });
          } catch (err) {
            console.error('Failed to store item:', err);
          }
        },
        removeItem: async (name) => {
          try {
            await invoke('remove_storage_item', { key: name });
          } catch (err) {
            console.error('Failed to remove item:', err);
          }
        },
      })),
    }
  )
);

// Initialize settings on app load
usePreferenceStore.getState().loadSettings();
