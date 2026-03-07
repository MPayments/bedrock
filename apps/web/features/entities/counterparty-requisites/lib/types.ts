import type { ListResult } from "@/features/entities/shared/lib/list-result";
import type {
  RelationOption,
  RequisiteDetails,
  SerializedRequisite,
} from "@/features/entities/requisites-shared/lib/constants";

export type CounterpartyRequisitesListResult = ListResult<SerializedRequisite>;

export type CounterpartyRequisiteDetails = RequisiteDetails;

export type CounterpartyRequisiteFormOptions = {
  owners: RelationOption[];
  currencies: RelationOption[];
};

export type CurrencyFilterOption = {
  value: string;
  label: string;
};
