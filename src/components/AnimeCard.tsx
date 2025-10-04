import { useState } from "react";
import { Card, CardContent, CardFooter } from "./ui/card";
import { Button } from "./ui/button";
import { Play, Trash2, Calendar } from "lucide-react";
import { AnimeStats } from "../types";
import { deleteAnimeFromLibrary } from "../api";
import { EpisodeListDialog } from "./EpisodeListDialog";

interface AnimeCardProps {
  anime: AnimeStats;
  onDelete: () => void;
  formatSize: (bytes: number) => string;
}

export function AnimeCard({ anime, onDelete, formatSize }: AnimeCardProps) {
  const [showEpisodes, setShowEpisodes] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`Delete ${anime.anime_name} from library?`)) return;

    setIsDeleting(true);
    try {
      await deleteAnimeFromLibrary(anime.slug);
      onDelete();
    } catch (error) {
      console.error("Failed to delete anime:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  return (
    <>
      <Card className="overflow-hidden hover:shadow-lg transition-shadow">
        <div className="aspect-video bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
          {anime.thumbnail_url ? (
            <img
              src={anime.thumbnail_url}
              alt={anime.anime_name}
              className="w-full h-full object-cover"
            />
          ) : (
            <Play className="h-12 w-12 text-muted-foreground" />
          )}
        </div>
        <CardContent className="pt-4">
          <h3 className="font-semibold truncate">{anime.anime_name}</h3>
          <div className="mt-2 space-y-1 text-sm text-muted-foreground">
            <p>{anime.episode_count} episode{anime.episode_count !== 1 ? 's' : ''}</p>
            <p>{formatSize(anime.total_size)}</p>
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>{formatDate(anime.last_downloaded)}</span>
            </div>
          </div>
        </CardContent>
        <CardFooter className="gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => setShowEpisodes(true)}
          >
            <Play className="h-4 w-4 mr-2" />
            Episodes
          </Button>
          <Button
            variant="destructive"
            size="icon"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </CardFooter>
      </Card>

      <EpisodeListDialog
        open={showEpisodes}
        onOpenChange={setShowEpisodes}
        slug={anime.slug}
        animeName={anime.anime_name}
        onUpdate={onDelete}
        formatSize={formatSize}
      />
    </>
  );
}
