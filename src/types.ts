export interface Settings {
  downloadDir: string | null;
  themeDark: boolean;
  hostUrl: string;
}

export interface SearchItem {
  session: string;
  title: string;
}

export interface EpisodeInfo {
  number: number;
  session: string;
}

export interface FetchEpisodesResponse {
  episodes: EpisodeInfo[];
  displayName: string;
}

export interface CandidateSource {
  src: string;
  audio?: string | null;
  resolution?: string | null;
  av1?: string | null;
}

export interface PreviewItem {
  episode: number;
  sources: CandidateSource[];
}

export interface DownloadStatusEvent {
  episode: number;
  status: string;
}

export interface DownloadProgressEvent {
  episode: number;
  done: number;
  total: number;
}

export interface RequirementStatus {
  name: string;
  available: boolean;
  path?: string | null;
  error?: string | null;
}

export interface RequirementsCheckResponse {
  allAvailable: boolean;
  requirements: RequirementStatus[];
}
