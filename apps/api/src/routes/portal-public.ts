import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import {
  UserEmailConflictError,
} from "@bedrock/iam";
import {
  CreateUserInputSchema,
} from "@bedrock/iam/contracts";

import { ErrorSchema } from "../common";
import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";

const RegisterPortalInputSchema = CreateUserInputSchema.pick({
  email: true,
  name: true,
  password: true,
});

const RegisterPortalResponseSchema = z.object({
  success: z.literal(true),
});

export function portalPublicRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  const registerPortalRoute = createRoute({
    method: "post",
    path: "/register",
    tags: ["Portal"],
    summary: "Register a portal user",
    request: {
      body: {
        content: {
          "application/json": {
            schema: RegisterPortalInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      201: {
        content: {
          "application/json": {
            schema: RegisterPortalResponseSchema,
          },
        },
        description: "Portal user registered",
      },
      409: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Email already exists",
      },
    },
  });

  return app.openapi(registerPortalRoute, async (c) => {
    const input = c.req.valid("json");

    try {
      const user = await ctx.iamService.commands.create({
        ...input,
        role: null,
      });
      await ctx.portalAccessGrantsService.commands.create({
        userId: user.id,
      });
      return c.json({ success: true as const }, 201);
    } catch (error) {
      if (error instanceof UserEmailConflictError) {
        return c.json({ error: error.message }, 409);
      }

      throw error;
    }
  });
}
