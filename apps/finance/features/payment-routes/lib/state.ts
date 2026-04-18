import {
  ABSTRACT_PAYMENT_ROUTE_DESTINATION_DISPLAY_NAME,
  ABSTRACT_PAYMENT_ROUTE_SOURCE_DISPLAY_NAME,
  getPaymentRouteParticipantOperationalCurrency,
  PaymentRouteDraftSchema,
  type PaymentRouteParticipantBinding,
  type PaymentRouteParticipantRole,
  PaymentRouteVisualMetadataSchema,
  type PaymentRouteCalculation,
  type PaymentRouteDraft,
  type PaymentRouteFee,
  type PaymentRouteParticipantKind,
  type PaymentRouteParticipantRef,
  type PaymentRouteTemplate,
  type PaymentRouteVisualMetadata,
} from "@bedrock/calculations/contracts";
import { toMinorAmountString } from "@bedrock/shared/money";

import type { PaymentRouteConstructorOptions } from "./queries";

export type PaymentRouteEntityOption =
  | {
      id: string;
      kind: "counterparty";
      label: string;
      shortLabel: string;
    }
  | {
      id: string;
      kind: "organization";
      label: string;
      shortLabel: string;
    };

export type PaymentRouteSelectableParticipantOption =
  | PaymentRouteEntityOption
  | {
      id: string;
      kind: "customer";
      label: string;
      shortLabel: string;
    };

export type PaymentRouteEditorMode = "manual" | "graph";

export type PaymentRouteGraphSelection =
  | {
      kind: "leg";
      legId: string;
    }
  | {
      kind: "participant";
      nodeId: string;
    }
  | null;

export type PaymentRouteEditorState = {
  calculation: PaymentRouteCalculation | null;
  draft: PaymentRouteDraft;
  mode: PaymentRouteEditorMode;
  name: string;
  selection: PaymentRouteGraphSelection;
  templateId: string | null;
  status: PaymentRouteTemplate["status"] | null;
  visual: PaymentRouteVisualMetadata;
};

export const DEFAULT_PAYMENT_ROUTE_VIEWPORT = {
  x: 0,
  y: 0,
  zoom: 1,
} as const;

export function isDefaultPaymentRouteViewport(
  viewport: PaymentRouteVisualMetadata["viewport"],
) {
  return (
    viewport.x === DEFAULT_PAYMENT_ROUTE_VIEWPORT.x &&
    viewport.y === DEFAULT_PAYMENT_ROUTE_VIEWPORT.y &&
    viewport.zoom === DEFAULT_PAYMENT_ROUTE_VIEWPORT.zoom
  );
}

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function cloneDraft(draft: PaymentRouteDraft) {
  return PaymentRouteDraftSchema.parse(structuredClone(draft));
}

function supportsParticipantRequisites(
  participant: PaymentRouteDraft["participants"][number],
) {
  return (
    participant.binding === "bound" &&
    (participant.entityKind === "organization" ||
      participant.entityKind === "counterparty")
  );
}

function clearChangedParticipantRequisites(input: {
  nextDraft: PaymentRouteDraft;
  previousDraft: PaymentRouteDraft;
}) {
  const previousCurrencyByNodeId = new Map(
    input.previousDraft.participants.map((participant, index) => [
      participant.nodeId,
      getPaymentRouteParticipantOperationalCurrency({
        draft: input.previousDraft,
        participantIndex: index,
      }),
    ]),
  );

  input.nextDraft.participants = input.nextDraft.participants.map(
    (participant, index) => {
      if (!supportsParticipantRequisites(participant) || !participant.requisiteId) {
        return participant;
      }

      const previousCurrencyId =
        previousCurrencyByNodeId.get(participant.nodeId) ?? null;
      const nextCurrencyId = getPaymentRouteParticipantOperationalCurrency({
        draft: input.nextDraft,
        participantIndex: index,
      });

      if (!previousCurrencyId || previousCurrencyId === nextCurrencyId) {
        return participant;
      }

      return {
        ...participant,
        requisiteId: null,
      };
    },
  );

  return input.nextDraft;
}

function cloneVisual(visual: PaymentRouteVisualMetadata) {
  return PaymentRouteVisualMetadataSchema.parse(structuredClone(visual));
}

function getDefaultEntityOption(options: PaymentRouteConstructorOptions) {
  return getEntityOptions(options)[0] ?? null;
}

