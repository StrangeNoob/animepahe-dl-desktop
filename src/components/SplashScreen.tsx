import { RefreshCw } from 'lucide-react';

interface SplashScreenProps {
  message?: string;
}

export function SplashScreen({ message = "Checking for updates..." }: SplashScreenProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <div className="pointer-events-none absolute -left-20 top-10 h-64 w-64 rounded-full bg-gradient-to-br from-purple-500/40 via-pink-500/30 to-cyan-400/30 blur-3xl" />
      <div className="pointer-events-none absolute right-10 bottom-10 h-72 w-72 rounded-full bg-gradient-to-br from-cyan-400/30 via-purple-500/25 to-transparent blur-3xl" />

      <div className="relative flex flex-col items-center gap-6">
        <div className="flex items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Animepahe DL Desktop</h1>
        </div>
        <p className="text-sm text-muted-foreground animate-pulse">{message}</p>
      </div>
    </div>
  );
}