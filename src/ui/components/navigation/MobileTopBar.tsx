import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Download } from 'lucide-react';
import { cn } from '../../../core/utils/cn';

export interface MobileTopBarProps {
  title?: string;
  showBack?: boolean;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Mobile Top Bar Navigation
 * Displays on mobile screens (< md breakpoint)
 *
 * Features:
 * - Automatic back button on nested routes
 * - Dynamic screen title based on route
 * - Optional action buttons on the right
 * - Safe area support for notched devices
 * - Complements BottomNav for mobile navigation
 *
 * Usage:
 * ```tsx
 * // With auto-detected title and back button
 * <MobileTopBar />
 *
 * // With custom title and actions
 * <MobileTopBar
 *   title="Custom Title"
 *   actions={<Button>Action</Button>}
 * />
 * ```
 */
export function MobileTopBar({
  title,
  showBack,
  actions,
  className,
}: MobileTopBarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  // Auto-detect if back button should show based on route depth
  const isNestedRoute = location.pathname.split('/').filter(Boolean).length > 1;
  const shouldShowBack = showBack !== undefined ? showBack : isNestedRoute;

  // Auto-detect screen title based on current route if not provided
  const getAutoTitle = (): string => {
    const path = location.pathname;
    if (path.startsWith('/home')) return 'Home';
    if (path.startsWith('/search')) return 'Search';
    if (path.startsWith('/downloads')) return 'Downloads';
    if (path.startsWith('/library')) return 'Library';
    if (path.startsWith('/settings')) return 'Settings';
    if (path.includes('/episodes')) return 'Episodes';
    if (path.includes('/title/')) return 'Anime Details';
    return 'Animepahe DL';
  };

  const displayTitle = title || getAutoTitle();

  return (
    <header
      className={cn(
        'md:hidden',
        'sticky top-0 z-50',
        'flex items-center justify-between',
        'h-14 px-4',
        'bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60',
        'border-b',
        'safe-top',
        className
      )}
    >
      {/* Left side: Back button or Logo */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {shouldShowBack ? (
          <button
            onClick={() => navigate(-1)}
            className={cn(
              'flex items-center justify-center',
              'h-10 w-10 -ml-2',
              'rounded-full',
              'hover:bg-accent',
              'transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-ring'
            )}
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        ) : (
          <Download className="h-5 w-5 text-primary flex-shrink-0" />
        )}

        {/* Screen title */}
        <h1 className="text-lg font-semibold truncate">{displayTitle}</h1>
      </div>

      {/* Right side: Action buttons */}
      {actions && (
        <div className="flex items-center gap-2 ml-2">{actions}</div>
      )}
    </header>
  );
}
