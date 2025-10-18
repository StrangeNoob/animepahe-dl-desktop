import { Outlet } from 'react-router-dom';
import { DesktopHeader } from '../components/navigation/DesktopHeader';
import { BottomNav } from '../components/navigation/BottomNav';
import { useBreakpoint } from '../hooks/useBreakpoint';

/**
 * AppChrome Layout Wrapper
 * Orchestrates responsive navigation and layout structure
 *
 * Mobile (< md):
 * - BottomNav for navigation
 * - Content with bottom padding for nav clearance
 *
 * Desktop (>= md):
 * - DesktopHeader for navigation
 * - Content with standard padding
 */
export function AppChrome() {
  const breakpoint = useBreakpoint();
  const isMobile = !breakpoint.md;

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Desktop Header - hidden on mobile */}
      <DesktopHeader />

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pb-safe">
        <div className={isMobile ? 'pb-16' : ''}>
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Navigation - hidden on desktop */}
      <BottomNav />
    </div>
  );
}
