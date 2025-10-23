import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search as SearchIcon, SlidersHorizontal, X } from 'lucide-react';
import { searchAnime } from '../../core/animepahe/api';
import { SearchItem } from '../../core/types';
import { usePreferenceStore } from '../../core/store';
import { PosterCard, PosterCardSkeleton } from '../../ui/components/content/PosterCard';
import { FilterSheet, FilterOptions } from '../../ui/components/filters/FilterSheet';
import { useChromeSlots } from '../../ui/contexts/ChromeSlots';
import { cn } from '../../core/utils/cn';
import { Autocomplete, AutocompleteOption } from '../../ui/components/base/autocomplete';

/**
 * Search Screen 
 * Anime search with grid layout and filters
 */
export function SearchScreen() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedAnime, setSelectedAnime] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    resolution: 'any',
    audioType: 'any',
    sortBy: 'relevance',
  });
  const hostUrl = usePreferenceStore((state) => state.hostUrl);
  const slots = useChromeSlots();

  // Setup chrome slots for mobile top bar
  useEffect(() => {
    slots.setMobileTopBarTitle('Search');
    slots.setMobileTopBarActions(
      <button
        onClick={() => setFilterOpen(true)}
        className={cn(
          'flex items-center gap-2',
          'px-3 py-2 rounded-md',
          'text-sm font-medium',
          'hover:bg-accent transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-ring'
        )}
      >
        <SlidersHorizontal className="h-4 w-4" />
        <span className="hidden sm:inline">Filters</span>
      </button>
    );

    return () => {
      slots.clearSlots();
    };
  }, [slots.setMobileTopBarTitle, slots.setMobileTopBarActions, slots.clearSlots]);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    const timeoutId = setTimeout(() => {
      handleSearch(query);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [query, hostUrl]);

  const handleSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    setHasSearched(true);

    try {
      const searchResults = await searchAnime(searchQuery.trim(), hostUrl);
      setResults(searchResults);
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [hostUrl]);

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setHasSearched(false);
    setSelectedAnime(null);
  };

  // Convert search results to autocomplete options
  const autocompleteOptions: AutocompleteOption[] = useMemo(() => {
    return results.map((item) => ({
      value: item.session, // slug
      label: item.title, // anime name
    }));
  }, [results]);

  // Handle anime selection from autocomplete
  const handleAnimeSelect = useCallback((option: AutocompleteOption | null) => {
    if (option) {
      setSelectedAnime(option.value);
      // Navigate to the title page
      navigate(`/title/${option.value}`);
    }
  }, [navigate]);

  return (
    <main className="pb-8">
      {/* Search Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b pb-4 mb-6">
        <div className="container mx-auto px-4 md:px-6 pt-4">
          {/* Search Input with Autocomplete */}
          <form role="search" onSubmit={(e) => e.preventDefault()}>
            <Autocomplete
              value={selectedAnime}
              onChange={handleAnimeSelect}
              query={query}
              onQueryChange={setQuery}
              items={autocompleteOptions}
              isLoading={isLoading}
              placeholder="Search anime..."
              emptyMessage="No anime found. Try a different search."
            />
          </form>

          {/* Desktop Filter Button */}
          <div className="hidden md:flex items-center gap-2 mt-4">
            <button
              onClick={() => setFilterOpen(true)}
              className={cn(
                'inline-flex items-center gap-2',
                'px-4 py-2 rounded-md',
                'text-sm font-medium',
                'border border-border',
                'hover:bg-accent transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-ring'
              )}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="container mx-auto px-4 md:px-6">
        {/* Loading State */}
        {isLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4" role="status" aria-live="polite">
            <span className="sr-only">Loading search results...</span>
            {Array.from({ length: 12 }).map((_, i) => (
              <PosterCardSkeleton key={i} aspectRatio="portrait" mode="below" />
            ))}
          </div>
        )}

        {/* Results Grid */}
        {!isLoading && results.length > 0 && (
          <section aria-label="Search results">
            <div className="mb-4 text-sm text-muted-foreground" role="status" aria-live="polite">
              Found {results.length} results for "{query}"
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {results.map((item) => (
                <PosterCard
                  key={item.session}
                  slug={item.session}
                  title={item.title}
                  imageUrl={item.poster || item.image || undefined}
                  aspectRatio="portrait"
                  mode="below"
                />
              ))}
            </div>
          </section>
        )}

        {/* Empty State - No Results */}
        {!isLoading && hasSearched && results.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center" role="status" aria-live="polite">
            <SearchIcon className="h-16 w-16 text-muted-foreground mb-4" aria-hidden="true" />
            <h2 className="text-xl font-semibold mb-2">No results found</h2>
            <p className="text-muted-foreground max-w-md">
              Try searching with different keywords or check your spelling
            </p>
          </div>
        )}

        {/* Empty State - Start Searching */}
        {!isLoading && !hasSearched && (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <SearchIcon className="h-16 w-16 text-muted-foreground mb-4" aria-hidden="true" />
            <h2 className="text-xl font-semibold mb-2">Search for anime</h2>
            <p className="text-muted-foreground max-w-md">
              Enter a title, genre, or keyword to find your favorite anime
            </p>
          </div>
        )}
      </div>

      {/* Filter Sheet */}
      <FilterSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        filters={filters}
        onApplyFilters={(newFilters) => {
          setFilters(newFilters);
          // Trigger search with new filters if there's a query
          if (query.trim()) {
            handleSearch(query);
          }
        }}
        onResetFilters={() => {
          setFilters({
            resolution: 'any',
            audioType: 'any',
            sortBy: 'relevance',
          });
        }}
      />
    </main>
  );
}
