import { organizations } from "./organizations";
import { organizationRequisiteBindings } from "./requisites";

export const schema = {
  organizations,
  organizationRequisiteBindings,
};

export { organizations };
export { organizationRequisiteBindings };
export type { OrganizationInsert, OrganizationRow } from "./organizations";
export type {
  OrganizationRequisiteBindingInsert,
  OrganizationRequisiteBindingRow,
} from "./requisites";
