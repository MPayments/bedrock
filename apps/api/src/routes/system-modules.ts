import { OpenAPIHono, z } from "@hono/zod-openapi";

import type { ModuleCatalogEntry } from "@bedrock/core/module-runtime";

import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";

const UpdateModuleStateSchema = z
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

const PreviewModuleStateSchema = z
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

export function systemModulesRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  app.get(
    "/",
    requirePermission({ system_modules: ["list"] }),
    async (c) => {
      const bookId = c.req.query("bookId") || undefined;
      const modules = await ctx.moduleRuntime.listModules({ bookId });
      return c.json({
        data: modules.map((entry: ModuleCatalogEntry) => ({
          manifest: entry.manifest,
          effective: entry.effective,
          globalState: entry.globalState,
          bookState: entry.bookState,
        })),
      });
    },
  );

  app.get(
    "/:moduleId/effective",
    requirePermission({ system_modules: ["list"] }),
    async (c) => {
      const moduleId = c.req.param("moduleId");
      const bookId = c.req.query("bookId") || undefined;
      const effective = await ctx.moduleRuntime.getEffectiveModuleState({
        moduleId,
        bookId,
      });
      return c.json(effective);
    },
  );

  app.put(
    "/:moduleId/state",
    requirePermission({ system_modules: ["manage"] }),
    async (c) => {
      const moduleId = c.req.param("moduleId");
      const parsed = UpdateModuleStateSchema.safeParse(await c.req.json());
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
      const updated = await ctx.moduleRuntime.updateModuleState({
        moduleId,
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
    "/:moduleId/state/dry-run",
    requirePermission({ system_modules: ["manage"] }),
    async (c) => {
      const moduleId = c.req.param("moduleId");
      const parsed = PreviewModuleStateSchema.safeParse(await c.req.json());
      if (!parsed.success) {
        return c.json(
          {
            error: "Validation error",
            details: z.flattenError(parsed.error),
          },
          400,
        );
      }

      const preview = await ctx.moduleRuntime.previewModuleStateUpdate({
        moduleId,
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
    requirePermission({ system_modules: ["list"] }),
    async (c) => {
      const limit = Number(c.req.query("limit") ?? "100");
      const offset = Number(c.req.query("offset") ?? "0");
      const moduleId = c.req.query("moduleId") || undefined;
      const scopeType = c.req.query("scopeType") as
        | "global"
        | "book"
        | undefined;
      const scopeId = c.req.query("scopeId") || undefined;

      const events = await ctx.moduleRuntime.listModuleEvents({
        moduleId,
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
    requirePermission({ system_modules: ["list"] }),
    async (c) => {
      const runtime = await ctx.moduleRuntime.getRuntimeInfo();

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
