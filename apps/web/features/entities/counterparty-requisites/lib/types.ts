import type {
  RelationOption,
  RequisiteDetails,
} from "@/features/entities/requisites-shared/lib/constants";

export type CounterpartyRequisiteDetails = RequisiteDetails;

export type CounterpartyRequisiteFormOptions = {
  owners: RelationOption[];
  providers: RelationOption[];
  currencies: RelationOption[];
};
