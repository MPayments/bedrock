"use client";

import type { Edge, Node } from "@xyflow/react";

import { formatCurrencyMinorAmount } from "./format";
import type { PaymentRouteConstructorOptions } from "./queries";
import {
  buildPaymentRouteParticipantGraphRows,
  type PaymentRouteOwnerRequisitesByKey,
} from "./requisites";
import type { PaymentRouteEditorState } from "./state";

export type PaymentRouteGraphNodeData = {
  canInsertAfter: boolean;
  canRemove: boolean;
  displayName: string;
  iconKind: "beneficiary" | "counterparty" | "customer" | "organization";
  onInsertAfter: () => void;
  onRemove: () => void;
  role: "destination" | "hop" | "source";
  rows: ReturnType<typeof buildPaymentRouteParticipantGraphRows>["rows"];
  subtitle: string;
};

export type PaymentRouteGraphEdgeData = {
  amountLabel: string;
  feeLabel: string;
  legId: string;
};

function getPaymentRouteLegCalculation(
  state: PaymentRouteEditorState,
  legId: string,
) {
  return state.calculation?.legs.find((leg) => leg.id === legId) ?? null;
}

function getCurrencyLabel(
  options: PaymentRouteConstructorOptions,
  currencyId: string,
) {
  return (
    options.currencies.find((currency) => currency.id === currencyId) ?? null
  );
}

function getEdgeAmountLabel(input: {
  calculation: ReturnType<typeof getPaymentRouteLegCalculation>;
  leg: PaymentRouteEditorState["draft"]["legs"][number];
  options: PaymentRouteConstructorOptions;
}) {
  const { calculation, leg, options } = input;

  if (calculation) {
    return `Сумма: ${formatCurrencyMinorAmount(
      calculation.netOutputMinor,
      getCurrencyLabel(options, leg.toCurrencyId),
    )}`;
  }

  const fromCurrency = getCurrencyLabel(options, leg.fromCurrencyId);
  const toCurrency = getCurrencyLabel(options, leg.toCurrencyId);

  return `Сумма: ${fromCurrency?.code ?? "?"} → ${toCurrency?.code ?? "?"}`;
}

function getEdgeFeeLabel(input: {
  calculation: ReturnType<typeof getPaymentRouteLegCalculation>;
  leg: PaymentRouteEditorState["draft"]["legs"][number];
  options: PaymentRouteConstructorOptions;
}) {
  const { calculation, leg, options } = input;

  const feeLabels = calculation
    ? calculation.fees.map((fee) => {
        const currency = getCurrencyLabel(options, fee.currencyId);
        const amount = formatCurrencyMinorAmount(fee.amountMinor, currency);

        if (fee.kind === "fixed") {
          return `${fee.label ?? "Комиссия"} ${amount}`;
        }

        return `${fee.label ?? "Комиссия"} ${fee.percentage}% (${amount})`;
      })
    : leg.fees.map((fee) => {
        if (fee.kind === "fixed") {
          return `${fee.label ?? "Комиссия"} ${formatCurrencyMinorAmount(
            fee.amountMinor ?? "0",
            getCurrencyLabel(options, fee.currencyId ?? leg.fromCurrencyId),
          )}`;
        }

        return `${fee.label ?? "Комиссия"} ${fee.percentage}%`;
      });

  return feeLabels.length > 0 ? feeLabels.join(" • ") : "Комиссия: нет";
}

function getParticipantSubtitle(
  participant: PaymentRouteEditorState["draft"]["participants"][number],
) {
  if (participant.binding === "abstract") {
    return participant.role === "source"
      ? "Клиент"
      : participant.role === "destination"
        ? "Бенефициар"
        : "Промежуточный";
  }

  if (participant.entityKind === "customer") {
    return "Клиент";
  }

  if (participant.entityKind === "organization") {
    return "Организация";
  }

  return "Контрагент";
}

function getParticipantIconKind(
  participant: PaymentRouteEditorState["draft"]["participants"][number],
): PaymentRouteGraphNodeData["iconKind"] {
  if (participant.role === "source") {
    return "customer";
  }

  if (participant.role === "destination") {
    return "beneficiary";
  }

  if (participant.entityKind === "organization") {
    return "organization";
  }

  return "counterparty";
}

export function buildPaymentRouteGraphNodes(input: {
  canInsertHop: boolean;
  onInsertAfter: (index: number) => void;
  onRemove: (index: number) => void;
  options: PaymentRouteConstructorOptions;
  requisitesByOwner: PaymentRouteOwnerRequisitesByKey;
  selectedNodeId: string | null;
  state: PaymentRouteEditorState;
}): Node<PaymentRouteGraphNodeData>[] {
  const {
    canInsertHop,
    onInsertAfter,
    onRemove,
    requisitesByOwner,
    selectedNodeId,
    state,
  } =
    input;

  return state.draft.participants.map((participant, index) => ({
    data: {
      canInsertAfter:
        canInsertHop && index < state.draft.participants.length - 1,
      canRemove: index > 0 && index < state.draft.participants.length - 1,
      displayName: participant.displayName,
      iconKind: getParticipantIconKind(participant),
      onInsertAfter: () => onInsertAfter(index),
      onRemove: () => onRemove(index),
      role: participant.role,
      rows: buildPaymentRouteParticipantGraphRows({
        draft: state.draft,
        index,
        options: input.options,
        requisitesByOwner,
      }).rows,
      subtitle: getParticipantSubtitle(participant),
    },
    id: participant.nodeId,
    position: state.visual.nodePositions[participant.nodeId] ?? {
      x: index * 260,
      y: index % 2 === 0 ? 72 : 180,
    },
    selected: selectedNodeId === participant.nodeId,
    type: "routeParticipant",
  }));
}

export function buildPaymentRouteGraphEdges(input: {
  options: PaymentRouteConstructorOptions;
  requisitesByOwner: PaymentRouteOwnerRequisitesByKey;
  selectedLegId: string | null;
  state: PaymentRouteEditorState;
}): Edge<PaymentRouteGraphEdgeData>[] {
  const { options, requisitesByOwner, selectedLegId, state } = input;

  return state.draft.legs.map((leg, index) => {
    const calculation = getPaymentRouteLegCalculation(state, leg.id);
    const sourceRows = buildPaymentRouteParticipantGraphRows({
      draft: state.draft,
      index,
      options,
      requisitesByOwner,
    });
    const targetRows = buildPaymentRouteParticipantGraphRows({
      draft: state.draft,
      index: index + 1,
      options,
      requisitesByOwner,
    });

    return {
      animated: selectedLegId === leg.id,
      data: {
        amountLabel: getEdgeAmountLabel({
          calculation,
          leg,
          options,
        }),
        feeLabel: getEdgeFeeLabel({
          calculation,
          leg,
          options,
        }),
        legId: leg.id,
      },
      id: leg.id,
      selected: selectedLegId === leg.id,
      source: state.draft.participants[index]!.nodeId,
      sourceHandle: sourceRows.connectionHandleId ?? undefined,
      target: state.draft.participants[index + 1]!.nodeId,
      targetHandle: targetRows.connectionHandleId ?? undefined,
      type: "routeLeg",
    };
  });
}
