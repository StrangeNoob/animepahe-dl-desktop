import { NavLink } from 'react-router-dom';
import { Download, Library, Settings } from 'lucide-react';
import { cn } from '../../../core/utils/cn';

/**
 * Desktop Header Navigation
 * Displays horizontal navigation for desktop screens (md and above)
 */
export function DesktopHeader() {
  const navItems = [
    { to: '/download', icon: Download, label: 'Download' },
    { to: '/library', icon: Library, label: 'Library' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <header className="hidden md:flex items-center justify-between px-6 py-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-2">
        <Download className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-bold">Animepahe DL</h1>
      </div>

      <nav className="flex items-center gap-1">
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
          >
            <item.icon className="h-4 w-4" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
