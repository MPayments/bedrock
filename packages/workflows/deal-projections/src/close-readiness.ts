import type {
  DealOperationalPosition,
  DealType,
  DealWorkflowProjection,
} from "@bedrock/deals/contracts";
import type { ReconciliationOperationLinkDto } from "@bedrock/reconciliation/contracts";
import type { PaymentStep } from "@bedrock/treasury/contracts";

import type {
  FinanceDealCloseReadiness,
  FinanceDealCloseReadinessCriterion,
  FinanceDealReconciliationException,
  FinanceDealReconciliationSummary,
  FinanceDealStage,
} from "./contracts";

const TERMINAL_STEP_STATES = new Set<PaymentStep["state"]>([
  "completed",
  "returned",
  "cancelled",
  "skipped",
]);

const RECONCILIATION_REQUIRED_STEP_STATES = new Set<PaymentStep["state"]>([
  "completed",
  "returned",
]);

const CLOSING_DOCUMENT_TYPE_BY_DEAL_TYPE: Record<DealType, string | null> = {
  currency_exchange: null,
  currency_transit: "acceptance",
  exporter_settlement: "acceptance",
  payment: "acceptance",
};

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

function isFormalDocumentReady(input: {
  approvalStatus: string | null;
  lifecycleStatus: string | null;
  postingStatus: string | null;
  submissionStatus: string | null;
}) {
  return (
    input.lifecycleStatus === "active" &&
    input.submissionStatus === "submitted" &&
    (input.approvalStatus === "approved" ||
      input.approvalStatus === "not_required") &&
    (input.postingStatus === "posted" || input.postingStatus === "not_required")
  );
}

function findRelatedFormalDocument(input: {
  docType: string;
  documents: DealWorkflowProjection["relatedResources"]["formalDocuments"];
}) {
  const matching = input.documents.filter(
    (document) => document.docType === input.docType,
  );

  return (
    matching.find((document) => document.lifecycleStatus === "active") ??
    matching.sort((left, right) => {
      const leftTime =
        left.createdAt?.getTime() ?? left.occurredAt?.getTime() ?? 0;
      const rightTime =
        right.createdAt?.getTime() ?? right.occurredAt?.getTime() ?? 0;
      return rightTime - leftTime;
    })[0] ??
    null
  );
}

function isClosingDocumentReady(workflow: DealWorkflowProjection) {
  const docType = CLOSING_DOCUMENT_TYPE_BY_DEAL_TYPE[workflow.summary.type];

  if (!docType) {
    return true;
  }

  const document = findRelatedFormalDocument({
    docType,
    documents: workflow.relatedResources.formalDocuments,
  });

  if (!document) {
    return false;
  }

  return isFormalDocumentReady({
    approvalStatus: document.approvalStatus,
    lifecycleStatus: document.lifecycleStatus,
    postingStatus: document.postingStatus,
    submissionStatus: document.submissionStatus,
  });
}

function createCriterion(
  code: FinanceDealCloseReadinessCriterion["code"],
  label: string,
  satisfied: boolean,
) {
  return {
    code,
    label,
    satisfied,
  } satisfies FinanceDealCloseReadinessCriterion;
}

function addUniqueBlocker(blockers: string[], blocker: string) {
  if (!blockers.includes(blocker)) {
    blockers.push(blocker);
  }
}

function doLegStepsSatisfyStates(input: {
  allowedStates: ReadonlySet<PaymentStep["state"]>;
  paymentStepByLegIdx: ReadonlyMap<number, PaymentStep>;
  workflow: DealWorkflowProjection;
  legKinds: string[];
}) {
  const legs = input.workflow.executionPlan.filter((leg) =>
    input.legKinds.includes(leg.kind),
  );

  if (legs.length === 0) {
    return false;
  }

  return legs.every((leg) => {
    if (leg.state === "skipped") {
      return true;
    }

    const step = input.paymentStepByLegIdx.get(leg.idx);
    if (!step) {
      return false;
    }

    return input.allowedStates.has(step.state);
  });
}

