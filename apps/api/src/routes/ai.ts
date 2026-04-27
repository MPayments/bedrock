import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";

const TranslateFieldsRequestSchema = z.object({
  fields: z.record(z.string(), z.string()),
  fromLang: z.string().min(1).optional(),
  toLang: z.string().min(1).optional(),
});

const TranslateFieldsResponseSchema = z.record(z.string(), z.string());

export function aiRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  const translateRoute = createRoute({
    method: "post",
    path: "/translate",
    request: {
      body: {
        content: {
          "application/json": {
            schema: TranslateFieldsRequestSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": { schema: TranslateFieldsResponseSchema },
        },
        description: "Translated fields",
      },
      503: {
        content: {
          "application/json": {
            schema: z.object({ error: z.string() }),
          },
        },
        description: "AI translation not configured",
      },
    },
    summary: "Translate a map of string fields between languages",
    tags: ["AI"],
  });

  return app.openapi(translateRoute, async (c): Promise<any> => {
    if (!ctx.documentExtraction) {
      return c.json({ error: "AI translation not configured" }, 503);
    }

    const { fields, fromLang, toLang } = c.req.valid("json");

    if (Object.keys(fields).length === 0) {
      return c.json({}, 200);
    }

    const result = await ctx.documentExtraction.translateFields(
      fields,
      fromLang ?? "Russian",
      toLang ?? "English",
    );

    return c.json(result, 200);
  });
}
