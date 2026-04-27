import {
  getPaymentRouteParticipantOperationalCurrency,
  PaymentRouteDraftSchema,
  type PaymentRouteDraft,
  type PaymentRouteParticipantRef,
} from "@bedrock/treasury/contracts";

import { getRequisiteKindLabel } from "@/features/entities/requisites-shared/lib/constants";
import { resolveLegacyRequisiteIdentity } from "@/features/entities/requisites-shared/lib/master-data";

import type { PaymentRouteCurrencyOption } from "./format";
import type { PaymentRouteConstructorOptions } from "./queries";

export type PaymentRouteOwnerRequisite = {
  currencyCode: string;
  currencyId: string;
  id: string;
  identity: string;
  isDefault: boolean;
  kind: "bank" | "blockchain" | "custodian" | "exchange";
  kindLabel: string;
  label: string;
  ownerId: string;
  ownerType: "counterparty" | "organization";
};

export type PaymentRouteOwnerRequisitesByKey = Record<
  string,
  PaymentRouteOwnerRequisite[]
>;

export type PaymentRouteOwnerRequisitesStatus = Record<
  string,
  {
    error: string | null;
    pending: boolean;
  }
>;

export type PaymentRouteRequisiteWarning = {
  createHref: string | null;
  message: string;
  ownerKey: string | null;
  participantNodeId: string;
  title: string;
};

export type PaymentRouteParticipantRequisiteContext = {
  createHref: string | null;
  matchingRequisites: PaymentRouteOwnerRequisite[];
  note: string | null;
  operationalCurrency: PaymentRouteCurrencyOption | null;
  ownerKey: string | null;
  ownerRequisites: PaymentRouteOwnerRequisite[];
  selectedRequisite: PaymentRouteOwnerRequisite | null;
  unresolvedKind: "no_matching" | "selection_required" | null;
};

type PaymentRouteParticipantGraphRow = {
  active: boolean;
  handleId: string | null;
  id: string;
  label: string;
  meta: string | null;
  selected: boolean;
  tone: "default" | "info" | "muted" | "warning";
};

export type PaymentRouteParticipantGraphRows = {
  connectionHandleId: string | null;
  rows: PaymentRouteParticipantGraphRow[];
};

function findCurrency(
  options: Pick<PaymentRouteConstructorOptions, "currencies">,
  currencyId: string | null,
) {
  if (!currencyId) {
    return null;
  }

  return options.currencies.find((currency) => currency.id === currencyId) ?? null;
}

function buildCreateRequisiteHref(input: {
  currencyId: string;
  ownerId: string;
  ownerType: "counterparty" | "organization";
}) {
  const params = new URLSearchParams({
    currencyId: input.currencyId,
    ownerId: input.ownerId,
    ownerType: input.ownerType,
  });

  return `/entities/requisites/create?${params.toString()}`;
}

function buildParticipantHandleId(input: {
  nodeId: string;
  scope: "customer" | "placeholder" | "requisite" | "unresolved";
  value: string;
}) {
  return `${input.nodeId}:${input.scope}:${input.value}`;
}

export function getPaymentRouteParticipantOwnerKey(
  participant: PaymentRouteParticipantRef,
) {
  if (
    participant.binding !== "bound" ||
    (participant.entityKind !== "organization" &&
      participant.entityKind !== "counterparty")
  ) {
    return null;
  }

  return `${participant.entityKind}:${participant.entityId}`;
}

function getPaymentRouteParticipantOperationalCurrencyOption(input: {
  draft: PaymentRouteDraft;
  index: number;
  options: Pick<PaymentRouteConstructorOptions, "currencies">;
}) {
  const currencyId = getPaymentRouteParticipantOperationalCurrency({
    draft: input.draft,
    participantIndex: input.index,
  });

  return findCurrency(input.options, currencyId);
}