function createBoundParticipantRef(input: {
  nodeId?: string;
  option: PaymentRouteSelectableParticipantOption;
  role: PaymentRouteParticipantRole;
}): PaymentRouteParticipantRef {
  const nodeId = input.nodeId ?? createId("route-node");

  if (input.role === "source") {
    return {
      binding: "bound",
      displayName: input.option.shortLabel,
      entityId: input.option.id,
      entityKind: "customer",
      nodeId,
      requisiteId: null,
      role: "source",
    };
  }

  if (input.role === "destination") {
    return {
      binding: "bound",
      displayName: input.option.shortLabel,
      entityId: input.option.id,
      entityKind: input.option.kind as "counterparty" | "organization",
      nodeId,
      requisiteId: null,
      role: "destination",
    };
  }

  return {
    binding: "bound",
    displayName: input.option.shortLabel,
    entityId: input.option.id,
    entityKind: input.option.kind as "counterparty" | "organization",
    nodeId,
    requisiteId: null,
    role: "hop",
  };
}

function createAbstractEndpointParticipantRef(
  role: Extract<PaymentRouteParticipantRole, "destination" | "source">,
  nodeId = createId("route-node"),
): PaymentRouteParticipantRef {
  if (role === "source") {
    return {
      binding: "abstract",
      displayName: ABSTRACT_PAYMENT_ROUTE_SOURCE_DISPLAY_NAME,
      entityId: null,
      entityKind: null,
      nodeId,
      requisiteId: null,
      role: "source",
    };
  }

  return {
    binding: "abstract",
    displayName: ABSTRACT_PAYMENT_ROUTE_DESTINATION_DISPLAY_NAME,
    entityId: null,
    entityKind: null,
    nodeId,
    requisiteId: null,
    role: "destination",
  };
}

export function getEntityOptions(
  options: PaymentRouteConstructorOptions,
): PaymentRouteEntityOption[] {
  return [
    ...options.organizations.map((organization) => ({
      id: organization.id,
      kind: "organization" as const,
      label: organization.label,
      shortLabel: organization.shortName,
    })),
    ...options.counterparties.map((counterparty) => ({
      id: counterparty.id,
      kind: "counterparty" as const,
      label: counterparty.label,
      shortLabel: counterparty.shortName,
    })),
  ];
}

export function getCustomerOptions(
  options: PaymentRouteConstructorOptions,
): PaymentRouteSelectableParticipantOption[] {
  return options.customers.map((customer) => ({
    id: customer.id,
    kind: "customer" as const,
    label: customer.label,
    shortLabel: customer.name,
  }));
}

function getSelectableParticipantOptionsForRole(
  role: PaymentRouteParticipantRole,
  options: PaymentRouteConstructorOptions,
) {
  if (role === "source") {
    return getCustomerOptions(options);
  }

  return getEntityOptions(options);
}

export function getSelectableParticipantOptions(input: {
  options: PaymentRouteConstructorOptions;
  participant: PaymentRouteDraft["participants"][number];
}) {
  return getSelectableParticipantOptionsForRole(
    input.participant.role,
    input.options,
  );
}

export function findSelectableParticipantOption(input: {
  entityId: string;
  options: PaymentRouteConstructorOptions;
  role: PaymentRouteParticipantRole;
  entityKind: PaymentRouteParticipantKind;
}) {
  return getSelectableParticipantOptionsForRole(input.role, input.options).find(
    (option) =>
      option.id === input.entityId && option.kind === input.entityKind,
  ) ?? null;
}

export function createPaymentRouteSeed(
  options: PaymentRouteConstructorOptions,
): PaymentRouteEditorState | null {
  const currency = options.currencies[0] ?? null;

  if (!currency) {
    return null;
  }

  const amountMinor = toMinorAmountString("12000", currency.code, {
    requirePositive: true,
  });
  const source = createAbstractEndpointParticipantRef("source");
  const target = createAbstractEndpointParticipantRef("destination");
  const draft = PaymentRouteDraftSchema.parse({
    additionalFees: [],
    amountInMinor: amountMinor,
    amountOutMinor: amountMinor,
    currencyInId: currency.id,
    currencyOutId: currency.id,
    legs: [
      {
        fees: [],
        fromCurrencyId: currency.id,
        id: createId("route-leg"),
        toCurrencyId: currency.id,
      },
    ],
    lockedSide: "currency_in",
    participants: [source, target],
  });

  return {
    calculation: null,
    draft,
    mode: "manual",
    name: "Новый маршрут",
    selection: {
      kind: "leg",
      legId: draft.legs[0]!.id,
    },
    status: null,
    templateId: null,
    visual: ensureVisualMetadata(draft, {
      nodePositions: {},
      viewport: DEFAULT_PAYMENT_ROUTE_VIEWPORT,
    }),
  };
}

