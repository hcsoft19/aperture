"use client";

import { Check, ChevronDown, Plus, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCatalogOption } from "@/features/catalog/actions";
import {
  type CatalogOption,
  type CatalogOptionType,
  getMaxLength,
} from "@/features/catalog/schemas";

interface CatalogComboboxProps {
  type: CatalogOptionType;
  label: string;
  options: CatalogOption[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  placeholder?: string;
}

export function CatalogCombobox({
  type,
  label,
  options,
  value,
  onChange,
  error,
  required = false,
  placeholder = "Select or type to create...",
}: CatalogComboboxProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isPending, startTransition] = useTransition();
  const [createError, setCreateError] = useState<string | null>(null);

  const maxLength = getMaxLength(type);

  const filteredOptions = useMemo(() => {
    if (!search) return options;
    const normalized = search.toLowerCase().trim();
    return options.filter((opt) =>
      opt.displayName.toLowerCase().includes(normalized),
    );
  }, [options, search]);

  const exactMatch = useMemo(() => {
    const normalized = search.toLowerCase().trim();
    return options.some((opt) => opt.displayName.toLowerCase() === normalized);
  }, [options, search]);

  const canCreate = search.trim().length > 0 && !exactMatch;

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const next = event.target.value;
      setSearch(next);
      onChange(next.trim());
      if (!isOpen) setIsOpen(true);
      setHighlightedIndex(-1);
      setCreateError(null);
    },
    [isOpen, onChange],
  );

  const handleSelect = useCallback(
    (displayName: string) => {
      onChange(displayName);
      setSearch("");
      setIsOpen(false);
      setHighlightedIndex(-1);
      setCreateError(null);
    },
    [onChange],
  );

  const handleCreate = useCallback(() => {
    if (!canCreate || isPending) return;

    const trimmed = search.trim();
    if (trimmed.length > maxLength) {
      setCreateError(`Use ${maxLength} characters or fewer.`);
      return;
    }

    startTransition(async () => {
      setCreateError(null);
      const result = await createCatalogOption({ type, displayName: trimmed });

      if (result.status === "error") {
        setCreateError(result.message);
        return;
      }

      handleSelect(result.option.displayName);
    });
  }, [canCreate, isPending, search, maxLength, type, handleSelect]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          setIsOpen(true);
          e.preventDefault();
        }
        return;
      }

      const itemCount = filteredOptions.length + (canCreate ? 1 : 0);

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev < itemCount - 1 ? prev + 1 : 0,
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev > 0 ? prev - 1 : itemCount - 1,
          );
          break;
        case "Enter": {
          const suggestionHighlighted =
            highlightedIndex >= 0 && highlightedIndex < filteredOptions.length;
          if (suggestionHighlighted) {
            e.preventDefault();
            handleSelect(filteredOptions[highlightedIndex].displayName);
            break;
          }
          if (canCreate && highlightedIndex === filteredOptions.length) {
            e.preventDefault();
            handleCreate();
          }
          break;
        }
        case "Escape":
          e.preventDefault();
          setIsOpen(false);
          setHighlightedIndex(-1);
          break;
        case "Tab":
          setIsOpen(false);
          setHighlightedIndex(-1);
          break;
      }
    },
    [isOpen, filteredOptions, canCreate, highlightedIndex, handleSelect, handleCreate],
  );

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightedIndex] as HTMLElement;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex]);

  const handleClear = useCallback(() => {
    onChange("");
    setSearch("");
    inputRef.current?.focus();
  }, [onChange]);

  return (
    <div ref={containerRef} className="relative flex flex-col gap-2">
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>

      <div className="relative">
        <Input
          ref={inputRef}
          id={id}
          type="text"
          value={isOpen ? search : value}
          onChange={handleInputChange}
          onFocus={() => {
            setSearch(value);
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-controls={`${id}-listbox`}
          role="combobox"
          autoComplete="off"
          className="pr-16"
        />

        <div className="absolute inset-y-0 right-0 flex items-center gap-1 pr-2">
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="rounded p-1 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Clear selection"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </div>
      </div>

      {isOpen && (
        <ul
          ref={listRef}
          id={`${id}-listbox`}
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-auto rounded-lg border border-input bg-card shadow-lg"
        >
          {filteredOptions.length === 0 && !canCreate && (
            <li className="px-3 py-2 text-sm text-muted-foreground">
              No options found
            </li>
          )}

          {filteredOptions.map((option, index) => (
            <li
              key={option.id}
              role="option"
              aria-selected={option.displayName === value}
              className={`flex min-h-11 cursor-pointer items-center gap-2 px-3 py-2 text-base ${
                highlightedIndex === index ? "bg-muted" : ""
              } ${option.displayName === value ? "font-medium" : ""}`}
              onClick={() => handleSelect(option.displayName)}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              <span className="w-4">
                {option.displayName === value && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </span>
              <span className="flex-1">{option.displayName}</span>
            </li>
          ))}

          {canCreate && (
            <li
              role="option"
              aria-selected={false}
              className={`flex min-h-11 cursor-pointer items-center gap-2 border-t border-input px-3 py-2 text-base ${
                highlightedIndex === filteredOptions.length ? "bg-muted" : ""
              }`}
              onClick={handleCreate}
              onMouseEnter={() => setHighlightedIndex(filteredOptions.length)}
            >
              <Plus className="h-4 w-4 text-primary" />
              <span>
                Create{" "}
                <span className="font-medium">&ldquo;{search.trim()}&rdquo;</span>
              </span>
              {isPending && (
                <span className="ml-auto text-sm text-muted-foreground">
                  Creating...
                </span>
              )}
            </li>
          )}
        </ul>
      )}

      {(error || createError) && (
        <p
          id={`${id}-error`}
          className="text-sm text-destructive"
          role="alert"
        >
          {error || createError}
        </p>
      )}
    </div>
  );
}
