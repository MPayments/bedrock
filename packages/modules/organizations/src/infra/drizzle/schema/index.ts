import { organizations } from "./organizations";
import {
  organizationRequisiteBindings,
  organizationRequisites,
} from "./requisites";

export const schema = {
  organizations,
  organizationRequisites,
  organizationRequisiteBindings,
};

export { organizations };
export { organizationRequisiteBindings, organizationRequisites };
export type { OrganizationInsert, OrganizationRow } from "./organizations";
export type {
  OrganizationRequisiteBindingInsert,
  OrganizationRequisiteBindingRow,
  OrganizationRequisiteInsert,
  OrganizationRequisiteRow,
} from "./requisites";