function buildReconciliationState(input: {
  paymentStepByLegIdx: ReadonlyMap<number, PaymentStep>;
  reconciliationLinksByStepId: ReadonlyMap<string, ReconciliationOperationLinkDto>;
  workflow: DealWorkflowProjection;
}): {
  reconciliationExceptions: FinanceDealReconciliationException[];
  reconciliationSummary: FinanceDealReconciliationSummary;
  requiredStepIds: string[];
} {
  const requiredStepIds = Array.from(
    new Set(
      input.workflow.executionPlan
        .map((leg) => input.paymentStepByLegIdx.get(leg.idx))
        .filter(
          (step): step is PaymentStep =>
            Boolean(step) &&
            RECONCILIATION_REQUIRED_STEP_STATES.has((step as PaymentStep).state),
        )
        .map((step) => step.id),
    ),
  );
  const seenExceptionIds = new Set<string>();
  const reconciliationExceptions: FinanceDealReconciliationException[] = [];
  let lastActivityAt: Date | null = null;
  let openExceptionCount = 0;
  let resolvedExceptionCount = 0;
  let ignoredExceptionCount = 0;
  let reconciledOperationCount = 0;

  for (const stepId of requiredStepIds) {
    const link = input.reconciliationLinksByStepId.get(stepId);
    const hasArtifact = Boolean(
      link && (link.matchCount > 0 || link.exceptions.length > 0),
    );

    if (hasArtifact) {
      reconciledOperationCount += 1;
    }

    if (link?.lastActivityAt) {
      if (
        !lastActivityAt ||
        link.lastActivityAt.getTime() > lastActivityAt.getTime()
      ) {
        lastActivityAt = link.lastActivityAt;
      }
    }

    for (const exception of link?.exceptions ?? []) {
      reconciliationExceptions.push({
        actions: {
          adjustmentDocumentDocType: null,
          canIgnore: exception.state === "open",
        },
        blocking: exception.state === "open",
        createdAt: exception.createdAt,
        externalRecordId: exception.externalRecordId,
        id: exception.id,
        operationId: exception.operationId,
        reasonCode: exception.reasonCode,
        resolvedAt: exception.resolvedAt,
        source: exception.source,
        state: exception.state,
      });

      if (seenExceptionIds.has(exception.id)) {
        continue;
      }

      seenExceptionIds.add(exception.id);

      if (exception.state === "open") {
        openExceptionCount += 1;
      } else if (exception.state === "resolved") {
        resolvedExceptionCount += 1;
      } else if (exception.state === "ignored") {
        ignoredExceptionCount += 1;
      }
    }
  }

  const pendingOperationCount = Math.max(
    0,
    requiredStepIds.length - reconciledOperationCount,
  );
  const state =
    requiredStepIds.length === 0
      ? "not_started"
      : openExceptionCount > 0
        ? "blocked"
        : pendingOperationCount > 0
          ? "pending"
          : "clear";

  return {
    reconciliationExceptions: reconciliationExceptions.sort(
      (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
    ),
    reconciliationSummary: {
      ignoredExceptionCount,
      lastActivityAt,
      openExceptionCount,
      pendingOperationCount,
      reconciledOperationCount,
      requiredOperationCount: requiredStepIds.length,
      resolvedExceptionCount,
      state,
    },
    requiredStepIds,
  };
}

function createCriteria(input: {
  executionUnblocked: boolean;
  paymentStepByLegIdx: ReadonlyMap<number, PaymentStep>;
  reconciliationSummary: FinanceDealReconciliationSummary;
  workflow: DealWorkflowProjection;
}) {
  const criteria: FinanceDealCloseReadinessCriterion[] = [];
  const operationsMaterialized = input.workflow.executionPlan.every(
    (leg) =>
      leg.state === "skipped" || input.paymentStepByLegIdx.has(leg.idx),
  );

  criteria.push(
    createCriterion(
      "operations_materialized",
      "Казначейские операции созданы для всех шагов",
      operationsMaterialized,
    ),
  );
  criteria.push(
    createCriterion(
      "execution_unblocked",
      "Исполнение не содержит блокеров",
      input.executionUnblocked,
    ),
  );
  criteria.push(
    createCriterion(
      "reconciliation_clear",
      "Сверка завершена без открытых исключений",
      input.reconciliationSummary.state === "clear" ||
        input.reconciliationSummary.state === "not_started",
    ),
  );

  switch (input.workflow.summary.type) {
    case "payment":
      criteria.push(
        createCriterion(
          "payment_payout_settled",
          "Выплата исполнена",
          doLegStepsSatisfyStates({
            allowedStates: new Set<PaymentStep["state"]>(["completed"]),
            paymentStepByLegIdx: input.paymentStepByLegIdx,
            workflow: input.workflow,
            legKinds: ["payout"],
          }),
        ),
      );
      criteria.push(
        createCriterion(
          "payment_documents_ready",
          "Закрывающие документы готовы",
          isClosingDocumentReady(input.workflow),
        ),
      );
      break;
    case "currency_exchange":
      criteria.push(
        createCriterion(
          "currency_exchange_conversion_settled",
          "Конвертация исполнена",
          doLegStepsSatisfyStates({
            allowedStates: new Set<PaymentStep["state"]>(["completed"]),
            paymentStepByLegIdx: input.paymentStepByLegIdx,
            workflow: input.workflow,
            legKinds: ["convert"],
          }),
        ),
      );
      criteria.push(
        createCriterion(
          "currency_exchange_payout_or_returned",
          "Выплата или возврат завершены",
          doLegStepsSatisfyStates({
            allowedStates: new Set<PaymentStep["state"]>([
              "completed",
              "returned",
            ]),
            paymentStepByLegIdx: input.paymentStepByLegIdx,
            workflow: input.workflow,
            legKinds: ["payout"],
          }),
        ),
      );
      break;
    case "currency_transit":
      criteria.push(
        createCriterion(
          "currency_transit_collect_settled",
          "Поступление подтверждено",
          doLegStepsSatisfyStates({
            allowedStates: new Set<PaymentStep["state"]>(["completed"]),
            paymentStepByLegIdx: input.paymentStepByLegIdx,
            workflow: input.workflow,
            legKinds: ["collect"],
          }),
        ),
      );
      criteria.push(
        createCriterion(
          "currency_transit_payout_settled",
          "Выплата исполнена",
          doLegStepsSatisfyStates({
            allowedStates: new Set<PaymentStep["state"]>(["completed"]),
            paymentStepByLegIdx: input.paymentStepByLegIdx,
            workflow: input.workflow,
            legKinds: ["payout"],
          }),
        ),
      );
      criteria.push(
        createCriterion(
          "currency_transit_in_transit_resolved",
          "Позиция в транзите закрыта",
          ["done", "not_applicable"].includes(
            getPositionByKind(input.workflow, "in_transit")?.state ?? "",
          ),
        ),
      );
      break;
    case "exporter_settlement":
      criteria.push(
        createCriterion(
          "exporter_settlement_payout_settled",
          "Выплата исполнена",
          doLegStepsSatisfyStates({
            allowedStates: new Set<PaymentStep["state"]>(["completed"]),
            paymentStepByLegIdx: input.paymentStepByLegIdx,
            workflow: input.workflow,
            legKinds: ["payout"],
          }),
        ),
      );
      criteria.push(
        createCriterion(
          "exporter_settlement_receivable_resolved",
          "Ожидаемая экспортная выручка закрыта",
          ["done"].includes(
            getPositionByKind(input.workflow, "exporter_expected_receivable")
              ?.state ?? "",
          ),
        ),
      );
      break;
  }

  return criteria;
}

export function deriveFinanceDealReadiness(input: {
  paymentStepByLegIdx: ReadonlyMap<number, PaymentStep>;
  reconciliationLinksByStepId: ReadonlyMap<
    string,
    ReconciliationOperationLinkDto
  >;
  workflow: DealWorkflowProjection;
}): {
  closeReadiness: FinanceDealCloseReadiness;
  reconciliationExceptions: FinanceDealReconciliationException[];
  reconciliationSummary: FinanceDealReconciliationSummary;
  terminalStepCount: number;
  totalStepCount: number;
} {
  const readiness = input.workflow.transitionReadiness.find(
    (item) => item.targetStatus === "done",
  );
  const existingBlockers =
    readiness?.allowed === false
      ? readiness.blockers.map((blocker) => blocker.message)
      : [];
  const executionBlocked =
    input.workflow.executionPlan.some((leg) => leg.state === "blocked") ||
    input.workflow.operationalState.positions.some(
      (position) => position.state === "blocked",
    ) ||
    existingBlockers.some(
      (message) =>
        message.includes("Execution leg is blocked") ||
        message.includes("Operational position is blocked"),
    );

  const totalStepCount = input.paymentStepByLegIdx.size;
  let terminalStepCount = 0;
  for (const step of input.paymentStepByLegIdx.values()) {
    if (TERMINAL_STEP_STATES.has(step.state)) {
      terminalStepCount += 1;
    }
  }

  const { reconciliationExceptions, reconciliationSummary } =
    buildReconciliationState(input);
  const criteria = createCriteria({
    executionUnblocked: !executionBlocked,
    paymentStepByLegIdx: input.paymentStepByLegIdx,
    reconciliationSummary,
    workflow: input.workflow,
  });
  const blockers = [...existingBlockers];

  if (
    input.workflow.summary.status === "done" ||
    input.workflow.summary.status === "cancelled"
  ) {
    addUniqueBlocker(blockers, "Сделка уже находится в конечном статусе");
  }

  for (const criterion of criteria) {
    if (!criterion.satisfied) {
      addUniqueBlocker(blockers, criterion.label);
    }
  }

  if (reconciliationSummary.state === "blocked") {
    addUniqueBlocker(blockers, "Есть открытые исключения сверки");
  } else if (reconciliationSummary.state === "pending") {
    addUniqueBlocker(blockers, "Сверка еще не завершена по всем операциям");
  }

  return {
    closeReadiness: {
      blockers,
      criteria,
      ready: blockers.length === 0,
    },
    reconciliationExceptions,
    reconciliationSummary,
    terminalStepCount,
    totalStepCount,
  };
}

function resolveFundingStage(input: {
  agreementOrganizationId: string | null;
  internalEntityOrganizationId: string | null;
}) {
  return input.agreementOrganizationId &&
    input.internalEntityOrganizationId &&
    input.agreementOrganizationId !== input.internalEntityOrganizationId
    ? "awaiting_intercompany_funding"
    : "awaiting_intracompany_transfer";
}

function findPrimaryOpenLeg(workflow: DealWorkflowProjection) {
  return workflow.executionPlan.find(
    (leg) => leg.state !== "done" && leg.state !== "skipped",
  );
}

function mapCriterionToStage(input: {
  agreementOrganizationId: string | null;
  closeReadiness: FinanceDealCloseReadiness;
  internalEntityOrganizationId: string | null;
}) {
  const unsatisfiedCriterion = input.closeReadiness.criteria.find(
    (criterion) => !criterion.satisfied,
  );

  switch (unsatisfiedCriterion?.code) {
    case "currency_exchange_conversion_settled":
      return "awaiting_fx" satisfies FinanceDealStage;
    case "currency_exchange_payout_or_returned":
    case "currency_transit_payout_settled":
    case "exporter_settlement_payout_settled":
    case "payment_documents_ready":
    case "payment_payout_settled":
      return "awaiting_payout" satisfies FinanceDealStage;
    case "currency_transit_collect_settled":
      return "awaiting_collection" satisfies FinanceDealStage;
    case "currency_transit_in_transit_resolved":
    case "exporter_settlement_receivable_resolved":
      return resolveFundingStage({
        agreementOrganizationId: input.agreementOrganizationId,
        internalEntityOrganizationId: input.internalEntityOrganizationId,
      });
    default:
      return null;
  }
}

function getStageReason(stage: FinanceDealStage) {
  switch (stage) {
    case "awaiting_collection":
      return "Ожидаем поступление средств";
    case "awaiting_fx":
      return "Ожидаем конвертацию";
    case "awaiting_intracompany_transfer":
      return "Ожидаем внутренний перевод";
    case "awaiting_intercompany_funding":
      return "Ожидаем межкомпанейское фондирование";
    case "awaiting_payout":
      return "Ожидаем выплату";
    case "awaiting_reconciliation":
      return "Ожидаем завершение сверки";
    case "ready_to_close":
      return "Сделка готова к закрытию";
  }
}

export function deriveFinanceDealStage(input: {
  agreementOrganizationId: string | null;
  closeReadiness: FinanceDealCloseReadiness;
  internalEntityOrganizationId: string | null;
  paymentStepByLegIdx: ReadonlyMap<number, PaymentStep>;
  reconciliationSummary: FinanceDealReconciliationSummary;
  workflow: DealWorkflowProjection;
}): { stage: FinanceDealStage; stageReason: string } {
  if (input.closeReadiness.ready) {
    return {
      stage: "ready_to_close",
      stageReason: getStageReason("ready_to_close"),
    };
  }

  const linkedSteps = Array.from(input.paymentStepByLegIdx.values());
  const allLinkedStepsTerminal =
    linkedSteps.length > 0 &&
    linkedSteps.every((step) => TERMINAL_STEP_STATES.has(step.state));

  if (
    allLinkedStepsTerminal &&
    input.reconciliationSummary.state !== "clear"
  ) {
    return {
      stage: "awaiting_reconciliation",
      stageReason: getStageReason("awaiting_reconciliation"),
    };
  }

  const primaryOpenLeg = findPrimaryOpenLeg(input.workflow);

  if (primaryOpenLeg) {
    const stage =
      primaryOpenLeg.kind === "collect"
        ? "awaiting_collection"
        : primaryOpenLeg.kind === "convert"
          ? "awaiting_fx"
          : primaryOpenLeg.kind === "payout"
            ? "awaiting_payout"
            : resolveFundingStage({
                agreementOrganizationId: input.agreementOrganizationId,
                internalEntityOrganizationId:
                  input.internalEntityOrganizationId,
              });

    return {
      stage,
      stageReason: getStageReason(stage),
    };
  }

  const criterionStage = mapCriterionToStage({
    agreementOrganizationId: input.agreementOrganizationId,
    closeReadiness: input.closeReadiness,
    internalEntityOrganizationId: input.internalEntityOrganizationId,
  });

  if (criterionStage) {
    return {
      stage: criterionStage,
      stageReason: getStageReason(criterionStage),
    };
  }

  return {
    stage: "awaiting_reconciliation",
    stageReason: getStageReason("awaiting_reconciliation"),
  };
}
