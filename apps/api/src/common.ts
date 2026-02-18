import { z } from "@hono/zod-openapi";

export const ErrorSchema = z
  .object({
    error: z.string().openapi({ example: "Resource not found" }),
    code: z.string().optional().openapi({ example: "NOT_FOUND" }),
  })
  .openapi("Error");

export const DeletedSchema = z
  .object({
    deleted: z.boolean().openapi({ example: true }),
  })
  .openapi("Deleted");


export const PaginationQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
});