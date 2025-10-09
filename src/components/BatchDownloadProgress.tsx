import React from 'react';
import { Download, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { cn } from '../lib/utils';
import { useNotificationContext } from '../contexts/NotificationContext';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';

export function BatchDownloadProgress() {
  const { batchState } = useNotificationContext();

  if (!batchState.isActive) return null;

  const progress = Math.floor(((batchState.completed + batchState.failed) / batchState.total) * 100);
  const elapsedSeconds = Math.floor((Date.now() - batchState.startTime) / 1000);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Download className="h-4 w-4" />
          Batch Download Progress
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Overall Progress</span>
            <span className="font-medium">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-4 pt-2">
          {/* Total */}
          <div className="flex flex-col items-center gap-1">
            <div className="text-2xl font-bold">{batchState.total}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Download className="h-3 w-3" />
              Total
            </div>
          </div>

          {/* Completed */}
          <div className="flex flex-col items-center gap-1">
            <div className={cn(
              "text-2xl font-bold",
              batchState.completed > 0 && "text-green-600 dark:text-green-400"
            )}>
              {batchState.completed}
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Completed
            </div>
          </div>

          {/* Failed */}
          <div className="flex flex-col items-center gap-1">
            <div className={cn(
              "text-2xl font-bold",
              batchState.failed > 0 && "text-red-600 dark:text-red-400"
            )}>
              {batchState.failed}
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <XCircle className="h-3 w-3" />
              Failed
            </div>
          </div>
        </div>

        {/* Elapsed Time */}
        <div className="flex items-center justify-center gap-2 pt-2 border-t text-sm text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span>Elapsed: {formatDuration(elapsedSeconds)}</span>
        </div>

        {/* Current Episode (if available) */}
        {batchState.currentEpisode && (
          <div className="text-xs text-center text-muted-foreground pt-1">
            Currently downloading: Episode {batchState.currentEpisode}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
