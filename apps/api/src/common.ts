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

export const IdParamSchema = z.object({
  id: z
    .uuid()
    .openapi({
      param: {
        name: "id",
        in: "path",
        example: "00000000-0000-0000-0000-000000000001",
      },
    }),
});
