import { z } from "@hono/zod-openapi";

export const OpsIdParamSchema = z.object({
  id: z.coerce
    .number()
    .int()
    .openapi({
      param: {
        name: "id",
        in: "path",
        example: 1,
      },
    }),
});

export const OpsErrorSchema = z
  .object({
    error: z.string().openapi({ example: "Resource not found" }),
  })
  .openapi("OpsError");

export const OpsDeletedSchema = z
  .object({
    deleted: z.boolean().openapi({ example: true }),
  })
  .openapi("OpsDeleted");
