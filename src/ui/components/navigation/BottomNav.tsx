import { NavLink } from 'react-router-dom';
import { Home, Search, Download, Library as LibraryIcon, Settings } from 'lucide-react';
import { cn } from '../../../core/utils/cn';

const tabs = [
  { to: '/home', icon: Home, label: 'Home' },
  { to: '/search', icon: Search, label: 'Search' },
  { to: '/downloads', icon: Download, label: 'Downloads' },
  { to: '/library', icon: LibraryIcon, label: 'Library' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

/**
 * Mobile-only bottom navigation bar
 * Shows on screens < md breakpoint (768px)
 * 5 tabs: Home, Search, Downloads, Library, Settings
 */
export function BottomNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 h-16 backdrop-blur-lg bg-card/80 border-t border-white/10 safe-bottom md:hidden" aria-label="Main navigation">
      <ul className="grid grid-cols-5 h-full">
        {tabs.map((tab) => (
          <li key={tab.to} className="flex items-center justify-center">
            <NavLink
              to={tab.to}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center h-full w-full gap-1 transition-colors',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )
              }
              aria-label={tab.label}
            >
              {({ isActive }) => (
                <>
                  <tab.icon className={cn('h-5 w-5', isActive && 'text-primary')} aria-hidden="true" />
                  <span className="text-xs font-medium">{tab.label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
