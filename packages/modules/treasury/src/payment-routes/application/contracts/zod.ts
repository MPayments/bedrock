import { createListQuerySchemaFromContract, type ListQueryContract } from "@bedrock/shared/core/pagination";
import { parseDecimalToFraction } from "@bedrock/shared/money/math";
import { z } from "zod";

const positiveMinorStringSchema = z
  .string()
  .regex(/^\d+$/, "Minor amount must be a positive integer string")
  .refine((value) => BigInt(value) > 0n, "Minor amount must be greater than 0");

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

export const PAYMENT_ROUTE_TEMPLATE_STATUS_VALUES = [
  "active",
  "archived",
] as const;
export const PAYMENT_ROUTE_PARTICIPANT_KIND_VALUES = [
  "customer",
  "counterparty",
  "organization",
] as const;
export const PAYMENT_ROUTE_LEG_KIND_VALUES = [
  "collect",
  "exchange",
  "transfer",
  "intercompany",
  "cross_company",
  "payout",
] as const;
export const PAYMENT_ROUTE_FEE_KIND_VALUES = ["percent", "fixed"] as const;
export const PAYMENT_ROUTE_LOCKED_SIDE_VALUES = [
  "currency_in",
  "currency_out",
] as const;

export const PaymentRouteTemplateStatusSchema = z.enum(
  PAYMENT_ROUTE_TEMPLATE_STATUS_VALUES,
);
export const PaymentRouteParticipantKindSchema = z.enum(
  PAYMENT_ROUTE_PARTICIPANT_KIND_VALUES,
);
export const PaymentRouteLegKindSchema = z.enum(PAYMENT_ROUTE_LEG_KIND_VALUES);
export const PaymentRouteFeeKindSchema = z.enum(PAYMENT_ROUTE_FEE_KIND_VALUES);
export const PaymentRouteLockedSideSchema = z.enum(
  PAYMENT_ROUTE_LOCKED_SIDE_VALUES,
);
export const PaymentRouteSnapshotPolicySchema = z.literal("clone_on_attach");

export const PaymentRouteParticipantRefSchema = z.object({
  displayName: z.string().trim().min(1),
  entityId: z.uuid(),
  kind: PaymentRouteParticipantKindSchema,
  nodeId: z.string().trim().min(1),
});

export const PaymentRouteFeeSchema = z
  .object({
    amountMinor: nonNegativeMinorStringSchema.optional(),
    currencyId: z.uuid().nullable().optional(),
    id: z.string().trim().min(1),
    kind: PaymentRouteFeeKindSchema,
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
          // The base schema already reports the invalid value.
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

export const PaymentRouteLegSchema = z.object({
  fees: z.array(PaymentRouteFeeSchema).default([]),
  fromCurrencyId: z.uuid(),
  id: z.string().trim().min(1),
  kind: PaymentRouteLegKindSchema,
  toCurrencyId: z.uuid(),
});

const PaymentRouteNodePositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const PaymentRouteVisualMetadataSchema = z.object({
  nodePositions: z.record(z.string(), PaymentRouteNodePositionSchema).default({}),
  viewport: z
    .object({
      x: z.number(),
      y: z.number(),
      zoom: z.number().positive(),
    })
    .default({
      x: 0,
      y: 0,
      zoom: 1,
    }),
});

export const PaymentRouteDraftSchema = z
  .object({
    additionalFees: z.array(PaymentRouteFeeSchema).default([]),
    amountInMinor: positiveMinorStringSchema,
    amountOutMinor: positiveMinorStringSchema,
    currencyInId: z.uuid(),
    currencyOutId: z.uuid(),
    legs: z.array(PaymentRouteLegSchema).min(1),
    lockedSide: PaymentRouteLockedSideSchema,
    participants: z.array(PaymentRouteParticipantRefSchema).min(2),
  })
  .superRefine((value, context) => {
    if (value.participants.length !== value.legs.length + 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Participants count must equal legs + 1",
        path: ["participants"],
      });
    }

    const firstParticipant = value.participants[0];
    const lastParticipant = value.participants[value.participants.length - 1];

    if (firstParticipant?.kind !== "customer") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "The first participant must be a customer",
        path: ["participants", 0, "kind"],
      });
    }

    if (lastParticipant?.kind === "customer") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "The destination participant cannot be a customer",
        path: ["participants", value.participants.length - 1, "kind"],
      });
    }

    for (let index = 1; index < value.participants.length; index += 1) {
      const participant = value.participants[index];
      if (participant?.kind === "customer") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Only the first participant can be a customer",
          path: ["participants", index, "kind"],
        });
      }
    }

    const seenNodeIds = new Set<string>();
    value.participants.forEach((participant, index) => {
      if (seenNodeIds.has(participant.nodeId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Participant nodeId must be unique",
          path: ["participants", index, "nodeId"],
        });
      }
      seenNodeIds.add(participant.nodeId);
    });

    if (value.legs[0]?.fromCurrencyId !== value.currencyInId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "The first leg must start with currencyInId",
        path: ["legs", 0, "fromCurrencyId"],
      });
    }

    if (value.legs[value.legs.length - 1]?.toCurrencyId !== value.currencyOutId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "The last leg must end with currencyOutId",
        path: ["legs", value.legs.length - 1, "toCurrencyId"],
      });
    }

    for (let index = 1; index < value.legs.length; index += 1) {
      const previous = value.legs[index - 1];
      const current = value.legs[index];

      if (
        previous?.toCurrencyId &&
        current?.fromCurrencyId &&
        previous.toCurrencyId !== current.fromCurrencyId
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Leg currencies must be continuous",
          path: ["legs", index, "fromCurrencyId"],
        });
      }
    }
  });

