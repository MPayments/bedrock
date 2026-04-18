import { z } from "zod";

import { parseDecimalToFraction } from "@bedrock/shared/money/math";

const nonNegativeMinorStringSchema = z
  .string()
  .regex(/^\d+$/, "Minor amount must be a non-negative integer string");

const positiveDecimalStringSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => {
    try {
      parseDecimalToFraction(value, { allowScientific: false });
      return true;
    } catch {
      return false;
    }
  }, "Value must be a positive decimal");

export const COMMERCIAL_ROUTE_FEE_KIND_VALUES = ["percent", "fixed"] as const;

export const CommercialRouteFeeKindSchema = z.enum(
  COMMERCIAL_ROUTE_FEE_KIND_VALUES,
);

export const CommercialRouteFeeSchema = z
  .object({
    amountMinor: nonNegativeMinorStringSchema.optional(),
    currencyId: z.uuid().nullable().optional(),
    id: z.string().trim().min(1),
    kind: CommercialRouteFeeKindSchema,
    label: z.string().trim().min(1).optional(),
    percentage: positiveDecimalStringSchema.optional(),
  })
  .superRefine((value, context) => {
    if (value.kind === "percent") {
      if (!value.percentage) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Percent fee requires percentage",
          path: ["percentage"],
        });
      }

      if (value.amountMinor !== undefined) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Percent fee cannot define amountMinor",
          path: ["amountMinor"],
        });
      }

      if (value.currencyId !== undefined && value.currencyId !== null) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Percent fee cannot define currencyId",
          path: ["currencyId"],
        });
      }

      if (value.percentage) {
        try {
          const fraction = parseDecimalToFraction(value.percentage, {
            allowScientific: false,
          });

          if (fraction.num >= fraction.den * 100n) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Percent fee must be lower than 100",
              path: ["percentage"],
            });
          }
        } catch {
          // Base validation already reports malformed values.
        }
      }

      return;
    }

    if (!value.amountMinor || BigInt(value.amountMinor) <= 0n) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Fixed fee requires amountMinor > 0",
        path: ["amountMinor"],
      });
    }

    if (!value.currencyId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Fixed fee requires currencyId",
        path: ["currencyId"],
      });
    }

    if (value.percentage !== undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Fixed fee cannot define percentage",
        path: ["percentage"],
      });
    }
  });

export type CommercialRouteFee = z.infer<typeof CommercialRouteFeeSchema>;
export type CommercialRouteFeeKind = z.infer<
  typeof CommercialRouteFeeKindSchema
>;
