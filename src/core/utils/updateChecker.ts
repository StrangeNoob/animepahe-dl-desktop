export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  releaseUrl: string;
}

export async function checkForUpdates(
  currentVersion: string,
  repoOwner: string,
  repoName: string,
  timeoutMs: number = 5000
): Promise<UpdateInfo | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(
      `https://api.github.com/repos/${repoOwner}/${repoName}/releases/latest`,
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': `${repoName}/1.0`,
        },
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn('Failed to check for updates:', response.statusText);
      return null;
    }

    const release = await response.json();
    const latestVersion = release.tag_name;
    const updateAvailable = isNewerVersion(currentVersion, latestVersion);

    return {
      currentVersion,
      latestVersion,
      updateAvailable,
      releaseUrl: release.html_url,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn('Update check timed out');
    } else {
      console.warn('Failed to check for updates:', error);
    }
    return null;
  }
}

function isNewerVersion(current: string, latest: string): boolean {
  const parseVersion = (version: string): number[] => {
    return version
      .replace(/^v/, '')
      .split('.')
      .map(part => {
        const num = parseInt(part.split(/[-+]/)[0]);
        return isNaN(num) ? 0 : num;
      });
  };

  const currentParts = parseVersion(current);
  const latestParts = parseVersion(latest);

  const maxLength = Math.max(currentParts.length, latestParts.length);

  for (let i = 0; i < maxLength; i++) {
    const cur = currentParts[i] || 0;
    const lat = latestParts[i] || 0;
    if (lat > cur) return true;
    if (lat < cur) return false;
  }

  return false;
}