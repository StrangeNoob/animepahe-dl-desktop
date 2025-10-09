import { useEffect, useState, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import { sendNotification, isPermissionGranted, requestPermission } from '@tauri-apps/plugin-notification';
import type { DownloadCompleteNotification, ToastNotification } from '../types';
import { useNotificationContext } from '../contexts/NotificationContext';
import { playNotificationSound, updateTrayTitle, openPath } from '../api';

export function useDownloadNotifications() {
  const { settings, batchState, incrementCompleted, incrementFailed, completeBatch } = useNotificationContext();
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  const addToast = useCallback((toast: ToastNotification) => {
    setToasts((prev) => [...prev, toast]);

    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toast.id));
    }, 5000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleDownloadComplete = useCallback(async (notification: DownloadCompleteNotification) => {
    console.log('[NOTIFICATION] Download complete event received:', notification);
    console.log('[NOTIFICATION] Settings:', settings);

    if (!settings.enabled) {
      console.log('[NOTIFICATION] Notifications disabled, skipping');
      return;
    }

    incrementCompleted();

    // Play sound if enabled
    if (settings.soundEnabled) {
      console.log('[NOTIFICATION] Playing notification sound');
      try {
        await playNotificationSound();
        console.log('[NOTIFICATION] Sound played successfully');
      } catch (error) {
        console.error('[NOTIFICATION] Failed to play notification sound:', error);
      }
    }

    // Show desktop notification
    console.log('[NOTIFICATION] Checking desktop notification permission');
    try {
      let permissionGranted = await isPermissionGranted();
      console.log('[NOTIFICATION] Permission granted:', permissionGranted);

      if (!permissionGranted) {
        console.log('[NOTIFICATION] Requesting permission');
        const permission = await requestPermission();
        permissionGranted = permission === 'granted';
        console.log('[NOTIFICATION] Permission after request:', permissionGranted);
      }

      if (permissionGranted) {
        console.log('[NOTIFICATION] Sending desktop notification');
        await sendNotification({
          title: 'Download Complete',
          body: `${notification.anime_name} - Episode ${notification.episode}`,
        });
        console.log('[NOTIFICATION] Desktop notification sent successfully');
      }
    } catch (error) {
      console.error('[NOTIFICATION] Failed to show desktop notification:', error);
    }

    // Update tray if enabled
    if (settings.showInTray) {
      console.log('[NOTIFICATION] Updating tray title');
      try {
        const trayTitle = `Downloaded: ${notification.anime_name} Ep ${notification.episode}`;
        console.log('[NOTIFICATION] Tray title:', trayTitle);
        await updateTrayTitle(trayTitle);
        console.log('[NOTIFICATION] Tray title updated successfully');

        // Reset tray title after 5 seconds
        setTimeout(async () => {
          console.log('[NOTIFICATION] Resetting tray title to default');
          await updateTrayTitle('Animepahe DL Desktop');
        }, 5000);
      } catch (error) {
        console.error('[NOTIFICATION] Failed to update tray:', error);
      }
    } else {
      console.log('[NOTIFICATION] Tray updates disabled in settings');
    }

    // Show in-app toast
    addToast({
      id: `${Date.now()}-${notification.episode}`,
      type: 'success',
      anime_name: notification.anime_name,
      episode: notification.episode,
      file_path: notification.file_path,
      file_size: notification.file_size,
    });

    // Auto-open folder if enabled
    if (settings.autoOpenFolder && notification.file_path) {
      try {
        const folder = notification.file_path.substring(0, notification.file_path.lastIndexOf('/'));
        await openPath(folder);
      } catch (error) {
        console.error('Failed to open folder:', error);
      }
    }

    // Check if batch is complete
    if (batchState.isActive &&
        (batchState.completed + batchState.failed + 1) >= batchState.total) {
      const elapsedSeconds = Math.floor((Date.now() - batchState.startTime) / 1000);

      // Show batch summary notification
      try {
        await sendNotification({
          title: 'Batch Download Complete',
          body: `Completed ${batchState.completed + 1}/${batchState.total} episodes in ${elapsedSeconds}s`,
        });
      } catch (error) {
        console.error('Failed to show batch notification:', error);
      }

      completeBatch();
    }
  }, [settings, batchState, incrementCompleted, completeBatch, addToast]);

  const handleDownloadFailed = useCallback(async (notification: DownloadCompleteNotification) => {
    if (!settings.enabled) return;

    incrementFailed();

    // Show desktop notification
    try {
      let permissionGranted = await isPermissionGranted();
      if (!permissionGranted) {
        const permission = await requestPermission();
        permissionGranted = permission === 'granted';
      }

      if (permissionGranted) {
        await sendNotification({
          title: 'Download Failed',
          body: `${notification.anime_name} - Episode ${notification.episode}`,
        });
      }
    } catch (error) {
      console.error('Failed to show desktop notification:', error);
    }

    // Show in-app toast
    addToast({
      id: `${Date.now()}-${notification.episode}`,
      type: 'error',
      anime_name: notification.anime_name,
      episode: notification.episode,
    });

    // Check if batch is complete
    if (batchState.isActive &&
        (batchState.completed + batchState.failed + 1) >= batchState.total) {
      completeBatch();
    }
  }, [settings, batchState, incrementFailed, completeBatch, addToast]);

  // Listen for download events
  useEffect(() => {
    console.log('[NOTIFICATION] Setting up event listeners');

    const unlistenComplete = listen<DownloadCompleteNotification>('download-complete', (event) => {
      console.log('[NOTIFICATION] download-complete event received from backend');
      handleDownloadComplete(event.payload);
    });

    const unlistenFailed = listen<DownloadCompleteNotification>('download-failed', (event) => {
      console.log('[NOTIFICATION] download-failed event received from backend');
      handleDownloadFailed(event.payload);
    });

    console.log('[NOTIFICATION] Event listeners registered');

    return () => {
      console.log('[NOTIFICATION] Cleaning up event listeners');
      unlistenComplete.then((fn) => fn());
      unlistenFailed.then((fn) => fn());
    };
  }, [handleDownloadComplete, handleDownloadFailed]);

  // Update tray with batch progress
  useEffect(() => {
    if (batchState.isActive && settings.showInTray) {
      const progress = Math.floor(((batchState.completed + batchState.failed) / batchState.total) * 100);
      const trayTitle = `Downloading: ${batchState.completed + batchState.failed}/${batchState.total} (${progress}%)`;
      console.log('[NOTIFICATION] Updating batch progress in tray:', trayTitle);
      updateTrayTitle(trayTitle);
    }
  }, [batchState, settings.showInTray]);

  return {
    toasts,
    removeToast,
  };
}
