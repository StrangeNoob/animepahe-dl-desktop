import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { PostHogProvider } from './lib/posthog';
import { NotificationProvider } from './contexts/NotificationContext';
import { TourProvider } from './components/tour/TourProvider';
import { ChromeSlotsProvider } from './ui/contexts/ChromeSlots';
import { AppChrome } from './ui/layouts/AppChrome';
import { HomeScreen } from './screens/home/HomeScreen';
import { SearchScreen } from './screens/search/SearchScreen';
import { DownloadScreen } from './screens/download/DownloadScreen';
import { LibraryScreen } from './screens/library/LibraryScreen';
import { SettingsScreen } from './screens/settings/SettingsScreen';
import { TitleScreen } from './screens/title/TitleScreen';
import { EpisodesScreen } from './screens/episodes/EpisodesScreen';
import { PlayerScreen } from './screens/player/PlayerScreen';
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
            <ChromeSlotsProvider>
              <Routes>
                {/* Full-screen player route (no AppChrome) */}
                <Route path="/player" element={<PlayerScreen />} />

                <Route path="/" element={<AppChrome />}>
                  {/* Default route redirects to home */}
                  <Route index element={<Navigate to="/home" replace />} />

                  {/* Main application routes */}
                  <Route path="home" element={<HomeScreen />} />
                  <Route path="search" element={<SearchScreen />} />
                  <Route path="downloads" element={<DownloadScreen />} />
                  <Route path="library" element={<LibraryScreen />} />
                  <Route path="settings" element={<SettingsScreen />} />

                  {/* Title and Episodes routes */}
                  <Route path="title/:slug" element={<TitleScreen />} />
                  <Route path="title/:slug/episodes" element={<EpisodesScreen />} />

                  {/* Catch-all redirect to home */}
                  <Route path="*" element={<Navigate to="/home" replace />} />
                </Route>
              </Routes>
            </ChromeSlotsProvider>
          </BrowserRouter>
        </TourProvider>
      </NotificationProvider>
    </PostHogProvider>
  );
}
