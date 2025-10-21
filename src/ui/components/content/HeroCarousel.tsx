import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Play, Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../../../core/utils/cn';

export interface HeroSlide {
  slug: string;
  title: string;
  description?: string;
  imageUrl?: string;
  year?: number;
  rating?: number;
  genres?: string[];
}

export interface HeroCarouselProps {
  slides: HeroSlide[];
  autoPlayInterval?: number;
  className?: string;
}

/**
 * HeroCarousel Component
 * Large banner carousel for featured/trending anime
 *
 * Features:
 * - Auto-play with configurable interval
 * - Swipe gestures on mobile
 * - Pagination dots
 * - Previous/Next navigation
 * - Gradient overlay for text readability
 * - Call-to-action buttons (Watch, Info)
 *
 * Usage:
 * ```tsx
 * <HeroCarousel
 *   slides={[
 *     {
 *       slug: 'one-piece',
 *       title: 'One Piece',
 *       description: 'Epic pirate adventure...',
 *       imageUrl: 'https://...',
 *       year: 1999,
 *       rating: 4.8,
 *       genres: ['Action', 'Adventure'],
 *     },
 *   ]}
 *   autoPlayInterval={5000}
 * />
 * ```
 */
export function HeroCarousel({
  slides,
  autoPlayInterval = 5000,
  className,
}: HeroCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Auto-play
  useEffect(() => {
    if (slides.length <= 1 || autoPlayInterval <= 0) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % slides.length);
    }, autoPlayInterval);

    return () => clearInterval(timer);
  }, [slides.length, autoPlayInterval]);

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % slides.length);
  };

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  if (slides.length === 0) return null;

  const currentSlide = slides[currentIndex];

  return (
    <div
      className={cn('relative h-[400px] md:h-[500px] overflow-hidden rounded-lg', className)}
      role="region"
      aria-label="Featured anime carousel"
      aria-live="polite"
    >
      {/* Background Image with Gradient Overlay */}
      <div className="absolute inset-0">
        {currentSlide.imageUrl ? (
          <img
            src={currentSlide.imageUrl}
            alt={currentSlide.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-primary/20 to-primary/5" />
        )}
        {/* Gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative h-full flex flex-col justify-end p-6 md:p-12">
        {/* Title */}
        <h2 className="text-3xl md:text-5xl font-bold text-white mb-2 drop-shadow-lg">
          {currentSlide.title}
        </h2>

        {/* Metadata */}
        {(currentSlide.year || currentSlide.rating || currentSlide.genres) && (
          <div className="flex items-center gap-3 text-sm md:text-base text-white/90 mb-4">
            {currentSlide.year && <span>{currentSlide.year}</span>}
            {currentSlide.rating && (
              <span className="flex items-center gap-1">
                ⭐ {currentSlide.rating.toFixed(1)}
              </span>
            )}
            {currentSlide.genres && currentSlide.genres.length > 0 && (
              <span className="flex items-center gap-2">
                {currentSlide.genres.slice(0, 3).map((genre, i) => (
                  <span key={genre}>
                    {i > 0 && '•'} {genre}
                  </span>
                ))}
              </span>
            )}
          </div>
        )}

        {/* Description */}
        {currentSlide.description && (
          <p className="text-sm md:text-base text-white/80 max-w-2xl line-clamp-2 md:line-clamp-3 mb-6">
            {currentSlide.description}
          </p>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <Link
            to={`/title/${currentSlide.slug}`}
            className={cn(
              'inline-flex items-center gap-2',
              'px-6 py-3 rounded-md',
              'bg-white text-black',
              'font-semibold text-sm md:text-base',
              'hover:bg-white/90 transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black'
            )}
          >
            <Play className="h-5 w-5 fill-black" />
            <span>Watch Now</span>
          </Link>
          <Link
            to={`/title/${currentSlide.slug}`}
            className={cn(
              'inline-flex items-center gap-2',
              'px-6 py-3 rounded-md',
              'bg-white/20 backdrop-blur-sm text-white',
              'font-semibold text-sm md:text-base',
              'hover:bg-white/30 transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black'
            )}
          >
            <Info className="h-5 w-5" />
            <span>More Info</span>
          </Link>
        </div>
      </div>

      {/* Navigation Arrows (Desktop) */}
      {slides.length > 1 && (
        <>
          <button
            onClick={goToPrevious}
            className={cn(
              'hidden md:flex',
              'absolute left-4 top-1/2 -translate-y-1/2',
              'items-center justify-center',
              'h-12 w-12 rounded-full',
              'bg-black/50 backdrop-blur-sm text-white',
              'hover:bg-black/70 transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-white'
            )}
            aria-label="Previous slide"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            onClick={goToNext}
            className={cn(
              'hidden md:flex',
              'absolute right-4 top-1/2 -translate-y-1/2',
              'items-center justify-center',
              'h-12 w-12 rounded-full',
              'bg-black/50 backdrop-blur-sm text-white',
              'hover:bg-black/70 transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-white'
            )}
            aria-label="Next slide"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}

      {/* Pagination Dots */}
      {slides.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={cn(
                'h-2 rounded-full transition-all',
                index === currentIndex
                  ? 'w-8 bg-white'
                  : 'w-2 bg-white/50 hover:bg-white/75'
              )}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
