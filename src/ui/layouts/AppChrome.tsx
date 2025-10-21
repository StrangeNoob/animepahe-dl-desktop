import { Outlet } from 'react-router-dom';
import { DesktopHeader } from '../components/navigation/DesktopHeader';
import { MobileTopBar } from '../components/navigation/MobileTopBar';
import { BottomNav } from '../components/navigation/BottomNav';
import { QueuePill } from '../components/queue/QueuePill';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useChromeSlots } from '../contexts/ChromeSlots';

/**
 * AppChrome Layout Wrapper
 * Orchestrates responsive navigation and layout structure with slot pattern
 *
 * Slot Pattern:
 * - Screens can inject context-specific UI via useChromeSlots()
 * - Mobile top bar title and actions
 * - FAB (floating action button)
 * - Context bar (e.g., batch selection)
 *
 * Mobile (< md):
 * - MobileTopBar with slotted title and actions
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
  const slots = useChromeSlots();

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Responsive Header */}
      {isMobile ? (
        <MobileTopBar
          title={slots.mobileTopBarTitle}
          actions={slots.mobileTopBarActions}
        />
      ) : (
        <DesktopHeader />
      )}

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pb-safe">
        <div className={isMobile ? 'pb-16' : ''}>
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Navigation - hidden on desktop */}
      <BottomNav />

      {/* Floating Action Button Slot (mobile only) */}
      {isMobile && slots.fab}

      {/* Context Bar Slot (e.g., batch selection controls) */}
      {slots.contextBar}

      {/* Global Queue Indicator */}
      <QueuePill />
    </div>
  );
}
