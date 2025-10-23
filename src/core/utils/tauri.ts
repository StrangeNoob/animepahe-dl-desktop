/**
 * Tauri Utilities
 * Helper functions for detecting and working with Tauri environment
 */

/**
 * Check if the app is running in Tauri
 * Returns true if running in Tauri desktop app, false if in browser
 */
export function isTauri(): boolean {
  return '__TAURI_INTERNALS__' in window;
}

/**
 * Safely invoke a Tauri command with fallback
 * Returns null if command fails or is not available
 * Does not throw errors - logs them instead
 */
export async function safeInvoke<T>(
  command: string,
  args?: Record<string, unknown>
): Promise<T | null> {
  if (!isTauri()) {
    // Silently return null in browser mode
    return null;
  }

  const { invoke } = await import('@tauri-apps/api/core');
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    // Silently handle command not found errors
    const errorMessage = String(error);
    if (errorMessage.includes('not found')) {
      // Command doesn't exist in backend - this is expected for some commands
      return null;
    }
    // Log other errors but don't throw
    console.warn(`Tauri command "${command}" failed:`, error);
    return null;
  }
}
