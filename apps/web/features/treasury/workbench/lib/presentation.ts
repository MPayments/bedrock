import { minorToAmountString } from "@bedrock/shared/money";

import { formatDate, formatMajorAmount } from "@/lib/format";

import { getTreasuryAccountDisplayLabel, getTreasuryAccountProviderLabel } from "./display";
import {
  BENEFICIAL_OWNER_TYPE_LABELS,
  getStatusBadgeVariant,
  TREASURY_ACCOUNT_KIND_LABELS,
  TREASURY_EVENT_KIND_LABELS,
  TREASURY_INSTRUCTION_STATUS_LABELS,
  TREASURY_OPERATION_KIND_LABELS,
  TREASURY_POSITION_KIND_LABELS,
  TREASURY_SETTLEMENT_MODEL_LABELS,
} from "./labels";
import type {
  CounterpartyEndpointListItem,
  TreasuryAccountBalanceListItem,
  TreasuryAccountListItem,
  TreasuryEndpointListItem,
  TreasuryOperationListItem,
  TreasuryOperationTimeline,
  TreasuryPositionListItem,
  UnmatchedExternalRecordListItem,
} from "./queries";
import {
  buildInstructionRouteSummary,
  buildOperationNextStep,
  buildOperationRouteSummary,
  buildOperationStageSummary,
  buildOperationTimelineWarning,
  getBalanceGlossaryItems,
  getExceptionResolutionHint,
  getPositionKindMeaning,
  getTreasuryFlowDescriptor,
} from "./flows";

type LabelMaps = {
  assetLabels: Record<string, string>;
  counterpartyLabels?: Record<string, string>;
  customerLabels?: Record<string, string>;
  organizationLabels: Record<string, string>;
  providerLabels?: Record<string, string>;
};

function shortId(id: string) {
  return id.slice(0, 8);
}

export type TreasuryOperationTableRow = {
  id: string;
  shortId: string;
  kind: string;
  kindLabel: string;
  instructionStatus: string;
  statusLabel: string;
  statusVariant: ReturnType<typeof getStatusBadgeVariant>;
  settlementModelLabel: string;
  amountLabel: string;
  ownerLabel: string;
  routeLabel: string;
  nextStep: string;
  createdAt: string;
  createdAtLabel: string;
};

export type TreasuryPositionTableRow = {
  id: string;
  assetCode: string;
  kind: string;
  kindLabel: string;
  meaning: string;
  ownerLabel: string;
  relatedPartyLabel: string;
  beneficialOwnerTypeLabel: string;
  amountLabel: string;
  settledLabel: string;
  remainingMinor: string;
  remainingLabel: string;
  status: "open" | "closed";
  statusLabel: string;
  createdAt: string;
  createdAtLabel: string;
  canSettle: boolean;
};

export type TreasuryExceptionTableRow = {
  id: string;
  receivedAt: string;
  receivedAtLabel: string;
  sourceLabel: string;
  recordKindLabel: string;
  reasonLabel: string;
  reasonMetaLabel: string | null;
  resolutionHint: string;
  externalRecordId: string;
  externalRecordShortId: string;
  record: UnmatchedExternalRecordListItem;
};

export function formatMoneyValue(
  amountMinor: string | null | undefined,
  assetCode: string | null | undefined,
) {
  if (!amountMinor) {
    return "—";
  }

  const majorAmount = minorToAmountString(amountMinor, {
    currency: assetCode ?? undefined,
  });
  const formatted = formatMajorAmount(majorAmount);
  return assetCode ? `${formatted} ${assetCode}` : formatted;
}

function labelOrFallback(map: Record<string, string> | undefined, id: string | null | undefined) {
  if (!id) {
    return "—";
  }

  return map?.[id] ?? id;
}

export function formatBeneficialOwnerLabel(input: {
  beneficialOwnerId: string | null;
  beneficialOwnerType: string | null;
  counterpartyLabels?: Record<string, string>;
  customerLabels?: Record<string, string>;
  organizationLabels: Record<string, string>;
}) {
  if (!input.beneficialOwnerType || !input.beneficialOwnerId) {
    return "—";
  }

  if (input.beneficialOwnerType === "customer") {
    return input.customerLabels?.[input.beneficialOwnerId] ?? input.beneficialOwnerId;
  }

  if (input.beneficialOwnerType === "counterparty") {
    return input.counterpartyLabels?.[input.beneficialOwnerId] ?? input.beneficialOwnerId;
  }

  return input.organizationLabels[input.beneficialOwnerId] ?? input.beneficialOwnerId;
}

