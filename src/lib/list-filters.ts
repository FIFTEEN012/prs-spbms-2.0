import { z } from "zod";

export type SearchParamValue = string | string[] | undefined;
export type SearchParamsSource =
  | URLSearchParams
  | Record<string, SearchParamValue>;

export type SortDirection = "asc" | "desc";

export type PaginatedResult<TData, TFilters> = {
  data: TData[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  filters: TFilters;
};

const pageSchema = z.coerce.number().int().min(1).catch(1);
const limitSchema = z.coerce.number().int().min(1).max(100).catch(10);

export const sortDirectionSchema = z
  .enum(["asc", "desc"])
  .catch("desc");

const optionalTrimmedString = z
  .string()
  .transform((value) => value.trim())
  .transform((value) => (value === "" ? undefined : value))
  .optional();

export function getFirstSearchParamValue(
  value: SearchParamValue,
): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export function searchParamsToRecord(
  source: SearchParamsSource,
): Record<string, string | undefined> {
  if (source instanceof URLSearchParams) {
    const entries = Array.from(source.entries());
    return Object.fromEntries(entries);
  }

  return Object.fromEntries(
    Object.entries(source).map(([key, value]) => [
      key,
      getFirstSearchParamValue(value),
    ]),
  );
}

export function parsePaginationParams(source: SearchParamsSource) {
  const record = searchParamsToRecord(source);

  return {
    page: pageSchema.parse(record.page),
    limit: limitSchema.parse(record.limit),
  };
}

export function createSortBySchema<TSortField extends string>(
  allowedSortFields: readonly [TSortField, ...TSortField[]],
  defaultSortField: TSortField,
) {
  return z.enum(allowedSortFields).catch(defaultSortField);
}

export function parseOptionalStringParam(
  source: SearchParamsSource,
  key: string,
) {
  return optionalTrimmedString.parse(searchParamsToRecord(source)[key]);
}

export function parseOptionalNumberParam(
  source: SearchParamsSource,
  key: string,
) {
  const raw = parseOptionalStringParam(source, key);
  if (!raw) return undefined;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return undefined;
  }

  return parsed;
}

export function parseOptionalDateParam(
  source: SearchParamsSource,
  key: string,
  parser: (value: string | undefined | null) => Date | null,
) {
  const raw = parseOptionalStringParam(source, key);
  if (!raw) return undefined;

  return parser(raw) ?? undefined;
}

export function parseOptionalMonthParam(
  source: SearchParamsSource,
  key: string,
) {
  const raw = parseOptionalStringParam(source, key);
  if (!raw) return undefined;

  return /^\d{4}-\d{2}$/.test(raw) ? raw : undefined;
}

export function buildPaginatedResult<TData, TFilters>({
  data,
  total,
  page,
  limit,
  filters,
}: {
  data: TData[];
  total: number;
  page: number;
  limit: number;
  filters: TFilters;
}): PaginatedResult<TData, TFilters> {
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return {
    data,
    total,
    page: Math.min(page, totalPages),
    limit,
    totalPages,
    filters,
  };
}

export function getPaginationSkip(page: number, limit: number) {
  return (page - 1) * limit;
}
