import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import {
  CalculationSchema,
  CreateCalculationInputSchema,
  ListCalculationsQuerySchema,
  PaginatedCalculationsSchema,
} from "@bedrock/operations/contracts";

import type { AppContext } from "../../context";
import type { AuthVariables } from "../../middleware/auth";
import { OpsDeletedSchema, OpsErrorSchema, OpsIdParamSchema } from "./common";

const PreviewCalculationInputSchema = z.object({
  applicationId: z.number().int().optional(),
  currencyCode: z.string(),
  originalAmount: z.coerce.string(),
  feePercentage: z.coerce.string(),
  rateSource: z.string(),
  additionalExpenses: z.coerce.string().default("0"),
  additionalExpensesCurrencyCode: z.string().nullable().optional(),
  baseCurrencyCode: z.string().default("RUB"),
});

type PreviewInput = z.infer<typeof PreviewCalculationInputSchema>;

async function computeCalculation(ctx: AppContext, input: PreviewInput) {
  const amount = parseFloat(input.originalAmount);
  const feePct = parseFloat(input.feePercentage);
  const addExp = parseFloat(input.additionalExpenses);

  let rate = 1;
  if (input.currencyCode.toUpperCase() !== input.baseCurrencyCode.toUpperCase()) {
    const rateResult = await ctx.treasuryModule.rates.queries.getLatestRate(
      input.currencyCode,
      input.baseCurrencyCode,
      new Date(),
    );
    rate = Number(rateResult.rateNum) / Number(rateResult.rateDen || 1n);
  }

  const feeAmount = amount * feePct / 100;
  const totalAmount = amount + feeAmount;
  const feeAmountInBase = feeAmount * rate;
  const totalInBase = totalAmount * rate;
  const additionalExpensesInBase = addExp;
  const totalWithExpensesInBase = totalInBase + additionalExpensesInBase;

  return {
    currencyCode: input.currencyCode,
    originalAmount: amount.toFixed(2),
    feePercentage: feePct.toFixed(2),
    feeAmount: feeAmount.toFixed(2),
    totalAmount: totalAmount.toFixed(2),
    rateSource: input.rateSource,
    rate: rate.toFixed(6),
    additionalExpensesCurrencyCode: input.additionalExpensesCurrencyCode ?? input.baseCurrencyCode,
    additionalExpenses: addExp.toFixed(2),
    baseCurrencyCode: input.baseCurrencyCode,
    feeAmountInBase: feeAmountInBase.toFixed(2),
    totalInBase: totalInBase.toFixed(2),
    additionalExpensesInBase: additionalExpensesInBase.toFixed(2),
    totalWithExpensesInBase: totalWithExpensesInBase.toFixed(2),
    calculationTimestamp: new Date().toISOString(),
  };
}

