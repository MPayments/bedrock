import { createSearchParamsCache } from "nuqs/server";
import {
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
} from "nuqs/server";

const searchParsers = {
  batchId: parseAsString.withDefault(""),
  createdAt: parseAsArrayOf(parseAsString).withDefault([]),
  dealId: parseAsString.withDefault(""),
  page: parseAsInteger.withDefault(1),
  perPage: parseAsInteger.withDefault(10),
  purpose: parseAsString.withDefault(""),
  state: parseAsArrayOf(parseAsString).withDefault([]),
};

export const searchParamsCache = createSearchParamsCache(searchParsers);

export type TreasuryOperationsSearchParams = {
  batchId?: string;
  createdAt?: string[];
  dealId?: string;
  page?: number;
  perPage?: number;
  purpose?: string;
  state?: string[];
};
