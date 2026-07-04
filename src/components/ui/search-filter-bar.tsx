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

const fieldClassName =
  "h-10 w-full rounded-lg border border-input bg-background/90 px-3 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 sm:w-auto";

function renderFilterField(filter: FilterConfig) {
  if (filter.type === "select") {
    return (
      <select
        value={filter.value}
        onChange={(event) => filter.onChange(event.target.value)}
        className={fieldClassName}
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
      className={`${fieldClassName} placeholder:text-muted-foreground`}
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
    <div className="space-y-4 rounded-lg border border-border/70 bg-card/85 p-4 shadow-sm backdrop-blur md:p-5">
      <div className="flex items-center gap-2 text-sm font-bold text-primary">
        <SlidersHorizontal className="size-4" />
        ตัวกรองและการค้นหา
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-11 w-full rounded-lg border border-input bg-background/90 pl-11 pr-9 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            aria-label="ค้นหา"
          />
          {searchValue && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 transition-colors hover:text-foreground"
              aria-label="ล้างคำค้นหา"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {filters.map((filter) => (
          <div key={filter.key} className="min-w-[160px] sm:w-auto">
            {renderFilterField(filter)}
          </div>
        ))}

        {sortOptions.length > 0 && onSortChange && (
          <div className="min-w-[170px] sm:w-auto">
            <select
              value={sortValue}
              onChange={(event) => onSortChange(event.target.value)}
              className={fieldClassName}
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
          <div className="min-w-[150px] sm:w-auto">
            <select
              value={sortDirection}
              onChange={(event) =>
                onSortDirectionChange(event.target.value as "asc" | "desc")
              }
              className={fieldClassName}
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
            className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "กำลังโหลด..." : "ใช้ตัวกรอง"}
          </button>
        )}

        {onReset && (
          <button
            type="button"
            onClick={onReset}
            disabled={isLoading}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border/70 bg-background/90 px-3 text-xs font-bold text-muted-foreground transition-colors hover:border-border hover:bg-muted/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
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
              className="inline-flex rounded-full border border-border/70 bg-background/90 px-3 py-1 text-xs font-semibold text-foreground"
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
            <span className="font-medium text-amber-700">
              ไม่พบข้อมูลที่ตรงกับเงื่อนไข
            </span>
          ) : (
            <span>
              พบ <span className="font-semibold text-foreground">{filteredCount}</span>{" "}
              รายการ{" "}
              <span className="text-muted-foreground/70">
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
