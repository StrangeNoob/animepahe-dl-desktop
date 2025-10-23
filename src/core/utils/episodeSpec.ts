/**
 * Episode Specification Parser
 * Parses episode specifications like "1,3-5,*" into episode numbers
 */

export interface ParseResult {
  episodes: number[];
  error: string | null;
}

/**
 * Parse episode specification string into array of episode numbers
 *
 * Supported formats:
 * - Single episode: "1"
 * - Multiple episodes: "1,3,5"
 * - Range: "1-5"
 * - All episodes: "*"
 * - Combined: "1,3-5,7"
 *
 * @param value - Episode specification string
 * @param availableEpisodes - Array of available episode numbers
 * @returns ParseResult with episodes array and error (if any)
 */
export function parseEpisodeSpec(value: string, availableEpisodes: number[]): ParseResult {
  const cleaned = value.trim();
  if (!cleaned) {
    return { episodes: [], error: null };
  }

  const parts = cleaned
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  if (!parts.length) {
    return { episodes: [], error: null };
  }

  const sortedAvailable = [...availableEpisodes].sort((a, b) => a - b);
  if (!sortedAvailable.length) {
    return { episodes: [], error: 'No episodes available to match.' };
  }

  const availableSet = new Set(sortedAvailable);

  // Handle wildcard - return all episodes
  if (parts.some((part) => part.includes('*'))) {
    return { episodes: sortedAvailable, error: null };
  }

  const result = new Set<number>();

  for (const part of parts) {
    const rangeParts = part.split('-').map((n) => n.trim());

    // Handle range (e.g., "1-5")
    if (rangeParts.length === 2) {
      const [startStr, endStr] = rangeParts;
      if (!startStr || !endStr) {
        return { episodes: [], error: `Range '${part}' is incomplete.` };
      }
      const start = Number(startStr);
      const end = Number(endStr);
      if (!Number.isInteger(start) || !Number.isInteger(end)) {
        return { episodes: [], error: `Range '${part}' must use whole numbers.` };
      }
      if (start > end) {
        return { episodes: [], error: `Range '${part}' is inverted.` };
      }
      for (let current = start; current <= end; current += 1) {
        if (!availableSet.has(current)) {
          return { episodes: [], error: `Episode ${current} is not available.` };
        }
        result.add(current);
      }
      continue;
    }

    // Handle single episode number
    const numberValue = Number(part);
    if (!Number.isInteger(numberValue)) {
      return { episodes: [], error: `'${part}' is not a valid episode number.` };
    }
    if (!availableSet.has(numberValue)) {
      return { episodes: [], error: `Episode ${numberValue} is not available.` };
    }
    result.add(numberValue);
  }

  return { episodes: [...result].sort((a, b) => a - b), error: null };
}

/**
 * Validate episode specification without parsing
 *
 * @param value - Episode specification string
 * @returns true if valid format, false otherwise
 */
export function isValidEpisodeSpec(value: string): boolean {
  const cleaned = value.trim();
  if (!cleaned) return true; // Empty is valid

  // Check for wildcard
  if (cleaned === '*') return true;

  // Split by comma and validate each part
  const parts = cleaned.split(',').map((p) => p.trim()).filter(Boolean);

  for (const part of parts) {
    // Check for range
    if (part.includes('-')) {
      const rangeParts = part.split('-').map((n) => n.trim());
      if (rangeParts.length !== 2) return false;
      if (!rangeParts.every((n) => /^\d+$/.test(n))) return false;
    } else {
      // Check for single number
      if (!/^\d+$/.test(part) && part !== '*') return false;
    }
  }

  return true;
}
