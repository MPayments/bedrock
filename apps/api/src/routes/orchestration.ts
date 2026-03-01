import { OpenAPIHono, z } from "@hono/zod-openapi";

import {
  CreateProviderCorridorInputSchema,
  CreateProviderFeeScheduleInputSchema,
  CreateProviderLimitInputSchema,
  CreateRoutingRuleInputSchema,
  CreateScopeOverrideInputSchema,
  PlanRouteInputSchema,
  UpdateProviderCorridorInputSchema,
  UpdateProviderFeeScheduleInputSchema,
  UpdateProviderLimitInputSchema,
  UpdateRoutingRuleInputSchema,
  UpdateScopeOverrideInputSchema,
} from "@bedrock/orchestration";

import { handleRouteError } from "../common/errors";
import { toJsonSafe } from "../common/json";
import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";

const IdParamSchema = z.object({
  id: z.uuid(),
});

export function orchestrationRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  app.get("/", requirePermission({ orchestration: ["list"] }), async (c) => {
    try {
      const rules = await ctx.orchestrationService.listRoutingRules();
      return c.json(toJsonSafe(rules));
    } catch (error) {
      return handleRouteError(c, error);
    }
  });

  app.post("/", requirePermission({ orchestration: ["manage"] }), async (c) => {
    try {
      const body = CreateRoutingRuleInputSchema.parse(await c.req.json());
      const created = await ctx.orchestrationService.createRoutingRule(body);
      return c.json(toJsonSafe(created), 201);
    } catch (error) {
      return handleRouteError(c, error);
    }
  });

  app.patch("/:id", requirePermission({ orchestration: ["manage"] }), async (c) => {
    try {
      const { id } = IdParamSchema.parse(c.req.param());
      const body = UpdateRoutingRuleInputSchema.omit({ id: true }).parse(await c.req.json());
      const updated = await ctx.orchestrationService.updateRoutingRule({
        id,
        ...body,
      });
      return c.json(toJsonSafe(updated));
    } catch (error) {
      return handleRouteError(c, error);
    }
  });

  app.delete("/:id", requirePermission({ orchestration: ["manage"] }), async (c) => {
    try {
      const { id } = IdParamSchema.parse(c.req.param());
      const deleted = await ctx.orchestrationService.deleteRoutingRule(id);
      return c.json(toJsonSafe(deleted));
    } catch (error) {
      return handleRouteError(c, error);
    }
  });

  app.get(
    "/corridors",
    requirePermission({ orchestration: ["list"] }),
    async (c) => {
      try {
        const rows = await ctx.orchestrationService.listProviderCorridors();
        return c.json(toJsonSafe(rows));
      } catch (error) {
        return handleRouteError(c, error);
      }
    },
  );

  app.post(
    "/corridors",
    requirePermission({ orchestration: ["manage"] }),
    async (c) => {
      try {
        const body = CreateProviderCorridorInputSchema.parse(await c.req.json());
        const created = await ctx.orchestrationService.createProviderCorridor(body);
        return c.json(toJsonSafe(created), 201);
      } catch (error) {
        return handleRouteError(c, error);
      }
    },
  );

  app.patch(
    "/corridors/:id",
    requirePermission({ orchestration: ["manage"] }),
    async (c) => {
      try {
        const { id } = IdParamSchema.parse(c.req.param());
        const body = UpdateProviderCorridorInputSchema.omit({ id: true }).parse(
          await c.req.json(),
        );
        const updated = await ctx.orchestrationService.updateProviderCorridor({
          id,
          ...body,
        });
        return c.json(toJsonSafe(updated));
      } catch (error) {
        return handleRouteError(c, error);
      }
    },
  );

  app.delete(
    "/corridors/:id",
    requirePermission({ orchestration: ["manage"] }),
    async (c) => {
      try {
        const { id } = IdParamSchema.parse(c.req.param());
        const deleted = await ctx.orchestrationService.deleteProviderCorridor(id);
        return c.json(toJsonSafe(deleted));
      } catch (error) {
        return handleRouteError(c, error);
      }
    },
  );

  app.get("/fees", requirePermission({ orchestration: ["list"] }), async (c) => {
    try {
      const rows = await ctx.orchestrationService.listProviderFeeSchedules();
      return c.json(toJsonSafe(rows));
    } catch (error) {
      return handleRouteError(c, error);
    }
  });

  app.post("/fees", requirePermission({ orchestration: ["manage"] }), async (c) => {
    try {
      const body = CreateProviderFeeScheduleInputSchema.parse(await c.req.json());
      const created = await ctx.orchestrationService.createProviderFeeSchedule(body);
      return c.json(toJsonSafe(created), 201);
    } catch (error) {
      return handleRouteError(c, error);
    }
  });

  app.patch(
    "/fees/:id",
    requirePermission({ orchestration: ["manage"] }),
    async (c) => {
      try {
        const { id } = IdParamSchema.parse(c.req.param());
        const body = UpdateProviderFeeScheduleInputSchema.omit({ id: true }).parse(
          await c.req.json(),
        );
        const updated = await ctx.orchestrationService.updateProviderFeeSchedule({
          id,
          ...body,
        });
        return c.json(toJsonSafe(updated));
      } catch (error) {
        return handleRouteError(c, error);
      }
    },
  );

  app.delete(
    "/fees/:id",
    requirePermission({ orchestration: ["manage"] }),
    async (c) => {
      try {
        const { id } = IdParamSchema.parse(c.req.param());
        const deleted = await ctx.orchestrationService.deleteProviderFeeSchedule(id);
        return c.json(toJsonSafe(deleted));
      } catch (error) {
        return handleRouteError(c, error);
      }
    },
  );

  app.get("/limits", requirePermission({ orchestration: ["list"] }), async (c) => {
    try {
      const rows = await ctx.orchestrationService.listProviderLimits();
      return c.json(toJsonSafe(rows));
    } catch (error) {
      return handleRouteError(c, error);
    }
  });

  app.post(
    "/limits",
    requirePermission({ orchestration: ["manage"] }),
    async (c) => {
      try {
        const body = CreateProviderLimitInputSchema.parse(await c.req.json());
        const created = await ctx.orchestrationService.createProviderLimit(body);
        return c.json(toJsonSafe(created), 201);
      } catch (error) {
        return handleRouteError(c, error);
      }
    },
  );

  app.patch(
    "/limits/:id",
    requirePermission({ orchestration: ["manage"] }),
    async (c) => {
      try {
        const { id } = IdParamSchema.parse(c.req.param());
        const body = UpdateProviderLimitInputSchema.omit({ id: true }).parse(
          await c.req.json(),
        );
        const updated = await ctx.orchestrationService.updateProviderLimit({
          id,
          ...body,
        });
        return c.json(toJsonSafe(updated));
      } catch (error) {
        return handleRouteError(c, error);
      }
    },
  );

  app.delete(
    "/limits/:id",
    requirePermission({ orchestration: ["manage"] }),
    async (c) => {
      try {
        const { id } = IdParamSchema.parse(c.req.param());
        const deleted = await ctx.orchestrationService.deleteProviderLimit(id);
        return c.json(toJsonSafe(deleted));
      } catch (error) {
        return handleRouteError(c, error);
      }
    },
  );

  app.get(
    "/overrides",
    requirePermission({ orchestration: ["list"] }),
    async (c) => {
      try {
        const rows = await ctx.orchestrationService.listScopeOverrides();
        return c.json(toJsonSafe(rows));
      } catch (error) {
        return handleRouteError(c, error);
      }
    },
  );

  app.post(
    "/overrides",
    requirePermission({ orchestration: ["manage"] }),
    async (c) => {
      try {
        const body = CreateScopeOverrideInputSchema.parse(await c.req.json());
        const created = await ctx.orchestrationService.createScopeOverride(body);
        return c.json(toJsonSafe(created), 201);
      } catch (error) {
        return handleRouteError(c, error);
      }
    },
  );

  app.patch(
    "/overrides/:id",
    requirePermission({ orchestration: ["manage"] }),
    async (c) => {
      try {
        const { id } = IdParamSchema.parse(c.req.param());
        const body = UpdateScopeOverrideInputSchema.omit({ id: true }).parse(
          await c.req.json(),
        );
        const updated = await ctx.orchestrationService.updateScopeOverride({
          id,
          ...body,
        });
        return c.json(toJsonSafe(updated));
      } catch (error) {
        return handleRouteError(c, error);
      }
    },
  );

  app.delete(
    "/overrides/:id",
    requirePermission({ orchestration: ["manage"] }),
    async (c) => {
      try {
        const { id } = IdParamSchema.parse(c.req.param());
        const deleted = await ctx.orchestrationService.deleteScopeOverride(id);
        return c.json(toJsonSafe(deleted));
      } catch (error) {
        return handleRouteError(c, error);
      }
    },
  );

  app.post(
    "/simulate",
    requirePermission({ orchestration: ["simulate"] }),
    async (c) => {
      try {
        const body = PlanRouteInputSchema.parse(await c.req.json());
        const result = await ctx.orchestrationService.simulateRoute(body);
        return c.json(toJsonSafe(result));
      } catch (error) {
        return handleRouteError(c, error);
      }
    },
  );

  return app;
}
