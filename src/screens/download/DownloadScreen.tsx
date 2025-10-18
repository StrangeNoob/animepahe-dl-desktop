import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/components/base/card';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Download as DownloadIcon, Search as SearchIcon } from 'lucide-react';
import { cn } from '../../core/utils/cn';

/**
 * Download Screen
 * Main screen for searching anime and downloading episodes
 *
 * TODO: Full migration from App.old.tsx includes:
 * - Autocomplete search with anime API integration
 * - Episode grid with checkbox selection
 * - Episode spec parsing (e.g., "1,3-5,*")
 * - Resolution and audio preferences
 * - Thread count configuration
 * - Preview functionality
 * - Duplicate detection
 * - Integration with QueueStore for download management
 * - Analytics tracking
 * - Download status and progress displays
 * - Mobile-responsive layout with FAB for download action
 *
 * For now, this establishes the basic structure and layout.
 * Progressive enhancement will add features from the legacy App.tsx.
 */
export function DownloadScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEpisodes, setSelectedEpisodes] = useState<number[]>([]);

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Download</h1>
        <p className="text-muted-foreground mt-1">
          Search for anime and download episodes
        </p>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Sidebar - Search & Filters */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SearchIcon className="h-5 w-5 text-primary" />
              Search & Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Anime Search */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Anime</label>
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search anime..."
              />
              <p className="text-xs text-muted-foreground">
                Select an anime to enable downloads
              </p>
            </div>

            {/* Episode Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Episodes</label>
              <Input
                placeholder="1,3-5,*"
                disabled={!searchQuery}
              />
              <p className="text-xs text-muted-foreground">
                Use patterns like 1,3-5 or *
              </p>
            </div>

            {/* Resolution Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Resolution</label>
              <Input
                placeholder="1080p"
                disabled={!searchQuery}
              />
            </div>

            {/* Audio Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Audio</label>
              <Input
                placeholder="eng"
                disabled={!searchQuery}
              />
            </div>

            {/* Download Action */}
            <Button
              className="w-full"
              disabled={selectedEpisodes.length === 0}
            >
              <DownloadIcon className="mr-2 h-4 w-4" />
              Download {selectedEpisodes.length > 0 ? `(${selectedEpisodes.length})` : ''}
            </Button>
          </CardContent>
        </Card>

        {/* Right Content - Episodes Grid */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Episodes</CardTitle>
          </CardHeader>
          <CardContent>
            {!searchQuery ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <SearchIcon className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold">No anime selected</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Search for an anime to view available episodes
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-sm text-muted-foreground">
                  Episode grid will appear here
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Download Queue Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DownloadIcon className="h-5 w-5 text-primary" />
            Download Queue
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-sm text-muted-foreground">
              No downloads in queue
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
