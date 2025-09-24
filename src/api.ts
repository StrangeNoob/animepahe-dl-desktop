import { invoke } from "@tauri-apps/api/core";
import type {
  Settings,
  SearchItem,
  FetchEpisodesResponse,
  PreviewItem,
  EpisodeInfo,
  RequirementsCheckResponse,
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
  slug: string;
  host: string;
  resolution?: string;
  audio?: string;
  threads: number;
  listOnly: boolean;
  episodesSpec?: string;
  selected: number[];
  downloadDir?: string | null;
}

export async function startDownload(req: StartDownloadRequest): Promise<void> {
  await invoke("start_download", {
    req: {
      anime_name: req.animeName,
      slug: req.slug,
      host: req.host,
      resolution: emptyToNull(req.resolution),
      audio: emptyToNull(req.audio),
      threads: req.threads,
      list_only: req.listOnly,
      episodes_spec: emptyToNull(req.episodesSpec),
      selected: req.selected,
      download_dir: req.downloadDir ?? null,
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
