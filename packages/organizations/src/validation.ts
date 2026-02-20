import { z } from "zod";

import { PaginationInputSchema, SortInputSchema } from "@bedrock/kernel/pagination";

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

const SORTABLE_COLUMNS = ["name", "country", "baseCurrency", "createdAt", "updatedAt"] as const;

export const ListOrganizationsQuerySchema = PaginationInputSchema
    .extend(SortInputSchema.shape)
    .extend({
        sortBy: z.enum(SORTABLE_COLUMNS).optional(),
        name: z.string().optional(),
        country: z.string().optional(),
        baseCurrency: z.string().optional(),
        isTreasury: z.coerce.boolean().optional(),
    });

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
