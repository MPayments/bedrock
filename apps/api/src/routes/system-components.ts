import { OpenAPIHono, z } from "@hono/zod-openapi";

import type { ComponentCatalogEntry } from "@bedrock/core/component-runtime";

import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";

const UpdateComponentStateSchema = z
  .object({
    scopeType: z.enum(["global", "book"]),
    scopeId: z.string().uuid().optional(),
    state: z.enum(["enabled", "disabled"]),
    reason: z.string().trim().min(1).max(1_000),
    retryAfterSec: z.number().int().optional(),
    expectedVersion: z.number().int().nonnegative(),
  })
  .superRefine((value, ctx) => {
    if (value.scopeType === "book" && !value.scopeId) {
      ctx.addIssue({
        code: "custom",
        message: "scopeId is required for book scope",
        path: ["scopeId"],
      });
    }
  });

const PreviewComponentStateSchema = z
  .object({
    scopeType: z.enum(["global", "book"]),
    scopeId: z.string().uuid().optional(),
    state: z.enum(["enabled", "disabled"]),
    reason: z.string().trim().min(1).max(1_000),
    retryAfterSec: z.number().int().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.scopeType === "book" && !value.scopeId) {
      ctx.addIssue({
        code: "custom",
        message: "scopeId is required for book scope",
        path: ["scopeId"],
      });
    }
  });

export function systemComponentsRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  app.get(
    "/",
    requirePermission({ system_components: ["list"] }),
    async (c) => {
      const bookId = c.req.query("bookId") || undefined;
      const components = await ctx.componentRuntime.listComponents({ bookId });
      return c.json({
        data: components.map((entry: ComponentCatalogEntry) => ({
          manifest: entry.manifest,
          effective: entry.effective,
          globalState: entry.globalState,
          bookState: entry.bookState,
        })),
      });
    },
  );

  app.get(
    "/:componentId/effective",
    requirePermission({ system_components: ["list"] }),
    async (c) => {
      const componentId = c.req.param("componentId");
      const bookId = c.req.query("bookId") || undefined;
      const effective = await ctx.componentRuntime.getEffectiveComponentState({
        componentId,
        bookId,
      });
      return c.json(effective);
    },
  );

  app.put(
    "/:componentId/state",
    requirePermission({ system_components: ["manage"] }),
    async (c) => {
      const componentId = c.req.param("componentId");
      const parsed = UpdateComponentStateSchema.safeParse(await c.req.json());
      if (!parsed.success) {
        return c.json(
          {
            error: "Validation error",
            details: z.flattenError(parsed.error),
          },
          400,
        );
      }

      const requestContext = c.get("requestContext");
      const updated = await ctx.componentRuntime.updateComponentState({
        componentId,
        scopeType: parsed.data.scopeType,
        scopeId: parsed.data.scopeId,
        state: parsed.data.state,
        reason: parsed.data.reason,
        retryAfterSec: parsed.data.retryAfterSec,
        expectedVersion: parsed.data.expectedVersion,
        changedBy: c.get("user")!.id,
        requestId: requestContext?.requestId ?? null,
      });

      return c.json(updated);
    },
  );

  app.post(
    "/:componentId/state/dry-run",
    requirePermission({ system_components: ["manage"] }),
    async (c) => {
      const componentId = c.req.param("componentId");
      const parsed = PreviewComponentStateSchema.safeParse(await c.req.json());
      if (!parsed.success) {
        return c.json(
          {
            error: "Validation error",
            details: z.flattenError(parsed.error),
          },
          400,
        );
      }

      const preview = await ctx.componentRuntime.previewComponentStateUpdate({
        componentId,
        scopeType: parsed.data.scopeType,
        scopeId: parsed.data.scopeId,
        state: parsed.data.state,
        reason: parsed.data.reason,
        retryAfterSec: parsed.data.retryAfterSec,
      });
      return c.json(preview);
    },
  );

  app.get(
    "/events",
    requirePermission({ system_components: ["list"] }),
    async (c) => {
      const limit = Number(c.req.query("limit") ?? "100");
      const offset = Number(c.req.query("offset") ?? "0");
      const componentId = c.req.query("componentId") || undefined;
      const scopeType = c.req.query("scopeType") as
        | "global"
        | "book"
        | undefined;
      const scopeId = c.req.query("scopeId") || undefined;

      const events = await ctx.componentRuntime.listComponentEvents({
        componentId,
        scopeType,
        scopeId,
        limit,
        offset,
      });

      return c.json({ data: events });
    },
  );

  app.get(
    "/runtime",
    requirePermission({ system_components: ["list"] }),
    async (c) => {
      const runtime = await ctx.componentRuntime.getRuntimeInfo();

      return c.json({
        stateEpoch: runtime.stateEpoch.toString(),
        manifestChecksum: runtime.manifestChecksum,
        manifestSeenVersion: runtime.manifestSeenVersion,
        checksumMatches: runtime.checksumMatches,
        updatedAt: runtime.updatedAt,
      });
    },
  );

  return app;
}