export function presentTreasuryAccounts(input: {
  accounts: TreasuryAccountListItem[];
  balances: TreasuryAccountBalanceListItem[];
  labels: Required<Pick<LabelMaps, "assetLabels" | "organizationLabels" | "providerLabels">>;
}) {
  const balancesByAccountId = new Map(
    input.balances.map((balance) => [balance.accountId, balance]),
  );

  return input.accounts.map((account) => {
    const balance = balancesByAccountId.get(account.id);
    const assetCode = input.labels.assetLabels[account.assetId] ?? account.assetId;
    const ownerLabel =
      input.labels.organizationLabels[account.ownerEntityId] ?? account.ownerEntityId;
    const operatorLabel =
      input.labels.organizationLabels[account.operatorEntityId] ??
      account.operatorEntityId;

    return {
      id: account.id,
      title: getTreasuryAccountDisplayLabel(account),
      subtitle: `${ownerLabel} · ${assetCode}`,
      kindLabel: TREASURY_ACCOUNT_KIND_LABELS[account.kind] ?? account.kind,
      providerLabel: getTreasuryAccountProviderLabel({
        account,
        providerLabels: input.labels.providerLabels,
      }),
      railLabel: account.networkOrRail ?? "—",
      ownerLabel,
      operatorLabel,
      flags: [
        account.canReceive ? "Получение" : null,
        account.canSend ? "Списание" : null,
      ].filter(Boolean) as string[],
      balances: [
        {
          label: "Учтено",
          value: formatMoneyValue(balance?.bookedMinor ?? "0", assetCode),
        },
        {
          label: "Доступно",
          value: formatMoneyValue(balance?.availableMinor ?? "0", assetCode),
        },
        {
          label: "Зарезервировано",
          value: formatMoneyValue(balance?.reservedMinor ?? "0", assetCode),
        },
        {
          label: "Ожидает",
          value: formatMoneyValue(balance?.pendingMinor ?? "0", assetCode),
        },
      ],
    };
  });
}

export function presentTreasuryOperationsTable(input: {
  accounts: TreasuryAccountListItem[];
  labels: Required<Pick<LabelMaps, "assetLabels" | "organizationLabels">>;
  operations: TreasuryOperationListItem[];
}) {
  const accountLabelById = Object.fromEntries(
    input.accounts.map((account) => [
      account.id,
      getTreasuryAccountDisplayLabel(account),
    ]),
  );

  return input.operations.map<TreasuryOperationTableRow>((operation) => {
    const assetCode =
      input.labels.assetLabels[operation.sourceAssetId ?? ""] ??
      input.labels.assetLabels[operation.destinationAssetId ?? ""] ??
      null;
    const sourceAccountLabel = operation.sourceAccountId
      ? accountLabelById[operation.sourceAccountId] ?? operation.sourceAccountId
      : "—";
    const destinationAccountLabel = operation.destinationAccountId
      ? accountLabelById[operation.destinationAccountId] ??
        operation.destinationAccountId
      : "—";

    return {
      id: operation.id,
      shortId: shortId(operation.id),
      kind: operation.operationKind,
      kindLabel:
        TREASURY_OPERATION_KIND_LABELS[operation.operationKind] ??
        operation.operationKind,
      instructionStatus: operation.instructionStatus,
      statusLabel:
        TREASURY_INSTRUCTION_STATUS_LABELS[operation.instructionStatus] ??
        operation.instructionStatus,
      statusVariant: getStatusBadgeVariant(operation.instructionStatus),
      settlementModelLabel:
        TREASURY_SETTLEMENT_MODEL_LABELS[operation.settlementModel] ??
        operation.settlementModel,
      amountLabel: formatMoneyValue(operation.sourceAmountMinor, assetCode),
      ownerLabel:
        input.labels.organizationLabels[operation.economicOwnerEntityId] ??
        operation.economicOwnerEntityId,
      routeLabel: buildOperationRouteSummary({
        destinationAccountLabel,
        operation,
        sourceAccountLabel,
        sourceAmountLabel: formatMoneyValue(operation.sourceAmountMinor, assetCode),
      }),
      nextStep: buildOperationNextStep({
        instructionCount: 0,
        positionCount: 0,
        status: operation.instructionStatus,
      }),
      createdAt: new Date(operation.createdAt).toISOString(),
      createdAtLabel: formatDate(operation.createdAt),
    };
  });
}

