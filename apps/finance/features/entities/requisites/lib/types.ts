import type { ListResult } from "@/features/entities/shared/lib/list-result";
import type {
  RelationOption,
  RequisiteDetails,
  RequisiteOwnerType,
  SerializedRequisite,
} from "@/features/entities/requisites-shared/lib/constants";
import type { Option } from "@bedrock/sdk-tables-ui/lib/types";

export type RequisitesListResult = ListResult<SerializedRequisite>;

export type RequisitesFilterOptions = {
  providerOptions: Option[];
  currencyOptions: Option[];
};

export type RequisiteFormOptions = {
  counterpartyOwners: RelationOption[];
  organizationOwners: RelationOption[];
  providers: RelationOption[];
  currencies: RelationOption[];
};

export type RequisiteDetailsWithOwnerType = RequisiteDetails & {
  ownerType: RequisiteOwnerType;
};