export function operationsCalculationsRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  const listRoute = createRoute({
    method: "get",
    path: "/",
    tags: ["Operations - Calculations"],
    summary: "List calculations",
    request: { query: ListCalculationsQuerySchema },
    responses: {
      200: {
        content: {
          "application/json": { schema: PaginatedCalculationsSchema },
        },
        description: "Paginated calculations",
      },
    },
  });

  const getRoute = createRoute({
    method: "get",
    path: "/{id}",
    tags: ["Operations - Calculations"],
    summary: "Get calculation by ID",
    request: { params: OpsIdParamSchema },
    responses: {
      200: {
        content: { "application/json": { schema: CalculationSchema } },
        description: "Calculation found",
      },
      404: {
        content: { "application/json": { schema: OpsErrorSchema } },
        description: "Not found",
      },
    },
  });

  const createRoute_ = createRoute({
    method: "post",
    path: "/",
    tags: ["Operations - Calculations"],
    summary: "Create calculation",
    request: {
      body: {
        content: {
          "application/json": { schema: CreateCalculationInputSchema },
        },
        required: true,
      },
    },
    responses: {
      201: {
        content: { "application/json": { schema: CalculationSchema } },
        description: "Calculation created",
      },
    },
  });

  const deleteRoute = createRoute({
    method: "delete",
    path: "/{id}",
    tags: ["Operations - Calculations"],
    summary: "Delete calculation",
    request: { params: OpsIdParamSchema },
    responses: {
      200: {
        content: { "application/json": { schema: OpsDeletedSchema } },
        description: "Calculation deleted",
      },
    },
  });

  const previewRoute = createRoute({
    method: "post",
    path: "/preview",
    tags: ["Operations - Calculations"],
    summary: "Preview calculation without saving",
    request: {
      body: {
        content: {
          "application/json": { schema: PreviewCalculationInputSchema },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: { "application/json": { schema: z.any() } },
        description: "Preview result",
      },
      422: {
        content: { "application/json": { schema: OpsErrorSchema } },
        description: "Rate not available",
      },
    },
  });

  // Calculations by application
  const byApplicationRoute = createRoute({
    method: "get",
    path: "/application/{appId}",
    tags: ["Operations - Calculations"],
    summary: "List calculations for application",
    request: {
      params: z.object({ appId: z.coerce.number().int() }),
    },
    responses: {
      200: {
        content: { "application/json": { schema: z.array(CalculationSchema) } },
        description: "Calculations for application",
      },
    },
  });

  const createForApplicationRoute = createRoute({
    method: "post",
    path: "/application/{appId}",
    tags: ["Operations - Calculations"],
    summary: "Create calculation for application",
    request: {
      params: z.object({ appId: z.coerce.number().int() }),
      body: {
        content: {
          "application/json": { schema: PreviewCalculationInputSchema.omit({ applicationId: true }) },
        },
        required: true,
      },
    },
    responses: {
      201: {
        content: { "application/json": { schema: CalculationSchema } },
        description: "Calculation created",
      },
      422: {
        content: { "application/json": { schema: OpsErrorSchema } },
        description: "Calculation failed",
      },
    },
  });

  return app
    .openapi(previewRoute, async (c) => {
      const input = c.req.valid("json");
      try {
        const result = await computeCalculation(ctx, input);
        return c.json(result, 200);
      } catch {
        return c.json({ error: "Rate not available for this currency pair" }, 422);
      }
    })
    .openapi(createForApplicationRoute, async (c) => {
      const { appId } = c.req.valid("param");
      const input = c.req.valid("json");
      try {
        const computed = await computeCalculation(ctx, { ...input, applicationId: appId });
        const result = await ctx.operationsModule.calculations.commands.create({
          ...computed,
          applicationId: appId,
        });
        return c.json(result, 201);
      } catch (err) {
        return c.json({ error: err instanceof Error ? err.message : "Calculation failed" }, 422);
      }
    })
    .openapi(byApplicationRoute, async (c) => {
      const { appId } = c.req.valid("param");
      const result = await ctx.operationsModule.calculations.queries.list({
        limit: 100,
        offset: 0,
        sortBy: "createdAt",
        sortOrder: "desc",
        applicationId: appId,
      } as any);
      return c.json(result.data, 200);
    })
    .openapi(listRoute, async (c) => {
      const query = c.req.valid("query");
      const result =
        await ctx.operationsModule.calculations.queries.list(query);
      return c.json(result, 200);
    })
    .openapi(getRoute, async (c) => {
      const { id } = c.req.valid("param");
      const calc =
        await ctx.operationsModule.calculations.queries.findById(id);
      if (!calc) return c.json({ error: "Calculation not found" }, 404);
      return c.json(calc, 200);
    })
    .openapi(createRoute_, async (c) => {
      const input = c.req.valid("json");
      const result =
        await ctx.operationsModule.calculations.commands.create(input);
      return c.json(result, 201);
    })
    .openapi(deleteRoute, async (c) => {
      const { id } = c.req.valid("param");
      await ctx.operationsModule.calculations.commands.delete(id);
      return c.json({ deleted: true }, 200);
    });
}
