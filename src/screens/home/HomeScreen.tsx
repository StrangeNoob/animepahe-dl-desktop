import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchLatestReleases } from '../../core/animepahe/api';
import { usePreferenceStore } from '../../core/store';
import type { LatestRelease, PaginatedLatestReleases } from '../../core/types';
import { ImageWithProxy } from '../../ui/components/base/ImageWithProxy';
import { Button } from '../../ui/components/base/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Home Screen
 * Displays latest episode releases in a responsive grid with pagination
 */
export function HomeScreen() {
  const [releases, setReleases] = useState<LatestRelease[]>([]);
  const [pagination, setPagination] = useState<Omit<PaginatedLatestReleases, 'releases'> | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const hostUrl = usePreferenceStore((state) => state.hostUrl);
  const navigate = useNavigate();

  useEffect(() => {
    loadLatestReleases(currentPage);
  }, [hostUrl, currentPage]);

  const loadLatestReleases = async (page: number) => {
    setIsLoading(true);
    console.log('[FRONTEND] Fetching latest releases from:', hostUrl, 'page:', page);
    try {
      const response = await fetchLatestReleases(hostUrl, page);
      console.log('[FRONTEND] Received response:', response);
      console.log('[FRONTEND] Number of releases:', response.releases.length);
      console.log('[FRONTEND] Pagination:', {
        currentPage: response.currentPage,
        totalPages: response.totalPages,
        hasNext: response.hasNext,
        hasPrev: response.hasPrev
      });
      setReleases(response.releases);
      setPagination({
        currentPage: response.currentPage,
        totalItems: response.totalItems,
        perPage: response.perPage,
        totalPages: response.totalPages,
        hasNext: response.hasNext,
        hasPrev: response.hasPrev,
      });
    } catch (error) {
      console.error('[FRONTEND] Failed to load latest releases:', error);
      setReleases([]);
      setPagination(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEpisodeClick = (slug: string) => {
    navigate(`/title/${slug}`);
  };

  const handlePreviousPage = () => {
    if (pagination?.hasPrev) {
      setCurrentPage((prev) => Math.max(1, prev - 1));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleNextPage = () => {
    if (pagination?.hasNext) {
      setCurrentPage((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <main className="pb-8">
      <div className="px-4 md:px-6 space-y-8">
        {/* Latest Releases */}
        <div>
          <h1 className="text-2xl font-bold mb-6">Latest Releases</h1>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="bg-muted rounded-lg h-[200px] animate-pulse" />
            ))}
          </div>
        ) : releases.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {releases.map((release) => (
              <div
                key={`${release.slug}-${release.episodeNumber}`}
                className="group relative bg-card rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                onClick={() => handleEpisodeClick(release.slug)}
              >
                {/* Snapshot Image */}
                <div className="relative aspect-video bg-muted">
                  <ImageWithProxy
                    url={release.snapshotUrl}
                    alt={`${release.animeTitle} Episode ${release.episodeNumber}`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-primary/90 flex items-center justify-center">
                      <svg
                        className="w-6 h-6 text-primary-foreground ml-0.5"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Episode Info */}
                <div className="p-4">
                  <h3 className="font-medium text-sm line-clamp-2 mb-1">
                    {release.animeTitle}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Episode {release.episodeNumber}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-[400px] bg-muted rounded-lg">
            <p className="text-muted-foreground">No latest releases available</p>
          </div>
        )}

        {/* Pagination Controls */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-8">
            <Button
              variant="outline"
              onClick={handlePreviousPage}
              disabled={!pagination.hasPrev || isLoading}
              className="gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                Page {pagination.currentPage} of {pagination.totalPages}
              </span>
              <span className="hidden sm:inline">
                ({pagination.totalItems} total episodes)
              </span>
            </div>

            <Button
              variant="outline"
              onClick={handleNextPage}
              disabled={!pagination.hasNext || isLoading}
              className="gap-2"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
        </div>
      </div>
    </main>
  );
}
