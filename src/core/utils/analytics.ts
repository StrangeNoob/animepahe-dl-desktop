import type { PostHog } from 'posthog-js';

/**
 * Categorize search performance based on duration
 */
export function categorizeSearchPerformance(durationMs: number): 'fast' | 'medium' | 'slow' {
  if (durationMs < 500) return 'fast';
  if (durationMs < 2000) return 'medium';
  return 'slow';
}

/**
 * Measure and track search performance
 */
export function measureSearchPerformance(
  posthog: PostHog | undefined,
  durationMs: number,
  resultCount: number
) {
  if (!posthog) return;

  const category = categorizeSearchPerformance(durationMs);

  posthog.capture('search_performance', {
    duration_ms: durationMs,
    performance_category: category,
    result_count: resultCount
  });
}

/**
 * Categorize download speed in MB/s
 */
export function categorizeDownloadSpeed(speedMBps: number): 'slow' | 'medium' | 'fast' | 'very_fast' {
  if (speedMBps < 1) return 'slow';
  if (speedMBps < 5) return 'medium';
  if (speedMBps < 10) return 'fast';
  return 'very_fast';
}

/**
 * Categorize file size in MB
 */
export function categorizeFileSize(sizeMB: number): 'small' | 'medium' | 'large' | 'very_large' {
  if (sizeMB < 100) return 'small';
  if (sizeMB < 300) return 'medium';
  if (sizeMB < 600) return 'large';
  return 'very_large';
}

/**
 * Measure and track download performance
 */
export function measureDownloadSpeed(
  posthog: PostHog | undefined,
  totalBytes: number,
  durationMs: number
) {
  if (!posthog || totalBytes === 0 || durationMs === 0) return;

  const sizeMB = totalBytes / (1024 * 1024);
  const speedMBps = sizeMB / (durationMs / 1000);

  const speedCategory = categorizeDownloadSpeed(speedMBps);
  const sizeCategory = categorizeFileSize(sizeMB);

  posthog.capture('download_performance', {
    speed_category: speedCategory,
    file_size_category: sizeCategory,
    duration_seconds: Math.round(durationMs / 1000)
  });
}

/**
 * Track app startup time from launch to interactive
 */
export function trackAppStartupTime(posthog: PostHog | undefined, startTime: number) {
  if (!posthog) return;

  const duration = Date.now() - startTime;
  const category = duration < 1000 ? 'fast' : duration < 3000 ? 'medium' : 'slow';

  posthog.capture('app_startup_time', {
    duration_ms: duration,
    startup_category: category
  });
}

/**
 * Session tracker for managing app focus/blur events
 */
export class SessionTracker {
  private sessionStartTime: number | null = null;
  private posthog: PostHog | undefined;

  constructor(posthog: PostHog | undefined) {
    this.posthog = posthog;
  }

  startSession() {
    if (!this.posthog) return;

    this.sessionStartTime = Date.now();
    this.posthog.capture('session_started', {
      timestamp: new Date().toISOString()
    });
  }

  endSession() {
    if (!this.posthog || !this.sessionStartTime) return;

    const durationMs = Date.now() - this.sessionStartTime;
    const durationMinutes = Math.round(durationMs / 60000);

    this.posthog.capture('session_duration', {
      duration_minutes: durationMinutes
    });

    this.sessionStartTime = null;
  }

  getSessionDuration(): number {
    if (!this.sessionStartTime) return 0;
    return Date.now() - this.sessionStartTime;
  }
}
