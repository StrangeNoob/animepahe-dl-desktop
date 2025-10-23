import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Home, Search, Download, Library, Settings, ArrowLeft } from 'lucide-react';
import { cn } from '../../../core/utils/cn';

/**
 * Desktop Header Navigation
 * Displays horizontal navigation for desktop screens (md and above)
 * 5 sections: Home, Search, Downloads, Library, Settings
 * Automatically shows back button for nested routes
 */
export function DesktopHeader() {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { to: '/home', icon: Home, label: 'Home' },
    { to: '/search', icon: Search, label: 'Search' },
    { to: '/downloads', icon: Download, label: 'Downloads' },
    { to: '/library', icon: Library, label: 'Library' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ];

  // Auto-detect if back button should show based on route depth
  const isNestedRoute = location.pathname.split('/').filter(Boolean).length > 1;

  return (
    <header className="hidden md:flex items-center justify-between px-6 py-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-4">
        {/* Back Button - Auto-shown for nested routes */}
        {isNestedRoute && (
          <button
            onClick={() => navigate(-1)}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-md transition-colors',
              'hover:bg-accent hover:text-accent-foreground',
              'text-muted-foreground',
              'focus:outline-none focus:ring-2 focus:ring-ring'
            )}
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </button>
        )}

        <div className="flex items-center gap-2">
          <img src="/icon.png" alt="Animepahe DL" width={32} height={32} />
          <h1 className="text-xl font-bold">Animepahe DL</h1>
        </div>
      </div>

      <nav className="flex items-center gap-1" aria-label="Main navigation">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2 px-4 py-2 rounded-md transition-colors',
                'hover:bg-accent hover:text-accent-foreground',
                isActive
                  ? 'bg-accent text-accent-foreground font-medium'
                  : 'text-muted-foreground'
              )
            }
            aria-label={item.label}
          >
            {({ isActive }) => (
              <>
                <item.icon className="h-4 w-4" aria-hidden="true" />
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
