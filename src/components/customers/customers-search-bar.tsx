"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { searchCustomersForAutocomplete, type CustomerSearchSuggestion } from "@/lib/quote-search";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Customer } from "@/types";

const DEBOUNCE_MS = 300;
const MIN_AUTOCOMPLETE_CHARS = 3;

interface CustomersSearchBarProps {
  customers: Customer[];
  searchQuery: string;
  selectedCustomerId: string | null;
  onSearchQueryChange: (query: string) => void;
  onSelectCustomer: (customerId: string) => void;
  onClearFilter: () => void;
}

export function CustomersSearchBar({
  customers,
  searchQuery,
  selectedCustomerId,
  onSearchQueryChange,
  onSelectCustomer,
  onClearFilter,
}: CustomersSearchBarProps) {
  const [inputValue, setInputValue] = useState(searchQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const suggestions: CustomerSearchSuggestion[] =
    debouncedQuery.length >= MIN_AUTOCOMPLETE_CHARS && !selectedCustomerId
      ? searchCustomersForAutocomplete(customers, debouncedQuery)
      : [];

  const showSuggestions =
    suggestionsOpen &&
    !selectedCustomerId &&
    debouncedQuery.length >= MIN_AUTOCOMPLETE_CHARS;

  function handleInputChange(value: string) {
    setInputValue(value);
    setSuggestionsOpen(true);
    if (selectedCustomerId) {
      onClearFilter();
    }
  }

  function handleSelectSuggestion(suggestion: CustomerSearchSuggestion) {
    setInputValue(suggestion.name);
    setDebouncedQuery(suggestion.name);
    onSearchQueryChange(suggestion.name);
    onSelectCustomer(suggestion.id);
    setSuggestionsOpen(false);
  }

  function handleClear() {
    setInputValue("");
    setDebouncedQuery("");
    onClearFilter();
    setSuggestionsOpen(false);
  }

  const isFiltered = Boolean(selectedCustomerId || searchQuery.trim());

  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div ref={containerRef} className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => setSuggestionsOpen(true)}
            placeholder="Rechercher par nom ou adresse…"
            className="pl-8 pr-8"
            aria-label="Rechercher des clients"
            aria-expanded={showSuggestions}
            aria-autocomplete="list"
            data-testid="customers-search-input"
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
              data-testid="customers-search-suggestions"
              className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover py-1 text-popover-foreground shadow-md"
            >
              {suggestions.length === 0 ? (
                <li className="px-3 py-2 text-sm text-muted-foreground">Aucun client trouvé</li>
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
                      onClick={() => handleSelectSuggestion(suggestion)}
                    >
                      <span className="font-medium">{suggestion.name}</span>
                      {suggestion.address && (
                        <span className="text-xs text-muted-foreground">{suggestion.address}</span>
                      )}
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>

        {isFiltered && (
          <Button variant="outline" onClick={handleClear} className="shrink-0">
            Tous les clients
          </Button>
        )}
      </div>
    </div>
  );
}
