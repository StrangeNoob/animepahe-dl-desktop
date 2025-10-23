import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';

/**
 * Chrome Slots Context
 * Allows child screens to inject context-specific UI into the app chrome
 *
 * Slots available:
 * - mobileTopBarTitle: Custom title for mobile top bar
 * - mobileTopBarActions: Action buttons for mobile top bar (right side)
 * - fab: Floating action button content (mobile only)
 * - contextBar: Bottom context bar (e.g., batch selection controls)
 *
 * Usage in screens:
 * ```tsx
 * function MyScreen() {
 *   const slots = useChromeSlots();
 *
 *   useEffect(() => {
 *     slots.setMobileTopBarTitle('My Screen');
 *     slots.setMobileTopBarActions(<Button>Action</Button>);
 *     slots.setFab(<ContextFAB icon={Download} onClick={handleDownload} />);
 *
 *     return () => {
 *       slots.clearSlots();
 *     };
 *   }, []);
 *
 *   return <div>Screen content</div>;
 * }
 * ```
 */

export interface ChromeSlotsState {
  mobileTopBarTitle?: string;
  mobileTopBarActions?: ReactNode;
  fab?: ReactNode;
  contextBar?: ReactNode;
}

export interface ChromeSlotsContextValue extends ChromeSlotsState {
  setMobileTopBarTitle: (title: string | undefined) => void;
  setMobileTopBarActions: (actions: ReactNode) => void;
  setFab: (fab: ReactNode) => void;
  setContextBar: (bar: ReactNode) => void;
  clearSlots: () => void;
}

const ChromeSlotsContext = createContext<ChromeSlotsContextValue | null>(null);

export function ChromeSlotsProvider({ children }: { children: ReactNode }) {
  const [slots, setSlots] = useState<ChromeSlotsState>({});

  const setMobileTopBarTitle = useCallback((title: string | undefined) => {
    setSlots((prev) => ({ ...prev, mobileTopBarTitle: title }));
  }, []);

  const setMobileTopBarActions = useCallback((actions: ReactNode) => {
    setSlots((prev) => ({ ...prev, mobileTopBarActions: actions }));
  }, []);

  const setFab = useCallback((fab: ReactNode) => {
    setSlots((prev) => ({ ...prev, fab }));
  }, []);

  const setContextBar = useCallback((bar: ReactNode) => {
    setSlots((prev) => ({ ...prev, contextBar: bar }));
  }, []);

  const clearSlots = useCallback(() => {
    setSlots({});
  }, []);

  const value = useMemo<ChromeSlotsContextValue>(() => ({
    ...slots,
    setMobileTopBarTitle,
    setMobileTopBarActions,
    setFab,
    setContextBar,
    clearSlots,
  }), [slots, setMobileTopBarTitle, setMobileTopBarActions, setFab, setContextBar, clearSlots]);

  return (
    <ChromeSlotsContext.Provider value={value}>
      {children}
    </ChromeSlotsContext.Provider>
  );
}

export function useChromeSlots() {
  const context = useContext(ChromeSlotsContext);
  if (!context) {
    throw new Error('useChromeSlots must be used within ChromeSlotsProvider');
  }
  return context;
}
