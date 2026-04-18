import { z } from "zod";

import {
  CommercialRouteFeeKindSchema,
  CommercialRouteFeeSchema,
  type CommercialRouteFee,
  type CommercialRouteFeeKind,
} from "@bedrock/agreements/contracts";
import {
  createListQuerySchemaFromContract,
  type ListQueryContract,
} from "@bedrock/shared/core/pagination";

const positiveMinorStringSchema = z
  .string()
  .regex(/^\d+$/, "Minor amount must be a positive integer string")
  .refine((value) => BigInt(value) > 0n, "Minor amount must be greater than 0");

export const ABSTRACT_PAYMENT_ROUTE_SOURCE_DISPLAY_NAME = "Клиент";
export const ABSTRACT_PAYMENT_ROUTE_DESTINATION_DISPLAY_NAME =
  "Бенефициар";

export const PAYMENT_ROUTE_TEMPLATE_STATUS_VALUES = [
  "active",
  "archived",
] as const;
export const PAYMENT_ROUTE_PARTICIPANT_KIND_VALUES = [
  "customer",
  "counterparty",
  "organization",
] as const;
export const PAYMENT_ROUTE_PARTICIPANT_ROLE_VALUES = [
  "source",
  "hop",
  "destination",
] as const;
export const PAYMENT_ROUTE_PARTICIPANT_BINDING_VALUES = [
  "abstract",
  "bound",
] as const;
export const PAYMENT_ROUTE_LEG_SEMANTIC_TAG_VALUES = [
  "collection",
  "payout",
  "intracompany_transfer",
  "intercompany_transfer",
  "counterparty_transfer",
  "transfer",
  "fx_conversion",
] as const;
export const PAYMENT_ROUTE_LEG_TREASURY_OPERATION_HINT_VALUES = [
  "payin",
  "payout",
  "intracompany_transfer",
  "intercompany_funding",
  "fx_conversion",
] as const;
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
export const PaymentRouteParticipantRoleSchema = z.enum(
  PAYMENT_ROUTE_PARTICIPANT_ROLE_VALUES,
);
export const PaymentRouteParticipantBindingSchema = z.enum(
  PAYMENT_ROUTE_PARTICIPANT_BINDING_VALUES,
);
export const PaymentRouteLegSemanticTagSchema = z.enum(
  PAYMENT_ROUTE_LEG_SEMANTIC_TAG_VALUES,
);
export const PaymentRouteLegTreasuryOperationHintSchema = z.enum(
  PAYMENT_ROUTE_LEG_TREASURY_OPERATION_HINT_VALUES,
);
export const PaymentRouteFeeKindSchema = CommercialRouteFeeKindSchema;
export const PaymentRouteLockedSideSchema = z.enum(
  PAYMENT_ROUTE_LOCKED_SIDE_VALUES,
);
export const PaymentRouteSnapshotPolicySchema = z.literal("clone_on_attach");

interface PaymentRouteLegacyParticipantRef {
  displayName: string;
  entityId: string;
  kind: z.infer<typeof PaymentRouteParticipantKindSchema>;
  nodeId: string;
}

const PaymentRouteAbstractSourceParticipantRefSchema = z.object({
  binding: z.literal("abstract"),
  displayName: z.string().trim().min(1),
  entityId: z.null(),
  entityKind: z.null(),
  nodeId: z.string().trim().min(1),
  requisiteId: z.null().default(null),
  role: z.literal("source"),
});

const PaymentRouteBoundSourceParticipantRefSchema = z.object({
  binding: z.literal("bound"),
  displayName: z.string().trim().min(1),
  entityId: z.uuid(),
  entityKind: z.literal("customer"),
  nodeId: z.string().trim().min(1),
  requisiteId: z.null().default(null),
  role: z.literal("source"),
});

const PaymentRouteAbstractDestinationParticipantRefSchema = z.object({
  binding: z.literal("abstract"),
  displayName: z.string().trim().min(1),
  entityId: z.null(),
  entityKind: z.null(),
  nodeId: z.string().trim().min(1),
  requisiteId: z.null().default(null),
  role: z.literal("destination"),
});

