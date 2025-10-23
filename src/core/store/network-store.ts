import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { NetworkState } from './types';

export const useNetworkStore = create<NetworkState>()(
  persist(
    (set, get) => ({
      isOnline: navigator.onLine,
      isMobileData: false,
      batterySaver: false,
      batteryLevel: 100,
      isCharging: true,
      downloadPolicy: 'always',
      batteryPolicy: 'ignore',
      batteryThreshold: 20,

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

      setBatteryLevel: (level) => {
        set({ batteryLevel: level });
        // Auto-update battery saver based on threshold
        const state = get();
        const lowBattery = level < state.batteryThreshold && !state.isCharging;
        if (state.batterySaver !== lowBattery) {
          set({ batterySaver: lowBattery });
        }
      },

      setChargingStatus: (charging) => {
        set({ isCharging: charging });
        // Auto-update battery saver
        const state = get();
        const lowBattery = state.batteryLevel < state.batteryThreshold && !charging;
        if (state.batterySaver !== lowBattery) {
          set({ batterySaver: lowBattery });
        }
      },

      setDownloadPolicy: (policy) => {
        set({ downloadPolicy: policy });
      },

      setBatteryPolicy: (policy) => {
        set({ batteryPolicy: policy });
      },

      setBatteryThreshold: (threshold) => {
        set({ batteryThreshold: threshold });
        // Recalculate battery saver
        const state = get();
        const lowBattery = state.batteryLevel < threshold && !state.isCharging;
        if (state.batterySaver !== lowBattery) {
          set({ batterySaver: lowBattery });
        }
      },

      shouldPauseForBattery: () => {
        const state = get();

        // Ignore battery policy
        if (state.batteryPolicy === 'ignore') return false;

        // Check if battery is low
        const isLowBattery = state.batteryLevel < state.batteryThreshold && !state.isCharging;

        if (state.batteryPolicy === 'pause-when-low') {
          return isLowBattery;
        }

        if (state.batteryPolicy === 'wifi-only-when-low') {
          return isLowBattery && state.isMobileData;
        }

        return false;
      },

      shouldPauseForNetwork: () => {
        const state = get();

        // Check if offline
        if (!state.isOnline) return true;

        // Check network policy
        if (state.downloadPolicy === 'manual') return true;
        if (state.downloadPolicy === 'wifi-only' && state.isMobileData) return true;

        return false;
      },

      canDownload: () => {
        const state = get();

        // Check network constraints
        if (state.shouldPauseForNetwork()) return false;

        // Check battery constraints
        if (state.shouldPauseForBattery()) return false;

        return true;
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

  // Detect battery level and charging status (experimental - uses Battery API)
  if ('getBattery' in navigator) {
    (navigator as any).getBattery().then((battery: any) => {
      const updateBatteryStatus = () => {
        // Convert level from 0-1 to 0-100
        const level = Math.round(battery.level * 100);
        useNetworkStore.getState().setBatteryLevel(level);
        useNetworkStore.getState().setChargingStatus(battery.charging);
      };

      battery.addEventListener('levelchange', updateBatteryStatus);
      battery.addEventListener('chargingchange', updateBatteryStatus);
      updateBatteryStatus();
    });
  }
}
