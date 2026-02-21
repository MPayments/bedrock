import { z } from "zod";

import {
    createListQuerySchemaFromContract,
    type ListQueryContract,
} from "@bedrock/kernel/pagination";

export const OrganizationSchema = z.object({
    id: z.uuid(),
    externalId: z.string().nullable(),
    customerId: z.uuid().nullable(),
    name: z.string(),
    country: z.string().nullable(),
    baseCurrency: z.string(),
    isTreasury: z.coerce.boolean(),
    createdAt: z.date(),
    updatedAt: z.date(),
});

export type Organization = z.infer<typeof OrganizationSchema>;

const ORGANIZATIONS_SORTABLE_COLUMNS = [
    "name",
    "country",
    "baseCurrency",
    "createdAt",
    "updatedAt",
] as const;

interface OrganizationsListFilters {
    name: { kind: "string"; cardinality: "single" };
    country: { kind: "string"; cardinality: "single" };
    baseCurrency: { kind: "string"; cardinality: "multi" };
    isTreasury: { kind: "boolean"; cardinality: "single" };
}

export const ORGANIZATIONS_LIST_CONTRACT: ListQueryContract<
    typeof ORGANIZATIONS_SORTABLE_COLUMNS,
    OrganizationsListFilters
> = {
    sortableColumns: ORGANIZATIONS_SORTABLE_COLUMNS,
    defaultSort: { id: "createdAt", desc: true },
    filters: {
        name: { kind: "string", cardinality: "single" },
        country: { kind: "string", cardinality: "single" },
        baseCurrency: { kind: "string", cardinality: "multi" },
        isTreasury: { kind: "boolean", cardinality: "single" },
    },
};

export const ListOrganizationsQuerySchema = createListQuerySchemaFromContract(
    ORGANIZATIONS_LIST_CONTRACT,
);

export type ListOrganizationsQuery = z.infer<typeof ListOrganizationsQuerySchema>;

export const CreateOrganizationInputSchema = z.object({
    name: z.string().min(1, "name is required"),
    country: z.string().optional(),
    baseCurrency: z.string().min(1).default("USD"),
    externalId: z.string().optional(),
    isTreasury: z.boolean().default(false),
    customerId: z.uuid().optional(),
}).refine(
    (data) => data.isTreasury === true || data.customerId != null,
    { message: "customerId is required when isTreasury is false" },
);

export type CreateOrganizationInput = z.infer<typeof CreateOrganizationInputSchema>;

export const UpdateOrganizationInputSchema = z.object({
    name: z.string().min(1).optional(),
    country: z.string().nullable().optional(),
    baseCurrency: z.string().min(1).optional(),
    externalId: z.string().nullable().optional(),
});

export type UpdateOrganizationInput = z.infer<typeof UpdateOrganizationInputSchema>;
