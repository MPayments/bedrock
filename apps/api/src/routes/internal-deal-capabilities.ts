import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import {
  DealCapabilityStateSchema,
  ListDealCapabilityStatesQuerySchema,
  UpsertDealCapabilityStateInputSchema,
} from "@bedrock/deals/contracts";

import { ErrorSchema } from "../common";
import { handleRouteError } from "../common/errors";
import { jsonOk } from "../common/response";
import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";

export function internalDealCapabilitiesRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  const listRoute = createRoute({
    middleware: [requirePermission({ deals: ["list"] })],
    method: "get",
    path: "/",
    tags: ["Deals"],
    summary: "List internal deal capability states",
    request: {
      query: ListDealCapabilityStatesQuerySchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.array(DealCapabilityStateSchema),
          },
        },
        description: "Capability states",
      },
    },
  });

  const upsertRoute = createRoute({
    middleware: [requirePermission({ deals: ["update"] })],
    method: "put",
    path: "/",
    tags: ["Deals"],
    summary: "Upsert an internal deal capability state",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: UpsertDealCapabilityStateInputSchema,
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: DealCapabilityStateSchema,
          },
        },
        description: "Capability state updated",
      },
      400: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Validation error",
      },
    },
  });

  return app
    .openapi(listRoute, async (c) => {
      try {
        const query = c.req.valid("query");
        const result = await ctx.dealsModule.deals.queries.listCapabilityStates(
          query,
        );
        return jsonOk(c, result);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(upsertRoute, async (c) => {
      try {
        const actorUserId = c.get("user")!.id;
        const body = c.req.valid("json");
        const result = await ctx.dealsModule.deals.commands.upsertCapabilityState({
          ...body,
          actorUserId,
        });
        return jsonOk(c, result);
      } catch (error) {
        return handleRouteError(c, error);
      }
    });
}
