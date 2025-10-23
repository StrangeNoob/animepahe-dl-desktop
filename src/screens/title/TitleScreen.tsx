import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Play, Plus, Calendar, Film, Star, Download } from 'lucide-react';
import { fetchEpisodes, checkEpisodeDownloaded, getLibraryEntry, previewSources, resolveVideoUrl } from '../../core/animepahe/api';
import { usePreferenceStore } from '../../core/store';
import { usePlayerStore } from '../../core/store/player-store';
import { FetchEpisodesResponse, EpisodeInfo } from '../../core/types';
import { useChromeSlots } from '../../ui/contexts/ChromeSlots';
import { Button } from '../../ui/components/base/button';
import { cn } from '../../core/utils/cn';
import { ImageWithProxy } from '../../ui/components/base/ImageWithProxy';

/**
 * Title Screen
 * Anime title details page with hero banner
 *
 * Features:
 * - Hero banner with gradient overlay
 * - Anime title and metadata
 * - "View Episodes" CTA button
 * - Add to Library button
 * - Episode count and status
 */
export function TitleScreen() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const hostUrl = usePreferenceStore((state) => state.hostUrl);
  const slots = useChromeSlots();
  const { playEpisode } = usePlayerStore();

  const [data, setData] = useState<FetchEpisodesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadedEpisodes, setDownloadedEpisodes] = useState<Set<number>>(new Set());

  // Setup chrome slots
  useEffect(() => {
    slots.setMobileTopBarTitle(data?.displayName || 'Loading...');
    return () => {
      slots.clearSlots();
    };
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch anime details
  useEffect(() => {
    if (!slug) return;

    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await fetchEpisodes(slug, hostUrl, slug);
        setData(result);

        // Check which episodes are downloaded
        const downloaded = new Set<number>();
        for (const ep of result.episodes) {
          try {
            const isDownloaded = await checkEpisodeDownloaded(slug, ep.number);
            if (isDownloaded) {
              downloaded.add(ep.number);
            }
          } catch (err) {
            console.error(`Failed to check download status for episode ${ep.number}:`, err);
          }
        }
        setDownloadedEpisodes(downloaded);
      } catch (err) {
        console.error('Failed to fetch anime details:', err);
        setError('Failed to load anime details');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [slug, hostUrl]);

  const handleViewEpisodes = () => {
    if (slug) {
      navigate(`/title/${slug}/episodes`);
    }
  };

  const handleAddToLibrary = () => {
    // TODO: Implement add to library functionality in future sprint
    console.log('Add to library:', slug);
  };

  const handlePlayEpisode = async (episode: EpisodeInfo) => {
    if (!slug || !data) return;

    const isDownloaded = downloadedEpisodes.has(episode.number);

    if (isDownloaded) {
      // Play from local library
      try {
        const libraryEntry = await getLibraryEntry(slug, episode.number);
        if (libraryEntry) {
          await playEpisode({
            slug,
            animeName: data.displayName,
            episode: episode.number,
            source: 'local',
            filePath: libraryEntry.file_path,
            posterUrl: data.posterUrl || undefined,
          });
          navigate('/player');
        }
      } catch (err) {
        console.error('Failed to play local episode:', err);
      }
    } else {
      // Stream from remote URL
      try {
        // Fetch available sources for this episode
        const sources = await previewSources(slug, hostUrl, [episode.number], data);

        if (sources.length === 0 || sources[0].sources.length === 0) {
          console.error('No sources available for episode:', episode.number);
          return;
        }

        // Get the embed URL (e.g., Kwik.cx URL)
        const embedUrl = sources[0].sources[0].src;
        console.log('Resolving embed URL:', embedUrl);

        // Resolve the embed URL to the actual HLS stream URL
        const videoUrl = await resolveVideoUrl(embedUrl, hostUrl);
        console.log('Resolved video URL:', videoUrl);

        await playEpisode({
          slug,
          animeName: data.displayName,
          episode: episode.number,
          source: 'remote',
          remoteUrl: videoUrl,
          posterUrl: data.posterUrl || undefined,
        });
        navigate('/player');
      } catch (err) {
        console.error('Failed to stream remote episode:', err);
      }
    }
  };

  if (isLoading) {
    return (
      <main className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center" role="status" aria-live="polite">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading anime details...</p>
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md px-4" role="alert">
          <Film className="h-16 w-16 text-muted-foreground mx-auto mb-4" aria-hidden="true" />
          <h1 className="text-xl font-semibold mb-2">Failed to load</h1>
          <p className="text-muted-foreground mb-4">
            {error || 'Could not load anime details. Please try again.'}
          </p>
          <Button onClick={() => navigate('/search')} variant="outline">
            Back to Search
          </Button>
        </div>
      </main>
    );
  }

  // Extract real data from API
  const year = data.year;
  const status = data.status || undefined;
  const genres = data.genres || [];
  const synopsis = data.synopsis;
  const animeType = data.animeType;
  const season = data.season;

  return (
    <main className="pb-8">
      {/* Hero Banner */}
      <section className="relative h-[400px] md:h-[500px] overflow-hidden" aria-label="Anime details">
        {/* Background Image */}
        {data.posterUrl ? (
          <>
            <div className="absolute inset-0">
              <ImageWithProxy
                url={data.posterUrl}
                alt={data.displayName}
                className="w-full h-full object-cover blur-sm scale-110"
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/40" />
          </>
        ) : (
          <>
            <div
              className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-secondary/20"
              aria-hidden="true"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
          </>
        )}

        {/* Content */}
        <div className="absolute inset-0 flex items-end">
          <div className="container mx-auto px-4 md:px-6 pb-8">
            <div className="max-w-3xl flex gap-6 items-end">
              {/* Poster Thumbnail */}
              {data.posterUrl && (
                <div className="hidden md:block flex-shrink-0 w-40 h-56 rounded-lg overflow-hidden shadow-2xl border-2 border-white/10">
                  <ImageWithProxy
                    url={data.posterUrl}
                    alt={data.displayName}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="flex-1">
                {/* Title */}
                <h1 className="text-3xl md:text-5xl font-bold mb-4 drop-shadow-lg">
                  {data.displayName}
                </h1>

              {/* Metadata Row */}
              <div className="flex flex-wrap items-center gap-3 md:gap-4 text-sm md:text-base mb-4">
                {/* Year */}
                {year && (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{year}</span>
                  </div>
                )}

                {/* Type */}
                {animeType && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">{animeType}</span>
                  </div>
                )}

                {/* Episodes */}
                <div className="flex items-center gap-1.5">
                  <Film className="h-4 w-4 text-muted-foreground" />
                  <span>{data.episodes.length} Episodes</span>
                </div>

                {/* Status Badge */}
                {status && (
                  <div
                    className={cn(
                      'px-2 py-0.5 rounded-full text-xs font-medium',
                      status === 'ongoing'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-blue-500/20 text-blue-400'
                    )}
                  >
                    {status === 'ongoing' ? 'Ongoing' : 'Completed'}
                  </div>
                )}
              </div>

              {/* Genres */}
              {genres.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-6">
                  {genres.map((genre) => (
                    <span
                      key={genre}
                      className="px-3 py-1 rounded-md bg-white/10 backdrop-blur-sm text-sm"
                    >
                      {genre}
                    </span>
                  ))}
                </div>
              )}

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3">
                  <Button
                    size="lg"
                    onClick={handleViewEpisodes}
                    className="flex items-center gap-2"
                  >
                    <Play className="h-5 w-5 fill-current" />
                    View Episodes
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={handleAddToLibrary}
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-5 w-5" />
                    Add to Library
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Details Section */}
      <div className="container mx-auto px-4 md:px-6 mt-8">
        <div className="max-w-3xl">
          {/* Synopsis */}
          {synopsis && (
            <section aria-labelledby="synopsis-heading" className="mb-8">
              <h2 id="synopsis-heading" className="text-xl md:text-2xl font-bold mb-3">Synopsis</h2>
              <p className="text-muted-foreground leading-relaxed">
                {synopsis}
              </p>
            </section>
          )}

          {/* Episode Grid */}
          <section aria-labelledby="episodes-heading" className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Film className="h-6 w-6 text-primary" aria-hidden="true" />
                <h2 id="episodes-heading" className="text-xl font-bold">Episodes</h2>
                <span className="text-sm text-muted-foreground">({data.episodes.length})</span>
              </div>
              <Button
                onClick={handleViewEpisodes}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download Episodes
              </Button>
            </div>

            {/* Episode Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {data.episodes.map((episode) => {
                const isDownloaded = downloadedEpisodes.has(episode.number);
                return (
                  <button
                    key={episode.number}
                    onClick={() => handlePlayEpisode(episode)}
                    className={cn(
                      "relative aspect-video rounded-lg overflow-hidden group",
                      "bg-gradient-to-br from-primary/20 to-secondary/20",
                      "hover:from-primary/30 hover:to-secondary/30",
                      "transition-all duration-200 hover:scale-105",
                      "border-2 border-transparent hover:border-primary/50",
                      "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                    )}
                  >
                    {/* Episode Thumbnail */}
                    {episode.snapshotUrl && (
                      <ImageWithProxy
                        url={episode.snapshotUrl}
                        alt={`Episode ${episode.number}`}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    )}

                    {/* Dark Overlay for Text Visibility */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                    {/* Episode Number */}
                    <div className="absolute bottom-2 left-2 text-left">
                      <p className="text-xs text-white/70 mb-0.5">Episode</p>
                      <p className="text-xl font-bold text-white drop-shadow-lg">{episode.number}</p>
                    </div>

                    {/* Play Icon Overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center">
                      <Play className="h-10 w-10 opacity-0 group-hover:opacity-100 transition-opacity fill-white drop-shadow-lg" />
                    </div>

                    {/* Downloaded Badge */}
                    {isDownloaded && (
                      <div className="absolute top-2 right-2 bg-blue-600/90 text-white text-xs px-2.5 py-1 rounded-md flex items-center gap-1 font-medium backdrop-blur-sm shadow-lg">
                        <span>Local</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
