"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";

export type FilterOption = {
  value: string;
  label: string;
};

type BaseFieldConfig = {
  key: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
};

export type SelectFilterConfig = BaseFieldConfig & {
  type: "select";
  options: FilterOption[];
  allLabel?: string;
};

export type InputFilterConfig = BaseFieldConfig & {
  type: "date" | "month" | "number";
  placeholder?: string;
  min?: string;
  max?: string;
  step?: string;
};

export type FilterConfig = SelectFilterConfig | InputFilterConfig;

export type ActiveFilterSummary = {
  key: string;
  label: string;
  value: string;
};

interface SearchFilterBarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters?: FilterConfig[];
  sortOptions?: FilterOption[];
  sortValue?: string;
  onSortChange?: (value: string) => void;
  sortDirection?: "asc" | "desc";
  onSortDirectionChange?: (value: "asc" | "desc") => void;
  totalCount: number;
  filteredCount: number;
  isLoading?: boolean;
  isDirty?: boolean;
  onApply?: () => void;
  onReset?: () => void;
  activeFilters?: ActiveFilterSummary[];
}

function renderFilterField(filter: FilterConfig) {
  if (filter.type === "select") {
    return (
      <select
        value={filter.value}
        onChange={(event) => filter.onChange(event.target.value)}
        className="h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:w-auto"
        aria-label={filter.label}
      >
        <option value="">
          {filter.allLabel ?? `ทั้งหมด (${filter.label})`}
        </option>
        {filter.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      type={filter.type}
      value={filter.value}
      onChange={(event) => filter.onChange(event.target.value)}
      placeholder={filter.placeholder}
      min={filter.min}
      max={filter.max}
      step={filter.step}
      aria-label={filter.label}
      className="h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:w-auto"
    />
  );
}

export function SearchFilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "ค้นหา...",
  filters = [],
  sortOptions = [],
  sortValue = "",
  onSortChange,
  sortDirection = "desc",
  onSortDirectionChange,
  totalCount,
  filteredCount,
  isLoading = false,
  isDirty = false,
  onApply,
  onReset,
  activeFilters = [],
}: SearchFilterBarProps) {
  const hasActiveFilters =
    searchValue.trim() !== "" || activeFilters.length > 0;

  return (
    <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-3 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-8 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            aria-label="ค้นหา"
          />
          {searchValue && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 transition-colors hover:text-foreground"
              aria-label="ล้างคำค้นหา"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {filters.map((filter) => (
          <div key={filter.key} className="min-w-[150px] sm:w-auto">
            {renderFilterField(filter)}
          </div>
        ))}

        {sortOptions.length > 0 && onSortChange && (
          <div className="min-w-[160px] sm:w-auto">
            <select
              value={sortValue}
              onChange={(event) => onSortChange(event.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:w-auto"
              aria-label="เรียงตาม"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {onSortDirectionChange && (
          <div className="min-w-[130px] sm:w-auto">
            <select
              value={sortDirection}
              onChange={(event) =>
                onSortDirectionChange(event.target.value as "asc" | "desc")
              }
              className="h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:w-auto"
              aria-label="ทิศทางการเรียง"
            >
              <option value="desc">มากไปน้อย / ใหม่ไปเก่า</option>
              <option value="asc">น้อยไปมาก / เก่าไปใหม่</option>
            </select>
          </div>
        )}

        {onApply && (
          <button
            type="button"
            onClick={onApply}
            disabled={isLoading || !isDirty}
            className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "กำลังโหลด..." : "ใช้ตัวกรอง"}
          </button>
        )}

        {onReset && (
          <button
            type="button"
            onClick={onReset}
            disabled={isLoading}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border/60 bg-background px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-border hover:bg-muted/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            <X className="h-3.5 w-3.5" />
            ล้างตัวกรอง
          </button>
        )}
      </div>

      {activeFilters.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {activeFilters.map((filter) => (
            <span
              key={filter.key}
              className="inline-flex rounded-full border border-border/60 bg-background px-2.5 py-1 text-xs text-foreground"
            >
              {filter.label}: {filter.value}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <SlidersHorizontal className="h-3 w-3" />
        {isLoading ? (
          <span className="font-medium">กำลังอัปเดตรายการ...</span>
        ) : hasActiveFilters ? (
          filteredCount === 0 ? (
            <span className="font-medium text-amber-600">
              ไม่พบข้อมูลที่ตรงกับเงื่อนไข
            </span>
          ) : (
            <span>
              พบ <span className="font-semibold text-foreground">{filteredCount}</span>{" "}
              รายการ{" "}
              <span className="text-muted-foreground/60">
                (จากทั้งหมด {totalCount} รายการ)
              </span>
            </span>
          )
        ) : (
          <span>
            ทั้งหมด{" "}
            <span className="font-semibold text-foreground">{totalCount}</span>{" "}
            รายการ
          </span>
        )}
      </div>
    </div>
  );
}
