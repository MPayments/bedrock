import { z } from "@hono/zod-openapi";

/**
 * Organization types
 */
export const OrganizationType = z.enum(["internal", "customer"]).openapi({
  example: "customer",
});
export type OrganizationType = z.infer<typeof OrganizationType>;

/**
 * Organization entity
 */
export const OrganizationSchema = z
  .object({
    id: z.string().uuid().openapi({ example: "550e8400-e29b-41d4-a716-446655440000" }),
    type: OrganizationType,
    name: z.string().min(1).max(255).openapi({ example: "Acme Corp" }),
    createdAt: z.coerce.date().openapi({ example: "2024-01-15T10:30:00Z" }),
    updatedAt: z.coerce.date().openapi({ example: "2024-01-15T10:30:00Z" }),
  })
  .openapi("Organization");

export type Organization = z.infer<typeof OrganizationSchema>;

/**
 * Input for creating an organization
 */
export const CreateOrganizationInputSchema = z
  .object({
    type: OrganizationType,
    name: z.string().min(1).max(255).openapi({ example: "Acme Corp" }),
  })
  .openapi("CreateOrganizationInput");

export type CreateOrganizationInput = z.infer<typeof CreateOrganizationInputSchema>;

/**
 * Input for updating an organization
 */
export const UpdateOrganizationInputSchema = z
  .object({
    name: z.string().min(1).max(255).optional().openapi({ example: "Acme Corporation" }),
  })
  .openapi("UpdateOrganizationInput");

export type UpdateOrganizationInput = z.infer<typeof UpdateOrganizationInputSchema>;

/**
 * Path parameters
 */
export const OrganizationIdParamSchema = z.object({
  id: z.string().uuid().openapi({
    param: { name: "id", in: "path" },
    example: "550e8400-e29b-41d4-a716-446655440000",
  }),
});
