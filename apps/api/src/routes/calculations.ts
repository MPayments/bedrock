import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import {
  CalculationDetailsSchema,
  CreateCalculationInputSchema,
  ListCalculationsQuerySchema,
  PaginatedCalculationsSchema,
  type CalculationDetails,
} from "@bedrock/calculations/contracts";
import { formatFractionDecimal } from "@bedrock/shared/money";
import type { CalculationDocumentData } from "@bedrock/workflow-document-generation";

import { DeletedSchema, ErrorSchema, IdParamSchema } from "../common";
import { handleRouteError } from "../common/errors";
import { jsonOk } from "../common/response";
import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import { withRequiredIdempotency } from "../middleware/idempotency";
import { requirePermission } from "../middleware/permission";

interface CalculationCurrencyMetadata {
  code: string;
  id: string;
  precision: number;
}

function minorToDecimalString(amountMinor: bigint | string, precision: number) {
  const value = typeof amountMinor === "string" ? BigInt(amountMinor) : amountMinor;
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const digits = absolute.toString();

  if (precision === 0) {
    return `${negative ? "-" : ""}${digits}`;
  }

  const padded = digits.padStart(precision + 1, "0");
  const integerPart = padded.slice(0, padded.length - precision);
  const fractionPart = padded.slice(padded.length - precision);

  return `${negative ? "-" : ""}${integerPart}.${fractionPart}`;
}

function feeBpsToPercentString(feeBps: bigint | string) {
  return minorToDecimalString(feeBps, 2);
}

function rationalToDecimalString(
  numerator: bigint | string,
  denominator: bigint | string,
  scale = 6,
) {
  return formatFractionDecimal(numerator, denominator, {
    scale,
    trimTrailingZeros: true,
  });
}

function serializeRateSource(rateSource: string) {
  return rateSource === "cbr" ? "cbru" : rateSource;
}

function serializeCalculationForDocumentGeneration(input: {
  calculation: CalculationDetails;
  currencies: Map<string, CalculationCurrencyMetadata>;
}): CalculationDocumentData {
  const snapshot = input.calculation.currentSnapshot;
  const calculationCurrency = input.currencies.get(snapshot.calculationCurrencyId);
  const baseCurrency = input.currencies.get(snapshot.baseCurrencyId);
  const additionalExpensesCurrency = snapshot.additionalExpensesCurrencyId
    ? input.currencies.get(snapshot.additionalExpensesCurrencyId) ?? null
    : null;

  if (!calculationCurrency || !baseCurrency) {
    throw new Error("Missing currency metadata for calculation export");
  }

  return {
    id: input.calculation.id,
    currencyCode: calculationCurrency.code,
    originalAmount: minorToDecimalString(
      snapshot.originalAmountMinor,
      calculationCurrency.precision,
    ),
    agreementFeePercentage: feeBpsToPercentString(snapshot.agreementFeeBps),
    agreementFeeAmount: minorToDecimalString(
      snapshot.agreementFeeAmountMinor,
      calculationCurrency.precision,
    ),
    quoteMarkupPercentage: feeBpsToPercentString(snapshot.quoteMarkupBps),
    quoteMarkupAmount: minorToDecimalString(
      snapshot.quoteMarkupAmountMinor,
      calculationCurrency.precision,
    ),
    totalFeePercentage: feeBpsToPercentString(snapshot.totalFeeBps),
    totalFeeAmount: minorToDecimalString(
      snapshot.totalFeeAmountMinor,
      calculationCurrency.precision,
    ),
    totalAmount: minorToDecimalString(
      snapshot.totalAmountMinor,
      calculationCurrency.precision,
    ),
    finalRate: rationalToDecimalString(snapshot.rateNum, snapshot.rateDen),
    rateSource: serializeRateSource(snapshot.rateSource),
    rate: rationalToDecimalString(snapshot.rateNum, snapshot.rateDen),
    additionalExpenses: minorToDecimalString(
      snapshot.additionalExpensesAmountMinor,
      additionalExpensesCurrency?.precision ?? baseCurrency.precision,
    ),
    baseCurrencyCode: baseCurrency.code,
    totalFeeAmountInBase: minorToDecimalString(
      snapshot.totalFeeAmountInBaseMinor,
      baseCurrency.precision,
    ),
    fixedFeeAmount: snapshot.fixedFeeCurrencyId
      ? minorToDecimalString(
          snapshot.fixedFeeAmountMinor,
          input.currencies.get(snapshot.fixedFeeCurrencyId)?.precision ??
            baseCurrency.precision,
        )
      : minorToDecimalString(snapshot.fixedFeeAmountMinor, baseCurrency.precision),
    fixedFeeCurrencyCode:
      snapshot.fixedFeeCurrencyId != null
        ? (input.currencies.get(snapshot.fixedFeeCurrencyId)?.code ?? null)
        : null,
    totalInBase: minorToDecimalString(
      snapshot.totalInBaseMinor,
      baseCurrency.precision,
    ),
    additionalExpensesInBase: minorToDecimalString(
      snapshot.additionalExpensesInBaseMinor,
      baseCurrency.precision,
    ),
    totalWithExpensesInBase: minorToDecimalString(
      snapshot.totalWithExpensesInBaseMinor,
      baseCurrency.precision,
    ),
    calculationTimestamp: snapshot.calculationTimestamp.toISOString(),
  };
}

