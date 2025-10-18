import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { LibraryState } from './types';
import type { LibraryEntry, AnimeStats } from '../types';

export const useLibraryStore = create<LibraryState>((set, get) => ({
  entries: [],
  animeStats: [],
  selectedAnime: null,
  isLoading: false,

  // Actions
  loadLibrary: async () => {
    set({ isLoading: true });
    try {
      const entries = await invoke<LibraryEntry[]>('get_library_entries');
      const stats = await invoke<AnimeStats[]>('get_anime_stats');
      set({ entries, animeStats: stats, isLoading: false });
    } catch (err) {
      console.error('Failed to load library:', err);
      set({ isLoading: false });
    }
  },

  getAnimeEntries: (slug) => {
    return get().entries.filter((entry) => entry.slug === slug);
  },

  deleteEntry: async (id) => {
    try {
      await invoke('delete_library_entry', { id });
      set((state) => ({
        entries: state.entries.filter((entry) => entry.id !== id),
      }));
      // Reload stats after deletion
      await get().loadLibrary();
    } catch (err) {
      console.error('Failed to delete entry:', err);
      throw err;
    }
  },

  exportLibrary: async (path) => {
    try {
      await invoke('export_library', { path });
    } catch (err) {
      console.error('Failed to export library:', err);
      throw err;
    }
  },

  importLibrary: async (path) => {
    try {
      await invoke('import_library', { path });
      await get().loadLibrary();
    } catch (err) {
      console.error('Failed to import library:', err);
      throw err;
    }
  },

  updateWatchCount: async (id) => {
    try {
      await invoke('increment_watch_count', { id });
      set((state) => ({
        entries: state.entries.map((entry) =>
          entry.id === id ? { ...entry, watch_count: entry.watch_count + 1 } : entry
        ),
      }));
    } catch (err) {
      console.error('Failed to update watch count:', err);
    }
  },

  setSelectedAnime: (slug) => {
    set({ selectedAnime: slug });
  },
}));

// Load library on initialization
useLibraryStore.getState().loadLibrary();