export function createPaymentRouteEditorStateFromTemplate(
  template: PaymentRouteTemplate,
): PaymentRouteEditorState {
  const draft = cloneDraft(template.draft);

  return {
    calculation: template.lastCalculation,
    draft,
    mode: "manual",
    name: template.name,
    selection: {
      kind: "leg",
      legId: draft.legs[0]!.id,
    },
    status: template.status,
    templateId: template.id,
    visual: ensureVisualMetadata(draft, template.visual),
  };
}

export function ensureVisualMetadata(
  draft: PaymentRouteDraft,
  visual: PaymentRouteVisualMetadata,
): PaymentRouteVisualMetadata {
  const next = cloneVisual(visual);
  const allowedNodeIds = new Set(draft.participants.map((participant) => participant.nodeId));

  Object.keys(next.nodePositions).forEach((nodeId) => {
    if (!allowedNodeIds.has(nodeId)) {
      delete next.nodePositions[nodeId];
    }
  });

  draft.participants.forEach((participant, index) => {
    next.nodePositions[participant.nodeId] ??= {
      x: index * 260,
      y: index % 2 === 0 ? 72 : 180,
    };
  });

  next.viewport = next.viewport ?? { ...DEFAULT_PAYMENT_ROUTE_VIEWPORT };

  return PaymentRouteVisualMetadataSchema.parse(next);
}

export function syncDraftAmounts(
  draft: PaymentRouteDraft,
  calculation: PaymentRouteCalculation | null,
): PaymentRouteDraft {
  if (!calculation) {
    return draft;
  }

  return PaymentRouteDraftSchema.parse({
    ...draft,
    amountInMinor: calculation.amountInMinor,
    amountOutMinor: calculation.amountOutMinor,
  });
}

export function setEditorMode(
  state: PaymentRouteEditorState,
  mode: PaymentRouteEditorMode,
): PaymentRouteEditorState {
  return {
    ...state,
    mode,
  };
}

export function setRouteName(
  state: PaymentRouteEditorState,
  name: string,
): PaymentRouteEditorState {
  return {
    ...state,
    name,
  };
}

export function setLockedSide(
  state: PaymentRouteEditorState,
  lockedSide: PaymentRouteDraft["lockedSide"],
): PaymentRouteEditorState {
  return {
    ...state,
    draft: PaymentRouteDraftSchema.parse({
      ...state.draft,
      lockedSide,
    }),
  };
}

export function setRouteAmount(input: {
  amountMinor: string;
  side: "in" | "out";
  state: PaymentRouteEditorState;
}): PaymentRouteEditorState {
  return {
    ...input.state,
    draft: PaymentRouteDraftSchema.parse({
      ...input.state.draft,
      ...(input.side === "in"
        ? { amountInMinor: input.amountMinor }
        : { amountOutMinor: input.amountMinor }),
    }),
  };
}

export function setRouteCurrency(input: {
  currencyId: string;
  side: "in" | "out";
  state: PaymentRouteEditorState;
}): PaymentRouteEditorState {
  const draft = cloneDraft(input.state.draft);

  if (input.side === "in") {
    draft.currencyInId = input.currencyId;
    draft.legs[0]!.fromCurrencyId = input.currencyId;
  } else {
    draft.currencyOutId = input.currencyId;
    draft.legs[draft.legs.length - 1]!.toCurrencyId = input.currencyId;
  }

  clearChangedParticipantRequisites({
    nextDraft: draft,
    previousDraft: input.state.draft,
  });

  return {
    ...input.state,
    draft: PaymentRouteDraftSchema.parse(draft),
  };
}

export function setParticipantOption(input: {
  entityId: string;
  index: number;
  entityKind: PaymentRouteParticipantKind;
  options: PaymentRouteConstructorOptions;
  state: PaymentRouteEditorState;
}): PaymentRouteEditorState {
  const participant = input.state.draft.participants[input.index];

  if (!participant) {
    return input.state;
  }

  const option = findSelectableParticipantOption({
    entityId: input.entityId,
    entityKind: input.entityKind,
    options: input.options,
    role: participant.role,
  });

  if (!option) {
    return input.state;
  }

  const draft = cloneDraft(input.state.draft);
  draft.participants[input.index] = createBoundParticipantRef({
    nodeId: draft.participants[input.index]!.nodeId,
    option,
    role: participant.role,
  });

  return {
    ...input.state,
    draft,
    visual: ensureVisualMetadata(draft, input.state.visual),
  };
}

