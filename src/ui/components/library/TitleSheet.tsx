import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '../base/sheet';
import { Button } from '../base/button';
import { ScrollArea } from '../base/scroll-area';
import { usePlayerStore } from '../../../core/store/player-store';
import {
  Play,
  FolderOpen,
  Trash2,
  Calendar,
  HardDrive,
  Film,
  ExternalLink,
} from 'lucide-react';
import type { AnimeStats, LibraryEntry } from '../../../core/types';
import {
  getAnimeEpisodes,
  deleteAnimeFromLibrary,
  deleteLibraryEntry,
  fetchImageAsBase64,
  openPath,
} from '../../../core/animepahe/api';
import { formatBytes } from '../../../core/utils/format';

interface TitleSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anime: AnimeStats;
  onUpdate?: () => void;
}

/**
 * TitleSheet Component
 * Mobile-friendly drawer showing anime details and quick actions
 *
 * Features:
 * - Anime poster/thumbnail
 * - Title metadata (episodes, size, date)
 * - Quick actions: Play, Reveal in Finder, Delete
 * - Episode list with individual actions
 * - Responsive layout
 */
export function TitleSheet({ open, onOpenChange, anime, onUpdate }: TitleSheetProps) {
  const navigate = useNavigate();
  const { playEpisode } = usePlayerStore();
  const [episodes, setEpisodes] = useState<LibraryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadEpisodes();
      loadImage();
    }
  }, [open, anime.slug]);

  const loadEpisodes = async () => {
    setIsLoading(true);
    try {
      const data = await getAnimeEpisodes(anime.slug);
      setEpisodes(data);
    } catch (error) {
      console.error('Failed to load episodes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadImage = async () => {
    if (!anime.thumbnail_url) return;

    try {
      const base64 = await fetchImageAsBase64(anime.thumbnail_url);
      setImageSrc(base64);
    } catch (error) {
      console.error('Failed to load image:', error);
    }
  };

  const handlePlayFirst = async () => {
    if (episodes.length === 0) return;

    const firstEpisode = episodes[0];
    try {
      await playEpisode({
        slug: anime.slug,
        animeName: anime.anime_name,
        episode: firstEpisode.episode,
        source: "local",
        filePath: firstEpisode.file_path,
        posterUrl: anime.thumbnail_url ?? undefined,
      });
      onOpenChange(false); // Close the sheet
      navigate(`/player?slug=${anime.slug}&episode=${firstEpisode.episode}&source=local`);
    } catch (error) {
      console.error('Failed to open episode:', error);
      alert(`Failed to open episode: ${error}`);
    }
  };

  const handleRevealInFinder = async () => {
    if (episodes.length === 0) return;

    const firstEpisode = episodes[0];
    try {
      // Open the directory containing the file
      const directory = firstEpisode.file_path.split('/').slice(0, -1).join('/');
      await openPath(directory);
    } catch (error) {
      console.error('Failed to reveal in finder:', error);
      alert(`Failed to reveal in finder: ${error}`);
    }
  };

  const handleDeleteAnime = async () => {
    if (!confirm(`Delete ${anime.anime_name} and all ${anime.episode_count} episodes?`)) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteAnimeFromLibrary(anime.slug);
      onOpenChange(false);
      onUpdate?.();
    } catch (error) {
      console.error('Failed to delete anime:', error);
      alert(`Failed to delete anime: ${error}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePlayEpisode = async (episode: LibraryEntry) => {
    try {
      await playEpisode({
        slug: anime.slug,
        animeName: anime.anime_name,
        episode: episode.episode,
        source: "local",
        filePath: episode.file_path,
        posterUrl: anime.thumbnail_url ?? undefined,
      });
      onOpenChange(false); // Close the sheet
      navigate(`/player?slug=${anime.slug}&episode=${episode.episode}&source=local`);
    } catch (error) {
      console.error('Failed to open episode:', error);
      alert(`Failed to open episode: ${error}`);
    }
  };

  const handleDeleteEpisode = async (episode: LibraryEntry) => {
    if (!confirm(`Delete episode ${episode.episode}?`)) {
      return;
    }

    try {
      await deleteLibraryEntry(episode.id);
      loadEpisodes();
      onUpdate?.();
    } catch (error) {
      console.error('Failed to delete episode:', error);
      alert(`Failed to delete episode: ${error}`);
    }
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] flex flex-col p-0">
        {/* Header with Image */}
        <div className="relative flex-shrink-0">
          {/* Background Image with Overlay */}
          <div className="h-48 relative overflow-hidden">
            {imageSrc ? (
              <div className="absolute inset-0">
                <img
                  src={imageSrc}
                  alt={anime.anime_name}
                  className="w-full h-full object-cover blur-sm scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-background" />
              </div>
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5" />
            )}

            {/* Title Overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-6 pb-4">
              <h2 className="text-2xl font-bold text-white drop-shadow-lg">
                {anime.anime_name}
              </h2>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Metadata */}
          <div className="px-6 py-4 border-b flex-shrink-0">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Film className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Episodes</p>
                  <p className="font-medium">{anime.episode_count}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Size</p>
                  <p className="font-medium">{formatBytes(anime.total_size)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Downloaded</p>
                  <p className="font-medium">{formatDate(anime.last_downloaded)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="px-6 py-4 border-b flex gap-2 flex-shrink-0">
            <Button
              onClick={handlePlayFirst}
              disabled={episodes.length === 0}
              className="flex-1"
            >
              <Play className="h-4 w-4 mr-2" />
              Play First
            </Button>
            <Button
              variant="outline"
              onClick={handleRevealInFinder}
              disabled={episodes.length === 0}
            >
              <FolderOpen className="h-4 w-4 mr-2" />
              Reveal
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAnime}
              disabled={isDeleting}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Episodes List */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="px-6 py-3 border-b flex-shrink-0">
              <h3 className="font-semibold">Episodes</h3>
            </div>

            <ScrollArea className="flex-1">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : episodes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Film className="h-12 w-12 text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">No episodes found</p>
                </div>
              ) : (
                <div className="px-6 py-2 space-y-2">
                  {episodes.map((episode) => (
                    <div
                      key={episode.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">Episode {episode.episode}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {formatBytes(episode.file_size)} • {formatDate(episode.downloaded_at)}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handlePlayEpisode(episode)}
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteEpisode(episode)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
