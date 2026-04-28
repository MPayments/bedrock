import { createSearchParamsCache } from "nuqs/server";
import {
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
} from "nuqs/server";

const searchParsers = {
  batchId: parseAsString.withDefault(""),
  createdAt: parseAsArrayOf(parseAsString).withDefault([]),
  currencyId: parseAsString.withDefault(""),
  dealId: parseAsString.withDefault(""),
  page: parseAsInteger.withDefault(1),
  perPage: parseAsInteger.withDefault(10),
  purpose: parseAsString.withDefault(""),
  state: parseAsArrayOf(parseAsString).withDefault([]),
  view: parseAsString.withDefault("runtime"),
};

export const searchParamsCache = createSearchParamsCache(searchParsers);

export type TreasuryOperationsSearchParams = {
  batchId?: string;
  createdAt?: string[];
  currencyId?: string;
  dealId?: string;
  page?: number;
  perPage?: number;
  purpose?: string;
  state?: string[];
  view?: string;
};
