import * as React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '../../../core/utils/cn';

export interface SegmentedOption {
  value: string;
  label: string;
  icon?: LucideIcon;
}

export interface SegmentedProps {
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  fullWidth?: boolean;
}

/**
 * Segmented Control Component
 * Mobile-friendly toggle control for switching between options
 *
 * Features:
 * - iOS/Android style segmented control
 * - Supports icons + labels
 * - Smooth active indicator animation
 * - Touch-friendly targets (min 44px height)
 * - Keyboard accessible
 *
 * Usage:
 * ```tsx
 * <Segmented
 *   options={[
 *     { value: 'sub', label: 'Sub' },
 *     { value: 'dub', label: 'Dub' },
 *   ]}
 *   value={audioType}
 *   onChange={setAudioType}
 * />
 * ```
 */
export function Segmented({
  options,
  value,
  onChange,
  className,
  fullWidth = false,
}: SegmentedProps) {
  const activeIndex = options.findIndex((opt) => opt.value === value);

  return (
    <div
      className={cn(
        'inline-flex items-center',
        'bg-muted rounded-lg p-1',
        'relative',
        fullWidth && 'w-full',
        className
      )}
      role="tablist"
    >
      {/* Active indicator background */}
      <div
        className="absolute h-[calc(100%-8px)] bg-background rounded-md shadow-sm transition-all duration-200 ease-out"
        style={{
          width: `calc(${100 / options.length}% - 8px)`,
          left: `calc(${(activeIndex * 100) / options.length}% + 4px)`,
        }}
        aria-hidden="true"
      />

      {/* Options */}
      {options.map((option) => {
        const isActive = option.value === value;
        const Icon = option.icon;

        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(option.value)}
            className={cn(
              'relative z-10',
              'flex items-center justify-center gap-1.5',
              'px-4 h-10',
              'text-sm font-medium',
              'transition-colors duration-150',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-md',
              fullWidth && 'flex-1',
              isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {Icon && <Icon className="h-4 w-4" />}
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Segmented Group - Alternative layout for more options
 * Wraps to multiple rows if needed
 */
export interface SegmentedGroupProps {
  options: SegmentedOption[];
  value: string | string[];
  onChange: (value: string | string[]) => void;
  multiSelect?: boolean;
  className?: string;
}

export function SegmentedGroup({
  options,
  value,
  onChange,
  multiSelect = false,
  className,
}: SegmentedGroupProps) {
  const selectedValues = Array.isArray(value) ? value : [value];

  const handleToggle = (optionValue: string) => {
    if (multiSelect) {
      const currentValues = Array.isArray(value) ? value : [];
      const newValues = currentValues.includes(optionValue)
        ? currentValues.filter((v) => v !== optionValue)
        : [...currentValues, optionValue];
      onChange(newValues);
    } else {
      onChange(optionValue);
    }
  };

  return (
    <div className={cn('flex flex-wrap gap-2', className)} role="group">
      {options.map((option) => {
        const isSelected = selectedValues.includes(option.value);
        const Icon = option.icon;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => handleToggle(option.value)}
            className={cn(
              'inline-flex items-center gap-1.5',
              'px-4 h-10',
              'text-sm font-medium',
              'rounded-lg',
              'border transition-all duration-150',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
              isSelected
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-foreground border-border hover:bg-muted'
            )}
          >
            {Icon && <Icon className="h-4 w-4" />}
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
