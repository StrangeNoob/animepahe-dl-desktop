/**
 * Formatting Utilities
 * Common formatting functions for display
 */

/**
 * Format speed in bytes per second to human-readable format
 */
export function formatSpeed(bps: number): string {
  if (bps === 0) return '—';
  if (bps < 1024) return `${bps.toFixed(0)} B/s`;
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(1)} KB/s`;
  return `${(bps / (1024 * 1024)).toFixed(1)} MB/s`;
}

/**
 * Format elapsed time in seconds to human-readable format
 */
export function formatElapsedTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (minutes < 60) return `${minutes}m ${secs}s`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m ${secs}s`;
}

/**
 * Format bytes to human-readable format
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Format resolution for display (e.g., "1080" -> "1080p")
 */
export function formatResolutionLabel(value: string): string {
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    return `${trimmed}p`;
  }
  return trimmed;
}

/**
 * Format audio type for display (e.g., "eng" -> "Dub (ENG)")
 */
export function formatAudioLabel(value: string): string {
  switch (value.trim().toLowerCase()) {
    case 'eng':
      return 'Dub (ENG)';
    case 'jpn':
      return 'Sub (JPN)';
    case 'ja':
      return 'Sub (JA)';
    default:
      return value.trim().toUpperCase();
  }
}

/**
 * Sort resolution values in descending order
 */
export function sortResolutionValues(values: Iterable<string>): string[] {
  return Array.from(
    new Set(Array.from(values, (value) => value.trim()).filter((value) => value.length > 0))
  ).sort((a, b) => {
    const aNum = parseInt(a.replace(/[^0-9]/g, ''), 10) || 0;
    const bNum = parseInt(b.replace(/[^0-9]/g, ''), 10) || 0;
    return bNum - aNum;
  });
}

/**
 * Sort audio values with preference for common types
 */
export function sortAudioValues(values: Iterable<string>): string[] {
  return Array.from(
    new Set(Array.from(values, (value) => value.trim().toLowerCase()).filter((value) => value.length > 0))
  ).sort((a, b) => {
    const rank = (input: string) => {
      if (input === 'eng') return 0;
      if (input === 'jpn') return 1;
      return 2;
    };
    const diff = rank(a) - rank(b);
    return diff !== 0 ? diff : a.localeCompare(b);
  });
}

/**
 * Format episode specification (e.g., [1, 2, 5] -> "1,2,5")
 */
export function formatEpisodesSpec(episodes: number[]): string {
  return episodes
    .slice()
    .sort((a, b) => a - b)
    .join(',');
}
