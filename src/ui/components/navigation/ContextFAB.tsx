import { Plus } from 'lucide-react';
import { cn } from '../../../core/utils/cn';

interface ContextFABProps {
  onClick?: () => void;
  icon?: React.ReactNode;
  className?: string;
  hidden?: boolean;
}

/**
 * Floating Action Button for context-specific mobile actions
 * Typically used on screens that need a primary action (e.g., Download)
 */
export function ContextFAB({
  onClick,
  icon = <Plus className="h-6 w-6" />,
  className,
  hidden = false
}: ContextFABProps) {
  if (hidden) return null;

  return (
    <button
      onClick={onClick}
      className={cn(
        "fixed right-6 bottom-20 z-40 md:hidden",
        "flex items-center justify-center",
        "h-14 w-14 rounded-full",
        "bg-primary text-primary-foreground shadow-glow",
        "transition-all duration-200",
        "hover:scale-110 active:scale-95",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        className
      )}
      aria-label="Primary action"
    >
      {icon}
    </button>
  );
}
