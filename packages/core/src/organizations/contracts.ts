import { z } from "zod";

export {
  OrganizationSchema,
  ORGANIZATIONS_LIST_CONTRACT,
  ListOrganizationsQuerySchema,
  CreateOrganizationInputSchema,
  UpdateOrganizationInputSchema,
} from "./validation";

export type {
  Organization,
  ListOrganizationsQuery,
  CreateOrganizationInput,
  UpdateOrganizationInput,
} from "./validation";

export const OrganizationOptionSchema = z.object({
  id: z.uuid(),
  shortName: z.string(),
  label: z.string(),
});

export const OrganizationOptionsResponseSchema = z.object({
  data: z.array(OrganizationOptionSchema),
});

export type OrganizationOption = z.infer<typeof OrganizationOptionSchema>;
