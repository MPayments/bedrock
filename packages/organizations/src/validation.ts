import { z } from "zod";

export const OrganizationSchema = z.object({
    id: z.string().uuid(),
    externalId: z.string().nullable(),
    customerId: z.string().uuid().nullable(),
    name: z.string(),
    country: z.string().nullable(),
    baseCurrency: z.string(),
    isTreasury: z.boolean(),
    createdAt: z.date(),
});

export type Organization = z.infer<typeof OrganizationSchema>;

export const CreateOrganizationInputSchema = z.object({
    name: z.string().min(1, "name is required"),
    country: z.string().optional(),
    baseCurrency: z.string().min(1).default("USD"),
    externalId: z.string().optional(),
    isTreasury: z.boolean().default(false),
    customerId: z.string().uuid().optional(),
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

export const OrganizationIdParamSchema = z.object({
    id: z.string().uuid(),
});
