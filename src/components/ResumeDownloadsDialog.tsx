import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";
import { Separator } from "./ui/separator";
import { RefreshCw, Trash2, CheckCircle, XCircle, AlertCircle, FolderOpen } from "lucide-react";
import type { DownloadRecord } from "../types";
import {
  getIncompleteDownloads,
  resumeDownload,
  removeDownloadRecord,
  clearCompletedDownloads,
  validateDownloadIntegrity,
  openPath,
} from "../api";

interface ResumeDownloadsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ResumeDownloadsDialog({ open, onOpenChange }: ResumeDownloadsDialogProps) {
  const [downloads, setDownloads] = useState<DownloadRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState<Set<string>>(new Set());

  const loadDownloads = async () => {
    setLoading(true);
    try {
      const records = await getIncompleteDownloads();
      setDownloads(records);
    } catch (error) {
      console.error("Failed to load incomplete downloads:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadDownloads();
    }
  }, [open]);

  const handleResume = async (downloadId: string) => {
    try {
      await resumeDownload(downloadId);
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to resume download:", error);
      alert(`Failed to resume download: ${error}`);
    }
  };

  const handleRemove = async (downloadId: string) => {
    if (!confirm("Are you sure you want to remove this download record?")) {
      return;
    }

    try {
      await removeDownloadRecord(downloadId);
      await loadDownloads();
    } catch (error) {
      console.error("Failed to remove download:", error);
      alert(`Failed to remove download: ${error}`);
    }
  };

  const handleValidate = async (downloadId: string) => {
    setValidating((prev) => new Set(prev).add(downloadId));
    try {
      const isValid = await validateDownloadIntegrity(downloadId);
      alert(isValid ? "File is valid and can be resumed!" : "File is missing or corrupted. Please remove this record.");
    } catch (error) {
      console.error("Failed to validate download:", error);
      alert(`Failed to validate download: ${error}`);
    } finally {
      setValidating((prev) => {
        const next = new Set(prev);
        next.delete(downloadId);
        return next;
      });
    }
  };

  const handleClearCompleted = async () => {
    try {
      await clearCompletedDownloads();
      await loadDownloads();
    } catch (error) {
      console.error("Failed to clear completed downloads:", error);
    }
  };

  const handleOpenFolder = async (filePath: string) => {
    try {
      // Open parent directory
      const dir = filePath.substring(0, filePath.lastIndexOf("/") || filePath.lastIndexOf("\\"));
      await openPath(dir);
    } catch (error) {
      console.error("Failed to open folder:", error);
      alert(`Failed to open folder: ${error}`);
    }
  };

  const getStatusBadge = (status: DownloadRecord["status"]) => {
    switch (status.toLowerCase()) {
      case "inprogress":
        return (
          <Badge variant="default" className="flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            In Progress
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <XCircle className="w-3 h-3" />
            Failed
          </Badge>
        );
      case "completed":
        return (
          <Badge variant="outline" className="flex items-center gap-1 text-green-600 border-green-600">
            <CheckCircle className="w-3 h-3" />
            Completed
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <XCircle className="w-3 h-3" />
            Cancelled
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const getProgress = (record: DownloadRecord) => {
    if (!record.file_size) return 0;
    return Math.round((record.downloaded_bytes / record.file_size) * 100);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Resume Downloads</DialogTitle>
          <DialogDescription>
            {downloads.length === 0
              ? "No incomplete downloads found."
              : `Found ${downloads.length} incomplete download${downloads.length !== 1 ? "s" : ""}.`}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <ScrollArea className="max-h-[500px] pr-4">
            <div className="space-y-4">
              {downloads.map((download, index) => (
                <div key={download.id}>
                  <div className="space-y-3 py-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-lg truncate">{download.anime_name}</h3>
                        <p className="text-sm text-muted-foreground">Episode {download.episode}</p>
                      </div>
                      {getStatusBadge(download.status)}
                    </div>

                    {download.file_size && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-medium">
                            {formatBytes(download.downloaded_bytes)} / {formatBytes(download.file_size)} ({getProgress(download)}%)
                          </span>
                        </div>
                        <Progress value={getProgress(download)} className="h-2" />
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {download.audio_type && (
                        <div>
                          <span className="text-muted-foreground">Audio:</span> <span className="font-medium">{download.audio_type}</span>
                        </div>
                      )}
                      {download.resolution && (
                        <div>
                          <span className="text-muted-foreground">Resolution:</span> <span className="font-medium">{download.resolution}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-muted-foreground">Started:</span> <span className="font-medium">{formatDate(download.started_at)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Last Updated:</span> <span className="font-medium">{formatDate(download.updated_at)}</span>
                      </div>
                    </div>

                    <div className="text-xs text-muted-foreground truncate" title={download.file_path}>
                      <span className="font-medium">Path:</span> {download.file_path}
                    </div>

                    {download.error_message && (
                      <div className="p-2 bg-destructive/10 border border-destructive/20 rounded text-xs text-destructive break-words">
                        <span className="font-semibold">Error:</span> {download.error_message}
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleResume(download.id)}
                        disabled={download.status === "completed"}
                        className="flex items-center gap-1"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Resume
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleValidate(download.id)}
                        disabled={validating.has(download.id)}
                        className="flex items-center gap-1"
                      >
                        <CheckCircle className="w-4 h-4" />
                        {validating.has(download.id) ? "Validating..." : "Validate"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenFolder(download.file_path)}
                        className="flex items-center gap-1"
                      >
                        <FolderOpen className="w-4 h-4" />
                        Open Folder
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleRemove(download.id)}
                        className="flex items-center gap-1 ml-auto"
                      >
                        <Trash2 className="w-4 h-4" />
                        Remove
                      </Button>
                    </div>
                  </div>
                  {index < downloads.length - 1 && <Separator />}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClearCompleted}>
            Clear Completed
          </Button>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