export function presentTreasuryOperationDetail(input: {
  accounts: TreasuryAccountListItem[];
  counterpartyEndpoints: CounterpartyEndpointListItem[];
  labels: Required<
    Pick<
      LabelMaps,
      "assetLabels" | "counterpartyLabels" | "customerLabels" | "organizationLabels"
    >
  >;
  operationTimeline: TreasuryOperationTimeline;
  treasuryEndpoints: TreasuryEndpointListItem[];
}) {
  const { eventItems, instructionItems, obligationItems, operation, positionItems } =
    input.operationTimeline;
  const flowDescriptor = getTreasuryFlowDescriptor(
    operation.operationKind === "fx_conversion"
      ? "fx_execute"
      : operation.operationKind,
  );

  const accountLabels = Object.fromEntries(
    input.accounts.map((account) => [
      account.id,
      getTreasuryAccountDisplayLabel(account),
    ]),
  );
  const treasuryEndpointById = Object.fromEntries(
    input.treasuryEndpoints.map((endpoint) => [endpoint.id, endpoint]),
  );
  const counterpartyEndpointById = Object.fromEntries(
    input.counterpartyEndpoints.map((endpoint) => [endpoint.id, endpoint]),
  );

  const sourceAssetCode =
    input.labels.assetLabels[operation.sourceAssetId ?? ""] ??
    input.labels.assetLabels[operation.destinationAssetId ?? ""] ??
    null;
  const destinationAssetCode =
    input.labels.assetLabels[operation.destinationAssetId ?? ""] ?? sourceAssetCode;

  const sourceAmountLabel = formatMoneyValue(
    operation.sourceAmountMinor,
    sourceAssetCode,
  );
  const destinationAmountLabel = formatMoneyValue(
    operation.destinationAmountMinor,
    destinationAssetCode,
  );
  const sourceAccountLabel = operation.sourceAccountId
    ? accountLabels[operation.sourceAccountId] ?? operation.sourceAccountId
    : "—";
  const destinationAccountLabel = operation.destinationAccountId
    ? accountLabels[operation.destinationAccountId] ??
      operation.destinationAccountId
    : "—";

  const sortedInstructions = [...instructionItems].sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
  const sortedEvents = [...eventItems].sort(
    (left, right) =>
      new Date(right.eventAt).getTime() - new Date(left.eventAt).getTime(),
  );
  const sortedPositions = [...positionItems].sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );

  const latestEvent = sortedEvents[0] ?? null;
  const stage = buildOperationStageSummary({
    eventCount: sortedEvents.length,
    latestEventKind: latestEvent?.eventKind ?? null,
    positionCount: sortedPositions.length,
    status: operation.instructionStatus,
  });

  return {
    header: {
      title: flowDescriptor.title,
      summary: buildOperationRouteSummary({
        destinationAccountLabel,
        operation,
        sourceAccountLabel,
        sourceAmountLabel,
      }),
      flowTitle: flowDescriptor.title,
      flowDescription: flowDescriptor.longDescription,
      statusLabel:
        TREASURY_INSTRUCTION_STATUS_LABELS[operation.instructionStatus] ??
        operation.instructionStatus,
      statusVariant: getStatusBadgeVariant(operation.instructionStatus),
      settlementModelLabel:
        TREASURY_SETTLEMENT_MODEL_LABELS[operation.settlementModel] ??
        operation.settlementModel,
      operationId: operation.id,
      operationShortId: shortId(operation.id),
    },
    stage,
    nextStep: buildOperationNextStep({
      instructionCount: sortedInstructions.length,
      positionCount: sortedPositions.length,
      status: operation.instructionStatus,
    }),
    latestEventLabel: latestEvent
      ? `${TREASURY_EVENT_KIND_LABELS[latestEvent.eventKind] ?? latestEvent.eventKind} · ${formatDate(latestEvent.eventAt)}`
      : "Событий исполнения пока нет.",
    warning: buildOperationTimelineWarning({
      latestEventKind: latestEvent?.eventKind ?? null,
      status: operation.instructionStatus,
    }),
    overview: [
      { label: "Сценарий", value: flowDescriptor.longDescription },
      { label: "Маршрут денег", value: buildOperationRouteSummary({
          destinationAccountLabel,
          operation,
          sourceAccountLabel,
          sourceAmountLabel,
        }) },
      { label: "Сумма списания", value: sourceAmountLabel },
      { label: "Сумма зачисления", value: destinationAmountLabel },
      { label: flowDescriptor.sourceLabel, value: sourceAccountLabel },
      { label: "Счет назначения", value: destinationAccountLabel },
      { label: "Создана", value: formatDate(operation.createdAt) },
      { label: "Комментарий", value: operation.memo?.trim() || "—" },
    ],
    control: [
      {
        label: "Экономический владелец",
        value:
          input.labels.organizationLabels[operation.economicOwnerEntityId] ??
          operation.economicOwnerEntityId,
      },
      {
        label: "Исполняющая организация",
        value:
          input.labels.organizationLabels[operation.executingEntityId] ??
          operation.executingEntityId,
      },
      {
        label: "Держатель счета",
        value: labelOrFallback(
          input.labels.organizationLabels,
          operation.cashHolderEntityId,
        ),
      },
      {
        label: "Бенефициар",
        value: formatBeneficialOwnerLabel({
          beneficialOwnerId: operation.beneficialOwnerId,
          beneficialOwnerType: operation.beneficialOwnerType,
          counterpartyLabels: input.labels.counterpartyLabels,
          customerLabels: input.labels.customerLabels,
          organizationLabels: input.labels.organizationLabels,
        }),
      },
      {
        label: "Тип бенефициара",
        value: operation.beneficialOwnerType
          ? BENEFICIAL_OWNER_TYPE_LABELS[operation.beneficialOwnerType] ??
            operation.beneficialOwnerType
          : "—",
      },
      { label: "Основание", value: operation.legalBasis ?? "—" },
      {
        label: "Одобрена",
        value: operation.approvedAt ? formatDate(operation.approvedAt) : "—",
      },
      {
        label: "Зарезервирована",
        value: operation.reservedAt ? formatDate(operation.reservedAt) : "—",
      },
    ],
    instructions: sortedInstructions.map((instruction) => {
      const assetCode =
        input.labels.assetLabels[instruction.assetId] ??
        input.labels.assetLabels[operation.sourceAssetId ?? ""] ??
        null;
      const treasuryEndpoint = instruction.destinationEndpointId
        ? treasuryEndpointById[instruction.destinationEndpointId] ?? null
        : null;
      const counterpartyEndpoint = instruction.destinationEndpointId
        ? counterpartyEndpointById[instruction.destinationEndpointId] ?? null
        : null;

      return {
        id: instruction.id,
        shortId: shortId(instruction.id),
        statusLabel:
          TREASURY_INSTRUCTION_STATUS_LABELS[instruction.instructionStatus] ??
          instruction.instructionStatus,
        statusVariant: getStatusBadgeVariant(instruction.instructionStatus),
        amountLabel: formatMoneyValue(instruction.amountMinor, assetCode),
        sourceAccountLabel:
          accountLabels[instruction.sourceAccountId] ?? instruction.sourceAccountId,
        destinationLabel: buildInstructionRouteSummary({
          counterpartyEndpoint,
          treasuryEndpointLabel: treasuryEndpoint
            ? treasuryEndpoint.label ??
              `${accountLabels[treasuryEndpoint.accountId] ?? treasuryEndpoint.accountId} · ${treasuryEndpoint.value}`
            : null,
        }),
        createdAtLabel: formatDate(instruction.createdAt),
      };
    }),
    events: sortedEvents.map((event) => ({
      id: event.id,
      happenedAtLabel: formatDate(event.eventAt),
      kindLabel: TREASURY_EVENT_KIND_LABELS[event.eventKind] ?? event.eventKind,
      instructionShortId: shortId(event.instructionId),
      instructionId: event.instructionId,
      externalRecordId: event.externalRecordId ?? "—",
    })),
    obligations: obligationItems.map((obligation) => {
      const assetCode =
        input.labels.assetLabels[obligation.assetId] ?? obligation.assetId;
      const outstandingMinor = (
        BigInt(obligation.amountMinor) - BigInt(obligation.settledMinor)
      ).toString();

      return {
        id: obligation.id,
        shortId: shortId(obligation.id),
        kindLabel: obligation.obligationKind,
        amountLabel: formatMoneyValue(obligation.amountMinor, assetCode),
        outstandingLabel: formatMoneyValue(outstandingMinor, assetCode),
        debtorLabel:
          input.labels.organizationLabels[obligation.debtorEntityId] ??
          obligation.debtorEntityId,
        creditorLabel:
          input.labels.organizationLabels[obligation.creditorEntityId] ??
          obligation.creditorEntityId,
        dueAtLabel: obligation.dueAt ? formatDate(obligation.dueAt) : "—",
      };
    }),
    positions: sortedPositions.map((position) => {
      const assetCode = input.labels.assetLabels[position.assetId] ?? position.assetId;
      const remainingMinor = (
        BigInt(position.amountMinor) - BigInt(position.settledMinor)
      ).toString();

      return {
        id: position.id,
        assetCode,
        shortId: shortId(position.id),
        kindLabel:
          TREASURY_POSITION_KIND_LABELS[position.positionKind] ??
          position.positionKind,
        kindMeaning: getPositionKindMeaning(position.positionKind),
        ownerLabel:
          input.labels.organizationLabels[position.ownerEntityId] ??
          position.ownerEntityId,
        relatedPartyLabel: position.beneficialOwnerId
          ? formatBeneficialOwnerLabel({
              beneficialOwnerId: position.beneficialOwnerId,
              beneficialOwnerType: position.beneficialOwnerType,
              counterpartyLabels: input.labels.counterpartyLabels,
              customerLabels: input.labels.customerLabels,
              organizationLabels: input.labels.organizationLabels,
            })
          : labelOrFallback(
              input.labels.organizationLabels,
              position.counterpartyEntityId,
            ),
        beneficialOwnerTypeLabel: position.beneficialOwnerType
          ? BENEFICIAL_OWNER_TYPE_LABELS[position.beneficialOwnerType] ??
            position.beneficialOwnerType
          : null,
        remainingMinor,
        remainingLabel: formatMoneyValue(remainingMinor, assetCode),
        createdAtLabel: formatDate(position.createdAt),
        canSettle: BigInt(remainingMinor) > 0n && position.closedAt === null,
      };
    }),
  };
}

