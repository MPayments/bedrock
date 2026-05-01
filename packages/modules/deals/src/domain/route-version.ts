import { z } from "zod";

import { parseDecimalToFraction } from "@bedrock/shared/money/math";

export const DEAL_ROUTE_PARTICIPANT_KIND_VALUES = [
  "customer",
  "counterparty",
  "organization",
] as const;
export const DEAL_ROUTE_PARTICIPANT_ROLE_VALUES = [
  "source",
  "hop",
  "destination",
] as const;
export const DEAL_ROUTE_PARTICIPANT_BINDING_VALUES = [
  "abstract",
  "bound",
] as const;
export const DEAL_ROUTE_FEE_KIND_VALUES = [
  "gross_percent",
  "net_percent",
  "fixed",
  "fx_spread",
] as const;
export const DEAL_ROUTE_FEE_APPLICATION_VALUES = [
  "embedded_in_rate",
  "deducted_from_flow",
  "separate_charge",
] as const;
export const DEAL_ROUTE_LOCKED_SIDE_VALUES = [
  "currency_in",
  "currency_out",
] as const;

export type DealRouteParticipantKind =
  (typeof DEAL_ROUTE_PARTICIPANT_KIND_VALUES)[number];
export type DealRouteParticipantRole =
  (typeof DEAL_ROUTE_PARTICIPANT_ROLE_VALUES)[number];
export type DealRouteParticipantBinding =
  (typeof DEAL_ROUTE_PARTICIPANT_BINDING_VALUES)[number];
export type DealRouteFeeKind = (typeof DEAL_ROUTE_FEE_KIND_VALUES)[number];
export type DealRouteFeeApplication =
  (typeof DEAL_ROUTE_FEE_APPLICATION_VALUES)[number];
export type DealRouteLockedSide =
  (typeof DEAL_ROUTE_LOCKED_SIDE_VALUES)[number];

export type DealRouteParticipantRef =
  | {
      binding: "abstract";
      displayName: string;
      entityId: null;
      entityKind: null;
      nodeId: string;
      requisiteId: null;
      role: "source" | "destination";
    }
  | {
      binding: "bound";
      displayName: string;
      entityId: string;
      entityKind: "customer";
      nodeId: string;
      requisiteId: null;
      role: "source";
    }
  | {
      binding: "bound";
      displayName: string;
      entityId: string;
      entityKind: "organization" | "counterparty";
      nodeId: string;
      requisiteId: string | null;
      role: "destination" | "hop";
    };

export interface DealRouteFee {
  amountMinor?: string;
  application: DealRouteFeeApplication;
  currencyId?: string | null;
  id: string;
  kind: DealRouteFeeKind;
  label?: string;
  percentage?: string;
}

export interface DealRouteLeg {
  fees: DealRouteFee[];
  fromCurrencyId: string;
  id: string;
  toCurrencyId: string;
}

export interface DealRouteVersionSnapshot {
  additionalFees: DealRouteFee[];
  amountInMinor: string;
  amountOutMinor: string;
  currencyInId: string;
  currencyOutId: string;
  legs: DealRouteLeg[];
  lockedSide: DealRouteLockedSide;
  participants: DealRouteParticipantRef[];
}

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

const FX_SPREAD_MAX_PERCENT = 10n;

export const DealRouteParticipantKindSchema = z.enum(
  DEAL_ROUTE_PARTICIPANT_KIND_VALUES,
);
export const DealRouteParticipantRoleSchema = z.enum(
  DEAL_ROUTE_PARTICIPANT_ROLE_VALUES,
);
export const DealRouteParticipantBindingSchema = z.enum(
  DEAL_ROUTE_PARTICIPANT_BINDING_VALUES,
);
export const DealRouteFeeKindSchema = z.enum(DEAL_ROUTE_FEE_KIND_VALUES);
export const DealRouteFeeApplicationSchema = z.enum(
  DEAL_ROUTE_FEE_APPLICATION_VALUES,
);
export const DealRouteLockedSideSchema = z.enum(DEAL_ROUTE_LOCKED_SIDE_VALUES);

interface DealRouteLegacyParticipantRef {
  displayName: string;
  entityId: string;
  kind: DealRouteParticipantKind;
  nodeId: string;
}