export function setParticipantRequisiteId(input: {
  index: number;
  requisiteId: string | null;
  state: PaymentRouteEditorState;
}): PaymentRouteEditorState {
  const participant = input.state.draft.participants[input.index];

  if (!participant || !supportsParticipantRequisites(participant)) {
    return input.state;
  }

  const draft = cloneDraft(input.state.draft);
  const nextParticipant = draft.participants[input.index];

  if (!nextParticipant || !supportsParticipantRequisites(nextParticipant)) {
    return input.state;
  }

  nextParticipant.requisiteId = input.requisiteId;

  return {
    ...input.state,
    draft: PaymentRouteDraftSchema.parse(draft),
  };
}

export function setParticipantBinding(input: {
  binding: Extract<PaymentRouteParticipantBinding, "abstract" | "bound">;
  index: number;
  options: PaymentRouteConstructorOptions;
  state: PaymentRouteEditorState;
}): PaymentRouteEditorState {
  const participant = input.state.draft.participants[input.index];

  if (
    !participant ||
    participant.role === "hop" ||
    participant.binding === input.binding
  ) {
    return input.state;
  }

  const draft = cloneDraft(input.state.draft);
  const current = draft.participants[input.index]!;

  if (input.binding === "abstract") {
    draft.participants[input.index] = createAbstractEndpointParticipantRef(
      current.role as Extract<PaymentRouteParticipantRole, "destination" | "source">,
      current.nodeId,
    );

    return {
      ...input.state,
      draft,
      visual: ensureVisualMetadata(draft, input.state.visual),
    };
  }

  const option = getSelectableParticipantOptionsForRole(
    current.role,
    input.options,
  )[0];

  if (!option) {
    return input.state;
  }

  draft.participants[input.index] = createBoundParticipantRef({
    nodeId: current.nodeId,
    option,
    role: current.role,
  });

  return {
    ...input.state,
    draft,
    visual: ensureVisualMetadata(draft, input.state.visual),
  };
}

export function setLegField(
  state: PaymentRouteEditorState,
  legId: string,
  patch: Partial<PaymentRouteDraft["legs"][number]>,
): PaymentRouteEditorState {
  const draft = cloneDraft(state.draft);
  const legIndex = draft.legs.findIndex((item) => item.id === legId);
  const leg = draft.legs[legIndex];

  if (!leg) {
    return state;
  }

  Object.assign(leg, patch);

  if (patch.fromCurrencyId) {
    if (legIndex === 0) {
      draft.currencyInId = patch.fromCurrencyId;
    } else {
      draft.legs[legIndex - 1]!.toCurrencyId = patch.fromCurrencyId;
    }
  }

  if (patch.toCurrencyId) {
    if (legIndex === draft.legs.length - 1) {
      draft.currencyOutId = patch.toCurrencyId;
    } else {
      draft.legs[legIndex + 1]!.fromCurrencyId = patch.toCurrencyId;
    }
  }

  clearChangedParticipantRequisites({
    nextDraft: draft,
    previousDraft: state.draft,
  });

  return {
    ...state,
    draft: PaymentRouteDraftSchema.parse(draft),
  };
}

function createDefaultFixedFee(currencyId: string): PaymentRouteFee {
  return {
    amountMinor: "100",
    currencyId,
    id: createId("route-fee"),
    kind: "fixed",
    label: "Комиссия",
  };
}

function createDefaultAdditionalFee(currencyId: string): PaymentRouteFee {
  return {
    amountMinor: "100",
    currencyId,
    id: createId("route-fee"),
    kind: "fixed",
    label: "Доп. расход",
  };
}

function createDefaultPercentFee(): PaymentRouteFee {
  return {
    id: createId("route-fee"),
    kind: "percent",
    label: "Комиссия",
    percentage: "0.10",
  };
}

function reconnectLegCurrencies(draft: PaymentRouteDraft) {
  if (draft.legs.length === 0) {
    return draft;
  }

  draft.legs[0]!.fromCurrencyId = draft.currencyInId;

  for (let index = 1; index < draft.legs.length; index += 1) {
    draft.legs[index]!.fromCurrencyId = draft.legs[index - 1]!.toCurrencyId;
  }

  draft.legs[draft.legs.length - 1]!.toCurrencyId = draft.currencyOutId;

  return draft;
}

