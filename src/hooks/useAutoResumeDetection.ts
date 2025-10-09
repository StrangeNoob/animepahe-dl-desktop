import { useState, useEffect } from "react";
import { getIncompleteDownloads } from "../api";
import type { DownloadRecord } from "../types";

export function useAutoResumeDetection() {
  const [incompleteDownloads, setIncompleteDownloads] = useState<DownloadRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNotification, setShowNotification] = useState(false);

  useEffect(() => {
    const checkIncompleteDownloads = async () => {
      try {
        const downloads = await getIncompleteDownloads();
        setIncompleteDownloads(downloads);

        // Show notification if there are incomplete downloads
        if (downloads.length > 0) {
          setShowNotification(true);

          // Auto-dismiss after 10 seconds
          setTimeout(() => {
            setShowNotification(false);
          }, 10000);
        }
      } catch (error) {
        console.error("Failed to check incomplete downloads:", error);
      } finally {
        setLoading(false);
      }
    };

    checkIncompleteDownloads();
  }, []);

  const dismissNotification = () => {
    setShowNotification(false);
  };

  return {
    incompleteDownloads,
    incompleteCount: incompleteDownloads.length,
    showNotification,
    dismissNotification,
    loading,
  };
}
