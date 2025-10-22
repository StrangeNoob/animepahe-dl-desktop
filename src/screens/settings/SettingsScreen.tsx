import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../ui/components/base/card';
import { Input } from '../../ui/components/base/input';
import { Button } from '../../ui/components/base/button';
import { Switch } from '../../ui/components/base/switch';
import { Label } from '../../ui/components/base/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/components/base/select';
import {
  Settings as SettingsIcon,
  Sun,
  Moon,
  Globe,
  BarChart3,
  RefreshCw,
  FolderOpen,
  Cpu,
  HelpCircle,
  Info,
  Wifi,
  WifiOff,
  Battery,
  BatteryCharging,
  BatteryLow,
  Zap,
} from 'lucide-react';
import { usePreferenceStore, useNetworkStore } from '../../core/store';
import { open as selectDirectory } from '@tauri-apps/plugin-dialog';
import { getVersion } from '@tauri-apps/api/app';
import UpdateDialog from '../../components/UpdateDialog';

/**
 * Settings Screen
 * Application settings and preferences management
 *
 * Features:
 * - Theme toggle (light/dark)
 * - Download directory selection
 * - Base URL configuration
 * - Analytics toggle
 * - Max threads configuration
 * - App tour reset
 * - App version display
 *
 * Integrates with PreferenceStore for state management
 */
