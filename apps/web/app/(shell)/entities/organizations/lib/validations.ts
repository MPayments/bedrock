import {
  createSearchParamsCache,
  parseAsArrayOf,
  parseAsString,
  parseAsStringEnum,
} from "nuqs/server";

import { createListSearchParamsParsers } from "@/lib/list-search-params";

export const ORGANIZATIONS_SORTABLE_COLUMNS = [
  "name",
  "country",
  "baseCurrency",
  "createdAt",
  "updatedAt",
] as const;

export const searchParamsCache = createSearchParamsCache({
  ...createListSearchParamsParsers({
    sortableColumns: ORGANIZATIONS_SORTABLE_COLUMNS,
    defaultSort: { id: "createdAt", desc: true },
  }),
  name: parseAsString.withDefault(""),
  country: parseAsString.withDefault(""),
  baseCurrency: parseAsArrayOf(parseAsString).withDefault([]),
  isTreasury: parseAsArrayOf(
    parseAsStringEnum(["true", "false"]),
  ).withDefault([]),
});

export type OrganizationsSearchParams = Awaited<
  ReturnType<typeof searchParamsCache.parse>
>;
