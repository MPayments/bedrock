import type {
  RelationOption,
  RequisiteDetails,
} from "@/features/entities/requisites-shared/lib/constants";

export type OrganizationRequisiteDetails = RequisiteDetails;

export type OrganizationRequisiteFormOptions = {
  owners: RelationOption[];
  providers: RelationOption[];
  currencies: RelationOption[];
};
