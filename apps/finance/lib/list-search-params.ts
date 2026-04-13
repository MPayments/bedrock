import {
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  type ParserWithOptionalDefault,
} from "nuqs/server";

import { getSortingStateParser } from "@bedrock/sdk-tables-ui/lib/parsers";
import type { ExtendedColumnSort } from "@bedrock/sdk-tables-ui/lib/types";

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
type FilterQueryValue = string | number | boolean;
type MultiFilterQueryValue = FilterQueryValue[];

interface ListSearchParamsParsers {
  page: ParserWithOptionalDefault<number>;
  perPage: ParserWithOptionalDefault<number>;
  sort: ParserWithOptionalDefault<ExtendedColumnSort<Record<string, unknown>>[]>;
}

interface ContractFilter {
  kind: "string" | "number" | "boolean";
  cardinality: "single" | "multi";
  enumValues?: readonly string[];
  int?: boolean;
  min?: number;
  max?: number;
}

interface ListQueryContractLike {
  sortableColumns: readonly [string, ...string[]];
  defaultSort: {
    id: string;
    desc: boolean;
  };
  filters: Record<string, ContractFilter>;
}

type ListFilterParser =
  | ParserWithOptionalDefault<string>
  | ParserWithOptionalDefault<string[]>;

type StringQueryValue<TFilter extends ContractFilter> =
  TFilter extends {
    kind: "string";
    enumValues: readonly [string, ...string[]];
  }
    ? TFilter["enumValues"][number]
    : string;

type QueryFilterValue<TFilter extends ContractFilter> =
  TFilter["kind"] extends "number"
    ? TFilter["cardinality"] extends "multi"
      ? number[]
      : number
    : TFilter["kind"] extends "boolean"
      ? TFilter["cardinality"] extends "multi"
        ? boolean[]
        : boolean
      : TFilter["cardinality"] extends "multi"
        ? StringQueryValue<TFilter>[]
        : StringQueryValue<TFilter>;

type QueryFiltersFromContract<TContract extends ListQueryContractLike> = Partial<{
  [K in keyof TContract["filters"]]: QueryFilterValue<TContract["filters"][K]>;
}>;

interface ListSearchState {
  page?: number | null;
  perPage?: number | null;
  sort?: SortInput | null;
  [key: string]: unknown;
}

interface ListSortQuery<TSortBy extends string> {
  sortBy?: TSortBy;
  sortOrder?: "asc" | "desc";
}

function createPaginationSearchParamsParsers(defaultPerPage = 10) {
  return {
    page: parseAsInteger.withDefault(1),
    perPage: parseAsInteger.withDefault(defaultPerPage),
  };
}

function createListSearchParamsParsers({
  sortableColumns,
  defaultSort,
  defaultPerPage = 10,
}: ListSearchParamsParsersOptions): ListSearchParamsParsers {
  return {
    ...createPaginationSearchParamsParsers(defaultPerPage),
    sort: getSortingStateParser<Record<string, unknown>>(
      new Set(sortableColumns),
    ).withDefault([defaultSort]),
  };
}

function createContractFilterParsers<TContract extends ListQueryContractLike>(
  contract: TContract,
): Record<keyof TContract["filters"], ListFilterParser> {
  const filterParsers = {} as Record<keyof TContract["filters"], ListFilterParser>;

  for (const key of Object.keys(contract.filters)) {
    const filter = contract.filters[key]!;
    filterParsers[key as keyof TContract["filters"]] =
      filter.cardinality === "multi"
        ? parseAsArrayOf(parseAsString).withDefault([])
        : parseAsString.withDefault("");
  }

  return filterParsers;
}

export function createListSearchParamsParsersFromContract<
  TContract extends ListQueryContractLike,
>(
  contract: TContract,
  options?: {
    defaultPerPage?: number;
  },
): ListSearchParamsParsers & Record<keyof TContract["filters"], ListFilterParser> {
  const baseParsers = createListSearchParamsParsers({
    sortableColumns: contract.sortableColumns,
    defaultSort: {
      id: contract.defaultSort.id,
      desc: contract.defaultSort.desc,
    },
    defaultPerPage: options?.defaultPerPage,
  });

  return {
    ...baseParsers,
    ...createContractFilterParsers(contract),
  };
}

function getListPaginationQuery({ page, perPage }: PaginationSearch) {
  return {
    limit: perPage,
    offset: Math.max(0, (page - 1) * perPage),
  };
}

function getListSortQuery<TSortBy extends string>(
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

function parseSingleFilterValue(
  rawValue: unknown,
  filter: ContractFilter,
): FilterQueryValue | undefined {
  if (typeof rawValue !== "string") {
    return undefined;
  }

  const value = rawValue.trim();
  if (!value) {
    return undefined;
  }

  if (filter.kind === "string") {
    if (filter.enumValues && !filter.enumValues.includes(value)) {
      return undefined;
    }
    return value;
  }

  if (filter.kind === "number") {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return undefined;
    }
    if (filter.int && !Number.isInteger(parsed)) {
      return undefined;
    }
    if (filter.min !== undefined && parsed < filter.min) {
      return undefined;
    }
    if (filter.max !== undefined && parsed > filter.max) {
      return undefined;
    }
    return parsed;
  }

  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return undefined;
}

function parseFilterValue(
  rawValue: unknown,
  filter: ContractFilter,
): FilterQueryValue | MultiFilterQueryValue | undefined {
  if (filter.cardinality === "single") {
    return parseSingleFilterValue(rawValue, filter);
  }

  const rawValues = Array.isArray(rawValue) ? rawValue : [];
  const parsedValues = rawValues
    .map((value) => parseSingleFilterValue(value, filter))
    .filter((value): value is FilterQueryValue => value !== undefined);

  return parsedValues.length > 0 ? parsedValues : undefined;
}

export function createListQueryFromSearchParams<
  TContract extends ListQueryContractLike,
>(
  contract: TContract,
  search: ListSearchState,
): {
  limit: number;
  offset: number;
  sortBy?: TContract["sortableColumns"][number];
  sortOrder?: "asc" | "desc";
} & QueryFiltersFromContract<TContract> {
  const pagination = getListPaginationQuery({
    page: search.page ?? 1,
    perPage: search.perPage ?? 10,
  });

  const sorting = getListSortQuery(
    search.sort ?? [],
    contract.sortableColumns,
  );

  const filterQuery = {} as QueryFiltersFromContract<TContract>;

  for (const key of Object.keys(contract.filters)) {
    const filter = contract.filters[key]!;
    const value = parseFilterValue(search[String(key)], filter);
    if (value !== undefined) {
      filterQuery[key as keyof TContract["filters"]] =
        value as QueryFiltersFromContract<TContract>[keyof TContract["filters"]];
    }
  }

  return {
    ...pagination,
    ...sorting,
    ...filterQuery,
  };
}
