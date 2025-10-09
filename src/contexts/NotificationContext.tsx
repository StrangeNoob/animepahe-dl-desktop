import React, { createContext, useContext, useState, useEffect } from 'react';
import type { NotificationSettings, BatchDownloadState } from '../types';

interface NotificationContextType {
  settings: NotificationSettings;
  updateSettings: (settings: Partial<NotificationSettings>) => void;
  batchState: BatchDownloadState;
  updateBatchState: (state: Partial<BatchDownloadState>) => void;
  startBatch: (total: number) => void;
  completeBatch: () => void;
  incrementCompleted: () => void;
  incrementFailed: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: true,
  soundEnabled: true,
  showInTray: true,
  autoOpenFolder: false,
};

const DEFAULT_BATCH_STATE: BatchDownloadState = {
  total: 0,
  completed: 0,
  failed: 0,
  isActive: false,
  startTime: 0,
};

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<NotificationSettings>(() => {
    const stored = localStorage.getItem('notification-settings');
    return stored ? JSON.parse(stored) : DEFAULT_SETTINGS;
  });

  const [batchState, setBatchState] = useState<BatchDownloadState>(DEFAULT_BATCH_STATE);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('notification-settings', JSON.stringify(settings));
  }, [settings]);

  const updateSettings = (newSettings: Partial<NotificationSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  const updateBatchState = (newState: Partial<BatchDownloadState>) => {
    setBatchState((prev) => ({ ...prev, ...newState }));
  };

  const startBatch = (total: number) => {
    setBatchState({
      total,
      completed: 0,
      failed: 0,
      isActive: true,
      startTime: Date.now(),
    });
  };

  const completeBatch = () => {
    setBatchState((prev) => ({
      ...prev,
      isActive: false,
    }));
  };

  const incrementCompleted = () => {
    setBatchState((prev) => ({
      ...prev,
      completed: prev.completed + 1,
    }));
  };

  const incrementFailed = () => {
    setBatchState((prev) => ({
      ...prev,
      failed: prev.failed + 1,
    }));
  };

  const value = {
    settings,
    updateSettings,
    batchState,
    updateBatchState,
    startBatch,
    completeBatch,
    incrementCompleted,
    incrementFailed,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotificationContext() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotificationContext must be used within NotificationProvider');
  }
  return context;
}