const PaymentRouteBoundDestinationParticipantRefSchema = z.object({
  binding: z.literal("bound"),
  displayName: z.string().trim().min(1),
  entityId: z.uuid(),
  entityKind: z.enum(["organization", "counterparty"]),
  nodeId: z.string().trim().min(1),
  requisiteId: z.uuid().nullable().default(null),
  role: z.literal("destination"),
});

const PaymentRouteHopParticipantRefSchema = z.object({
  binding: z.literal("bound"),
  displayName: z.string().trim().min(1),
  entityId: z.uuid(),
  entityKind: z.enum(["organization", "counterparty"]),
  nodeId: z.string().trim().min(1),
  requisiteId: z.uuid().nullable().default(null),
  role: z.literal("hop"),
});

export const PaymentRouteParticipantRefSchema = z.union([
  PaymentRouteAbstractSourceParticipantRefSchema,
  PaymentRouteBoundSourceParticipantRefSchema,
  PaymentRouteAbstractDestinationParticipantRefSchema,
  PaymentRouteBoundDestinationParticipantRefSchema,
  PaymentRouteHopParticipantRefSchema,
]);

export const PaymentRouteFeeSchema = CommercialRouteFeeSchema;

export const PaymentRouteLegSchema = z
  .object({
    fees: z.array(PaymentRouteFeeSchema).default([]),
    fromCurrencyId: z.uuid(),
    id: z.string().trim().min(1),
    toCurrencyId: z.uuid(),
  })
  .strict();

const PaymentRouteNodePositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const PaymentRouteVisualMetadataSchema = z.object({
  nodePositions: z.record(z.string(), PaymentRouteNodePositionSchema).default(
    {},
  ),
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isLegacyPaymentRouteParticipantRef(
  value: unknown,
): value is PaymentRouteLegacyParticipantRef {
  return (
    isRecord(value) &&
    typeof value.kind === "string" &&
    !("role" in value) &&
    !("binding" in value)
  );
}

export function normalizePaymentRouteParticipantRef(input: {
  index: number;
  participant: unknown;
  total: number;
}) {
  if (isLegacyPaymentRouteParticipantRef(input.participant)) {
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
    if (input.participant.role === "source") {
      return {
        ...input.participant,
        displayName: ABSTRACT_PAYMENT_ROUTE_SOURCE_DISPLAY_NAME,
        entityId: null,
        entityKind: null,
        requisiteId: null,
      };
    }

    if (input.participant.role === "destination") {
      return {
        ...input.participant,
        displayName: ABSTRACT_PAYMENT_ROUTE_DESTINATION_DISPLAY_NAME,
        entityId: null,
        entityKind: null,
        requisiteId: null,
      };
    }
  }

  return input.participant;
}

export function normalizePaymentRouteDraft(input: unknown) {
  if (!isRecord(input) || !Array.isArray(input.participants)) {
    return input;
  }

  const participants = input.participants.map((participant, index, items) =>
    normalizePaymentRouteParticipantRef({
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
export type PaymentRouteParticipantRole = z.infer<
  typeof PaymentRouteParticipantRoleSchema
>;
export type PaymentRouteParticipantBinding = z.infer<
  typeof PaymentRouteParticipantBindingSchema
>;
export type PaymentRouteLegSemanticTag = z.infer<
  typeof PaymentRouteLegSemanticTagSchema
>;
export type PaymentRouteLegTreasuryOperationHint = z.infer<
  typeof PaymentRouteLegTreasuryOperationHintSchema
>;
export type PaymentRouteFeeKind = CommercialRouteFeeKind;
export type PaymentRouteLockedSide = z.infer<
  typeof PaymentRouteLockedSideSchema
>;
export type PaymentRouteParticipantRef = z.infer<
  typeof PaymentRouteParticipantRefSchema
>;
export type PaymentRouteFee = CommercialRouteFee;
export type PaymentRouteLeg = z.infer<typeof PaymentRouteLegSchema>;
export type PaymentRouteVisualMetadata = z.infer<
  typeof PaymentRouteVisualMetadataSchema
>;
export type PaymentRouteDraft = z.infer<typeof PaymentRouteDraftSchema>;
export type ListPaymentRouteTemplatesQuery = z.infer<
  typeof ListPaymentRouteTemplatesQuerySchema
>;

export function getPaymentRouteParticipantOperationalCurrency(input: {
  draft: Pick<
    PaymentRouteDraft,
    "currencyInId" | "currencyOutId" | "legs" | "participants"
  >;
  participantIndex: number;
}) {
  const participant = input.draft.participants[input.participantIndex];

  if (!participant) {
    return null;
  }

  if (participant.role === "source") {
    return input.draft.legs[0]?.fromCurrencyId ?? input.draft.currencyInId;
  }

  if (participant.role === "destination") {
    return (
      input.draft.legs[input.draft.legs.length - 1]?.toCurrencyId ??
      input.draft.currencyOutId
    );
  }

  return (
    input.draft.legs[input.participantIndex - 1]?.toCurrencyId ??
    input.draft.legs[input.participantIndex]?.fromCurrencyId ??
    null
  );
}

const PAYMENT_ROUTE_LEG_SEMANTIC_LABELS: Record<
  PaymentRouteLegSemanticTag,
  string
> = {
  collection: "Сбор",
  counterparty_transfer: "Перевод через контрагента",
  fx_conversion: "Обмен",
  intercompany_transfer: "Межкомпанейский перевод",
  intracompany_transfer: "Внутренний перевод",
  payout: "Выплата",
  transfer: "Перевод",
};

const PAYMENT_ROUTE_LEG_TREASURY_OPERATION_HINTS: Partial<
  Record<
    PaymentRouteLegSemanticTag,
    PaymentRouteLegTreasuryOperationHint
  >
> = {
  collection: "payin",
  fx_conversion: "fx_conversion",
  intercompany_transfer: "intercompany_funding",
  intracompany_transfer: "intracompany_transfer",
  payout: "payout",
};

export function derivePaymentRouteLegSemantics(input: {
  draft: Pick<PaymentRouteDraft, "legs" | "participants">;
  legIndex: number;
}): PaymentRouteLegSemanticTag[] {
  const fromParticipant = input.draft.participants[input.legIndex];
  const leg = input.draft.legs[input.legIndex];
  const toParticipant = input.draft.participants[input.legIndex + 1];

  if (!fromParticipant || !leg || !toParticipant) {
    return [];
  }

  const tags: PaymentRouteLegSemanticTag[] = [];
  const isCollection = fromParticipant.role === "source";
  const isPayout = toParticipant.role === "destination";

  if (isCollection) {
    tags.push("collection");
  }

  if (isPayout) {
    tags.push("payout");
  }

  if (!isCollection && !isPayout) {
    if (
      fromParticipant.binding === "bound" &&
      toParticipant.binding === "bound" &&
      fromParticipant.entityKind === "organization" &&
      toParticipant.entityKind === "organization"
    ) {
      tags.push(
        fromParticipant.entityId === toParticipant.entityId
          ? "intracompany_transfer"
          : "intercompany_transfer",
      );
    } else if (
      (fromParticipant.binding === "bound" &&
        fromParticipant.entityKind === "counterparty") ||
      (toParticipant.binding === "bound" &&
        toParticipant.entityKind === "counterparty")
    ) {
      tags.push("counterparty_transfer");
    } else {
      tags.push("transfer");
    }
  }

  if (leg.fromCurrencyId !== leg.toCurrencyId) {
    tags.push("fx_conversion");
  }

  return tags;
}

export function formatPaymentRouteLegSemantics(
  semantics: PaymentRouteLegSemanticTag[],
) {
  return semantics
    .map((semantic) => PAYMENT_ROUTE_LEG_SEMANTIC_LABELS[semantic] ?? semantic)
    .join(" + ");
}

export function derivePaymentRouteLegTreasuryOperationHints(
  semantics: PaymentRouteLegSemanticTag[],
): PaymentRouteLegTreasuryOperationHint[] {
  const hints = new Set<PaymentRouteLegTreasuryOperationHint>();

  for (const semantic of semantics) {
    const hint = PAYMENT_ROUTE_LEG_TREASURY_OPERATION_HINTS[semantic];

    if (hint) {
      hints.add(hint);
    }
  }

  return Array.from(hints);
}