export function addLegFee(
  state: PaymentRouteEditorState,
  legId: string,
): PaymentRouteEditorState {
  const leg = state.draft.legs.find((item) => item.id === legId);
  if (!leg) {
    return state;
  }

  return setLegField(state, legId, {
    fees: [...leg.fees, createDefaultFixedFee(leg.fromCurrencyId)],
  });
}

export function updateLegFee(
  state: PaymentRouteEditorState,
  legId: string,
  feeId: string,
  updater: (fee: PaymentRouteFee) => PaymentRouteFee,
): PaymentRouteEditorState {
  const leg = state.draft.legs.find((item) => item.id === legId);
  if (!leg) {
    return state;
  }

  return setLegField(state, legId, {
    fees: leg.fees.map((fee) => (fee.id === feeId ? updater(fee) : fee)),
  });
}

export function removeLegFee(
  state: PaymentRouteEditorState,
  legId: string,
  feeId: string,
): PaymentRouteEditorState {
  const leg = state.draft.legs.find((item) => item.id === legId);
  if (!leg) {
    return state;
  }

  return setLegField(state, legId, {
    fees: leg.fees.filter((fee) => fee.id !== feeId),
  });
}

export function addAdditionalFee(
  state: PaymentRouteEditorState,
): PaymentRouteEditorState {
  const fee = createDefaultAdditionalFee(state.draft.currencyInId);

  return {
    ...state,
    draft: PaymentRouteDraftSchema.parse({
      ...state.draft,
      additionalFees: [...state.draft.additionalFees, fee],
    }),
  };
}

export function updateAdditionalFee(
  state: PaymentRouteEditorState,
  feeId: string,
  updater: (fee: PaymentRouteFee) => PaymentRouteFee,
): PaymentRouteEditorState {
  return {
    ...state,
    draft: PaymentRouteDraftSchema.parse({
      ...state.draft,
      additionalFees: state.draft.additionalFees.map((fee) =>
        fee.id === feeId ? updater(fee) : fee,
      ),
    }),
  };
}

export function removeAdditionalFee(
  state: PaymentRouteEditorState,
  feeId: string,
): PaymentRouteEditorState {
  return {
    ...state,
    draft: PaymentRouteDraftSchema.parse({
      ...state.draft,
      additionalFees: state.draft.additionalFees.filter((fee) => fee.id !== feeId),
    }),
  };
}

export function insertIntermediateParticipant(input: {
  options: PaymentRouteConstructorOptions;
  state: PaymentRouteEditorState;
  afterLegIndex: number;
}): PaymentRouteEditorState {
  const option = getDefaultEntityOption(input.options);
  if (!option) {
    return input.state;
  }

  const draft = cloneDraft(input.state.draft);
  const splitLeg = draft.legs[input.afterLegIndex];

  if (!splitLeg) {
    return input.state;
  }

  const participant = createBoundParticipantRef({
    option,
    role: "hop",
  });
  const trailingLeg = {
    fees: [],
    fromCurrencyId: splitLeg.toCurrencyId,
    id: createId("route-leg"),
    toCurrencyId:
      input.afterLegIndex === draft.legs.length - 1
        ? draft.currencyOutId
        : draft.legs[input.afterLegIndex + 1]!.fromCurrencyId,
  };

  draft.participants.splice(input.afterLegIndex + 1, 0, participant);
  draft.legs.splice(input.afterLegIndex + 1, 0, trailingLeg);
  clearChangedParticipantRequisites({
    nextDraft: draft,
    previousDraft: input.state.draft,
  });

  return {
    ...input.state,
    draft: PaymentRouteDraftSchema.parse(draft),
    selection: {
      kind: "participant",
      nodeId: participant.nodeId,
    },
    visual: ensureVisualMetadata(draft, input.state.visual),
  };
}

export function removeIntermediateParticipant(
  state: PaymentRouteEditorState,
  participantIndex: number,
): PaymentRouteEditorState {
  if (
    participantIndex <= 0 ||
    participantIndex >= state.draft.participants.length - 1
  ) {
    return state;
  }

  const draft = cloneDraft(state.draft);
  const previousLeg = draft.legs[participantIndex - 1];
  const nextLeg = draft.legs[participantIndex];

  if (!previousLeg || !nextLeg) {
    return state;
  }

  previousLeg.toCurrencyId = nextLeg.toCurrencyId;
  draft.participants.splice(participantIndex, 1);
  draft.legs.splice(participantIndex, 1);
  clearChangedParticipantRequisites({
    nextDraft: draft,
    previousDraft: state.draft,
  });

  return {
    ...state,
    draft: PaymentRouteDraftSchema.parse(draft),
    selection: {
      kind: "leg",
      legId: previousLeg.id,
    },
    visual: ensureVisualMetadata(draft, state.visual),
  };
}

