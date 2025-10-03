export interface Settings {
  downloadDir: string | null;
  themeDark: boolean;
  hostUrl: string;
  tourCompleted: boolean;
  analyticsEnabled: boolean;
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
  path?: string | null;
}

export interface DownloadProgressEvent {
  episode: number;
  done: number;
  total: number;
  speedBps: number; // bytes per second
  elapsedSeconds: number; // time spent downloading
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

export interface TourStep {
  id: string;
  title: string;
  content: string;
  target?: string;
  placement?: "top" | "bottom" | "left" | "right";
  allowClicksThruHole?: boolean;
}

export interface TourState {
  isActive: boolean;
  currentStep: number;
  steps: TourStep[];
}

export interface TourContextType {
  tourState: TourState;
  startTour: () => void;
  endTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: number) => void;
  skipTour: () => void;
}