const DealRouteAbstractSourceParticipantRefSchema = z.object({
  binding: z.literal("abstract"),
  displayName: z.string().trim().min(1),
  entityId: z.null(),
  entityKind: z.null(),
  nodeId: z.string().trim().min(1),
  requisiteId: z.null().default(null),
  role: z.literal("source"),
});

const DealRouteBoundSourceParticipantRefSchema = z.object({
  binding: z.literal("bound"),
  displayName: z.string().trim().min(1),
  entityId: z.uuid(),
  entityKind: z.literal("customer"),
  nodeId: z.string().trim().min(1),
  requisiteId: z.null().default(null),
  role: z.literal("source"),
});

const DealRouteAbstractDestinationParticipantRefSchema = z.object({
  binding: z.literal("abstract"),
  displayName: z.string().trim().min(1),
  entityId: z.null(),
  entityKind: z.null(),
  nodeId: z.string().trim().min(1),
  requisiteId: z.null().default(null),
  role: z.literal("destination"),
});

const DealRouteBoundDestinationParticipantRefSchema = z.object({
  binding: z.literal("bound"),
  displayName: z.string().trim().min(1),
  entityId: z.uuid(),
  entityKind: z.enum(["organization", "counterparty"]),
  nodeId: z.string().trim().min(1),
  requisiteId: z.uuid().nullable().default(null),
  role: z.literal("destination"),
});

const DealRouteHopParticipantRefSchema = z.object({
  binding: z.literal("bound"),
  displayName: z.string().trim().min(1),
  entityId: z.uuid(),
  entityKind: z.enum(["organization", "counterparty"]),
  nodeId: z.string().trim().min(1),
  requisiteId: z.uuid().nullable().default(null),
  role: z.literal("hop"),
});

export const DealRouteParticipantRefSchema = z.union([
  DealRouteAbstractSourceParticipantRefSchema,
  DealRouteBoundSourceParticipantRefSchema,
  DealRouteAbstractDestinationParticipantRefSchema,
  DealRouteBoundDestinationParticipantRefSchema,
  DealRouteHopParticipantRefSchema,
]);

export const DealRouteFeeSchema = z
  .object({
    amountMinor: nonNegativeMinorStringSchema.optional(),
    application: DealRouteFeeApplicationSchema.optional(),
    currencyId: z.uuid().nullable().optional(),
    id: z.string().trim().min(1),
    kind: DealRouteFeeKindSchema,
    label: z.string().trim().min(1).optional(),
    percentage: positiveDecimalStringSchema.optional(),
  })
  .superRefine((value, context) => {
    if (value.kind === "fx_spread" && value.application === undefined) {
      value.application = "embedded_in_rate";
    }

    if (
      value.kind === "fx_spread" &&
      value.application !== "embedded_in_rate"
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "fx_spread fee must use embedded_in_rate application",
        path: ["application"],
      });
    }

    if (
      value.kind !== "fx_spread" &&
      value.application === "embedded_in_rate"
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "embedded_in_rate application is only supported for fx_spread",
        path: ["application"],
      });
    }

    if (value.kind === "fixed") {
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

      return;
    }

    if (!value.percentage) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${value.kind} fee requires percentage`,
        path: ["percentage"],
      });
    }

    if (value.amountMinor !== undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${value.kind} fee cannot define amountMinor`,
        path: ["amountMinor"],
      });
    }

    if (value.currencyId !== undefined && value.currencyId !== null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${value.kind} fee cannot define currencyId`,
        path: ["currencyId"],
      });
    }

    if (value.percentage) {
      try {
        const fraction = parseDecimalToFraction(value.percentage, {
          allowScientific: false,
        });
        const limit = value.kind === "fx_spread" ? FX_SPREAD_MAX_PERCENT : 100n;

        if (fraction.num >= fraction.den * limit) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${value.kind} fee must be lower than ${limit}%`,
            path: ["percentage"],
          });
        }
      } catch {
        // The base schema already reports the invalid value.
      }
    }
  });

