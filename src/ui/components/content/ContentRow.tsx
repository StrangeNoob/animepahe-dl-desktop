import { ReactNode, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../../core/utils/cn';

export interface ContentRowProps {
  title: string;
  children: ReactNode;
  className?: string;
  showNavigation?: boolean;
}

/**
 * ContentRow Component
 * Horizontal scrolling row for displaying content cards
 *
 * Features:
 * - Smooth horizontal scroll
 * - Navigation arrows (desktop)
 * - Touch/swipe friendly (mobile)
 * - Snap scrolling
 * - Keyboard navigation
 *
 * Usage:
 * ```tsx
 * <ContentRow title="Trending Now">
 *   {animeList.map(anime => (
 *     <PosterCard key={anime.slug} {...anime} />
 *   ))}
 * </ContentRow>
 * ```
 */
export function ContentRow({
  title,
  children,
  className,
  showNavigation = true,
}: ContentRowProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Generate ID from title for aria-labelledby
  const headingId = title.toLowerCase().replace(/\s+/g, '-') + '-heading';

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    const scrollAmount = container.clientWidth * 0.8; // Scroll 80% of container width

    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  return (
    <div className={cn('relative group', className)}>
      {/* Section Title */}
      <h2 id={headingId} className="text-xl md:text-2xl font-bold mb-4 px-4 md:px-6">
        {title}
      </h2>

      {/* Scroll Container */}
      <div className="relative">
        <div
          ref={scrollContainerRef}
          className={cn(
            'flex gap-3 md:gap-4',
            'overflow-x-auto',
            'scroll-smooth snap-x snap-mandatory',
            'scrollbar-hide',
            'px-4 md:px-6',
            'pb-4' // Extra padding for card shadows
          )}
        >
          {children}
        </div>

        {/* Navigation Arrows (Desktop only) */}
        {showNavigation && (
          <>
            <button
              onClick={() => scroll('left')}
              className={cn(
                'hidden md:flex',
                'absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2',
                'items-center justify-center',
                'h-12 w-12 rounded-full',
                'bg-black/70 backdrop-blur-sm text-white',
                'opacity-0 group-hover:opacity-100',
                'hover:bg-black/90 transition-all',
                'focus:outline-none focus:ring-2 focus:ring-white',
                'z-10'
              )}
              aria-label="Scroll left"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              onClick={() => scroll('right')}
              className={cn(
                'hidden md:flex',
                'absolute right-0 top-1/2 -translate-y-1/2 translate-x-2',
                'items-center justify-center',
                'h-12 w-12 rounded-full',
                'bg-black/70 backdrop-blur-sm text-white',
                'opacity-0 group-hover:opacity-100',
                'hover:bg-black/90 transition-all',
                'focus:outline-none focus:ring-2 focus:ring-white',
                'z-10'
              )}
              aria-label="Scroll right"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