export function presentTreasuryPositions(input: {
  labels: Required<
    Pick<
      LabelMaps,
      "assetLabels" | "counterpartyLabels" | "customerLabels" | "organizationLabels"
    >
  >;
  positions: TreasuryPositionListItem[];
}) {
  return input.positions.map<TreasuryPositionTableRow>((position) => {
    const assetCode = input.labels.assetLabels[position.assetId] ?? position.assetId;
    const remainingMinor = (
      BigInt(position.amountMinor) - BigInt(position.settledMinor)
    ).toString();
    const canSettle = BigInt(remainingMinor) > 0n && position.closedAt === null;

    return {
      id: position.id,
      assetCode,
      kind: position.positionKind,
      kindLabel:
        TREASURY_POSITION_KIND_LABELS[position.positionKind] ?? position.positionKind,
      meaning: getPositionKindMeaning(position.positionKind),
      ownerLabel:
        input.labels.organizationLabels[position.ownerEntityId] ??
        position.ownerEntityId,
      relatedPartyLabel: formatBeneficialOwnerLabel({
        beneficialOwnerId: position.beneficialOwnerId,
        beneficialOwnerType: position.beneficialOwnerType,
        counterpartyLabels: input.labels.counterpartyLabels,
        customerLabels: input.labels.customerLabels,
        organizationLabels: input.labels.organizationLabels,
      }),
      beneficialOwnerTypeLabel: position.beneficialOwnerType
        ? BENEFICIAL_OWNER_TYPE_LABELS[position.beneficialOwnerType] ??
          position.beneficialOwnerType
        : "—",
      amountLabel: formatMoneyValue(position.amountMinor, assetCode),
      settledLabel: formatMoneyValue(position.settledMinor, assetCode),
      remainingMinor,
      remainingLabel: formatMoneyValue(remainingMinor, assetCode),
      status: canSettle ? "open" : "closed",
      statusLabel: canSettle ? "Открыта" : "Закрыта",
      createdAt: new Date(position.createdAt).toISOString(),
      createdAtLabel: formatDate(position.createdAt),
      canSettle,
    };
  });
}

export function presentTreasuryExceptions(input: {
  records: UnmatchedExternalRecordListItem[];
}) {
  return input.records.map<TreasuryExceptionTableRow>((record) => ({
    id: record.externalRecordId,
    receivedAt: new Date(record.receivedAt).toISOString(),
    receivedAtLabel: formatDate(record.receivedAt),
    sourceLabel: record.source,
    recordKindLabel: record.recordKind ?? "Не указан",
    reasonLabel: record.reasonCode,
    reasonMetaLabel: record.reasonMeta ? JSON.stringify(record.reasonMeta) : null,
    resolutionHint: getExceptionResolutionHint(record),
    externalRecordId: record.externalRecordId,
    externalRecordShortId: shortId(record.externalRecordId),
    record,
  }));
}

export function getAccountsBalanceGlossary() {
  return getBalanceGlossaryItems();
}