export const PAYMENT_ROUTE_TEMPLATES_SORTABLE_COLUMNS = [
  "name",
  "status",
  "createdAt",
  "updatedAt",
] as const;

interface PaymentRouteTemplatesListFilters {
  name: { kind: "string"; cardinality: "single" };
  status: {
    kind: "string";
    cardinality: "single";
    enumValues: typeof PAYMENT_ROUTE_TEMPLATE_STATUS_VALUES;
  };
}

export const PAYMENT_ROUTE_TEMPLATES_LIST_CONTRACT: ListQueryContract<
  typeof PAYMENT_ROUTE_TEMPLATES_SORTABLE_COLUMNS,
  PaymentRouteTemplatesListFilters
> = {
  defaultSort: { id: "updatedAt", desc: true },
  sortableColumns: PAYMENT_ROUTE_TEMPLATES_SORTABLE_COLUMNS,
  filters: {
    name: { kind: "string", cardinality: "single" },
    status: {
      kind: "string",
      cardinality: "single",
      enumValues: PAYMENT_ROUTE_TEMPLATE_STATUS_VALUES,
    },
  },
};

export const ListPaymentRouteTemplatesQuerySchema =
  createListQuerySchemaFromContract(PAYMENT_ROUTE_TEMPLATES_LIST_CONTRACT);

export type PaymentRouteTemplateStatus = z.infer<
  typeof PaymentRouteTemplateStatusSchema
>;
export type PaymentRouteParticipantKind = z.infer<
  typeof PaymentRouteParticipantKindSchema
>;
export type PaymentRouteLegKind = z.infer<typeof PaymentRouteLegKindSchema>;
export type PaymentRouteFeeKind = z.infer<typeof PaymentRouteFeeKindSchema>;
export type PaymentRouteLockedSide = z.infer<
  typeof PaymentRouteLockedSideSchema
>;
export type PaymentRouteParticipantRef = z.infer<
  typeof PaymentRouteParticipantRefSchema
>;
export type PaymentRouteFee = z.infer<typeof PaymentRouteFeeSchema>;
export type PaymentRouteLeg = z.infer<typeof PaymentRouteLegSchema>;
export type PaymentRouteVisualMetadata = z.infer<
  typeof PaymentRouteVisualMetadataSchema
>;
export type PaymentRouteDraft = z.infer<typeof PaymentRouteDraftSchema>;
export type ListPaymentRouteTemplatesQuery = z.infer<
  typeof ListPaymentRouteTemplatesQuerySchema
>;
