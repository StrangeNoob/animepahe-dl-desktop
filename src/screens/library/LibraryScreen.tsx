import { useState, useEffect } from 'react';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../ui/components/base/card';
import { Search, Download, Upload, HardDrive, Film } from 'lucide-react';
import { AnimeStats, LibraryStats } from '../../core/types';
import {
  getAnimeLibrary,
  getLibraryStats,
  searchLibrary,
  exportLibraryToFile,
  importLibraryFromFile,
  migrateLibraryPosters,
} from '../../core/animepahe/api';
import { AnimeCard } from '../../components/AnimeCard';
import { save, open } from '@tauri-apps/plugin-dialog';
import { useLibraryStore } from '../../core/store';

/**
 * Library Screen
 * Displays downloaded anime collection with search, stats, and import/export
 *
 * Features:
 * - Stats cards showing total anime, episodes, storage, and watch time
 * - Search functionality to filter library
 * - Export library to JSON file
 * - Import library from JSON file
 * - Grid view of anime cards with episode details
 * - Delete anime from library
 * - Responsive layout (mobile grid adjusts columns)
 */
export function LibraryScreen() {
  const [animeList, setAnimeList] = useState<AnimeStats[]>([]);
  const [stats, setStats] = useState<LibraryStats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Load library from store on mount
  const loadLibraryFromStore = useLibraryStore((state) => state.loadLibrary);

  useEffect(() => {
    // Migrate posters on first load, then load library
    migrateLibraryPosters()
      .catch((err) => console.warn('Poster migration failed:', err))
      .finally(() => {
        loadLibrary();
        loadLibraryFromStore(); // Also load into the store
      });
  }, [loadLibraryFromStore]);

  const loadLibrary = async () => {
    setIsLoading(true);
    try {
      const [library, libraryStats] = await Promise.all([
        getAnimeLibrary(),
        getLibraryStats(),
      ]);
      setAnimeList(library);
      setStats(libraryStats);
    } catch (error) {
      console.error('Failed to load library:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.trim() === '') {
      loadLibrary();
    } else {
      try {
        const results = await searchLibrary(query);
        setAnimeList(results);
      } catch (error) {
        console.error('Search failed:', error);
      }
    }
  };

  const handleExport = async () => {
    try {
      const filePath = await save({
        filters: [
          {
            name: 'JSON',
            extensions: ['json'],
          },
        ],
        defaultPath: 'animepahe-library.json',
      });

      if (filePath) {
        await exportLibraryToFile(filePath);
        alert('Library exported successfully!');
      }
    } catch (error) {
      console.error('Export failed:', error);
      alert(`Export failed: ${error}`);
    }
  };

  const handleImport = async () => {
    try {
      const filePath = await open({
        filters: [
          {
            name: 'JSON',
            extensions: ['json'],
          },
        ],
        multiple: false,
      });

      if (filePath) {
        const count = await importLibraryFromFile(filePath as string);
        alert(`Successfully imported ${count} library entries!`);
        loadLibrary();
        loadLibraryFromStore(); // Reload store
      }
    } catch (error) {
      console.error('Import failed:', error);
      alert(`Import failed: ${error}`);
    }
  };

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <main className="container mx-auto p-4 md:p-6 space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Library</h1>
        <p className="text-muted-foreground mt-1">
          Your downloaded anime collection
        </p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <section aria-label="Library statistics">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center space-x-2">
                  <Film className="h-5 w-5 text-primary" aria-hidden="true" />
                  <div>
                    <p className="text-sm text-muted-foreground">Anime</p>
                    <p className="text-2xl font-bold" aria-label={`${stats.total_anime} anime in library`}>{stats.total_anime}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center space-x-2">
                  <Film className="h-5 w-5 text-primary" aria-hidden="true" />
                  <div>
                    <p className="text-sm text-muted-foreground">Episodes</p>
                    <p className="text-2xl font-bold" aria-label={`${stats.total_episodes} total episodes`}>{stats.total_episodes}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center space-x-2">
                  <HardDrive className="h-5 w-5 text-primary" aria-hidden="true" />
                  <div>
                    <p className="text-sm text-muted-foreground">Storage</p>
                    <p className="text-2xl font-bold">
                      {formatSize(stats.total_size)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      {/* Search and Actions */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <label htmlFor="library-search" className="sr-only">Search library</label>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input
            id="library-search"
            placeholder="Search library..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10"
            aria-label="Search for anime in your library"
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={handleExport} variant="outline" className="flex-1 sm:flex-none" aria-label="Export library to JSON file">
            <Download className="h-4 w-4 mr-2" aria-hidden="true" />
            Export
          </Button>
          <Button onClick={handleImport} variant="outline" className="flex-1 sm:flex-none" aria-label="Import library from JSON file">
            <Upload className="h-4 w-4 mr-2" aria-hidden="true" />
            Import
          </Button>
        </div>
      </div>

      {/* Anime Grid */}
      {isLoading ? (
        <div className="text-center py-12" role="status" aria-live="polite">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4" aria-hidden="true"></div>
          <p className="text-muted-foreground">Loading library...</p>
        </div>
      ) : animeList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center" role="status" aria-live="polite">
          <Film className="h-16 w-16 text-muted-foreground/50 mb-4" aria-hidden="true" />
          <h2 className="text-lg font-semibold">No anime in library</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {searchQuery
              ? 'No results found for your search'
              : 'Download some anime to get started'}
          </p>
        </div>
      ) : (
        <section aria-label="Anime library grid">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {animeList.map((anime) => (
              <AnimeCard
                key={anime.slug}
                anime={anime}
                onDelete={loadLibrary}
                formatSize={formatSize}
              />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
