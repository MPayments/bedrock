import { z } from "@hono/zod-openapi";

/**
 * Customer entity
 */
export const CustomerSchema = z
  .object({
    id: z.string().uuid().openapi({ example: "550e8400-e29b-41d4-a716-446655440001" }),
    name: z.string().min(1).max(255).openapi({ example: "John Doe" }),
    organizationId: z.string().uuid().openapi({ example: "550e8400-e29b-41d4-a716-446655440000" }),
    createdAt: z.coerce.date().openapi({ example: "2024-01-15T10:30:00Z" }),
    updatedAt: z.coerce.date().openapi({ example: "2024-01-15T10:30:00Z" }),
  })
  .openapi("Customer");

export type Customer = z.infer<typeof CustomerSchema>;

/**
 * Input for creating a customer
 */
export const CreateCustomerInputSchema = z
  .object({
    name: z.string().min(1).max(255).openapi({ example: "John Doe" }),
    organizationId: z.string().uuid().openapi({ example: "550e8400-e29b-41d4-a716-446655440000" }),
    currency: z.string().length(3).default("USD").openapi({ example: "USD" }),
  })
  .openapi("CreateCustomerInput");

export type CreateCustomerInput = z.infer<typeof CreateCustomerInputSchema>;

/**
 * Input for updating a customer
 */
export const UpdateCustomerInputSchema = z
  .object({
    name: z.string().min(1).max(255).optional().openapi({ example: "Jane Doe" }),
  })
  .openapi("UpdateCustomerInput");

export type UpdateCustomerInput = z.infer<typeof UpdateCustomerInputSchema>;

/**
 * Query filters for listing customers
 */
export const ListCustomersQuerySchema = z.object({
  organizationId: z
    .string()
    .uuid()
    .optional()
    .openapi({
      param: { name: "organizationId", in: "query" },
      example: "550e8400-e29b-41d4-a716-446655440000",
    }),
});

export type ListCustomersQuery = z.infer<typeof ListCustomersQuerySchema>;

/**
 * Path parameters
 */
export const CustomerIdParamSchema = z.object({
  id: z.string().uuid().openapi({
    param: { name: "id", in: "path" },
    example: "550e8400-e29b-41d4-a716-446655440001",
  }),
});
