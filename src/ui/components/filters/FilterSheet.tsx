import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '../base/sheet';
import { Segmented, SegmentedOption } from '../base/segmented';
import { Button } from '../base/button';
import { X } from 'lucide-react';

export interface FilterOptions {
  resolution?: string;
  audioType?: string;
  sortBy?: string;
}

export interface FilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: FilterOptions;
  onApplyFilters: (filters: FilterOptions) => void;
  onResetFilters: () => void;
}

const resolutionOptions: SegmentedOption[] = [
  { value: 'any', label: 'Any' },
  { value: '720p', label: '720p' },
  { value: '1080p', label: '1080p' },
];

const audioOptions: SegmentedOption[] = [
  { value: 'any', label: 'Any' },
  { value: 'sub', label: 'Sub' },
  { value: 'dub', label: 'Dub' },
];

const sortOptions: SegmentedOption[] = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'rating', label: 'Rating' },
];

/**
 * FilterSheet Component
 * Mobile-friendly bottom sheet for filtering anime search/browse results
 *
 * Features:
 * - Resolution filter (720p, 1080p, Any)
 * - Audio type filter (Sub, Dub, Any)
 * - Sort options (Relevance, Newest, Rating)
 * - Reset filters
 * - Apply filters
 * - Accessible with keyboard navigation
 *
 * Usage:
 * ```tsx
 * const [open, setOpen] = useState(false);
 * const [filters, setFilters] = useState<FilterOptions>({});
 *
 * <FilterSheet
 *   open={open}
 *   onOpenChange={setOpen}
 *   filters={filters}
 *   onApplyFilters={(newFilters) => {
 *     setFilters(newFilters);
 *     setOpen(false);
 *   }}
 *   onResetFilters={() => {
 *     setFilters({});
 *   }}
 * />
 * ```
 */
export function FilterSheet({
  open,
  onOpenChange,
  filters,
  onApplyFilters,
  onResetFilters,
}: FilterSheetProps) {
  // Local state for working filters (not applied until user clicks Apply)
  const [localFilters, setLocalFilters] = useState<FilterOptions>(filters);

  // Sync local filters with prop filters when sheet opens
  useEffect(() => {
    if (open) {
      setLocalFilters(filters);
    }
  }, [open, filters]);

  const handleApply = () => {
    onApplyFilters(localFilters);
    onOpenChange(false);
  };

  const handleReset = () => {
    const resetFilters = {
      resolution: 'any',
      audioType: 'any',
      sortBy: 'relevance',
    };
    setLocalFilters(resetFilters);
    onResetFilters();
  };

  const hasActiveFilters = () => {
    return (
      (localFilters.resolution && localFilters.resolution !== 'any') ||
      (localFilters.audioType && localFilters.audioType !== 'any') ||
      (localFilters.sortBy && localFilters.sortBy !== 'relevance')
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription>
            Customize your search results with filters and sorting options
          </SheetDescription>
        </SheetHeader>

        <div className="py-6 space-y-6">
          {/* Resolution Filter */}
          <div>
            <label className="text-sm font-medium mb-3 block">
              Resolution
            </label>
            <Segmented
              options={resolutionOptions}
              value={localFilters.resolution || 'any'}
              onChange={(value) =>
                setLocalFilters({ ...localFilters, resolution: value })
              }
              fullWidth
            />
          </div>

          {/* Audio Type Filter */}
          <div>
            <label className="text-sm font-medium mb-3 block">
              Audio Type
            </label>
            <Segmented
              options={audioOptions}
              value={localFilters.audioType || 'any'}
              onChange={(value) =>
                setLocalFilters({ ...localFilters, audioType: value })
              }
              fullWidth
            />
          </div>

          {/* Sort Options */}
          <div>
            <label className="text-sm font-medium mb-3 block">
              Sort By
            </label>
            <Segmented
              options={sortOptions}
              value={localFilters.sortBy || 'relevance'}
              onChange={(value) =>
                setLocalFilters({ ...localFilters, sortBy: value })
              }
              fullWidth
            />
          </div>
        </div>

        <SheetFooter className="flex-row gap-2">
          {/* Reset Button */}
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={!hasActiveFilters()}
            className="flex-1"
          >
            Reset
          </Button>

          {/* Apply Button */}
          <Button onClick={handleApply} className="flex-1">
            Apply Filters
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
