import { z } from "zod";

import { trimToNull } from "@bedrock/shared/core";

import {
  AgreementFeeRuleKindSchema,
  AgreementFeeRuleUnitSchema,
  AgreementRoutePolicyCommissionUnitSchema,
  AgreementRoutePolicyDealTypeSchema,
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

const nullableDecimalString = z
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
  }, "Must be a positive decimal string")
  .nullish()
  .transform((value) => trimToNull(value) ?? null);

const nullableMinorIntegerString = z
  .string()
  .trim()
  .regex(/^-?[0-9]+$/u)
  .nullish()
  .transform((value) => trimToNull(value) ?? null);

export const AgreementRouteTemplateLinkInputSchema = z.object({
  isDefault: z.boolean().optional().default(false),
  routeTemplateId: z.uuid(),
  sequence: z.number().int().positive(),
});

export type AgreementRouteTemplateLinkInput = z.infer<
  typeof AgreementRouteTemplateLinkInputSchema
>;

export const AgreementRoutePolicyInputSchema = z
  .object({
    approvalThresholdAmountMinor: nullableMinorIntegerString,
    approvalThresholdCurrencyId: z.uuid().nullish().transform((value) => value ?? null),
    defaultMarkupBps: nullableDecimalString,
    defaultSubAgentCommissionAmountMinor: nullableMinorIntegerString,
    defaultSubAgentCommissionBps: nullableDecimalString,
    defaultSubAgentCommissionCurrencyId: z
      .uuid()
      .nullish()
      .transform((value) => value ?? null),
    defaultSubAgentCommissionUnit: AgreementRoutePolicyCommissionUnitSchema
      .nullish()
      .transform((value) => value ?? null),
    defaultWireFeeAmountMinor: nullableMinorIntegerString,
    defaultWireFeeCurrencyId: z.uuid().nullish().transform((value) => value ?? null),
    dealType: AgreementRoutePolicyDealTypeSchema,
    quoteValiditySeconds: z.number().int().positive().nullish().transform((value) => value ?? null),
    sequence: z.number().int().positive(),
    sourceCurrencyId: z.uuid().nullish().transform((value) => value ?? null),
    targetCurrencyId: z.uuid().nullish().transform((value) => value ?? null),
    templateLinks: z.array(AgreementRouteTemplateLinkInputSchema).optional().default([]),
  })
  .superRefine((value, ctx) => {
    if (
      (value.defaultWireFeeAmountMinor && !value.defaultWireFeeCurrencyId) ||
      (!value.defaultWireFeeAmountMinor && value.defaultWireFeeCurrencyId)
    ) {
      ctx.addIssue({
        code: "custom",
        message: "defaultWireFeeAmountMinor and defaultWireFeeCurrencyId must be provided together",
        path: ["defaultWireFeeAmountMinor"],
      });
    }

    if (
      (value.approvalThresholdAmountMinor && !value.approvalThresholdCurrencyId) ||
      (!value.approvalThresholdAmountMinor && value.approvalThresholdCurrencyId)
    ) {
      ctx.addIssue({
        code: "custom",
        message:
          "approvalThresholdAmountMinor and approvalThresholdCurrencyId must be provided together",
        path: ["approvalThresholdAmountMinor"],
      });
    }

    if (!value.defaultSubAgentCommissionUnit) {
      if (
        value.defaultSubAgentCommissionBps ||
        value.defaultSubAgentCommissionAmountMinor ||
        value.defaultSubAgentCommissionCurrencyId
      ) {
        ctx.addIssue({
          code: "custom",
          message:
            "defaultSubAgentCommissionUnit is required when sub-agent commission defaults are provided",
          path: ["defaultSubAgentCommissionUnit"],
        });
      }
      return;
    }

    if (value.defaultSubAgentCommissionUnit === "bps") {
      if (!value.defaultSubAgentCommissionBps) {
        ctx.addIssue({
          code: "custom",
          message:
            "defaultSubAgentCommissionBps is required when defaultSubAgentCommissionUnit is bps",
          path: ["defaultSubAgentCommissionBps"],
        });
      }

      if (
        value.defaultSubAgentCommissionAmountMinor ||
        value.defaultSubAgentCommissionCurrencyId
      ) {
        ctx.addIssue({
          code: "custom",
          message:
            "Money fields are not allowed when defaultSubAgentCommissionUnit is bps",
          path: ["defaultSubAgentCommissionAmountMinor"],
        });
      }

      return;
    }

    if (!value.defaultSubAgentCommissionAmountMinor) {
      ctx.addIssue({
        code: "custom",
        message:
          "defaultSubAgentCommissionAmountMinor is required when defaultSubAgentCommissionUnit is money",
        path: ["defaultSubAgentCommissionAmountMinor"],
      });
    }

    if (!value.defaultSubAgentCommissionCurrencyId) {
      ctx.addIssue({
        code: "custom",
        message:
          "defaultSubAgentCommissionCurrencyId is required when defaultSubAgentCommissionUnit is money",
        path: ["defaultSubAgentCommissionCurrencyId"],
      });
    }

    if (value.defaultSubAgentCommissionBps) {
      ctx.addIssue({
        code: "custom",
        message:
          "defaultSubAgentCommissionBps is not allowed when defaultSubAgentCommissionUnit is money",
        path: ["defaultSubAgentCommissionBps"],
      });
    }
  });

