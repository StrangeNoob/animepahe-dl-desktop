import { useState, useEffect } from "react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Search, Download, Upload, HardDrive, Clock, Film } from "lucide-react";
import { AnimeStats, LibraryStats } from "../types";
import {
  getAnimeLibrary,
  getLibraryStats,
  searchLibrary,
  exportLibrary,
  importLibrary
} from "../api";
import { AnimeCard } from "./AnimeCard";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile, readTextFile } from "@tauri-apps/plugin-fs";

export function LibraryView() {
  const [animeList, setAnimeList] = useState<AnimeStats[]>([]);
  const [stats, setStats] = useState<LibraryStats | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadLibrary();
  }, []);

  const loadLibrary = async () => {
    setIsLoading(true);
    try {
      const [library, libraryStats] = await Promise.all([
        getAnimeLibrary(),
        getLibraryStats()
      ]);
      setAnimeList(library);
      setStats(libraryStats);
    } catch (error) {
      console.error("Failed to load library:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.trim() === "") {
      loadLibrary();
    } else {
      try {
        const results = await searchLibrary(query);
        setAnimeList(results);
      } catch (error) {
        console.error("Search failed:", error);
      }
    }
  };

  const handleExport = async () => {
    try {
      const json = await exportLibrary();
      const filePath = await save({
        filters: [{
          name: "JSON",
          extensions: ["json"]
        }],
        defaultPath: "animepahe-library.json"
      });

      if (filePath) {
        await writeTextFile(filePath, json);
        console.log("Library exported successfully");
      }
    } catch (error) {
      console.error("Export failed:", error);
    }
  };

  const handleImport = async () => {
    try {
      const filePath = await save({
        filters: [{
          name: "JSON",
          extensions: ["json"]
        }]
      });

      if (filePath) {
        const json = await readTextFile(filePath);
        const count = await importLibrary(json);
        console.log(`Imported ${count} entries`);
        loadLibrary();
      }
    } catch (error) {
      console.error("Import failed:", error);
    }
  };

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    return `${hours}h`;
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2">
                <Film className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Anime</p>
                  <p className="text-2xl font-bold">{stats.total_anime}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2">
                <Film className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Episodes</p>
                  <p className="text-2xl font-bold">{stats.total_episodes}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2">
                <HardDrive className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Storage</p>
                  <p className="text-2xl font-bold">{formatSize(stats.total_size)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2">
                <Clock className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Watch Time</p>
                  <p className="text-2xl font-bold">{formatDuration(stats.total_watch_time)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search and Actions */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search library..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={handleExport} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
        <Button onClick={handleImport} variant="outline">
          <Upload className="h-4 w-4 mr-2" />
          Import
        </Button>
      </div>

      {/* Anime Grid */}
      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading library...</p>
        </div>
      ) : animeList.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No anime in library</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {animeList.map((anime) => (
            <AnimeCard
              key={anime.slug}
              anime={anime}
              onDelete={loadLibrary}
              formatSize={formatSize}
            />
          ))}
        </div>
      )}
    </div>
  );
}
