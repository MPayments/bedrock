import {
  PaymentRouteDraftSchema,
  PaymentRouteVisualMetadataSchema,
  type PaymentRouteCalculation,
  type PaymentRouteDraft,
  type PaymentRouteFee,
  type PaymentRouteParticipantKind,
  type PaymentRouteParticipantRef,
  type PaymentRouteTemplate,
  type PaymentRouteVisualMetadata,
} from "@bedrock/treasury/contracts";
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

const DEFAULT_VIEWPORT = {
  x: 0,
  y: 0,
  zoom: 1,
} as const;

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function cloneDraft(draft: PaymentRouteDraft) {
  return PaymentRouteDraftSchema.parse(structuredClone(draft));
}

function cloneVisual(visual: PaymentRouteVisualMetadata) {
  return PaymentRouteVisualMetadataSchema.parse(structuredClone(visual));
}

function getDefaultEntityOption(options: PaymentRouteConstructorOptions) {
  return getEntityOptions(options)[0] ?? null;
}

function createParticipantRef(
  option: PaymentRouteSelectableParticipantOption,
  nodeId = createId("route-node"),
): PaymentRouteParticipantRef {
  return {
    displayName: option.shortLabel,
    entityId: option.id,
    kind: option.kind,
    nodeId,
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

export function getSelectableParticipantOptions(input: {
  index: number;
  options: PaymentRouteConstructorOptions;
}) {
  if (input.index === 0) {
    return getCustomerOptions(input.options);
  }

  return getEntityOptions(input.options);
}

export function findSelectableParticipantOption(input: {
  entityId: string;
  kind: PaymentRouteParticipantKind;
  options: PaymentRouteConstructorOptions;
}) {
  return getSelectableParticipantOptions({
    index: input.kind === "customer" ? 0 : 1,
    options: input.options,
  }).find(
    (option) => option.id === input.entityId && option.kind === input.kind,
  ) ?? null;
}

export function createPaymentRouteSeed(
  options: PaymentRouteConstructorOptions,
): PaymentRouteEditorState | null {
  const customer = getCustomerOptions(options)[0] ?? null;
  const destination = getDefaultEntityOption(options);
  const currency = options.currencies[0] ?? null;

  if (!customer || !destination || !currency) {
    return null;
  }

  const amountMinor = toMinorAmountString("12000", currency.code, {
    requirePositive: true,
  });
  const source = createParticipantRef(customer);
  const target = createParticipantRef(destination);
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
        kind: "transfer",
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
      viewport: DEFAULT_VIEWPORT,
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

  next.viewport = next.viewport ?? { ...DEFAULT_VIEWPORT };

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

  return {
    ...input.state,
    draft: PaymentRouteDraftSchema.parse(draft),
  };
}

export function setParticipantOption(input: {
  entityId: string;
  index: number;
  kind: PaymentRouteParticipantKind;
  options: PaymentRouteConstructorOptions;
  state: PaymentRouteEditorState;
}): PaymentRouteEditorState {
  const option = findSelectableParticipantOption({
    entityId: input.entityId,
    kind: input.kind,
    options: input.options,
  });

  if (!option) {
    return input.state;
  }

  const draft = cloneDraft(input.state.draft);
  draft.participants[input.index] = createParticipantRef(
    option,
    draft.participants[input.index]!.nodeId,
  );

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
  const leg = draft.legs.find((item) => item.id === legId);

  if (!leg) {
    return state;
  }

  Object.assign(leg, patch);

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

function createDefaultPercentFee(): PaymentRouteFee {
  return {
    id: createId("route-fee"),
    kind: "percent",
    label: "Комиссия",
    percentage: "0.10",
  };
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
  const fee = createDefaultFixedFee(state.draft.currencyOutId);

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

  const participant = createParticipantRef(option);
  const trailingLeg = {
    fees: [],
    fromCurrencyId: splitLeg.toCurrencyId,
    id: createId("route-leg"),
    kind: "transfer" as const,
    toCurrencyId:
      input.afterLegIndex === draft.legs.length - 1
        ? draft.currencyOutId
        : draft.legs[input.afterLegIndex + 1]!.fromCurrencyId,
  };

  draft.participants.splice(input.afterLegIndex + 1, 0, participant);
  draft.legs.splice(input.afterLegIndex + 1, 0, trailingLeg);

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
  draft.participants.splice(participantIndex, 1);
  draft.participants.splice(targetIndex, 0, participant);

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

export function getParticipantKindOptions(index: number, draft: PaymentRouteDraft) {
  if (index === 0) {
    return ["customer"] as const;
  }

  if (index === draft.participants.length - 1) {
    return ["organization", "counterparty"] as const satisfies readonly PaymentRouteParticipantKind[];
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
  kind: PaymentRouteParticipantKind;
  options: PaymentRouteConstructorOptions;
  state: PaymentRouteEditorState;
}): PaymentRouteEditorState {
  const available = getSelectableParticipantOptions({
    index: input.index,
    options: input.options,
  }).filter((option) => option.kind === input.kind);
  const option = available[0] ?? null;

  if (!option) {
    return input.state;
  }

  return setParticipantOption({
    entityId: option.id,
    index: input.index,
    kind: option.kind,
    options: input.options,
    state: input.state,
  });
}
