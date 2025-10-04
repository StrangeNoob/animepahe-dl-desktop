import { invoke } from "@tauri-apps/api/core";
import type {
  Settings,
  SearchItem,
  FetchEpisodesResponse,
  PreviewItem,
  EpisodeInfo,
  RequirementsCheckResponse,
  DownloadRecord,
} from "./types";

export async function loadSettings(): Promise<Settings> {
  const raw = await invoke<AppSettingsRaw>("load_settings");
  return normalizeSettings(raw);
}

export async function saveSettings(settings: Settings): Promise<void> {
  const payload: AppSettingsRaw = {
    download_dir: settings.downloadDir,
    theme_dark: settings.themeDark,
    host_url: settings.hostUrl,
    tour_completed: settings.tourCompleted,
  };
  await invoke("save_settings", { settings: payload });
}

export async function searchAnime(name: string, host: string): Promise<SearchItem[]> {
  return invoke("search_anime", { req: { name, host } });
}

export async function fetchEpisodes(
  slug: string,
  host: string,
  nameHint: string
): Promise<FetchEpisodesResponse> {
  const raw = await invoke<FetchEpisodesResponseRaw>("fetch_episodes", {
    req: { slug, host, name_hint: nameHint },
  });
  return {
    episodes: raw.episodes,
    displayName: raw.display_name,
  };
}

export async function previewSources(
  slug: string,
  host: string,
  episodes: number[],
  cached: FetchEpisodesResponse
): Promise<PreviewItem[]> {
  return invoke("preview_sources", {
    req: {
      slug,
      host,
      episodes,
      cached: cached.episodes,
    },
  });
}

export interface StartDownloadRequest {
  animeName: string;
  animeSlug: string;
  episodes: number[];
  audioType?: string;
  resolution?: string;
  downloadDir?: string | null;
  host: string;
}

export async function startDownload(req: StartDownloadRequest): Promise<void> {
  await invoke("start_download", {
    req: {
      anime_name: req.animeName,
      anime_slug: req.animeSlug,
      episodes: req.episodes,
      audio_type: emptyToNull(req.audioType),
      resolution: emptyToNull(req.resolution),
      download_dir: req.downloadDir ?? null,
      host: req.host,
      resume_download_id: null,
    },
  });
}

interface AppSettingsRaw {
  download_dir: string | null;
  theme_dark: boolean;
  host_url: string;
  tour_completed: boolean;
}

interface FetchEpisodesResponseRaw {
  episodes: EpisodeInfo[];
  display_name: string;
}

function normalizeSettings(raw: AppSettingsRaw): Settings {
  return {
    downloadDir: raw.download_dir,
    themeDark: raw.theme_dark,
    hostUrl: raw.host_url,
    tourCompleted: raw.tour_completed ?? false,
  };
}

export async function checkRequirements(): Promise<RequirementsCheckResponse> {
  const raw = await invoke<RequirementsCheckResponseRaw>("check_requirements");
  return {
    allAvailable: raw.all_available,
    requirements: raw.requirements,
  };
}

interface RequirementsCheckResponseRaw {
  all_available: boolean;
  requirements: Array<{
    name: string;
    available: boolean;
    path?: string | null;
    error?: string | null;
  }>;
}

function emptyToNull(value?: string): string | null | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export async function cancelDownload(episode: number): Promise<void> {
  await invoke("cancel_download", { episode });
}

// Resume download API functions
export async function getIncompleteDownloads(): Promise<DownloadRecord[]> {
  return invoke("get_incomplete_downloads");
}

export async function resumeDownload(downloadId: string): Promise<void> {
  await invoke("resume_download", { downloadId });
}

export async function removeDownloadRecord(downloadId: string): Promise<void> {
  await invoke("remove_download_record", { downloadId });
}

export async function clearCompletedDownloads(): Promise<void> {
  await invoke("clear_completed_downloads");
}

export async function validateDownloadIntegrity(downloadId: string): Promise<boolean> {
  return invoke("validate_download_integrity", { downloadId });
}

export async function getAppVersion(): Promise<string> {
  return invoke("get_app_version");
}

export async function openPath(path: string): Promise<void> {
  await invoke("open_path", { path });
}
