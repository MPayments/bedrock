import { z } from "zod";

import { trimToNull } from "@bedrock/shared/core";

import {
  AgreementFeeRuleKindSchema,
  AgreementFeeRuleUnitSchema,
} from "./zod";

const DecimalStringSchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d+)?$/, "Must be a positive decimal string");

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
