import { useState, useEffect } from "react";
import { checkEpisodeDownloaded, getLibraryEntry } from "../api";
import { LibraryEntry } from "../types";

export interface DuplicateEpisode {
  episode: number;
  existing: LibraryEntry;
}

export function useDuplicateDetection(
  slug: string | null,
  selectedEpisodes: number[]
) {
  const [duplicates, setDuplicates] = useState<DuplicateEpisode[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!slug || selectedEpisodes.length === 0) {
      setDuplicates([]);
      return;
    }

    const checkDuplicates = async () => {
      setIsLoading(true);
      try {
        const results = await Promise.all(
          selectedEpisodes.map(async (ep) => {
            const exists = await checkEpisodeDownloaded(slug, ep);
            if (exists) {
              const existing = await getLibraryEntry(slug, ep);
              if (existing) {
                return { episode: ep, existing };
              }
            }
            return null;
          })
        );

        const foundDuplicates = results.filter(
          (r): r is DuplicateEpisode => r !== null
        );
        setDuplicates(foundDuplicates);
      } catch (error) {
        console.error("Duplicate check failed:", error);
        setDuplicates([]);
      } finally {
        setIsLoading(false);
      }
    };

    checkDuplicates();
  }, [slug, selectedEpisodes]);

  return { duplicates, isLoading };
}