export type AgreementRoutePolicyInput = z.infer<
  typeof AgreementRoutePolicyInputSchema
>;

export const CreateAgreementInputSchema = z
  .object({
    customerId: z.uuid(),
    organizationId: z.uuid(),
    organizationRequisiteId: z.uuid(),
    contractNumber: nullableText,
    contractDate: z.coerce.date().optional(),
    feeRules: z.array(CreateAgreementFeeRuleInputSchema).optional().default([]),
    routePolicies: z.array(AgreementRoutePolicyInputSchema).optional().default([]),
  })
  .superRefine((value, ctx) => {
    const kinds = new Set<string>();
    const policySequences = new Set<number>();
    const policyKeys = new Set<string>();

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

    value.routePolicies.forEach((policy, index) => {
      if (policySequences.has(policy.sequence)) {
        ctx.addIssue({
          code: "custom",
          path: ["routePolicies", index, "sequence"],
          message: `Duplicate route policy sequence: ${policy.sequence}`,
        });
      }
      policySequences.add(policy.sequence);

      const key = [
        policy.dealType,
        policy.sourceCurrencyId ?? "*",
        policy.targetCurrencyId ?? "*",
      ].join(":");

      if (policyKeys.has(key)) {
        ctx.addIssue({
          code: "custom",
          path: ["routePolicies", index],
          message: `Duplicate route policy scope: ${key}`,
        });
      }
      policyKeys.add(key);

      const templateIds = new Set<string>();
      const templateSequences = new Set<number>();
      let defaultCount = 0;

      policy.templateLinks.forEach((link, linkIndex) => {
        if (templateIds.has(link.routeTemplateId)) {
          ctx.addIssue({
            code: "custom",
            path: ["routePolicies", index, "templateLinks", linkIndex, "routeTemplateId"],
            message: `Duplicate route template id: ${link.routeTemplateId}`,
          });
        }
        templateIds.add(link.routeTemplateId);

        if (templateSequences.has(link.sequence)) {
          ctx.addIssue({
            code: "custom",
            path: ["routePolicies", index, "templateLinks", linkIndex, "sequence"],
            message: `Duplicate route template sequence: ${link.sequence}`,
          });
        }
        templateSequences.add(link.sequence);

        if (link.isDefault) {
          defaultCount += 1;
        }
      });

      if (defaultCount > 1) {
        ctx.addIssue({
          code: "custom",
          path: ["routePolicies", index, "templateLinks"],
          message: "At most one default route template is allowed per route policy",
        });
      }
    });
  });

export type CreateAgreementInput = z.infer<typeof CreateAgreementInputSchema>;

export const UpdateAgreementInputSchema = z
  .object({
    contractNumber: nullableText.optional(),
    contractDate: z.coerce.date().nullable().optional(),
    feeRules: z.array(CreateAgreementFeeRuleInputSchema).optional(),
    routePolicies: z.array(AgreementRoutePolicyInputSchema).optional(),
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

    if (!value.routePolicies) {
      return;
    }

    const policySequences = new Set<number>();
    const policyKeys = new Set<string>();

    value.routePolicies.forEach((policy, index) => {
      if (policySequences.has(policy.sequence)) {
        ctx.addIssue({
          code: "custom",
          path: ["routePolicies", index, "sequence"],
          message: `Duplicate route policy sequence: ${policy.sequence}`,
        });
      }
      policySequences.add(policy.sequence);

      const key = [
        policy.dealType,
        policy.sourceCurrencyId ?? "*",
        policy.targetCurrencyId ?? "*",
      ].join(":");

      if (policyKeys.has(key)) {
        ctx.addIssue({
          code: "custom",
          path: ["routePolicies", index],
          message: `Duplicate route policy scope: ${key}`,
        });
      }
      policyKeys.add(key);
    });
  });

export type UpdateAgreementInput = z.infer<typeof UpdateAgreementInputSchema>;