export function getPaymentRouteParticipantRequisiteContext(input: {
  draft: PaymentRouteDraft;
  index: number;
  options: PaymentRouteConstructorOptions;
  requisitesByOwner: PaymentRouteOwnerRequisitesByKey;
}) {
  const participant = input.draft.participants[input.index];

  if (!participant) {
    return {
      createHref: null,
      matchingRequisites: [],
      note: null,
      operationalCurrency: null,
      ownerKey: null,
      ownerRequisites: [],
      selectedRequisite: null,
      unresolvedKind: null,
    } satisfies PaymentRouteParticipantRequisiteContext;
  }

  const operationalCurrency = getPaymentRouteParticipantOperationalCurrencyOption({
    draft: input.draft,
    index: input.index,
    options: input.options,
  });

  if (participant.binding === "abstract") {
    return {
      createHref: null,
      matchingRequisites: [],
      note: "Реквизиты появятся после выбора конкретного участника.",
      operationalCurrency,
      ownerKey: null,
      ownerRequisites: [],
      selectedRequisite: null,
      unresolvedKind: null,
    } satisfies PaymentRouteParticipantRequisiteContext;
  }

  if (participant.entityKind === "customer") {
    return {
      createHref: null,
      matchingRequisites: [],
      note: "Реквизиты клиентов в текущей модели пока не поддерживаются.",
      operationalCurrency,
      ownerKey: null,
      ownerRequisites: [],
      selectedRequisite: null,
      unresolvedKind: null,
    } satisfies PaymentRouteParticipantRequisiteContext;
  }

  const ownerKey = getPaymentRouteParticipantOwnerKey(participant);
  const ownerRequisites = ownerKey
    ? input.requisitesByOwner[ownerKey] ?? []
    : [];
  const matchingRequisites = operationalCurrency
    ? ownerRequisites.filter(
        (requisite) => requisite.currencyId === operationalCurrency.id,
      )
    : [];
  const selectedRequisite =
    matchingRequisites.find(
      (requisite) => requisite.id === participant.requisiteId,
    ) ?? null;

  return {
    createHref:
      operationalCurrency && participant.entityId
        ? buildCreateRequisiteHref({
            currencyId: operationalCurrency.id,
            ownerId: participant.entityId,
            ownerType: participant.entityKind,
          })
        : null,
    matchingRequisites,
    note: null,
    operationalCurrency,
    ownerKey,
    ownerRequisites,
    selectedRequisite,
    unresolvedKind:
      matchingRequisites.length === 0
        ? "no_matching"
        : selectedRequisite
          ? null
          : "selection_required",
  } satisfies PaymentRouteParticipantRequisiteContext;
}

function getRecommendedParticipantRequisiteId(
  context: PaymentRouteParticipantRequisiteContext,
) {
  if (context.matchingRequisites.length === 1) {
    return context.matchingRequisites[0]!.id;
  }

  const defaultRequisite =
    context.matchingRequisites.find((requisite) => requisite.isDefault) ?? null;

  return defaultRequisite?.id ?? null;
}

export function syncPaymentRouteDraftRequisites(input: {
  draft: PaymentRouteDraft;
  requisitesByOwner: PaymentRouteOwnerRequisitesByKey;
  statusByOwner: PaymentRouteOwnerRequisitesStatus;
  options: PaymentRouteConstructorOptions;
}) {
  let changed = false;

  const participants = input.draft.participants.map((participant, index) => {
    const context = getPaymentRouteParticipantRequisiteContext({
      draft: input.draft,
      index,
      options: input.options,
      requisitesByOwner: input.requisitesByOwner,
    });
    const ownerStatus = context.ownerKey
      ? input.statusByOwner[context.ownerKey]
      : null;

    if (context.ownerKey && (!ownerStatus || ownerStatus.pending || ownerStatus.error)) {
      return participant;
    }

    const nextRequisiteId = context.note
      ? null
      : context.selectedRequisite
        ? context.selectedRequisite.id
        : getRecommendedParticipantRequisiteId(context);

    if (participant.requisiteId === nextRequisiteId) {
      return participant;
    }

    changed = true;
    return {
      ...participant,
      requisiteId: nextRequisiteId,
    };
  });

  if (!changed) {
    return input.draft;
  }

  return PaymentRouteDraftSchema.parse({
    ...input.draft,
    participants,
  });
}

export function getPaymentRouteRequisiteWarnings(input: {
  draft: PaymentRouteDraft;
  options: PaymentRouteConstructorOptions;
  requisitesByOwner: PaymentRouteOwnerRequisitesByKey;
  statusByOwner: PaymentRouteOwnerRequisitesStatus;
}) {
  return input.draft.participants.flatMap((participant, index) => {
    const context = getPaymentRouteParticipantRequisiteContext({
      draft: input.draft,
      index,
      options: input.options,
      requisitesByOwner: input.requisitesByOwner,
    });
    const ownerStatus = context.ownerKey
      ? input.statusByOwner[context.ownerKey]
      : null;

    if (
      !context.unresolvedKind ||
      !context.operationalCurrency ||
      (context.ownerKey && (!ownerStatus || ownerStatus.pending || ownerStatus.error))
    ) {
      return [];
    }

    if (context.unresolvedKind === "no_matching") {
      return [
        {
          createHref: context.createHref,
          message: `Нет реквизитов в ${context.operationalCurrency.code}. Перед использованием шаблона добавьте подходящий реквизит.`,
          ownerKey: context.ownerKey,
          participantNodeId: participant.nodeId,
          title: participant.displayName,
        },
      ] satisfies PaymentRouteRequisiteWarning[];
    }

    return [
      {
        createHref: null,
        message: `Выберите реквизит в ${context.operationalCurrency.code}, чтобы шаблон был полностью готов к использованию.`,
        ownerKey: context.ownerKey,
        participantNodeId: participant.nodeId,
        title: participant.displayName,
      },
    ] satisfies PaymentRouteRequisiteWarning[];
  });
}

