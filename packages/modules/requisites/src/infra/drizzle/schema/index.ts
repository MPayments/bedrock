import {
  organizationRequisiteBindings,
  type OrganizationRequisiteBindingInsert,
  type OrganizationRequisiteBindingRow,
} from "./bindings";
import { requisiteKindEnum, requisiteOwnerTypeEnum } from "./enums";
import { requisiteProviders } from "./requisite-providers";
import { requisites } from "./requisites";

export const schema = {
  organizationRequisiteBindings,
  requisites,
  requisiteProviders,
};

export { requisiteKindEnum, requisiteOwnerTypeEnum };
export { organizationRequisiteBindings };
export { requisites };
export { requisiteProviders };
export type {
  OrganizationRequisiteBindingInsert,
  OrganizationRequisiteBindingRow,
};
export type { RequisiteInsert, RequisiteRow } from "./requisites";
export type {
  RequisiteProviderInsert,
  RequisiteProviderRow,
} from "./requisite-providers";
