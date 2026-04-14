import {
  createSearchParamsCache,
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
} from "nuqs/server";

import { getSortingStateParser } from "@bedrock/sdk-tables-ui/lib/parsers";
import type { ResourceSearchParams } from "@/lib/resources/search-params";

const OPERATIONS_SORTABLE_COLUMNS = ["createdAt", "postingDate", "postedAt"] as const;

const baseSearchParamsCache = createSearchParamsCache({
  page: parseAsInteger.withDefault(1),
  perPage: parseAsInteger.withDefault(10),
  sort: getSortingStateParser<Record<string, unknown>>(
    new Set(OPERATIONS_SORTABLE_COLUMNS),
  ).withDefault([{ id: "createdAt", desc: true }]),
  query: parseAsString.withDefault(""),
  status: parseAsArrayOf(parseAsString).withDefault([]),
  operationCode: parseAsArrayOf(parseAsString).withDefault([]),
  sourceType: parseAsArrayOf(parseAsString).withDefault([]),
  sourceId: parseAsString.withDefault(""),
  bookId: parseAsString.withDefault(""),
});

type RawSearchParams = Record<string, string | string[] | undefined>;

function normalizeDimensionFilters(
  searchParams: RawSearchParams,
): Record<string, string[]> | undefined {
  const entries = Object.entries(searchParams)
    .filter(([key]) => key.startsWith("dimension."))
    .map(([key, rawValue]) => {
      const dimensionKey = key.slice("dimension.".length).trim();
      const values = (Array.isArray(rawValue) ? rawValue : [rawValue])
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean);

      return [dimensionKey, Array.from(new Set(values))] as const;
    })
    .filter(([key, values]) => key.length > 0 && values.length > 0);

  if (entries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(entries);
}

export type OperationsSearchParams = ResourceSearchParams & {
  query?: string;
  status?: string[];
  operationCode?: string[];
  sourceType?: string[];
  sourceId?: string;
  bookId?: string;
  dimensionFilters?: Record<string, string[]>;
};

export const searchParamsCache = {
  async parse(
    searchParams: Promise<RawSearchParams> | RawSearchParams,
  ): Promise<OperationsSearchParams> {
    const resolvedSearchParams = await searchParams;
    const parsed = await baseSearchParamsCache.parse(resolvedSearchParams);

    return {
      ...parsed,
      query: parsed.query || undefined,
      status: parsed.status.length > 0 ? parsed.status : undefined,
      operationCode:
        parsed.operationCode.length > 0 ? parsed.operationCode : undefined,
      sourceType: parsed.sourceType.length > 0 ? parsed.sourceType : undefined,
      sourceId: parsed.sourceId || undefined,
      bookId: parsed.bookId || undefined,
      dimensionFilters: normalizeDimensionFilters(resolvedSearchParams),
    };
  },
};
