import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Play, Folder, Trash2, Eye } from "lucide-react";
import { LibraryEntry } from "../types";
import {
  getAnimeEpisodes,
  deleteLibraryEntry,
  markEpisodeWatched,
  openPath
} from "../api";

interface EpisodeListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  animeName: string;
  onUpdate: () => void;
  formatSize: (bytes: number) => string;
}

export function EpisodeListDialog({
  open,
  onOpenChange,
  slug,
  animeName,
  onUpdate,
  formatSize
}: EpisodeListDialogProps) {
  const [episodes, setEpisodes] = useState<LibraryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (open) {
      loadEpisodes();
    }
  }, [open, slug]);

  const loadEpisodes = async () => {
    setIsLoading(true);
    try {
      const data = await getAnimeEpisodes(slug);
      setEpisodes(data);
    } catch (error) {
      console.error("Failed to load episodes:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlay = async (episode: LibraryEntry) => {
    try {
      await markEpisodeWatched(episode.id);
      await openPath(episode.file_path);
      loadEpisodes();
    } catch (error) {
      console.error("Failed to play episode:", error);
    }
  };

  const handleOpenFolder = async (filePath: string) => {
    try {
      const folderPath = filePath.substring(0, filePath.lastIndexOf('/'));
      await openPath(folderPath);
    } catch (error) {
      console.error("Failed to open folder:", error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this episode from library?")) return;

    try {
      await deleteLibraryEntry(id);
      loadEpisodes();
      onUpdate();
    } catch (error) {
      console.error("Failed to delete episode:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{animeName}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Loading episodes...</p>
            </div>
          ) : episodes.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No episodes found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {episodes.map((episode) => (
                <div
                  key={episode.id}
                  className="p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">Episode {episode.episode}</h4>
                        {episode.watch_count > 0 && (
                          <span className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Eye className="h-3 w-3" />
                            {episode.watch_count}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground space-y-1">
                        {episode.resolution && <p>Resolution: {episode.resolution}</p>}
                        {episode.audio && <p>Audio: {episode.audio}</p>}
                        <p>Size: {formatSize(episode.file_size)}</p>
                        {episode.last_watched && (
                          <p>Last watched: {new Date(episode.last_watched * 1000).toLocaleString()}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => handlePlay(episode)}
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Play
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenFolder(episode.file_path)}
                      >
                        <Folder className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(episode.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
