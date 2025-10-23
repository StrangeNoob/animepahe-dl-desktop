import { useState, useEffect } from 'react';

export interface BreakpointState {
  xs: boolean;
  sm: boolean;
  md: boolean;
  lg: boolean;
  xl: boolean;
  '2xl': boolean;
}

/**
 * Hook to detect current responsive breakpoint
 * Matches Tailwind breakpoints: xs(380px), sm(480px), md(768px), lg(1024px), xl(1280px), 2xl(1536px)
 *
 * @example
 * const bp = useBreakpoint();
 * if (bp.md) {
 *   // Desktop layout
 * } else {
 *   // Mobile layout
 * }
 */
export function useBreakpoint(): BreakpointState {
  const [breakpoint, setBreakpoint] = useState<BreakpointState>(() => {
    // SSR guard - return false for all breakpoints during server render
    if (typeof window === 'undefined') {
      return {
        xs: false,
        sm: false,
        md: false,
        lg: false,
        xl: false,
        '2xl': false,
      };
    }

    // Initial calculation
    return {
      xs: window.matchMedia('(min-width: 380px)').matches,
      sm: window.matchMedia('(min-width: 480px)').matches,
      md: window.matchMedia('(min-width: 768px)').matches,
      lg: window.matchMedia('(min-width: 1024px)').matches,
      xl: window.matchMedia('(min-width: 1280px)').matches,
      '2xl': window.matchMedia('(min-width: 1536px)').matches,
    };
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const queries = {
      xs: window.matchMedia('(min-width: 380px)'),
      sm: window.matchMedia('(min-width: 480px)'),
      md: window.matchMedia('(min-width: 768px)'),
      lg: window.matchMedia('(min-width: 1024px)'),
      xl: window.matchMedia('(min-width: 1280px)'),
      '2xl': window.matchMedia('(min-width: 1536px)'),
    };

    const update = () => {
      setBreakpoint({
        xs: queries.xs.matches,
        sm: queries.sm.matches,
        md: queries.md.matches,
        lg: queries.lg.matches,
        xl: queries.xl.matches,
        '2xl': queries['2xl'].matches,
      });
    };

    // Add listeners
    Object.values(queries).forEach((q) => q.addEventListener('change', update));

    // Cleanup
    return () => {
      Object.values(queries).forEach((q) => q.removeEventListener('change', update));
    };
  }, []);

  return breakpoint;
}
