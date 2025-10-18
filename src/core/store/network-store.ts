import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { NetworkState } from './types';

export const useNetworkStore = create<NetworkState>()(
  persist(
    (set, get) => ({
      isOnline: navigator.onLine,
      isMobileData: false,
      batterySaver: false,
      downloadPolicy: 'always',

      // Actions
      setOnlineStatus: (online) => {
        set({ isOnline: online });
      },

      setMobileDataStatus: (mobileData) => {
        set({ isMobileData: mobileData });
      },

      setBatterySaver: (enabled) => {
        set({ batterySaver: enabled });
      },

      setDownloadPolicy: (policy) => {
        set({ downloadPolicy: policy });
      },

      canDownload: () => {
        const state = get();

        // Always offline = cannot download
        if (!state.isOnline) return false;

        // Check download policy
        switch (state.downloadPolicy) {
          case 'manual':
            return false;
          case 'wifi-only':
            return !state.isMobileData;
          case 'always':
          default:
            return true;
        }
      },
    }),
    {
      name: 'animepahe-network',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

// Setup online/offline listeners
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    useNetworkStore.getState().setOnlineStatus(true);
  });

  window.addEventListener('offline', () => {
    useNetworkStore.getState().setOnlineStatus(false);
  });

  // Detect mobile data connection (experimental - uses Network Information API)
  if ('connection' in navigator) {
    const connection = (navigator as any).connection;

    const updateConnectionType = () => {
      const effectiveType = connection?.effectiveType;
      // Assume mobile if connection is slow or cellular
      const isMobile = effectiveType === 'slow-2g' || effectiveType === '2g' ||
                       effectiveType === '3g' || connection?.type === 'cellular';
      useNetworkStore.getState().setMobileDataStatus(isMobile);
    };

    connection?.addEventListener('change', updateConnectionType);
    updateConnectionType();
  }

  // Detect battery saver mode (experimental - uses Battery API)
  if ('getBattery' in navigator) {
    (navigator as any).getBattery().then((battery: any) => {
      const updateBatterySaver = () => {
        // Consider battery saver if level < 20% and not charging
        const lowBattery = battery.level < 0.2 && !battery.charging;
        useNetworkStore.getState().setBatterySaver(lowBattery);
      };

      battery.addEventListener('levelchange', updateBatterySaver);
      battery.addEventListener('chargingchange', updateBatterySaver);
      updateBatterySaver();
    });
  }
}
