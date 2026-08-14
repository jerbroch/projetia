"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { searchArchivesForAutocomplete } from "@/lib/job-search";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Customer, Employee, ScheduleEvent } from "@/types";
import { buildArchiveSearchContext } from "@/lib/job-search";

const DEBOUNCE_MS = 300;
const MIN_AUTOCOMPLETE_CHARS = 3;

interface ArchivesSearchBarProps {
  events: ScheduleEvent[];
  customers: Customer[];
  employees: Employee[];
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  onClearSearch: () => void;
}

export function ArchivesSearchBar({
  events,
  customers,
  employees,
  searchQuery,
  onSearchQueryChange,
  onClearSearch,
}: ArchivesSearchBarProps) {
  const [inputValue, setInputValue] = useState(searchQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchContext = buildArchiveSearchContext(customers);

  useEffect(() => {
    setInputValue(searchQuery);
    setDebouncedQuery(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(inputValue);
      onSearchQueryChange(inputValue);
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [inputValue, onSearchQueryChange]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setSuggestionsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const suggestions =
    debouncedQuery.length >= MIN_AUTOCOMPLETE_CHARS
      ? searchArchivesForAutocomplete(events, debouncedQuery, searchContext, employees)
      : [];

  const showSuggestions = suggestionsOpen && debouncedQuery.length >= MIN_AUTOCOMPLETE_CHARS;

  function handleClear() {
    setInputValue("");
    setDebouncedQuery("");
    onClearSearch();
    setSuggestionsOpen(false);
  }

  return (
    <div className="mb-4">
      <div ref={containerRef} className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setSuggestionsOpen(true);
          }}
          onFocus={() => setSuggestionsOpen(true)}
          placeholder="Rechercher par no. contrat, BT, P.O., client, adresse ou employé…"
          className="pl-8 pr-8"
          aria-label="Rechercher dans les archives"
          aria-expanded={showSuggestions}
          aria-autocomplete="list"
        />
        {inputValue && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
            aria-label="Effacer la recherche"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {showSuggestions && (
          <ul
            role="listbox"
            className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover py-1 text-popover-foreground shadow-md"
          >
            {suggestions.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">Aucun résultat</li>
            ) : (
              suggestions.map((suggestion) => (
                <li key={suggestion.id} role="option" aria-selected={false}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full flex-col items-start px-3 py-2 text-left text-sm",
                      "hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:outline-none"
                    )}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setInputValue(suggestion.label);
                      setDebouncedQuery(suggestion.label);
                      onSearchQueryChange(suggestion.label);
                      setSuggestionsOpen(false);
                    }}
                  >
                    <span className="font-medium">{suggestion.label}</span>
                    {suggestion.sublabel && (
                      <span className="text-xs text-muted-foreground">{suggestion.sublabel}</span>
                    )}
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
