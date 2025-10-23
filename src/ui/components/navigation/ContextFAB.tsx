import { LucideIcon, Plus } from 'lucide-react';
import { cn } from '../../../core/utils/cn';

export interface ContextFABProps {
  onClick?: () => void;
  icon?: LucideIcon;
  label?: string;
  variant?: 'default' | 'primary' | 'success' | 'destructive';
  className?: string;
  hidden?: boolean;
  disabled?: boolean;
  showLabel?: boolean;
}

/**
 * Floating Action Button for context-specific mobile actions
 * Typically used on screens that need a primary action (e.g., Download)
 *
 * Features:
 * - Mobile-only (hidden on desktop via md:hidden)
 * - Positioned above BottomNav (bottom-20)
 * - Supports icon, label, and variants
 * - Accessible with ARIA labels
 * - Smooth animations
 */
export function ContextFAB({
  onClick,
  icon: Icon = Plus,
  label = 'Action',
  variant = 'primary',
  className,
  hidden = false,
  disabled = false,
  showLabel = false,
}: ContextFABProps) {
  if (hidden) return null;

  const variantStyles = {
    default: 'bg-card text-foreground shadow-lg',
    primary: 'bg-primary text-primary-foreground shadow-glow',
    success: 'bg-green-600 text-white shadow-lg',
    destructive: 'bg-destructive text-destructive-foreground shadow-lg',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'fixed right-6 bottom-20 z-40 md:hidden',
        'flex items-center justify-center gap-2',
        showLabel ? 'h-14 px-6 rounded-full' : 'h-14 w-14 rounded-full',
        variantStyles[variant],
        'transition-all duration-200',
        'hover:scale-110 active:scale-95',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        disabled && 'opacity-50 cursor-not-allowed hover:scale-100',
        className
      )}
      aria-label={label}
    >
      <Icon className="h-6 w-6" />
      {showLabel && <span className="font-semibold text-sm">{label}</span>}
    </button>
  );
}
