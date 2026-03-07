import { z } from "zod";

export {
  OrganizationRequisiteSchema,
  OrganizationRequisiteBindingSchema,
  ORGANIZATION_REQUISITES_LIST_CONTRACT,
  ListOrganizationRequisitesQuerySchema,
  CreateOrganizationRequisiteInputSchema,
  UpdateOrganizationRequisiteInputSchema,
  ListOrganizationRequisiteOptionsQuerySchema,
  UpsertOrganizationRequisiteBindingInputSchema,
} from "./validation";

export type {
  OrganizationRequisite,
  OrganizationRequisiteBinding,
  ListOrganizationRequisitesQuery,
  CreateOrganizationRequisiteInput,
  UpdateOrganizationRequisiteInput,
  ListOrganizationRequisiteOptionsQuery,
  UpsertOrganizationRequisiteBindingInput,
} from "./validation";

export const OrganizationRequisiteOptionSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  currencyId: z.uuid(),
  kind: z.string(),
  label: z.string(),
});

export const OrganizationRequisiteOptionsResponseSchema = z.object({
  data: z.array(OrganizationRequisiteOptionSchema),
});

export type OrganizationRequisiteOption = z.infer<
  typeof OrganizationRequisiteOptionSchema
>;
