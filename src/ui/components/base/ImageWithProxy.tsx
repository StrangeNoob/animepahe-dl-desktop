import { useState, useEffect, ImgHTMLAttributes } from 'react';
import { fetchImageProxy } from '../../../core/animepahe/api';
import { cn } from '../../../core/utils/cn';

interface ImageWithProxyProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  /**
   * URL of the image to load through the proxy
   */
  url: string | null | undefined;
  /**
   * Fallback content to show when image fails to load
   */
  fallback?: React.ReactNode;
  /**
   * Callback when image loads successfully
   */
  onLoadSuccess?: () => void;
  /**
   * Callback when image fails to load
   */
  onLoadError?: () => void;
}

/**
 * ImageWithProxy Component
 *
 * Loads images through the Tauri proxy to handle CORS and 403 errors.
 * Automatically converts proxy response to base64 data URL.
 *
 * Features:
 * - Automatic proxy loading for external images
 * - Loading state with skeleton animation
 * - Error handling with fallback content
 * - Lazy loading support
 * - All standard img attributes supported
 *
 * Usage:
 * ```tsx
 * <ImageWithProxy
 *   url="https://example.com/image.jpg"
 *   alt="Description"
 *   className="w-full h-full object-cover"
 *   loading="lazy"
 *   fallback={<div>No Image</div>}
 * />
 * ```
 */
export function ImageWithProxy({
  url,
  alt = '',
  className,
  fallback,
  onLoadSuccess,
  onLoadError,
  loading = 'lazy',
  ...props
}: ImageWithProxyProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    // Reset state when URL changes
    setImageSrc(null);
    setIsLoading(false);
    setHasError(false);

    // No URL provided
    if (!url) {
      setHasError(true);
      return;
    }

    // Start loading
    setIsLoading(true);

    let cancelled = false;

    const loadImage = async () => {
      try {
        const bytes = await fetchImageProxy(url);

        // Check if component unmounted or URL changed
        if (cancelled) return;

        // Convert bytes to base64 in chunks to avoid stack overflow
        // Process in chunks of 8192 bytes to stay well under call stack limit
        const chunkSize = 8192;
        let binaryString = '';
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const chunk = bytes.slice(i, i + chunkSize);
          binaryString += String.fromCharCode(...chunk);
        }

        const base64 = btoa(binaryString);
        const dataUrl = `data:image/jpeg;base64,${base64}`;

        setImageSrc(dataUrl);
        setIsLoading(false);
        setHasError(false);
        onLoadSuccess?.();
      } catch (error) {
        if (cancelled) return;

        console.error('Failed to load image through proxy:', error);
        setIsLoading(false);
        setHasError(true);
        onLoadError?.();
      }
    };

    loadImage();

    // Cleanup function
    return () => {
      cancelled = true;
    };
  }, [url, onLoadSuccess, onLoadError]);

  // Show fallback on error or no URL
  if (hasError || !url) {
    return (
      <>
        {fallback || (
          <div className={cn('flex items-center justify-center bg-muted', className)}>
            <span className="text-xs text-muted-foreground">No Image</span>
          </div>
        )}
      </>
    );
  }

  // Show loading state
  if (isLoading || !imageSrc) {
    return (
      <div
        className={cn(
          'animate-pulse bg-gradient-to-br from-muted to-muted-foreground/10',
          className
        )}
        role="status"
        aria-label="Loading image"
      />
    );
  }

  // Show the loaded image
  return (
    <img
      src={imageSrc}
      alt={alt}
      loading={loading}
      className={className}
      {...props}
    />
  );
}
