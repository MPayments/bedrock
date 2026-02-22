import { createSearchParamsCache } from "nuqs/server";
import { ORGANIZATIONS_LIST_CONTRACT } from "@bedrock/organizations/validation";

import { createListSearchParamsParsersFromContract } from "@/lib/list-search-params";

export const searchParamsCache = createSearchParamsCache({
  ...createListSearchParamsParsersFromContract(ORGANIZATIONS_LIST_CONTRACT),
});

export type OrganizationsSearchParams = Awaited<
  ReturnType<typeof searchParamsCache.parse>
>;
