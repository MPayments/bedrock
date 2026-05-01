import { z } from "zod";

import { trimToNull } from "@bedrock/shared/core";

import {
  AgreementFeeBillingModeSchema,
  AgreementFeeRuleKindSchema,
  AgreementFeeRuleUnitSchema,
} from "./zod";

const DecimalStringSchema = z
  .string()
  .trim()
  .refine((value) => {
    if (value.length === 0) {
      return false;
    }

    const parts = value.split(".");
    if (parts.length > 2) {
      return false;
    }

    return parts.every(
      (part, index) => part.length > 0 && /^[0-9]+$/.test(part) && !(index === 0 && part.startsWith("+")),
    );
  }, "Must be a positive decimal string");

const nullableText = z
  .string()
  .trim()
  .max(255)
  .nullish()
  .transform((value) => trimToNull(value) ?? null);

export const CreateAgreementFeeRuleInputSchema = z
  .object({
    kind: AgreementFeeRuleKindSchema,
    unit: AgreementFeeRuleUnitSchema,
    value: DecimalStringSchema,
    currencyId: z.uuid().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.unit === "money" && !value.currencyId) {
      ctx.addIssue({
        code: "custom",
        path: ["currencyId"],
        message: "currencyId is required for money fee rules",
      });
    }

    if (value.unit === "bps" && value.currencyId) {
      ctx.addIssue({
        code: "custom",
        path: ["currencyId"],
        message: "currencyId is not allowed for bps fee rules",
      });
    }
  });

export type CreateAgreementFeeRuleInput = z.infer<
  typeof CreateAgreementFeeRuleInputSchema
>;

export const CreateAgreementInputSchema = z
  .object({
    customerId: z.uuid(),
    organizationId: z.uuid(),
    organizationRequisiteId: z.uuid(),
    contractNumber: nullableText,
    contractDate: z.coerce.date().optional(),
    feeBillingMode: AgreementFeeBillingModeSchema.optional().default(
      "included_in_principal_invoice",
    ),
    feeRules: z.array(CreateAgreementFeeRuleInputSchema).optional().default([]),
  })
  .superRefine((value, ctx) => {
    const kinds = new Set<string>();

    value.feeRules.forEach((rule, index) => {
      if (kinds.has(rule.kind)) {
        ctx.addIssue({
          code: "custom",
          path: ["feeRules", index, "kind"],
          message: `Duplicate fee rule kind: ${rule.kind}`,
        });
        return;
      }

      kinds.add(rule.kind);
    });
  });

export type CreateAgreementInput = z.infer<typeof CreateAgreementInputSchema>;

export const UpdateAgreementInputSchema = z
  .object({
    contractNumber: nullableText.optional(),
    contractDate: z.coerce.date().nullable().optional(),
    feeBillingMode: AgreementFeeBillingModeSchema.optional(),
    feeRules: z.array(CreateAgreementFeeRuleInputSchema).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const providedKeys = Object.keys(value);

    if (providedKeys.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "At least one version-owned agreement field must be provided",
      });
    }

    if (!value.feeRules) {
      return;
    }

    const kinds = new Set<string>();

    value.feeRules.forEach((rule, index) => {
      if (kinds.has(rule.kind)) {
        ctx.addIssue({
          code: "custom",
          path: ["feeRules", index, "kind"],
          message: `Duplicate fee rule kind: ${rule.kind}`,
        });
        return;
      }

      kinds.add(rule.kind);
    });
  });

export type UpdateAgreementInput = z.infer<typeof UpdateAgreementInputSchema>;
