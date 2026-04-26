import type {
  DealOperationalPosition,
  DealWorkflowProjection,
} from "@bedrock/deals/contracts";

import type { FinanceDealQueue } from "../contracts";
import { collectBlockingReasons } from "../shared/workflow-helpers";

const DOWNSTREAM_POSITION_KINDS = new Set([
  "exporter_expected_receivable",
  "in_transit",
  "downstream_payable",
]);

const DOWNSTREAM_LEG_KINDS = new Set([
  "payout",
  "settle_exporter",
  "transit_hold",
]);

function getPositionByKind(
  workflow: DealWorkflowProjection,
  kind: string,
): DealOperationalPosition | null {
  return (
    workflow.operationalState.positions.find(
      (position) => position.kind === kind,
    ) ?? null
  );
}

function buildFundingMessage(workflow: DealWorkflowProjection) {
  if (!workflow.executionPlan.some((leg) => leg.kind === "convert")) {
    return null;
  }

  if (
    workflow.fundingResolution.state === "resolved" &&
    workflow.fundingResolution.strategy === "existing_inventory"
  ) {
    const targetCurrency =
      workflow.fundingResolution.targetCurrency ?? "целевой валюте";

    return `Используем остаток ${targetCurrency} на казначейском счете`;
  }

  if (
    workflow.fundingResolution.state === "resolved" &&
    workflow.fundingResolution.strategy === "external_fx"
  ) {
    return "Требуется конвертация";
  }

  return null;
}

export function buildFinanceQuoteRequestContext(
  workflow: DealWorkflowProjection,
) {
  if (workflow.summary.type === "payment") {
    return {
      fundingMessage: buildFundingMessage(workflow),
      fundingResolution: workflow.fundingResolution,
      quoteAmount: workflow.intake.incomingReceipt?.expectedAmount ?? null,
      quoteAmountSide: "target" as const,
      sourceCurrencyId: workflow.intake.moneyRequest.sourceCurrencyId ?? null,
      targetCurrencyId: workflow.intake.moneyRequest.targetCurrencyId ?? null,
    };
  }

  return {
    fundingMessage: buildFundingMessage(workflow),
    fundingResolution: workflow.fundingResolution,
    quoteAmount: workflow.intake.moneyRequest.sourceAmount ?? null,
    quoteAmountSide: "source" as const,
    sourceCurrencyId: workflow.intake.moneyRequest.sourceCurrencyId ?? null,
    targetCurrencyId: workflow.intake.moneyRequest.targetCurrencyId ?? null,
  };
}

export function summarizeExecutionPlan(workflow: DealWorkflowProjection) {
  return {
    blockedLegCount: workflow.executionPlan.filter(
      (leg) => leg.state === "blocked",
    ).length,
    doneLegCount: workflow.executionPlan.filter((leg) => leg.state === "done")
      .length,
    totalLegCount: workflow.executionPlan.length,
  };
}

export function classifyFinanceQueue(workflow: DealWorkflowProjection): {
  blockers: string[];
  queue: FinanceDealQueue;
  queueReason: string;
} {
  const downstreamBlocked =
    workflow.executionPlan.some(
      (leg) => DOWNSTREAM_LEG_KINDS.has(leg.kind) && leg.state === "blocked",
    ) ||
    workflow.operationalState.positions.some(
      (position) =>
        DOWNSTREAM_POSITION_KINDS.has(position.kind) &&
        position.state === "blocked",
    );

  if (downstreamBlocked) {
    return {
      blockers: collectBlockingReasons(workflow),
      queue: "failed_instruction",
      queueReason: "Сделка заблокирована на этапе исполнения",
    };
  }

  const customerReceivable = getPositionByKind(workflow, "customer_receivable");
  const downstreamReady = workflow.operationalState.positions.some(
    (position) =>
      DOWNSTREAM_POSITION_KINDS.has(position.kind) &&
      (position.state === "in_progress" || position.state === "ready"),
  );

  if (
    workflow.summary.status === "awaiting_payment" ||
    workflow.summary.status === "closing_documents" ||
    downstreamReady
  ) {
    return {
      blockers: [],
      queue: "execution",
      queueReason: "Сделка ожидает исполнения",
    };
  }

  if (
    workflow.summary.status === "preparing_documents" ||
    workflow.summary.status === "awaiting_funds" ||
    customerReceivable?.state === "ready" ||
    customerReceivable?.state === "in_progress"
  ) {
    return {
      blockers: [],
      queue: "funding",
      queueReason: "Сделка находится на этапе фондирования",
    };
  }

  return {
    blockers: collectBlockingReasons(workflow),
    queue: "funding",
    queueReason: "Сделка ожидает следующий шаг на этапе фондирования",
  };
}