export function SettingsScreen() {
  const [appVersion, setAppVersion] = useState('0.0.0');
  const [hostUrlInput, setHostUrlInput] = useState('');

  // Preference store selectors
  const downloadDir = usePreferenceStore((state) => state.downloadDir);
  const themeDark = usePreferenceStore((state) => state.themeDark);
  const hostUrl = usePreferenceStore((state) => state.hostUrl);
  const analyticsEnabled = usePreferenceStore((state) => state.analyticsEnabled);
  const maxThreads = usePreferenceStore((state) => state.maxThreads);
  const tourCompleted = usePreferenceStore((state) => state.tourCompleted);

  // Preference store actions
  const setDownloadDir = usePreferenceStore((state) => state.setDownloadDir);
  const toggleTheme = usePreferenceStore((state) => state.toggleTheme);
  const setHostUrl = usePreferenceStore((state) => state.setHostUrl);
  const setAnalyticsEnabled = usePreferenceStore((state) => state.setAnalyticsEnabled);
  const setMaxThreads = usePreferenceStore((state) => state.setMaxThreads);
  const setTourCompleted = usePreferenceStore((state) => state.setTourCompleted);

  // Network store selectors
  const isOnline = useNetworkStore((state) => state.isOnline);
  const isMobileData = useNetworkStore((state) => state.isMobileData);
  const batteryLevel = useNetworkStore((state) => state.batteryLevel);
  const isCharging = useNetworkStore((state) => state.isCharging);
  const downloadPolicy = useNetworkStore((state) => state.downloadPolicy);
  const batteryPolicy = useNetworkStore((state) => state.batteryPolicy);
  const batteryThreshold = useNetworkStore((state) => state.batteryThreshold);

  // Network store actions
  const setDownloadPolicy = useNetworkStore((state) => state.setDownloadPolicy);
  const setBatteryPolicy = useNetworkStore((state) => state.setBatteryPolicy);
  const setBatteryThreshold = useNetworkStore((state) => state.setBatteryThreshold);

  useEffect(() => {
    setHostUrlInput(hostUrl);
  }, [hostUrl]);

  useEffect(() => {
    getVersion().then(setAppVersion).catch(() => setAppVersion('0.0.0'));
  }, []);

  const handleSelectDirectory = async () => {
    try {
      const dir = await selectDirectory({
        directory: true,
        multiple: false,
      });
      if (dir) {
        setDownloadDir(dir as string);
      }
    } catch (error) {
      console.error('Failed to select directory:', error);
    }
  };

  const handleHostUrlSave = () => {
    setHostUrl(hostUrlInput);
  };

  const handleHostUrlReset = () => {
    const defaultUrl = 'https://animepahe.si';
    setHostUrlInput(defaultUrl);
    setHostUrl(defaultUrl);
  };

  const handleTourReset = () => {
    setTourCompleted(false);
    alert('App tour has been reset. Reload the app to see it again.');
  };

  // Helper to get battery icon based on level and charging status
  const getBatteryIcon = () => {
    if (isCharging) {
      return <BatteryCharging className="h-4 w-4 text-green-500" />;
    }
    if (batteryLevel < batteryThreshold) {
      return <BatteryLow className="h-4 w-4 text-red-500" />;
    }
    return <Battery className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <main className="container mx-auto p-4 md:p-6 space-y-6 max-w-4xl">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your app preferences and configuration
        </p>
      </div>

      {/* Appearance Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {themeDark ? <Moon className="h-5 w-5" aria-hidden="true" /> : <Sun className="h-5 w-5" aria-hidden="true" />}
            Appearance
          </CardTitle>
          <CardDescription>Customize how the app looks</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="theme-toggle">Theme</Label>
              <p className="text-sm text-muted-foreground">
                Switch between light and dark mode
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">Light</span>
              <Switch
                id="theme-toggle"
                checked={themeDark}
                onCheckedChange={toggleTheme}
              />
              <span className="text-xs text-muted-foreground">Dark</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Download Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" aria-hidden="true" />
            Downloads
          </CardTitle>
          <CardDescription>Configure download behavior</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Download Directory */}
          <div className="space-y-2">
            <Label htmlFor="download-dir">Download Directory</Label>
            <div className="flex gap-2">
              <Input
                id="download-dir"
                value={downloadDir || 'Not set'}
                readOnly
                className="flex-1"
                aria-label="Current download directory path"
                aria-describedby="download-dir-help"
              />
              <Button onClick={handleSelectDirectory} variant="outline" aria-label="Browse for download directory">
                Browse
              </Button>
            </div>
            <p id="download-dir-help" className="text-xs text-muted-foreground">
              Location where downloaded anime will be saved
            </p>
          </div>

          {/* Max Threads */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="max-threads">Max Download Threads</Label>
              <div className="relative group">
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" aria-label="Help information for max download threads" />
                <div className="absolute bottom-full left-0 mb-2 px-3 py-1.5 text-xs text-white bg-gray-900 rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 pointer-events-none w-64 text-left leading-snug" role="tooltip">
                  Controls how many video segments download in parallel. Higher values can
                  finish episodes faster on fast connections but consume more bandwidth and CPU.
                </div>
              </div>
            </div>
            <Input
              id="max-threads"
              type="number"
              min={2}
              max={64}
              value={maxThreads}
              onChange={(e) => {
                const value = parseInt(e.target.value);
                if (!isNaN(value) && value >= 2 && value <= 64) {
                  setMaxThreads(value);
                }
              }}
              aria-describedby="max-threads-help"
            />
            <p id="max-threads-help" className="text-xs text-muted-foreground">
              Range: 2-64 threads (default: 8)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Power & Network Policies */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" aria-hidden="true" />
            Power & Network Policies
          </CardTitle>
          <CardDescription>
            Control when downloads can run based on network and battery conditions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current Status Indicators */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg" role="status" aria-label="Current system status">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {isOnline ? (
                  <Wifi className="h-4 w-4 text-green-500" aria-hidden="true" />
                ) : (
                  <WifiOff className="h-4 w-4 text-red-500" aria-hidden="true" />
                )}
                <span>Network</span>
              </div>
              <p className="text-sm font-medium" aria-label={`Network status: ${isOnline ? (isMobileData ? 'Mobile Data' : 'WiFi or Ethernet') : 'Offline'}`}>
                {isOnline ? (isMobileData ? 'Mobile Data' : 'WiFi/Ethernet') : 'Offline'}
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span aria-hidden="true">{getBatteryIcon()}</span>
                <span>Battery</span>
              </div>
              <p className="text-sm font-medium" aria-label={`Battery level: ${batteryLevel}% ${isCharging ? 'and charging' : ''}`}>
                {batteryLevel}% {isCharging && '(Charging)'}
              </p>
            </div>
          </div>

          {/* Download Policy */}
          <div className="space-y-2">
            <Label htmlFor="download-policy">Download Policy</Label>
            <Select value={downloadPolicy} onValueChange={setDownloadPolicy}>
              <SelectTrigger id="download-policy">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="always">Always Download</SelectItem>
                <SelectItem value="wifi-only">WiFi Only</SelectItem>
                <SelectItem value="manual">Manual (Paused)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {downloadPolicy === 'always' && 'Downloads run on any connection type'}
              {downloadPolicy === 'wifi-only' && 'Downloads pause automatically on mobile data'}
              {downloadPolicy === 'manual' && 'All downloads are paused until you resume them'}
            </p>
          </div>

          {/* Battery Policy */}
          <div className="space-y-2">
            <Label htmlFor="battery-policy">Battery Policy</Label>
            <Select value={batteryPolicy} onValueChange={setBatteryPolicy}>
              <SelectTrigger id="battery-policy">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ignore">Ignore Battery Level</SelectItem>
                <SelectItem value="pause-when-low">Pause When Low</SelectItem>
                <SelectItem value="wifi-only-when-low">WiFi Only When Low</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {batteryPolicy === 'ignore' && 'Downloads run regardless of battery level'}
              {batteryPolicy === 'pause-when-low' && 'Downloads pause when battery is below threshold'}
              {batteryPolicy === 'wifi-only-when-low' && 'Switch to WiFi-only mode when battery is low'}
            </p>
          </div>

          {/* Battery Threshold */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="battery-threshold">Low Battery Threshold</Label>
              <span className="text-sm font-medium" aria-live="polite">{batteryThreshold}%</span>
            </div>
            <Input
              id="battery-threshold"
              type="range"
              min={10}
              max={50}
              step={5}
              value={batteryThreshold}
              onChange={(e) => setBatteryThreshold(parseInt(e.target.value))}
              className="cursor-pointer"
              aria-valuemin={10}
              aria-valuemax={50}
              aria-valuenow={batteryThreshold}
              aria-valuetext={`${batteryThreshold} percent`}
              aria-describedby="battery-threshold-help"
            />
            <p id="battery-threshold-help" className="text-xs text-muted-foreground">
              Battery policies trigger when battery drops below this level (10-50%)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Network Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" aria-hidden="true" />
            Network
          </CardTitle>
          <CardDescription>Configure network preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="host-url">Base URL</Label>
            <Input
              id="host-url"
              value={hostUrlInput}
              onChange={(e) => setHostUrlInput(e.target.value)}
              placeholder="https://animepahe.si"
            />
            <div className="flex gap-2">
              <Button onClick={handleHostUrlSave} variant="outline" size="sm">
                Save
              </Button>
              <Button onClick={handleHostUrlReset} variant="ghost" size="sm">
                <RefreshCw className="h-3 w-3 mr-1" />
                Reset to Default
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              The base URL for fetching anime data
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Privacy Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" aria-hidden="true" />
            Privacy
          </CardTitle>
          <CardDescription>Manage data collection preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5 flex-1">
              <Label htmlFor="analytics-toggle">Anonymous Analytics</Label>
              <p className="text-sm text-muted-foreground">
                Share anonymous usage data to help improve the app
              </p>
            </div>
            <Switch
              id="analytics-toggle"
              checked={analyticsEnabled}
              onCheckedChange={setAnalyticsEnabled}
            />
          </div>
        </CardContent>
      </Card>

      {/* Help & Support */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" aria-hidden="true" />
            Help & Support
          </CardTitle>
          <CardDescription>Get help and manage tutorials</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Update Checker */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5 flex-1">
              <Label>Software Updates</Label>
              <p className="text-sm text-muted-foreground">
                Check for new versions and download updates
              </p>
            </div>
            <UpdateDialog
              currentVersion={appVersion}
              repoOwner="StrangeNoob"
              repoName="animepahe-dl-desktop"
            />
          </div>

          {/* App Tour */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>App Tour</Label>
              <p className="text-sm text-muted-foreground">
                Reset the interactive app tour
              </p>
            </div>
            <Button
              onClick={handleTourReset}
              variant="outline"
              size="sm"
              disabled={!tourCompleted}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Reset Tour
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" aria-hidden="true" />
            About
          </CardTitle>
          <CardDescription>Application information and credits</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* App Info */}
          <div className="space-y-3">
            <div>
              <h4 className="font-semibold text-base">AnimePahe Downloader</h4>
              <p className="text-sm text-muted-foreground mt-1">
                A desktop application for downloading anime from AnimePahe with a modern,
                mobile-friendly interface.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Version</p>
                <p className="font-mono text-sm">{appVersion}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Build</p>
                <p className="font-mono text-sm">Universal</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Platform</p>
                <p className="font-mono text-sm">
                  {typeof window !== 'undefined' && window.navigator.platform}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Architecture</p>
                <p className="font-mono text-sm">
                  {typeof window !== 'undefined' && window.navigator.userAgent.includes('ARM') ? 'ARM64' : 'x64'}
                </p>
              </div>
            </div>
          </div>

          {/* Links */}
          <div className="space-y-2 pt-2 border-t">
            <h4 className="text-sm font-medium">Resources</h4>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={async () => {
                  const { open: openUrl } = await import('@tauri-apps/plugin-shell');
                  await openUrl('https://github.com/StrangeNoob/animepahe-dl-desktop');
                }}
              >
                <Globe className="h-3 w-3 mr-1" />
                GitHub Repository
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={async () => {
                  const { open: openUrl } = await import('@tauri-apps/plugin-shell');
                  await openUrl('https://github.com/StrangeNoob/animepahe-dl-desktop/issues');
                }}
              >
                <HelpCircle className="h-3 w-3 mr-1" />
                Report Issue
              </Button>
            </div>
          </div>

          {/* License & Credits */}
          <div className="space-y-2 pt-2 border-t">
            <h4 className="text-sm font-medium">License & Credits</h4>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Licensed under MIT License</p>
              <p>Built with Tauri, React, TypeScript, and Tailwind CSS</p>
              <p className="pt-1">
                This application is not affiliated with AnimePahe. All anime content
                and rights belong to their respective owners.
              </p>
            </div>
          </div>

          {/* Copyright */}
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground text-center">
              © {new Date().getFullYear()} AnimePahe Downloader. All rights reserved.
            </p>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