export function buildPaymentRouteParticipantGraphRows(input: {
  draft: PaymentRouteDraft;
  index: number;
  options: PaymentRouteConstructorOptions;
  requisitesByOwner: PaymentRouteOwnerRequisitesByKey;
}) {
  const participant = input.draft.participants[input.index];

  if (!participant) {
    return {
      connectionHandleId: null,
      rows: [],
    } satisfies PaymentRouteParticipantGraphRows;
  }

  const context = getPaymentRouteParticipantRequisiteContext(input);

  if (participant.binding === "abstract") {
    const handleId = buildParticipantHandleId({
      nodeId: participant.nodeId,
      scope: "placeholder",
      value: participant.role,
    });

    return {
      connectionHandleId: handleId,
      rows: [
        {
          active: true,
          handleId,
          id: handleId,
          label: "Реквизиты появятся после выбора участника",
          meta: null,
          selected: false,
          tone: "info",
        },
      ],
    } satisfies PaymentRouteParticipantGraphRows;
  }

  if (participant.entityKind === "customer") {
    const handleId = buildParticipantHandleId({
      nodeId: participant.nodeId,
      scope: "customer",
      value: "source",
    });

    return {
      connectionHandleId: handleId,
      rows: [
        {
          active: true,
          handleId,
          id: handleId,
          label: "Реквизиты клиентов пока не поддерживаются",
          meta: null,
          selected: false,
          tone: "info",
        },
      ],
    } satisfies PaymentRouteParticipantGraphRows;
  }

  const matchingRows = context.matchingRequisites.map((requisite) => {
    const handleId = buildParticipantHandleId({
      nodeId: participant.nodeId,
      scope: "requisite",
      value: requisite.id,
    });

    return {
      active: true,
      handleId,
      id: requisite.id,
      label: requisite.label,
      meta: `${requisite.identity} · ${requisite.kindLabel} · ${requisite.currencyCode}`,
      selected: requisite.id === participant.requisiteId,
      tone: "default",
    } satisfies PaymentRouteParticipantGraphRow;
  });
  const selectedRow = matchingRows.find((row) => row.selected) ?? null;

  if (selectedRow) {
    return {
      connectionHandleId: selectedRow.handleId,
      rows: [selectedRow],
    } satisfies PaymentRouteParticipantGraphRows;
  }

  const unresolvedHandleId = buildParticipantHandleId({
    nodeId: participant.nodeId,
    scope: "unresolved",
    value: context.operationalCurrency?.id ?? "none",
  });
  const unresolvedLabel =
    context.unresolvedKind === "no_matching" && context.operationalCurrency
      ? `Нет реквизитов в ${context.operationalCurrency.code}`
      : "Реквизит не выбран";
  const unresolvedMeta =
    context.unresolvedKind === "no_matching"
      ? "Создайте реквизит или смените участника."
      : context.operationalCurrency
        ? `Выберите реквизит в ${context.operationalCurrency.code}.`
        : "Выберите реквизит.";

    return {
      connectionHandleId: unresolvedHandleId,
      rows: [
        {
        active: true,
        handleId: unresolvedHandleId,
        id: unresolvedHandleId,
        label: unresolvedLabel,
        meta: unresolvedMeta,
        selected: false,
          tone: "warning",
        },
      ],
    } satisfies PaymentRouteParticipantGraphRows;
  }

export function mapPaymentRouteOwnerRequisite(input: {
  currencyCode: string;
  currencyId: string;
  id: string;
  identifiers: Array<{
    isPrimary: boolean;
    scheme: string;
    value: string;
  }>;
  isDefault: boolean;
  kind: "bank" | "blockchain" | "custodian" | "exchange";
  label: string;
  ownerId: string;
  ownerType: "counterparty" | "organization";
  beneficiaryName: string | null;
}) {
  return {
    currencyCode: input.currencyCode,
    currencyId: input.currencyId,
    id: input.id,
    identity: resolveLegacyRequisiteIdentity({
      beneficiaryName: input.beneficiaryName,
      identifiers: input.identifiers,
      kind: input.kind,
      label: input.label,
    }),
    isDefault: input.isDefault,
    kind: input.kind,
    kindLabel: getRequisiteKindLabel(input.kind),
    label: input.label,
    ownerId: input.ownerId,
    ownerType: input.ownerType,
  } satisfies PaymentRouteOwnerRequisite;
}
