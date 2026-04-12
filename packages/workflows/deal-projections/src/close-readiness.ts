import type { DealOperationalPosition, DealType, DealWorkflowProjection } from "@bedrock/deals/contracts";
import type { ReconciliationOperationLinkDto } from "@bedrock/reconciliation/contracts";
import type { TreasuryInstruction } from "@bedrock/treasury/contracts";

import type {
  FinanceDealCloseReadiness,
  FinanceDealCloseReadinessCriterion,
  FinanceDealInstructionSummary,
  FinanceDealReconciliationException,
  FinanceDealReconciliationSummary,
  FinanceDealStage,
} from "./contracts";

const CLOSE_TERMINAL_INSTRUCTION_STATES = new Set([
  "returned",
  "settled",
  "voided",
]);

const RECONCILIATION_REQUIRED_INSTRUCTION_STATES = new Set([
  "returned",
  "settled",
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

function doLegOperationsSatisfyStates(input: {
  allowedStates: Set<string>;
  latestInstructionByOperationId: ReadonlyMap<string, TreasuryInstruction>;
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

    if (leg.operationRefs.length === 0) {
      return false;
    }

    return leg.operationRefs.every((ref) => {
      const latest = input.latestInstructionByOperationId.get(ref.operationId);
      return Boolean(latest && input.allowedStates.has(latest.state));
    });
  });
}

function buildInstructionSummary(input: {
  latestInstructionByOperationId: ReadonlyMap<string, TreasuryInstruction>;
  workflow: DealWorkflowProjection;
}): FinanceDealInstructionSummary {
  const summary: FinanceDealInstructionSummary = {
    failed: 0,
    planned: 0,
    prepared: 0,
    returnRequested: 0,
    returned: 0,
    settled: 0,
    submitted: 0,
    terminalOperations: 0,
    totalOperations: 0,
    voided: 0,
  };

  const operationIds = Array.from(
    new Set(
      input.workflow.executionPlan.flatMap((leg) =>
        leg.operationRefs.map((ref) => ref.operationId),
      ),
    ),
  );

  summary.totalOperations = operationIds.length;

  for (const operationId of operationIds) {
    const latest = input.latestInstructionByOperationId.get(operationId);

    if (!latest) {
      summary.planned += 1;
      continue;
    }

    switch (latest.state) {
      case "failed":
        summary.failed += 1;
        break;
      case "prepared":
        summary.prepared += 1;
        break;
      case "return_requested":
        summary.returnRequested += 1;
        break;
      case "returned":
        summary.returned += 1;
        break;
      case "settled":
        summary.settled += 1;
        break;
      case "submitted":
        summary.submitted += 1;
        break;
      case "voided":
        summary.voided += 1;
        break;
    }

    if (CLOSE_TERMINAL_INSTRUCTION_STATES.has(latest.state)) {
      summary.terminalOperations += 1;
    }
  }

  return summary;
}

function buildReconciliationState(input: {
  latestInstructionByOperationId: ReadonlyMap<string, TreasuryInstruction>;
  reconciliationLinksByOperationId: ReadonlyMap<string, ReconciliationOperationLinkDto>;
  workflow: DealWorkflowProjection;
}): {
  reconciliationExceptions: FinanceDealReconciliationException[];
  reconciliationSummary: FinanceDealReconciliationSummary;
  requiredOperationIds: string[];
} {
  const requiredOperationIds = Array.from(
    new Set(
      input.workflow.executionPlan.flatMap((leg) =>
        leg.operationRefs
          .map((ref) => {
            const latest = input.latestInstructionByOperationId.get(ref.operationId);
            return latest &&
              RECONCILIATION_REQUIRED_INSTRUCTION_STATES.has(latest.state)
              ? ref.operationId
              : null;
          })
          .filter((operationId): operationId is string => Boolean(operationId)),
      ),
    ),
  );
  const seenExceptionIds = new Set<string>();
  const reconciliationExceptions: FinanceDealReconciliationException[] = [];
  let lastActivityAt: Date | null = null;
  let openExceptionCount = 0;
  let resolvedExceptionCount = 0;
  let ignoredExceptionCount = 0;
  let reconciledOperationCount = 0;

  for (const operationId of requiredOperationIds) {
    const link = input.reconciliationLinksByOperationId.get(operationId);
    const hasArtifact = Boolean(link && (link.matchCount > 0 || link.exceptions.length > 0));

    if (hasArtifact) {
      reconciledOperationCount += 1;
    }

    if (link?.lastActivityAt) {
      if (!lastActivityAt || link.lastActivityAt.getTime() > lastActivityAt.getTime()) {
        lastActivityAt = link.lastActivityAt;
      }
    }

    for (const exception of link?.exceptions ?? []) {
      reconciliationExceptions.push({
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
    requiredOperationIds.length - reconciledOperationCount,
  );
  const state =
    requiredOperationIds.length === 0
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
      requiredOperationCount: requiredOperationIds.length,
      resolvedExceptionCount,
      state,
    },
    requiredOperationIds,
  };
}

function createCriteria(input: {
  executionUnblocked: boolean;
  latestInstructionByOperationId: ReadonlyMap<string, TreasuryInstruction>;
  reconciliationSummary: FinanceDealReconciliationSummary;
  workflow: DealWorkflowProjection;
}) {
  const criteria: FinanceDealCloseReadinessCriterion[] = [];
  const operationsMaterialized = input.workflow.executionPlan.every(
    (leg) => leg.state === "skipped" || leg.operationRefs.length > 0,
  );

  criteria.push(
    createCriterion(
      "operations_materialized",
      "Казначейские операции созданы для всех этапов",
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
          doLegOperationsSatisfyStates({
            allowedStates: new Set(["settled"]),
            latestInstructionByOperationId: input.latestInstructionByOperationId,
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
          doLegOperationsSatisfyStates({
            allowedStates: new Set(["settled"]),
            latestInstructionByOperationId: input.latestInstructionByOperationId,
            workflow: input.workflow,
            legKinds: ["convert"],
          }),
        ),
      );
      criteria.push(
        createCriterion(
          "currency_exchange_payout_or_returned",
          "Выплата или возврат завершены",
          doLegOperationsSatisfyStates({
            allowedStates: new Set(["returned", "settled"]),
            latestInstructionByOperationId: input.latestInstructionByOperationId,
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
          doLegOperationsSatisfyStates({
            allowedStates: new Set(["settled"]),
            latestInstructionByOperationId: input.latestInstructionByOperationId,
            workflow: input.workflow,
            legKinds: ["collect"],
          }),
        ),
      );
      criteria.push(
        createCriterion(
          "currency_transit_payout_settled",
          "Выплата исполнена",
          doLegOperationsSatisfyStates({
            allowedStates: new Set(["settled"]),
            latestInstructionByOperationId: input.latestInstructionByOperationId,
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
          doLegOperationsSatisfyStates({
            allowedStates: new Set(["settled"]),
            latestInstructionByOperationId: input.latestInstructionByOperationId,
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
  latestInstructionByOperationId: ReadonlyMap<string, TreasuryInstruction>;
  reconciliationLinksByOperationId: ReadonlyMap<string, ReconciliationOperationLinkDto>;
  workflow: DealWorkflowProjection;
}): {
  closeReadiness: FinanceDealCloseReadiness;
  instructionSummary: FinanceDealInstructionSummary;
  reconciliationExceptions: FinanceDealReconciliationException[];
  reconciliationSummary: FinanceDealReconciliationSummary;
} {
  const readiness = input.workflow.transitionReadiness.find(
    (item) => item.targetStatus === "done",
  );
  const existingBlockers = readiness?.allowed === false
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
  const instructionSummary = buildInstructionSummary(input);
  const {
    reconciliationExceptions,
    reconciliationSummary,
  } = buildReconciliationState(input);
  const criteria = createCriteria({
    executionUnblocked: !executionBlocked,
    latestInstructionByOperationId: input.latestInstructionByOperationId,
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
    instructionSummary,
    reconciliationExceptions,
    reconciliationSummary,
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
  latestInstructionByOperationId: ReadonlyMap<string, TreasuryInstruction>;
  reconciliationSummary: FinanceDealReconciliationSummary;
  workflow: DealWorkflowProjection;
}): { stage: FinanceDealStage; stageReason: string } {
  if (input.closeReadiness.ready) {
    return {
      stage: "ready_to_close",
      stageReason: getStageReason("ready_to_close"),
    };
  }

  const linkedOperationIds = Array.from(
    new Set(
      input.workflow.executionPlan.flatMap((leg) =>
        leg.operationRefs.map((ref) => ref.operationId),
      ),
    ),
  );
  const allNonVoidedLinkedOperationsAreTerminal =
    linkedOperationIds.length > 0 &&
    linkedOperationIds.every((operationId) => {
      const latest = input.latestInstructionByOperationId.get(operationId);

      if (!latest || latest.state === "voided") {
        return latest?.state === "voided";
      }

      return CLOSE_TERMINAL_INSTRUCTION_STATES.has(latest.state);
    });

  if (
    allNonVoidedLinkedOperationsAreTerminal &&
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
                internalEntityOrganizationId: input.internalEntityOrganizationId,
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