export function calculationsRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  const listRoute = createRoute({
    middleware: [requirePermission({ calculations: ["list"] })],
    method: "get",
    path: "/",
    tags: ["Calculations"],
    summary: "List calculations",
    request: {
      query: ListCalculationsQuerySchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: PaginatedCalculationsSchema,
          },
        },
        description: "Paginated calculations",
      },
    },
  });

  const getRoute = createRoute({
    middleware: [requirePermission({ calculations: ["list"] })],
    method: "get",
    path: "/{id}",
    tags: ["Calculations"],
    summary: "Get calculation by id",
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: CalculationDetailsSchema,
          },
        },
        description: "Calculation found",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Calculation not found",
      },
    },
  });

  const createRoute_ = createRoute({
    middleware: [requirePermission({ calculations: ["create"] })],
    method: "post",
    path: "/",
    tags: ["Calculations"],
    summary: "Create calculation",
    request: {
      body: {
        content: {
          "application/json": {
            schema: CreateCalculationInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      201: {
        content: {
          "application/json": {
            schema: CalculationDetailsSchema,
          },
        },
        description: "Calculation created",
      },
      400: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Validation or idempotency header error",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Referenced entity not found",
      },
      409: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Idempotency conflict",
      },
    },
  });

  const deleteRoute = createRoute({
    middleware: [requirePermission({ calculations: ["delete"] })],
    method: "delete",
    path: "/{id}",
    tags: ["Calculations"],
    summary: "Archive calculation",
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: DeletedSchema,
          },
        },
        description: "Calculation archived",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Calculation not found",
      },
    },
  });

  const exportRoute = createRoute({
    middleware: [requirePermission({ calculations: ["list"] })],
    method: "get",
    path: "/{id}/export",
    tags: ["Calculations"],
    summary: "Export calculation as DOCX/PDF",
    request: {
      params: IdParamSchema,
      query: z.object({
        format: z.enum(["docx", "pdf"]).default("pdf"),
        lang: z.enum(["ru", "en"]).default("ru"),
      }),
    },
    responses: {
      200: { description: "Generated file" },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Calculation not found",
      },
    },
  });

  return app
    .openapi(listRoute, async (c) => {
      try {
        const query = c.req.valid("query");
        const result = await ctx.calculationsModule.calculations.queries.list(
          query,
        );
        return jsonOk(c, result);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(getRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        const result = await ctx.calculationsModule.calculations.queries.findById(
          id,
        );
        return jsonOk(c, result);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(createRoute_, async (c) => {
      try {
        const body = c.req.valid("json");
        const result = await withRequiredIdempotency(c, (idempotencyKey) =>
          ctx.calculationsModule.calculations.commands.create({
            ...body,
            actorUserId: c.get("user")!.id,
            idempotencyKey,
          }),
        );

        if (result instanceof Response) {
          return result;
        }

        return jsonOk(c, result, 201);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(deleteRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        await ctx.calculationsModule.calculations.commands.archive(id);
        return jsonOk(c, { deleted: true });
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(exportRoute, async (c): Promise<any> => {
      try {
        const { id } = c.req.valid("param");
        const { format, lang } = c.req.valid("query");
        const calculation =
          await ctx.calculationsModule.calculations.queries.findById(id);
        const snapshot = calculation.currentSnapshot;
        const currencyIds = Array.from(
          new Set(
            [
              snapshot.calculationCurrencyId,
              snapshot.baseCurrencyId,
              snapshot.additionalExpensesCurrencyId,
            ].filter((value): value is string => Boolean(value)),
          ),
        );
        const currencies = new Map(
          await Promise.all(
            currencyIds.map(async (currencyId) => {
              const currency = await ctx.currenciesService.findById(currencyId);
              return [
                currencyId,
                {
                  code: currency.code,
                  id: currency.id,
                  precision: currency.precision,
                },
              ] as const;
            }),
          ),
        );
        const serialized = serializeCalculationForDocumentGeneration({
          calculation,
          currencies,
        });
        const result = await ctx.documentGenerationWorkflow.generateCalculation({
          calculationData: serialized,
          format,
          lang,
        });

        c.header("Content-Type", result.mimeType);
        c.header(
          "Content-Disposition",
          `attachment; filename="${result.fileName}"`,
        );
        return c.body(result.buffer as unknown as ArrayBuffer);
      } catch (error) {
        return handleRouteError(c, error);
      }
    });
}
