import { useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Download, Loader2 } from 'lucide-react';
import { useQueueManager } from '../../../core/queue/useQueueManager';
import { cn } from '../../../core/utils/cn';

/**
 * QueuePill Component
 * Global floating indicator showing active download count and progress
 *
 * Features:
 * - Shows active download count
 * - Displays overall progress percentage
 * - Animated loading indicator
 * - Click to navigate to Downloads screen
 * - Auto-hides when no active downloads
 * - Auto-hides on Downloads screen itself
 *
 * Position:
 * - Mobile: Bottom right, above bottom nav
 * - Desktop: Top right, below header
 */
export function QueuePill() {
  const navigate = useNavigate();
  const location = useLocation();
  const { items, statusMap, progressMap } = useQueueManager();

  // Calculate active downloads and progress
  const stats = useMemo(() => {
    const activeItems = items.filter((item) => {
      const status = statusMap[item.episode]?.toLowerCase() || '';
      return (
        !status.includes('done') &&
        !status.includes('completed') &&
        !status.includes('failed') &&
        !status.includes('error')
      );
    });

    const activeCount = activeItems.length;

    // Calculate overall progress
    let totalProgress = 0;
    activeItems.forEach((item) => {
      const progress = progressMap[item.episode];
      if (progress && progress.total > 0) {
        totalProgress += (progress.done / progress.total) * 100;
      }
    });

    const averageProgress =
      activeCount > 0 ? Math.round(totalProgress / activeCount) : 0;

    return { activeCount, averageProgress };
  }, [items, statusMap, progressMap]);

  // Don't show if no active downloads
  if (stats.activeCount === 0) {
    return null;
  }

  // Don't show on Downloads screen
  if (location.pathname === '/downloads') {
    return null;
  }

  const handleClick = () => {
    navigate('/downloads');
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        // Base styles
        'fixed z-40 flex items-center gap-2 px-4 py-2.5',
        'bg-primary text-primary-foreground rounded-full',
        'shadow-lg hover:shadow-xl transition-all',
        'hover:scale-105 active:scale-95',
        // Position - responsive
        'bottom-20 right-4', // Mobile: above bottom nav
        'md:top-20 md:bottom-auto md:right-6' // Desktop: below header
      )}
      title={`${stats.activeCount} active download${stats.activeCount !== 1 ? 's' : ''}`}
    >
      {/* Animated icon */}
      <div className="relative">
        <Loader2 className="h-4 w-4 animate-spin absolute" />
        <Download className="h-4 w-4 opacity-50" />
      </div>

      {/* Count and progress */}
      <div className="flex items-center gap-2 text-sm font-medium">
        <span>{stats.activeCount}</span>
        <span className="opacity-75">·</span>
        <span>{stats.averageProgress}%</span>
      </div>
    </button>
  );
}
