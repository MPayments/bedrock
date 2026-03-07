import type { ListResult } from "@/features/entities/shared/lib/list-result";
import type {
  RelationOption,
  RequisiteDetails,
  SerializedRequisite,
} from "@/features/entities/requisites-shared/lib/constants";

export type OrganizationRequisitesListResult = ListResult<SerializedRequisite>;

export type OrganizationRequisiteDetails = RequisiteDetails;

export type OrganizationRequisiteFormOptions = {
  owners: RelationOption[];
  providers: RelationOption[];
  currencies: RelationOption[];
};

export type CurrencyFilterOption = {
  value: string;
  label: string;
};
