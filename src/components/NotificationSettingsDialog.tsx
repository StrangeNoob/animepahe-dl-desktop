import React, { useState } from 'react';
import { Bell, Volume2, Folder, Monitor, AlertCircle, Settings } from 'lucide-react';
import {
  sendNotification,
  isPermissionGranted,
  requestPermission
} from '@tauri-apps/plugin-notification';
import { useNotificationContext } from '../contexts/NotificationContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { playNotificationSound, openSystemSettings } from '../api';

export function NotificationSettingsDialog() {
  const { settings, updateSettings } = useNotificationContext();
  const [open, setOpen] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'unknown'>('unknown');

  const checkPermission = async () => {
    const granted = await isPermissionGranted();
    setPermissionStatus(granted ? 'granted' : 'denied');
    return granted;
  };

  const handleTestNotification = async () => {
    try {
      // Check permission first
      let granted = await checkPermission();

      // If not granted, request permission
      if (!granted) {
        const result = await requestPermission();
        granted = result === 'granted';
        setPermissionStatus(granted ? 'granted' : 'denied');

        // If still denied, prompt user to open system settings
        if (!granted) {
          return;
        }
      }

      // Play sound if enabled
      if (settings.soundEnabled) {
        await playNotificationSound();
      }

      // Send notification
      await sendNotification({
        title: 'Test Notification',
        body: 'This is how your download notifications will look!',
      });
    } catch (error) {
      console.error('Failed to send test notification:', error);
    }
  };

  const handleOpenSystemSettings = async () => {
    try {
      await openSystemSettings();
    } catch (error) {
      console.error('Failed to open system settings:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon">
          <Bell className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Notification Settings</DialogTitle>
          <DialogDescription>
            Configure how you receive download notifications
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          {/* Enable Notifications */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <div className="space-y-0.5">
                <Label htmlFor="enable-notifications">Enable Notifications</Label>
                <p className="text-xs text-muted-foreground">
                  Show notifications when downloads complete
                </p>
              </div>
            </div>
            <Switch
              id="enable-notifications"
              checked={settings.enabled}
              onCheckedChange={(checked) => updateSettings({ enabled: checked })}
            />
          </div>

          {/* Sound Alerts */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Volume2 className="h-5 w-5 text-muted-foreground" />
              <div className="space-y-0.5">
                <Label htmlFor="sound-enabled">Sound Alerts</Label>
                <p className="text-xs text-muted-foreground">
                  Play a sound when downloads complete
                </p>
              </div>
            </div>
            <Switch
              id="sound-enabled"
              checked={settings.soundEnabled}
              onCheckedChange={(checked) => updateSettings({ soundEnabled: checked })}
              disabled={!settings.enabled}
            />
          </div>

          {/* System Tray Updates */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Monitor className="h-5 w-5 text-muted-foreground" />
              <div className="space-y-0.5">
                <Label htmlFor="tray-enabled">System Tray Updates</Label>
                <p className="text-xs text-muted-foreground">
                  Show progress in system tray tooltip
                </p>
              </div>
            </div>
            <Switch
              id="tray-enabled"
              checked={settings.showInTray}
              onCheckedChange={(checked) => updateSettings({ showInTray: checked })}
              disabled={!settings.enabled}
            />
          </div>

          {/* Auto-open Folder */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Folder className="h-5 w-5 text-muted-foreground" />
              <div className="space-y-0.5">
                <Label htmlFor="auto-open">Auto-open Folder</Label>
                <p className="text-xs text-muted-foreground">
                  Automatically open download folder
                </p>
              </div>
            </div>
            <Switch
              id="auto-open"
              checked={settings.autoOpenFolder}
              onCheckedChange={(checked) => updateSettings({ autoOpenFolder: checked })}
              disabled={!settings.enabled}
            />
          </div>

          {/* Test Notification Button */}
          <div className="pt-4 border-t space-y-3">
            <Button
              variant="secondary"
              className="w-full"
              onClick={handleTestNotification}
              disabled={!settings.enabled}
            >
              <Bell className="h-4 w-4 mr-2" />
              Test Notification
            </Button>

            {/* Permission Denied Warning */}
            {permissionStatus === 'denied' && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 space-y-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium text-destructive">
                      Notification Permission Denied
                    </p>
                    <p className="text-xs text-muted-foreground">
                      To receive notifications, please enable them in your system settings.
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={handleOpenSystemSettings}
                >
                  <Settings className="h-3.5 w-3.5 mr-2" />
                  Open System Settings
                </Button>
              </div>
            )}
          </div>

          {/* Setup Instructions */}
          <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            <p className="font-medium mb-2">System Setup:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Click "Test Notification" to check permissions</li>
              <li>Grant notification permissions when prompted</li>
              <li>Sound alerts use system default sounds</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
