import { CheckCircle2, Circle, Download, PlayCircle } from 'lucide-react';
import { EpisodeInfo } from '../../../core/types';
import { cn } from '../../../core/utils/cn';

export interface EpisodeRowProps {
  episode: EpisodeInfo;
  selected: boolean;
  onToggle: (episode: number) => void;
  isDownloaded?: boolean;
  className?: string;
}

/**
 * EpisodeRow Component
 * Displays a single episode with checkbox selection
 *
 * Features:
 * - Checkbox selection
 * - Episode number and title
 * - Download status indicator
 * - File size display
 * - Keyboard accessible
 * - Hover states
 *
 * Usage:
 * ```tsx
 * <EpisodeRow
 *   episode={episodeData}
 *   selected={selectedEpisodes.includes(episodeData.episode)}
 *   onToggle={(ep) => handleToggle(ep)}
 *   isDownloaded={checkIfDownloaded(episodeData.episode)}
 * />
 * ```
 */
export function EpisodeRow({
  episode,
  selected,
  onToggle,
  isDownloaded = false,
  className,
}: EpisodeRowProps) {
  const handleClick = () => {
    onToggle(episode.number);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggle(episode.number);
    }
  };

  // Format file size to human-readable
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  return (
    <div
      onClick={handleClick}
      onKeyPress={handleKeyPress}
      role="checkbox"
      aria-checked={selected}
      tabIndex={0}
      className={cn(
        'group relative flex items-center gap-3 md:gap-4',
        'px-4 py-3 rounded-lg',
        'hover:bg-accent/50 active:bg-accent',
        'transition-all cursor-pointer',
        'focus:outline-none focus:ring-2 focus:ring-ring',
        selected && 'bg-accent/30',
        isDownloaded && 'opacity-60',
        className
      )}
    >
      {/* Checkbox */}
      <div className="flex-shrink-0">
        {selected ? (
          <CheckCircle2
            className={cn(
              'h-5 w-5',
              isDownloaded ? 'text-green-500' : 'text-primary'
            )}
          />
        ) : (
          <Circle
            className={cn(
              'h-5 w-5 text-muted-foreground',
              'group-hover:text-primary transition-colors'
            )}
          />
        )}
      </div>

      {/* Episode Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {/* Episode Number */}
          <span className="font-semibold text-sm md:text-base">
            Episode {episode.number}
          </span>

          {/* Downloaded Badge */}
          {isDownloaded && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs">
              <Download className="h-3 w-3" />
              Downloaded
            </span>
          )}
        </div>

        {/* Title (if available) */}
        {episode.title && episode.title !== `Episode ${episode.number}` && (
          <p className="text-sm text-muted-foreground truncate">
            {episode.title}
          </p>
        )}
      </div>

      {/* File Size and Actions */}
      <div className="flex-shrink-0 flex items-center gap-3">
        {/* File Size */}
        {episode.filesize && episode.filesize > 0 && (
          <span className="text-sm text-muted-foreground hidden sm:inline">
            {formatFileSize(episode.filesize)}
          </span>
        )}

        {/* Play Icon (if downloaded) */}
        {isDownloaded && (
          <PlayCircle className="h-5 w-5 text-green-500 opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </div>

      {/* Selection Highlight Bar */}
      {selected && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-l-lg" />
      )}
    </div>
  );
}

/**
 * EpisodeRow Skeleton Component
 * Loading state placeholder for episode rows
 */
export function EpisodeRowSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 md:gap-4 px-4 py-3 rounded-lg',
        className
      )}
    >
      {/* Checkbox skeleton */}
      <div className="flex-shrink-0">
        <div className="h-5 w-5 rounded-full bg-muted animate-pulse" />
      </div>

      {/* Content skeleton */}
      <div className="flex-1 space-y-2">
        <div className="h-4 w-24 bg-muted rounded animate-pulse" />
        <div className="h-3 w-48 bg-muted rounded animate-pulse" />
      </div>

      {/* File size skeleton */}
      <div className="flex-shrink-0 hidden sm:block">
        <div className="h-3 w-16 bg-muted rounded animate-pulse" />
      </div>
    </div>
  );
}
