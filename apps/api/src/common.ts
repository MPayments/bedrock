import { z } from "@hono/zod-openapi";

/**
 * Common error response schema
 */
export const ErrorSchema = z
  .object({
    error: z.string().openapi({ example: "Resource not found" }),
    code: z.string().optional().openapi({ example: "NOT_FOUND" }),
  })
  .openapi("Error");

/**
 * Success response for delete operations
 */
export const DeletedSchema = z
  .object({
    deleted: z.boolean().openapi({ example: true }),
  })
  .openapi("Deleted");
