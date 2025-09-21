import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Loader2, Search } from "lucide-react";

import { cn } from "../../lib/utils";

export interface AutocompleteOption {
  value: string;
  label: string;
  description?: string;
}

interface AutocompleteProps {
  value: string | null;
  onChange: (option: AutocompleteOption | null) => void;
  query: string;
  onQueryChange: (value: string) => void;
  items: AutocompleteOption[];
  isLoading?: boolean;
  placeholder?: string;
  emptyMessage?: string;
}

type MenuPosition = {
  top: number;
  left: number;
  width: number;
};

const INITIAL_POSITION: MenuPosition = { top: 0, left: 0, width: 0 };

export function Autocomplete({
  value,
  onChange,
  query,
  onQueryChange,
  items,
  isLoading,
  placeholder = "Search for an anime…",
  emptyMessage = "No matches found. Try another title.",
}: AutocompleteProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition>(INITIAL_POSITION);
  const [activeIndex, setActiveIndex] = useState<number>(-1);

  const selectedOption = useMemo(
    () => (value ? items.find((option) => option.value === value) ?? null : null),
    [items, value]
  );

  const displayLabel = selectedOption?.label || query || placeholder;

  const updatePosition = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    setPosition({
      top: rect.bottom + window.scrollY + 4,
      left: rect.left + window.scrollX,
      width: rect.width,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    const handle = () => updatePosition();
    window.addEventListener("resize", handle);
    window.addEventListener("scroll", handle, true);
    return () => {
      window.removeEventListener("resize", handle);
      window.removeEventListener("scroll", handle, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (containerRef.current && !containerRef.current.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((prev) => {
          const next = prev + 1;
          return next >= items.length ? 0 : next;
        });
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((prev) => {
          const next = prev - 1;
          return next < 0 ? items.length - 1 : next;
        });
      } else if (event.key === "Enter") {
        if (open && activeIndex >= 0 && activeIndex < items.length) {
          event.preventDefault();
          onChange(items[activeIndex]);
          setOpen(false);
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, activeIndex, items, onChange]);

  useEffect(() => {
    if (!open) return;
    // ensure highlighted item resets when list changes
    setActiveIndex(items.length > 0 ? 0 : -1);
  }, [items, open]);

  const handleInputFocus = () => {
    setOpen(true);
    setTimeout(updatePosition, 0);
  };

  const handleOptionClick = (option: AutocompleteOption) => {
    onChange(option);
    setOpen(false);
  };

  const renderedMenu = open ? (
    <DropdownMenu
      position={position}
      items={items}
      activeIndex={activeIndex}
      onSelect={handleOptionClick}
      emptyMessage={emptyMessage}
      isLoading={isLoading}
    />
  ) : null;

  return (
    <div className="relative" ref={containerRef}>
      <label className="sr-only">Anime</label>
      <div
        className={cn(
          "flex h-12 w-full items-center gap-3 rounded-2xl border border-white/15",
          "bg-gradient-to-br from-white/12 via-white/6 to-transparent px-4 text-left text-sm text-foreground",
          "shadow-[0_15px_45px_-25px_rgba(139,92,246,0.55)] backdrop-blur-2xl",
          "focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-[#ec4899] focus-within:ring-offset-background"
        )}
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-primary/40 via-pink-500/40 to-cyan-400/40 text-primary shadow-inner">
          <Search className="h-4 w-4" />
        </span>
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onFocus={handleInputFocus}
          onClick={handleInputFocus}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : null}
      </div>
      {createPortal(renderedMenu, document.body)}
    </div>
  );
}

interface DropdownMenuProps {
  position: MenuPosition;
  items: AutocompleteOption[];
  activeIndex: number;
  onSelect: (option: AutocompleteOption) => void;
  emptyMessage: string;
  isLoading?: boolean;
}

function DropdownMenu({ position, items, activeIndex, onSelect, emptyMessage, isLoading }: DropdownMenuProps) {
  const style: React.CSSProperties = {
    position: "absolute",
    top: position.top,
    left: position.left,
    width: Math.min(position.width, window.innerWidth - position.left - 12),
    zIndex: 9999,
  };

  return (
    <div
      style={style}
      className="overflow-hidden rounded-2xl border border-white/12 bg-[#0b061d]/95 shadow-[0_30px_90px_-50px_rgba(59,130,246,0.85)] backdrop-blur-2xl"
    >
      <div className="max-h-72 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center gap-2 px-4 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Searching…
          </div>
        ) : items.length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted-foreground">{emptyMessage}</div>
        ) : (
          items.map((option, index) => (
            <button
              key={option.value}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onSelect(option)}
              className={cn(
                "flex w-full flex-col items-start gap-1 px-4 py-3 text-left text-sm text-foreground transition",
                index === activeIndex
                  ? "bg-gradient-to-r from-primary/30 via-pink-500/30 to-cyan-400/30 text-white"
                  : "hover:bg-white/10"
              )}
            >
              <span className="font-semibold">{option.label}</span>
              {option.description && (
                <span className="text-xs text-muted-foreground">{option.description}</span>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
