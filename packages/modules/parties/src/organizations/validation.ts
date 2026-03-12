import { z } from "zod";

import {
  CounterpartyKindSchema,
  CountryCodeSchema,
} from "@bedrock/parties/counterparties/validation";
import {
  createListQuerySchemaFromContract,
  type ListQueryContract,
} from "@bedrock/common/pagination";

export const OrganizationSchema = z.object({
  id: z.uuid(),
  externalId: z.string().nullable(),
  shortName: z.string(),
  fullName: z.string(),
  description: z.string().nullable(),
  country: CountryCodeSchema.nullable(),
  kind: CounterpartyKindSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Organization = z.infer<typeof OrganizationSchema>;

const ORGANIZATIONS_SORTABLE_COLUMNS = [
  "shortName",
  "fullName",
  "country",
  "kind",
  "createdAt",
  "updatedAt",
] as const;

interface OrganizationsListFilters {
  shortName: { kind: "string"; cardinality: "single" };
  fullName: { kind: "string"; cardinality: "single" };
  country: { kind: "string"; cardinality: "multi" };
  kind: { kind: "string"; cardinality: "multi" };
}

export const ORGANIZATIONS_LIST_CONTRACT: ListQueryContract<
  typeof ORGANIZATIONS_SORTABLE_COLUMNS,
  OrganizationsListFilters
> = {
  sortableColumns: ORGANIZATIONS_SORTABLE_COLUMNS,
  defaultSort: { id: "createdAt", desc: true },
  filters: {
    shortName: { kind: "string", cardinality: "single" },
    fullName: { kind: "string", cardinality: "single" },
    country: { kind: "string", cardinality: "multi" },
    kind: { kind: "string", cardinality: "multi" },
  },
};

export const ListOrganizationsQuerySchema = createListQuerySchemaFromContract(
  ORGANIZATIONS_LIST_CONTRACT,
);

export type ListOrganizationsQuery = z.infer<typeof ListOrganizationsQuerySchema>;

export const CreateOrganizationInputSchema = z.object({
  shortName: z.string().trim().min(1, "shortName is required"),
  fullName: z.string().trim().min(1, "fullName is required"),
  kind: CounterpartyKindSchema.default("legal_entity"),
  country: CountryCodeSchema.optional(),
  externalId: z.string().trim().optional(),
  description: z.string().trim().optional(),
});

export type CreateOrganizationInput = z.infer<
  typeof CreateOrganizationInputSchema
>;

export const UpdateOrganizationInputSchema = z.object({
  shortName: z.string().trim().min(1).optional(),
  fullName: z.string().trim().min(1).optional(),
  kind: CounterpartyKindSchema.optional(),
  country: CountryCodeSchema.nullable().optional(),
  externalId: z.string().trim().nullable().optional(),
  description: z.string().trim().nullable().optional(),
});

export type UpdateOrganizationInput = z.infer<
  typeof UpdateOrganizationInputSchema
>;
