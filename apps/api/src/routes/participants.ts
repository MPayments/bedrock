import { OpenAPIHono, createRoute } from "@hono/zod-openapi";

import {
  ParticipantLookupQuerySchema,
  ParticipantLookupResponseSchema,
} from "@bedrock/parties/contracts";

import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";

export function participantsRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  const lookupRoute = createRoute({
    middleware: [
      requirePermission({
        counterparties: ["list"],
        customers: ["list"],
        organizations: ["list"],
        requisites: ["list"],
      }),
    ],
    method: "get",
    path: "/lookup",
    request: {
      query: ParticipantLookupQuerySchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: ParticipantLookupResponseSchema,
          },
        },
        description: "Typed participant lookup for route composer",
      },
    },
    summary: "Lookup route participants",
    tags: ["Participants"],
  });

  return app.openapi(lookupRoute, async (c) => {
    const query = c.req.valid("query");
    const result = await ctx.partiesModule.participants.queries.lookup(query);
    return c.json(result, 200);
  });
}
