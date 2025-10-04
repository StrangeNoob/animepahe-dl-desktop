import { AlertCircle, X, Folder, Eye } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Button } from "./ui/button";
import { DuplicateEpisode } from "../hooks/useDuplicateDetection";
import { openPath } from "../api";

interface DuplicateWarningProps {
  duplicates: DuplicateEpisode[];
  onRemoveDuplicates: () => void;
  onViewLibrary: () => void;
}

export function DuplicateWarning({
  duplicates,
  onRemoveDuplicates,
  onViewLibrary
}: DuplicateWarningProps) {
  if (duplicates.length === 0) return null;

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const handleOpenFile = async (filePath: string) => {
    try {
      await openPath(filePath);
    } catch (error) {
      console.error("Failed to open file:", error);
    }
  };

  const handleOpenFolder = async (filePath: string) => {
    try {
      const folderPath = filePath.substring(0, filePath.lastIndexOf('/'));
      await openPath(folderPath);
    } catch (error) {
      console.error("Failed to open folder:", error);
    }
  };

  return (
    <Alert variant="destructive" className="mb-4">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Duplicate Episodes Detected</AlertTitle>
      <AlertDescription>
        <p className="mb-2">
          {duplicates.length} episode{duplicates.length !== 1 ? 's' : ''} already in library:
        </p>
        <div className="space-y-2 mb-3">
          {duplicates.map((dup) => (
            <div key={dup.episode} className="flex items-center justify-between bg-background/50 p-2 rounded">
              <div className="flex-1">
                <p className="font-medium">Episode {dup.episode}</p>
                <p className="text-sm opacity-90">
                  {dup.existing.resolution && `${dup.existing.resolution} • `}
                  {dup.existing.audio && `${dup.existing.audio} • `}
                  {formatSize(dup.existing.file_size)}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleOpenFile(dup.existing.file_path)}
                >
                  <Eye className="h-3 w-3 mr-1" />
                  Play
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleOpenFolder(dup.existing.file_path)}
                >
                  <Folder className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onRemoveDuplicates}
          >
            <X className="h-3 w-3 mr-1" />
            Remove from Selection
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onViewLibrary}
          >
            View in Library
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
