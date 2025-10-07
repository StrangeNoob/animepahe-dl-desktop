import React from 'react';
import { X, CheckCircle2, XCircle, Folder } from 'lucide-react';
import { cn } from '../lib/utils';
import type { ToastNotification } from '../types';
import { openPath } from '../api';

interface NotificationToastProps {
  toast: ToastNotification;
  onDismiss: (id: string) => void;
}

export function NotificationToast({ toast, onDismiss }: NotificationToastProps) {
  const isSuccess = toast.type === 'success';

  const formatFileSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(1)} KB`;
  };

  const handleOpenFolder = async () => {
    if (toast.file_path) {
      try {
        const folder = toast.file_path.substring(0, toast.file_path.lastIndexOf('/'));
        await openPath(folder);
      } catch (error) {
        console.error('Failed to open folder:', error);
      }
    }
  };

  return (
    <div
      className={cn(
        'pointer-events-auto w-full max-w-sm rounded-lg border shadow-lg transition-all',
        'animate-in slide-in-from-right-full duration-300',
        isSuccess
          ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900'
          : 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900'
      )}
    >
      <div className="flex items-start gap-3 p-4">
        {/* Icon */}
        <div className="flex-shrink-0 mt-0.5">
          {isSuccess ? (
            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
          ) : (
            <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {isSuccess ? 'Download Complete' : 'Download Failed'}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {toast.anime_name} - Episode {toast.episode}
          </p>
          {isSuccess && toast.file_size && (
            <p className="text-xs text-muted-foreground mt-1">
              {formatFileSize(toast.file_size)}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {isSuccess && toast.file_path && (
            <button
              onClick={handleOpenFolder}
              className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              title="Open folder"
            >
              <Folder className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
          <button
            onClick={() => onDismiss(toast.id)}
            className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            title="Dismiss"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}

interface NotificationToastContainerProps {
  toasts: ToastNotification[];
  onDismiss: (id: string) => void;
}

export function NotificationToastContainer({ toasts, onDismiss }: NotificationToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-0 right-0 z-50 flex flex-col gap-2 p-4 max-h-screen overflow-hidden pointer-events-none">
      <div className="flex flex-col-reverse gap-2">
        {toasts.slice(-3).map((toast) => (
          <NotificationToast key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </div>
    </div>
  );
}
