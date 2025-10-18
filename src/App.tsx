import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { PostHogProvider } from './lib/posthog';
import { NotificationProvider } from './contexts/NotificationContext';
import { TourProvider } from './components/tour/TourProvider';
import { AppChrome } from './ui/layouts/AppChrome';
import { DownloadScreen } from './screens/download/DownloadScreen';
import { LibraryScreen } from './screens/library/LibraryScreen';
import { SettingsScreen } from './screens/settings/SettingsScreen';
import { usePreferenceStore } from './core/store';
import { useEffect } from 'react';

/**
 * Main App Component
 * Sets up routing and provider wrappers for the universal app architecture
 */
export default function App() {
  const themeDark = usePreferenceStore((state) => state.themeDark);
  const analyticsEnabled = usePreferenceStore((state) => state.analyticsEnabled);
  const loadSettings = usePreferenceStore((state) => state.loadSettings);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return (
    <PostHogProvider
      enabled={analyticsEnabled}
      theme={themeDark ? 'dark' : 'light'}
    >
      <NotificationProvider>
        <TourProvider
          settings={{
            downloadDir: null,
            themeDark,
            hostUrl: 'https://animepahe.si',
            tourCompleted: false,
            analyticsEnabled,
            maxThreads: 8,
          }}
          onSettingsUpdate={() => {}}
        >
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<AppChrome />}>
                {/* Default route redirects to download */}
                <Route index element={<Navigate to="/download" replace />} />

                {/* Main application routes */}
                <Route path="download" element={<DownloadScreen />} />
                <Route path="library" element={<LibraryScreen />} />
                <Route path="settings" element={<SettingsScreen />} />

                {/* Catch-all redirect to download */}
                <Route path="*" element={<Navigate to="/download" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </TourProvider>
      </NotificationProvider>
    </PostHogProvider>
  );
}
