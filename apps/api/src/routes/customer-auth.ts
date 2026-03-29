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

const RegisterCustomerInputSchema = CreateUserInputSchema.pick({
  email: true,
  name: true,
  password: true,
});

const RegisterCustomerResponseSchema = z.object({
  success: z.literal(true),
});

export function customerAuthRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  const registerCustomerRoute = createRoute({
    method: "post",
    path: "/register",
    tags: ["Customer Auth"],
    summary: "Register a customer portal user",
    request: {
      body: {
        content: {
          "application/json": {
            schema: RegisterCustomerInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      201: {
        content: {
          "application/json": {
            schema: RegisterCustomerResponseSchema,
          },
        },
        description: "Customer user registered",
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

  return app.openapi(registerCustomerRoute, async (c) => {
    const input = c.req.valid("json");

    try {
      await ctx.iamService.commands.create({
        ...input,
        role: "customer",
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
