import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { MiddlewareHandler } from "hono";

import {
  ApplicationSchema,
  ClientSchema,
  CreateClientInputSchema,
  DealSchema,
  PaginatedClientsSchema,
} from "@bedrock/operations/contracts";

import type { AppContext } from "../../context";
import type { AuthVariables } from "../../middleware/auth";
import { OpsErrorSchema, OpsIdParamSchema } from "./common";

function requireCustomerRole(): MiddlewareHandler<{
  Variables: AuthVariables;
}> {
  return async (c, next) => {
    const user = c.get("user");
    if (!user || user.role !== "customer") {
      return c.json({ error: "Forbidden: customer role required" }, 403);
    }
    await next();
  };
}

export function operationsCustomerPortalRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();
  app.use("*", requireCustomerRole());

  const getProfileRoute = createRoute({
    method: "get",
    path: "/profile",
    tags: ["Operations - Customer Portal"],
    summary: "Get customer profile",
    responses: {
      200: {
        content: { "application/json": { schema: z.any() } },
        description: "Customer profile",
      },
    },
  });

  const listClientsRoute = createRoute({
    method: "get",
    path: "/clients",
    tags: ["Operations - Customer Portal"],
    summary: "List customer's clients",
    responses: {
      200: {
        content: { "application/json": { schema: PaginatedClientsSchema } },
        description: "Customer's clients",
      },
    },
  });

  const createClientRoute = createRoute({
    method: "post",
    path: "/clients",
    tags: ["Operations - Customer Portal"],
    summary: "Create client as customer",
    request: {
      body: {
        content: { "application/json": { schema: CreateClientInputSchema } },
        required: true,
      },
    },
    responses: {
      201: {
        content: { "application/json": { schema: ClientSchema } },
        description: "Client created",
      },
    },
  });

  const listApplicationsRoute = createRoute({
    method: "get",
    path: "/applications",
    tags: ["Operations - Customer Portal"],
    summary: "List customer's applications",
    request: {
      query: z.object({
        limit: z.coerce.number().int().default(20),
        offset: z.coerce.number().int().default(0),
      }),
    },
    responses: {
      200: {
        content: { "application/json": { schema: z.any() } },
        description: "Customer's applications",
      },
    },
  });

  const listDealsRoute = createRoute({
    method: "get",
    path: "/deals",
    tags: ["Operations - Customer Portal"],
    summary: "List customer's deals",
    request: {
      query: z.object({
        limit: z.coerce.number().int().default(20),
        offset: z.coerce.number().int().default(0),
      }),
    },
    responses: {
      200: {
        content: { "application/json": { schema: z.any() } },
        description: "Customer's deals",
      },
    },
  });

  const getDealRoute = createRoute({
    method: "get",
    path: "/deals/{id}",
    tags: ["Operations - Customer Portal"],
    summary: "Get customer's deal details",
    request: { params: OpsIdParamSchema },
    responses: {
      200: {
        content: { "application/json": { schema: z.any() } },
        description: "Deal details",
      },
      403: {
        content: { "application/json": { schema: OpsErrorSchema } },
        description: "Not authorized",
      },
    },
  });

  return app
    .openapi(getProfileRoute, async (c) => {
      const user = c.get("user")!;
      return c.json({ id: user.id, email: user.email, role: user.role }, 200);
    })
    .openapi(listClientsRoute, async (c) => {
      const user = c.get("user")!;
      // userId in ops context is the agent/user integer ID
      // For customer portal, we need to resolve from bedrock user.id
      const result = await ctx.customerPortalWorkflow.getClients({
        userId: Number(user.id),
      });
      return c.json(result, 200);
    })
    .openapi(createClientRoute, async (c) => {
      const user = c.get("user")!;
      const input = c.req.valid("json");
      const result = await ctx.customerPortalWorkflow.createClient(
        { userId: Number(user.id) },
        input,
      );
      return c.json(result, 201);
    })
    .openapi(listApplicationsRoute, async (c) => {
      const user = c.get("user")!;
      const query = c.req.valid("query");
      const result = await ctx.customerPortalWorkflow.listMyApplications(
        { userId: Number(user.id) },
        query,
      );
      return c.json(result, 200);
    })
    .openapi(listDealsRoute, async (c) => {
      const user = c.get("user")!;
      const query = c.req.valid("query");
      const result = await ctx.customerPortalWorkflow.listMyDeals(
        { userId: Number(user.id) },
        query,
      );
      return c.json(result, 200);
    })
    .openapi(getDealRoute, async (c) => {
      const user = c.get("user")!;
      const { id } = c.req.valid("param");
      try {
        const result = await ctx.customerPortalWorkflow.getDealById(
          { userId: Number(user.id) },
          id,
        );
        return c.json(result, 200);
      } catch (error) {
        if (
          error instanceof Error &&
          error.name === "CustomerNotAuthorizedError"
        ) {
          return c.json({ error: error.message }, 403);
        }
        throw error;
      }
    });
}
