import { organizations } from "./organizations";
import {
  organizationRequisiteBindings,
  organizationRequisites,
  requisiteKindEnum,
  requisiteOwnerTypeEnum,
} from "./requisites";

export const schema = {
  organizations,
  organizationRequisites,
  organizationRequisiteBindings,
};

export { organizations };
export {
  organizationRequisiteBindings,
  organizationRequisites,
  requisiteKindEnum,
  requisiteOwnerTypeEnum,
};
export type { OrganizationInsert, OrganizationRow } from "./organizations";
export type {
  OrganizationRequisiteBindingInsert,
  OrganizationRequisiteBindingRow,
  OrganizationRequisiteInsert,
  OrganizationRequisiteRow,
} from "./requisites";
