import type { ListResult } from "@/features/entities/shared/lib/list-result";
import type { SerializedRequisite } from "@/features/entities/requisites-shared/lib/constants";
import type { Option } from "@/types/data-table";

export type RequisitesListResult = ListResult<SerializedRequisite>;

export type RequisitesFilterOptions = {
  providerOptions: Option[];
  currencyOptions: Option[];
};
