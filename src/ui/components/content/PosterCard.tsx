import { Link } from 'react-router-dom';
import { Play, Star } from 'lucide-react';
import { cn } from '../../../core/utils/cn';
import { ImageWithProxy } from '../base/ImageWithProxy';

export interface PosterCardProps {
  slug: string;
  title: string;
  imageUrl?: string;
  year?: number;
  episodes?: number;
  rating?: number;
  status?: 'ongoing' | 'completed';
  className?: string;
  /**
   * Aspect ratio for the poster image
   * - portrait: 2:3 ratio (default, typical anime posters)
   * - landscape: 16:9 ratio (for wide banners)
   * - square: 1:1 ratio
   */
  aspectRatio?: 'portrait' | 'landscape' | 'square';
  /**
   * Display mode
   * - overlay: Title and metadata overlay on image with gradient
   * - below: Title and metadata display below image
   */
  mode?: 'overlay' | 'below';
  /**
   * Show play icon on hover/tap
   */
  showPlayIcon?: boolean;
}

/**
 * PosterCard Component
 * Displays anime poster with title and metadata
 *
 * Features:
 * - Responsive aspect ratios (portrait, landscape, square)
 * - Two display modes (overlay, below)
 * - Lazy loading for images
 * - Skeleton loading state
 * - Touch-friendly tap targets
 * - Accessible with ARIA labels
 * - Links to title detail page
 *
 * Usage:
 * ```tsx
 * <PosterCard
 *   slug="one-piece"
 *   title="One Piece"
 *   imageUrl="https://..."
 *   year={1999}
 *   episodes={1000}
 *   rating={4.8}
 *   status="ongoing"
 * />
 * ```
 */
export function PosterCard({
  slug,
  title,
  imageUrl,
  year,
  episodes,
  rating,
  status,
  className,
  aspectRatio = 'portrait',
  mode = 'overlay',
  showPlayIcon = true,
}: PosterCardProps) {
  const aspectRatioClasses = {
    portrait: 'aspect-[2/3]',
    landscape: 'aspect-video',
    square: 'aspect-square',
  };

  const content = (
    <div
      className={cn(
        'group relative overflow-hidden rounded-lg',
        'transition-all duration-200',
        'hover:scale-105 hover:shadow-xl',
        'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
        className
      )}
    >
      {/* Image Container */}
      <div className={cn('relative bg-muted', aspectRatioClasses[aspectRatio])}>
        {/* Poster Image with Proxy */}
        <ImageWithProxy
          url={imageUrl}
          alt={title}
          className="h-full w-full object-cover"
          loading="lazy"
          fallback={
            <div className="flex h-full w-full items-center justify-center bg-muted">
              <span className="text-xs text-muted-foreground">No Image</span>
            </div>
          }
        />

        {/* Play Icon Overlay */}
        {showPlayIcon && (
          <div
            className={cn(
              'absolute inset-0 flex items-center justify-center',
              'bg-black/40 opacity-0',
              'transition-opacity duration-200',
              'group-hover:opacity-100'
            )}
          >
            <div className="rounded-full bg-white/90 p-3">
              <Play className="h-6 w-6 text-black fill-black" />
            </div>
          </div>
        )}

        {/* Overlay Mode: Gradient + Content */}
        {mode === 'overlay' && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3">
            <h3 className="text-sm font-semibold text-white line-clamp-2 mb-1">
              {title}
            </h3>
            {(year || episodes || rating || status) && (
              <div className="flex items-center gap-2 text-xs text-white/80">
                {year && <span>{year}</span>}
                {episodes && <span>• {episodes} ep</span>}
                {rating && (
                  <span className="flex items-center gap-1">
                    • <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    {rating.toFixed(1)}
                  </span>
                )}
                {status === 'ongoing' && (
                  <span className="ml-auto rounded-full bg-green-500 px-2 py-0.5 text-[10px] font-medium text-white">
                    Ongoing
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Below Mode: Content under image */}
      {mode === 'below' && (
        <div className="p-2">
          <h3 className="text-sm font-semibold line-clamp-2 mb-1">{title}</h3>
          {(year || episodes || rating) && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {year && <span>{year}</span>}
              {episodes && <span>• {episodes} ep</span>}
              {rating && (
                <span className="flex items-center gap-1">
                  • <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  {rating.toFixed(1)}
                </span>
              )}
            </div>
          )}
          {status === 'ongoing' && (
            <div className="mt-1">
              <span className="inline-block rounded-full bg-green-500 px-2 py-0.5 text-[10px] font-medium text-white">
                Ongoing
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <Link
      to={`/title/${slug}`}
      className="block focus:outline-none"
      aria-label={`View ${title}`}
    >
      {content}
    </Link>
  );
}

/**
 * PosterCardSkeleton
 * Loading state for PosterCard
 */
export function PosterCardSkeleton({
  aspectRatio = 'portrait',
  mode = 'overlay',
  className,
}: Pick<PosterCardProps, 'aspectRatio' | 'mode' | 'className'>) {
  const aspectRatioClasses = {
    portrait: 'aspect-[2/3]',
    landscape: 'aspect-video',
    square: 'aspect-square',
  };

  return (
    <div className={cn('overflow-hidden rounded-lg', className)}>
      <div
        className={cn(
          'animate-pulse bg-gradient-to-br from-muted to-muted-foreground/10',
          aspectRatioClasses[aspectRatio]
        )}
      />
      {mode === 'below' && (
        <div className="p-2 space-y-2">
          <div className="h-4 w-3/4 animate-pulse bg-muted rounded" />
          <div className="h-3 w-1/2 animate-pulse bg-muted rounded" />
        </div>
      )}
    </div>
  );
}