export const DealRouteLegSchema = z
  .object({
    fees: z.array(DealRouteFeeSchema).default([]),
    fromCurrencyId: z.uuid(),
    id: z.string().trim().min(1),
    toCurrencyId: z.uuid(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.fromCurrencyId !== value.toCurrencyId) {
      return;
    }

    value.fees.forEach((fee, index) => {
      if (fee.kind === "fx_spread") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "fx_spread fee requires a currency-changing leg",
          path: ["fees", index, "kind"],
        });
      }
    });
  });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isLegacyDealRouteParticipantRef(
  value: unknown,
): value is DealRouteLegacyParticipantRef {
  return (
    isRecord(value) &&
    typeof value.kind === "string" &&
    !("role" in value) &&
    !("binding" in value)
  );
}

function normalizeDealRouteParticipantRef(input: {
  index: number;
  participant: unknown;
  total: number;
}) {
  if (isLegacyDealRouteParticipantRef(input.participant)) {
    const role =
      input.index === 0
        ? "source"
        : input.index === input.total - 1
          ? "destination"
          : "hop";

    return {
      binding: "bound" as const,
      displayName: input.participant.displayName,
      entityId: input.participant.entityId,
      entityKind: input.participant.kind,
      nodeId: input.participant.nodeId,
      requisiteId: null,
      role,
    };
  }

  if (!isRecord(input.participant)) {
    return input.participant;
  }

  if (input.participant.binding === "abstract") {
    return {
      ...input.participant,
      entityId: null,
      entityKind: null,
      requisiteId: null,
    };
  }

  return input.participant;
}

export function normalizeDealRouteVersionSnapshot(input: unknown) {
  if (!isRecord(input) || !Array.isArray(input.participants)) {
    return input;
  }

  const participants = input.participants.map((participant, index, items) =>
    normalizeDealRouteParticipantRef({
      index,
      participant,
      total: items.length,
    }),
  );

  return {
    ...input,
    participants,
  };
}

function normalizeRouteFeeApplication(
  fee: z.infer<typeof DealRouteFeeSchema>,
  location: "additional" | "leg",
): DealRouteFee {
  return {
    ...fee,
    application:
      fee.application ??
      (fee.kind === "fx_spread"
        ? "embedded_in_rate"
        : location === "additional"
          ? "separate_charge"
          : "deducted_from_flow"),
  };
}

export const DealRouteVersionSnapshotSchema = z
  .object({
    additionalFees: z.array(DealRouteFeeSchema).default([]),
    amountInMinor: positiveMinorStringSchema,
    amountOutMinor: positiveMinorStringSchema,
    currencyInId: z.uuid(),
    currencyOutId: z.uuid(),
    legs: z.array(DealRouteLegSchema).min(1),
    lockedSide: DealRouteLockedSideSchema,
    participants: z.array(DealRouteParticipantRefSchema).min(2),
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

    if (firstParticipant?.role !== "source") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "The first participant must be a source endpoint",
        path: ["participants", 0, "role"],
      });
    }

    if (lastParticipant?.role !== "destination") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "The last participant must be a destination endpoint",
        path: ["participants", value.participants.length - 1, "role"],
      });
    }

    for (let index = 1; index < value.participants.length - 1; index += 1) {
      const participant = value.participants[index];

      if (participant?.role !== "hop") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Intermediate participants must be hop nodes",
          path: ["participants", index, "role"],
        });
      }

      if (participant?.binding !== "bound") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Intermediate participants cannot be abstract",
          path: ["participants", index, "binding"],
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

    if (
      value.legs[value.legs.length - 1]?.toCurrencyId !== value.currencyOutId
    ) {
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

    value.additionalFees.forEach((fee, index) => {
      if (fee.kind === "fx_spread") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "fx_spread fee is only allowed inside a leg",
          path: ["additionalFees", index, "kind"],
        });
      }

      if (fee.application && fee.application !== "separate_charge") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Additional route fees must use separate_charge application",
          path: ["additionalFees", index, "application"],
        });
      }
    });
  })
  .transform(
    (value): DealRouteVersionSnapshot => ({
      ...value,
      additionalFees: value.additionalFees.map((fee) =>
        normalizeRouteFeeApplication(fee, "additional"),
      ),
      legs: value.legs.map((leg) => ({
        ...leg,
        fees: leg.fees.map((fee) => normalizeRouteFeeApplication(fee, "leg")),
      })),
    }),
  );
