import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { Button } from '../base/button';
import { usePreferenceStore } from '../../../core/store';
import { previewSources, startDownload } from '../../../core/animepahe/api';
import { FetchEpisodesResponse, EpisodeInfo, CandidateSource } from '../../../core/types';

interface EpisodeDownloadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  episode: EpisodeInfo;
  animeData: FetchEpisodesResponse;
  animeSlug: string;
}

export function EpisodeDownloadDialog({
  isOpen,
  onClose,
  episode,
  animeData,
  animeSlug,
}: EpisodeDownloadDialogProps) {
  const hostUrl = usePreferenceStore((state) => state.hostUrl);
  const maxThreads = usePreferenceStore((state) => state.maxThreads);
  const downloadDir = usePreferenceStore((state) => state.downloadDir);

  const [sources, setSources] = useState<CandidateSource[]>([]);
  const [selectedSource, setSelectedSource] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Fetch sources when dialog opens
  useEffect(() => {
    if (isOpen && sources.length === 0) {
      loadSources();
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadSources = async () => {
    setIsLoading(true);
    try {
      const result = await previewSources(animeSlug, hostUrl, [episode.number], animeData);
      if (result.length > 0 && result[0].sources.length > 0) {
        setSources(result[0].sources);
      }
    } catch (error) {
      console.error('Failed to load sources:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    if (sources.length === 0) return;

    const source = sources[selectedSource];
    setIsDownloading(true);

    try {
      await startDownload({
        animeName: animeData.displayName,
        animeSlug,
        episodes: [episode.number],
        audioType: source.audio || undefined,
        resolution: source.resolution || undefined,
        downloadDir,
        host: hostUrl,
        threads: maxThreads,
      });

      // Close dialog after starting download
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (error) {
      console.error('Failed to start download:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  if (!isOpen) return null;

  const selectedSourceData = sources[selectedSource];
  const audioOptions = [...new Set(sources.map(s => s.audio).filter(Boolean))];
  const resolutionOptions = [...new Set(sources.map(s => s.resolution).filter(Boolean))];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-gray-900 rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white">
            Download Episode {episode.number}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : sources.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              No sources available
            </div>
          ) : (
            <>
              {/* Audio Selection */}
              {audioOptions.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Audio
                  </label>
                  <select
                    value={selectedSourceData?.audio || ''}
                    onChange={(e) => {
                      const index = sources.findIndex(
                        s => s.audio === e.target.value && s.resolution === selectedSourceData?.resolution
                      );
                      if (index !== -1) setSelectedSource(index);
                    }}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {audioOptions.map((audio) => (
                      <option key={audio ?? ''} value={audio ?? ''}>
                        {audio}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Resolution Selection */}
              {resolutionOptions.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Resolution
                  </label>
                  <select
                    value={selectedSourceData?.resolution || ''}
                    onChange={(e) => {
                      const index = sources.findIndex(
                        s => s.resolution === e.target.value && s.audio === selectedSourceData?.audio
                      );
                      if (index !== -1) setSelectedSource(index);
                    }}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {resolutionOptions.map((resolution) => (
                      <option key={resolution ?? ''} value={resolution ?? ''}>
                        {resolution}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Source Info */}
              <div className="bg-gray-800 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Anime:</span>
                  <span className="text-white font-medium">{animeData.displayName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Episode:</span>
                  <span className="text-white font-medium">{episode.number}</span>
                </div>
                {selectedSourceData?.audio && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Audio:</span>
                    <span className="text-white font-medium">{selectedSourceData.audio}</span>
                  </div>
                )}
                {selectedSourceData?.resolution && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Quality:</span>
                    <span className="text-white font-medium">{selectedSourceData.resolution}</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-800 border-t border-gray-700 flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
            disabled={isDownloading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDownload}
            className="flex-1 flex items-center justify-center gap-2"
            disabled={isLoading || sources.length === 0 || isDownloading}
          >
            <Download className="w-4 h-4" />
            {isDownloading ? 'Starting...' : 'Download'}
          </Button>
        </div>
      </div>
    </div>
  );
}