export function moveIntermediateParticipant(input: {
  direction: "down" | "up";
  state: PaymentRouteEditorState;
  participantIndex: number;
}): PaymentRouteEditorState {
  const { participantIndex, state } = input;
  const targetIndex = input.direction === "up"
    ? participantIndex - 1
    : participantIndex + 1;

  if (
    participantIndex <= 0 ||
    participantIndex >= state.draft.participants.length - 1 ||
    targetIndex <= 0 ||
    targetIndex >= state.draft.participants.length - 1
  ) {
    return state;
  }

  const draft = cloneDraft(state.draft);
  const participant = draft.participants[participantIndex]!;
  const legIndex = participantIndex - 1;
  const leg = draft.legs[legIndex];

  draft.participants.splice(participantIndex, 1);
  draft.participants.splice(targetIndex, 0, participant);

  if (leg) {
    const targetLegIndex = input.direction === "up" ? legIndex - 1 : legIndex + 1;

    draft.legs.splice(legIndex, 1);
    draft.legs.splice(targetLegIndex, 0, leg);
    reconnectLegCurrencies(draft);
  }

  clearChangedParticipantRequisites({
    nextDraft: draft,
    previousDraft: state.draft,
  });

  return {
    ...state,
    draft: PaymentRouteDraftSchema.parse(draft),
    visual: ensureVisualMetadata(draft, state.visual),
  };
}

export function setVisualNodePosition(input: {
  nodeId: string;
  position: { x: number; y: number };
  state: PaymentRouteEditorState;
}): PaymentRouteEditorState {
  return {
    ...input.state,
    visual: PaymentRouteVisualMetadataSchema.parse({
      ...input.state.visual,
      nodePositions: {
        ...input.state.visual.nodePositions,
        [input.nodeId]: input.position,
      },
    }),
  };
}

export function setViewport(input: {
  state: PaymentRouteEditorState;
  viewport: PaymentRouteVisualMetadata["viewport"];
}): PaymentRouteEditorState {
  return {
    ...input.state,
    visual: PaymentRouteVisualMetadataSchema.parse({
      ...input.state.visual,
      viewport: input.viewport,
    }),
  };
}

export function setSelection(
  state: PaymentRouteEditorState,
  selection: PaymentRouteGraphSelection,
): PaymentRouteEditorState {
  return {
    ...state,
    selection,
  };
}

export function applyCalculation(
  state: PaymentRouteEditorState,
  calculation: PaymentRouteCalculation | null,
): PaymentRouteEditorState {
  const draft = syncDraftAmounts(state.draft, calculation);

  return {
    ...state,
    calculation,
    draft,
  };
}

export function createDuplicateRouteName(name: string) {
  return `${name} (копия)`;
}

export function getParticipantKindOptions(
  participant: PaymentRouteDraft["participants"][number],
) {
  if (participant.role === "source") {
    return ["customer"] as const;
  }

  return ["organization", "counterparty"] as const satisfies readonly PaymentRouteParticipantKind[];
}

export function changeFeeKind(input: {
  fallbackCurrencyId: string;
  fee: PaymentRouteFee;
  nextKind: PaymentRouteFee["kind"];
}) {
  if (input.nextKind === input.fee.kind) {
    return input.fee;
  }

  if (input.nextKind === "percent") {
    return createDefaultPercentFee();
  }

  return createDefaultFixedFee(
    input.fee.kind === "fixed" && input.fee.currencyId
      ? input.fee.currencyId
      : input.fallbackCurrencyId,
  );
}

export function changeParticipantKind(input: {
  index: number;
  entityKind: PaymentRouteParticipantKind;
  options: PaymentRouteConstructorOptions;
  state: PaymentRouteEditorState;
}): PaymentRouteEditorState {
  const participant = input.state.draft.participants[input.index];

  if (!participant) {
    return input.state;
  }

  const available = getSelectableParticipantOptions({
    options: input.options,
    participant,
  }).filter((option) => option.kind === input.entityKind);
  const option = available[0] ?? null;

  if (!option) {
    return input.state;
  }

  return setParticipantOption({
    entityId: option.id,
    entityKind: option.kind,
    index: input.index,
    options: input.options,
    state: input.state,
  });
}
