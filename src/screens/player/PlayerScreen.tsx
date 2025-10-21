import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { VideoPlayer } from "../../ui/components/content/VideoPlayer";
import { usePlayerStore } from "../../core/store/player-store";
import { ArrowLeft, Download, ChevronDown } from "lucide-react";
import { fetchEpisodes, previewSources, resolveVideoUrl, startDownload } from "../../core/animepahe/api";
import { usePreferenceStore } from "../../core/store";
import { FetchEpisodesResponse, EpisodeInfo, CandidateSource } from "../../core/types";
import { ImageWithProxy } from "../../ui/components/base/ImageWithProxy";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";

export function PlayerScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentEpisode, error, clearError, playEpisode } = usePlayerStore();
  const hostUrl = usePreferenceStore((state) => state.hostUrl);
  const maxThreads = usePreferenceStore((state) => state.maxThreads);
  const downloadDir = usePreferenceStore((state) => state.downloadDir);

  const [animeData, setAnimeData] = useState<FetchEpisodesResponse | null>(null);
  const [sources, setSources] = useState<CandidateSource[]>([]);
  const [selectedSourceIndex, setSelectedSourceIndex] = useState<number>(0);
  const [isChangingQuality, setIsChangingQuality] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Fetch anime data and sources
  useEffect(() => {
    const loadAnimeDataAndSources = async () => {
      if (currentEpisode && currentEpisode.slug && currentEpisode.source === "remote") {
        try {
          const data = await fetchEpisodes(
            currentEpisode.slug,
            hostUrl,
            currentEpisode.slug
          );
          setAnimeData(data);

          // Load available sources
          const sourcesResult = await previewSources(
            currentEpisode.slug,
            hostUrl,
            [currentEpisode.episode],
            data
          );

          if (sourcesResult.length > 0 && sourcesResult[0].sources.length > 0) {
            setSources(sourcesResult[0].sources);
          }
        } catch (err) {
          console.error("Failed to fetch anime data and sources:", err);
        }
      }
    };

    loadAnimeDataAndSources();
  }, [currentEpisode, hostUrl]);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      clearError();
    };
  }, [clearError]);

  const handleBack = () => {
    // TODO: Save progress before leaving when history tracking is implemented
    navigate(-1);
  };

  const handleQualityChange = async (sourceIndex: number) => {
    if (!currentEpisode || !animeData || sources.length === 0) return;

    setIsChangingQuality(true);
    try {
      const source = sources[sourceIndex];
      const embedUrl = source.src;

      // Resolve the embed URL to get the actual video URL
      const videoUrl = await resolveVideoUrl(embedUrl, hostUrl);

      // Update the player with the new video URL
      await playEpisode({
        slug: currentEpisode.slug,
        animeName: currentEpisode.animeName,
        episode: currentEpisode.episode,
        source: 'remote',
        remoteUrl: videoUrl,
        posterUrl: currentEpisode.posterUrl,
      });

      setSelectedSourceIndex(sourceIndex);
    } catch (err) {
      console.error("Failed to change quality:", err);
    } finally {
      setIsChangingQuality(false);
    }
  };

  const handleEpisodeChange = async (episodeNumber: number) => {
    if (!currentEpisode || !animeData) return;

    const episodeInfo = animeData.episodes.find((ep: EpisodeInfo) => ep.number === episodeNumber);
    if (!episodeInfo) return;

    setIsChangingQuality(true);
    try {
      // Load sources for the new episode
      const sourcesResult = await previewSources(
        currentEpisode.slug,
        hostUrl,
        [episodeNumber],
        animeData
      );

      if (sourcesResult.length > 0 && sourcesResult[0].sources.length > 0) {
        const newSources = sourcesResult[0].sources;
        setSources(newSources);
        setSelectedSourceIndex(0);

        // Get the first source and resolve it
        const embedUrl = newSources[0].src;
        const videoUrl = await resolveVideoUrl(embedUrl, hostUrl);

        // Update the player with the new episode
        await playEpisode({
          slug: currentEpisode.slug,
          animeName: currentEpisode.animeName,
          episode: episodeNumber,
          source: 'remote',
          remoteUrl: videoUrl,
          posterUrl: currentEpisode.posterUrl,
        });

        // Episode info is now updated in the player store
      }
    } catch (err) {
      console.error("Failed to change episode:", err);
    } finally {
      setIsChangingQuality(false);
    }
  };

  const handleDownload = async () => {
    if (!currentEpisode || !animeData || sources.length === 0) return;

    const source = sources[selectedSourceIndex];
    setIsDownloading(true);

    try {
      await startDownload({
        animeName: animeData.displayName,
        animeSlug: currentEpisode.slug,
        episodes: [currentEpisode.episode],
        audioType: source.audio || undefined,
        resolution: source.resolution || undefined,
        downloadDir,
        host: hostUrl,
        threads: maxThreads,
      });
    } catch (err) {
      console.error("Failed to start download:", err);
    } finally {
      setIsDownloading(false);
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white p-4">
        <div className="max-w-md text-center">
          <h2 className="text-2xl font-bold mb-4">Playback Error</h2>
          <p className="text-gray-300 mb-6">{error}</p>
          <button
            onClick={handleBack}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!currentEpisode) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white p-4">
        <div className="max-w-md text-center">
          <h2 className="text-2xl font-bold mb-4">No Episode Selected</h2>
          <p className="text-gray-300 mb-6">
            Please select an episode to watch.
          </p>
          <button
            onClick={handleBack}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Get current selected source for display
  const selectedSource = sources[selectedSourceIndex];

  // Commented out - not needed with combined quality selector
  // const audioOptions = [...new Set(sources.map(s => s.audio).filter(Boolean))];
  // const resolutionOptions = [...new Set(sources.map(s => s.resolution).filter(Boolean))];

  // Format quality display (audio · resolution)
  const formatQualityLabel = (source: CandidateSource) => {
    const parts = [];
    if (source.audio) parts.push(source.audio);
    if (source.resolution) parts.push(source.resolution);
    return parts.join(' · ') || 'Unknown';
  };

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header Bar */}
      <div className="bg-black border-b">
        <div className="px-4 py-3">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-white hover:text-primary transition-colors group"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="font-medium">Back</span>
          </button>
        </div>
      </div>

      {/* Video Player */}
      <div className="bg-black aspect-video w-full">
        <VideoPlayer className="w-full h-full" />
      </div>

      {/* Controls Section - Only show for remote episodes */}
      {currentEpisode?.source === "remote" && sources.length > 0 && (
        <div className="border-t">
          <div className="px-4 py-3">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-w-7xl mx-auto">

              {/* Episode Selector */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    disabled={isChangingQuality || !animeData}
                    className="w-full flex items-center justify-between bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span>Episode {currentEpisode?.episode || 1}</span>
                    <ChevronDown className="w-4 h-4 ml-2" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 max-h-80 overflow-y-auto bg-gray-800 border-gray-700">
                  <DropdownMenuRadioGroup
                    value={String(currentEpisode?.episode || 1)}
                    onValueChange={(value) => handleEpisodeChange(Number(value))}
                  >
                    {animeData?.episodes.map((ep) => (
                      <DropdownMenuRadioItem
                        key={ep.number}
                        value={String(ep.number)}
                        className="text-white hover:bg-gray-700 focus:bg-gray-700"
                      >
                        Episode {ep.number}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Quality/Audio Selector */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    disabled={isChangingQuality || sources.length <= 1}
                    className="w-full flex items-center justify-between bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span>{selectedSource ? formatQualityLabel(selectedSource) : 'Select Quality'}</span>
                    <ChevronDown className="w-4 h-4 ml-2" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 max-h-80 overflow-y-auto bg-gray-800 border-gray-700">
                  <DropdownMenuRadioGroup
                    value={String(selectedSourceIndex)}
                    onValueChange={(value) => handleQualityChange(Number(value))}
                  >
                    {sources.map((source, index) => (
                      <DropdownMenuRadioItem
                        key={index}
                        value={String(index)}
                        className="text-white hover:bg-gray-700 focus:bg-gray-700"
                      >
                        {formatQualityLabel(source)}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Download Button */}
              <button
                onClick={handleDownload}
                disabled={isDownloading || isChangingQuality}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-800 border border-gray-700 hover:bg-gray-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-5 h-5" />
                <span>{isDownloading ? 'Downloading...' : 'Download'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Anime Info Section */}
      {animeData && currentEpisode && (
        <div className="bg-black/50">
          <div className="px-4 py-6">
            <div className="flex gap-6 items-center">
              {/* Poster */}
              {animeData.posterUrl && (
                <div className="flex-shrink-0">
                  <ImageWithProxy
                    url={animeData.posterUrl}
                    alt={animeData.displayName}
                    className="w-28 h-40 object-cover rounded-lg shadow-xl border-2 border-gray-700/50"
                  />
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl md:text-3xl font-bold text-white mb-3 truncate">
                  {animeData.displayName}
                </h2>
                <div className="flex items-center gap-3 mb-3">
                  <span className="px-3 py-1 bg-primary/20 text-primary rounded-md text-sm font-medium">
                    Episode {currentEpisode.episode}
                  </span>
                  {selectedSource && (
                    <span className="px-3 py-1  text-gray-300 rounded-md text-sm">
                      {formatQualityLabel(selectedSource)}
                    </span>
                  )}
                </div>
                <div className="text-gray-400 space-y-1.5 text-sm">
                  {animeData.animeType && (
                    <p className="flex items-center gap-2">
                      <span className="text-gray-500">•</span>
                      {animeData.animeType} · {animeData.episodes.length} Episodes
                      {animeData.status && (
                        <span className="ml-2 px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs">
                          {animeData.status}
                        </span>
                      )}
                    </p>
                  )}
                  {animeData.season && animeData.year && (
                    <p className="flex items-center gap-2">
                      <span className="text-gray-500">•</span>
                      {animeData.season} {animeData.year}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
