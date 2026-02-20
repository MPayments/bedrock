import {
  parseAsInteger,
  type ParserWithOptionalDefault,
} from "nuqs/server";

import { getSortingStateParser } from "@/lib/parsers";
import type { ExtendedColumnSort } from "@/types/data-table";

interface ListSearchParamsParsersOptions {
  sortableColumns: readonly string[];
  defaultSort: ExtendedColumnSort<Record<string, unknown>>;
  defaultPerPage?: number;
}

interface PaginationSearch {
  page: number;
  perPage: number;
}

type SortInput = ReadonlyArray<{ id: string; desc: boolean }>;

interface ListSearchParamsParsers {
  page: ParserWithOptionalDefault<number>;
  perPage: ParserWithOptionalDefault<number>;
  sort: ParserWithOptionalDefault<ExtendedColumnSort<Record<string, unknown>>[]>;
}

interface ListSortQuery<TSortBy extends string> {
  sortBy?: TSortBy;
  sortOrder?: "asc" | "desc";
}

export function createListSearchParamsParsers({
  sortableColumns,
  defaultSort,
  defaultPerPage = 10,
}: ListSearchParamsParsersOptions): ListSearchParamsParsers {
  return {
    page: parseAsInteger.withDefault(1),
    perPage: parseAsInteger.withDefault(defaultPerPage),
    sort: getSortingStateParser<Record<string, unknown>>(
      new Set(sortableColumns),
    ).withDefault([defaultSort]),
  };
}

export function getListPaginationQuery({ page, perPage }: PaginationSearch) {
  return {
    limit: perPage,
    offset: Math.max(0, (page - 1) * perPage),
  };
}

export function getListSortQuery<TSortBy extends string>(
  sort: SortInput,
  sortableColumns: readonly TSortBy[],
): ListSortQuery<TSortBy> {
  const firstSort = sort[0];
  if (!firstSort) {
    return {
      sortBy: undefined,
      sortOrder: undefined,
    };
  }

  const sortBy = firstSort.id as TSortBy;
  if (!sortableColumns.includes(sortBy)) {
    return {
      sortBy: undefined,
      sortOrder: undefined,
    };
  }

  return {
    sortBy,
    sortOrder: firstSort.desc ? "desc" : "asc",
  };
}
