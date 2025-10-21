import { create } from 'zustand';
import type { LibraryState } from './types';
import type { LibraryEntry, AnimeStats } from '../types';
import { isTauri, safeInvoke } from '../utils/tauri';

export const useLibraryStore = create<LibraryState>((set, get) => ({
  entries: [],
  animeStats: [],
  selectedAnime: null,
  isLoading: false,

  // Actions
  loadLibrary: async () => {
    if (!isTauri()) {
      // Library not available in browser mode
      set({ entries: [], animeStats: [], isLoading: false });
      return;
    }

    set({ isLoading: true });
    const entries = await safeInvoke<LibraryEntry[]>('get_library_entries');
    const stats = await safeInvoke<AnimeStats[]>('get_anime_stats');

    // If commands aren't available, just set empty arrays
    set({
      entries: entries || [],
      animeStats: stats || [],
      isLoading: false
    });
  },

  getAnimeEntries: (slug) => {
    return get().entries.filter((entry) => entry.slug === slug);
  },

  deleteEntry: async (id) => {
    if (!isTauri()) {
      throw new Error('Library operations not available in browser mode');
    }
    try {
      await safeInvoke('delete_library_entry', { id });
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
    if (!isTauri()) {
      throw new Error('Library operations not available in browser mode');
    }
    try {
      await safeInvoke('export_library', { path });
    } catch (err) {
      console.error('Failed to export library:', err);
      throw err;
    }
  },

  importLibrary: async (path) => {
    if (!isTauri()) {
      throw new Error('Library operations not available in browser mode');
    }
    try {
      await safeInvoke('import_library', { path });
      await get().loadLibrary();
    } catch (err) {
      console.error('Failed to import library:', err);
      throw err;
    }
  },

  updateWatchCount: async (id) => {
    if (!isTauri()) {
      return;
    }
    try {
      await safeInvoke('increment_watch_count', { id });
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
