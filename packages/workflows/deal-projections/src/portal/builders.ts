import type {
  DealTimelineEvent,
  DealType,
  DealWorkflowProjection,
} from "@bedrock/deals/contracts";

import type { PortalDealProjection } from "../contracts";
import type { DealAttachmentRecord, DealProjectionsWorkflowDeps } from "../shared/deps";
import {
  hasAttachmentPurpose,
} from "../shared/documents";
import { buildPortalQuoteSummary } from "../shared/projection-builders";
import { toMap } from "../shared/utils";
import {
  getApplicantParticipant,
  getCustomerParticipant,
} from "../shared/workflow-helpers";

const CUSTOMER_SAFE_INVOICE_REQUIRED_ACTION = "Загрузите инвойс";
const PORTAL_OWNED_SECTIONS_BY_TYPE: Record<DealType, string[]> = {
  currency_exchange: ["common", "moneyRequest"],
  currency_transit: ["common", "moneyRequest", "incomingReceipt"],
  exporter_settlement: ["common", "moneyRequest", "incomingReceipt"],
  payment: ["common", "moneyRequest"],
};

function getCustomerSafeTimeline(
  timeline: DealTimelineEvent[],
): DealTimelineEvent[] {
  return timeline.filter((event) => event.visibility === "customer_safe");
}

function buildCustomerSafeAttachments(
  attachments: DealAttachmentRecord[],
  workflow: DealWorkflowProjection,
) {
  const ingestionsByAttachmentId = new Map(
    workflow.attachmentIngestions.map((ingestion) => [
      ingestion.fileAssetId,
      ingestion,
    ]),
  );

  return attachments
    .filter((attachment) => attachment.visibility === "customer_safe")
    .map((attachment) => {
      const ingestion = ingestionsByAttachmentId.get(attachment.id) ?? null;
      const ingestionStatus =
        !attachment.purpose || attachment.purpose === "other"
          ? null
          : !ingestion
            ? null
            : ingestion.status === "pending" ||
                ingestion.status === "processing"
              ? ("processing" as const)
              : ingestion.status === "processed"
                ? ("applied" as const)
                : ingestion.errorCode === "extractor_unconfigured" ||
                    ingestion.errorCode === "storage_unconfigured"
                  ? ("unavailable" as const)
                  : ("failed" as const);

      return {
        createdAt: attachment.createdAt,
        fileName: attachment.fileName,
        id: attachment.id,
        ingestionStatus,
        purpose: attachment.purpose,
      };
    })
    .sort(
      (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
    );
}

function buildPortalSubmissionCompleteness(input: {
  attachments: DealAttachmentRecord[];
  workflow: DealWorkflowProjection;
}) {
  const relevantSectionIds = new Set(
    PORTAL_OWNED_SECTIONS_BY_TYPE[input.workflow.intake.type],
  );
  const blockingReasons = input.workflow.sectionCompleteness
    .filter((section) => relevantSectionIds.has(section.sectionId))
    .flatMap((section) => section.blockingReasons);

  if (
    input.workflow.summary.type === "payment" &&
    !hasAttachmentPurpose(input.attachments, "invoice", "customer_safe")
  ) {
    blockingReasons.push(CUSTOMER_SAFE_INVOICE_REQUIRED_ACTION);
  }

  return {
    blockingReasons,
    complete: blockingReasons.length === 0,
  };
}

function requiresCustomerAttachment(nextAction: string) {
  return (
    nextAction === "Prepare documents" ||
    nextAction === "Prepare closing documents"
  );
}

function mapPortalNextAction(input: {
  hasRequiredInvoice: boolean;
  nextAction: string;
}) {
  if (requiresCustomerAttachment(input.nextAction)) {
    if (!input.hasRequiredInvoice) {
      return CUSTOMER_SAFE_INVOICE_REQUIRED_ACTION;
    }

    return "Ожидайте обработки документов";
  }

  const nextAction = input.nextAction;
  switch (nextAction) {
    case "Complete intake":
      return "Заполните обязательные поля заявки";
    case "Accept quote":
      return "Ожидайте или примите котировку";
    case "Create calculation from accepted quote":
      return "Ожидайте расчет по принятой котировке";
    default:
      return nextAction;
  }
}

function buildPortalRequiredActions(input: {
  hasRequiredInvoice: boolean;
  nextAction: string;
  submissionCompleteness: {
    blockingReasons: string[];
    complete: boolean;
  };
}) {
  const actions = new Set<string>();

  for (const blocker of input.submissionCompleteness.blockingReasons) {
    actions.add(blocker);
  }

  if (
    requiresCustomerAttachment(input.nextAction) &&
    !input.hasRequiredInvoice
  ) {
    actions.add(CUSTOMER_SAFE_INVOICE_REQUIRED_ACTION);
  } else if (input.nextAction.trim().length > 0) {
    actions.add(
      mapPortalNextAction({
        hasRequiredInvoice: input.hasRequiredInvoice,
        nextAction: input.nextAction,
      }),
    );
  }

  return Array.from(actions);
}

async function resolvePortalIntakeCurrencyCodes(
  workflow: DealWorkflowProjection,
  deps: Pick<DealProjectionsWorkflowDeps, "currencies">,
) {
  const currencyIds = [
    workflow.intake.moneyRequest.sourceCurrencyId,
    workflow.intake.moneyRequest.targetCurrencyId,
  ].filter((currencyId): currencyId is string => Boolean(currencyId));

  if (currencyIds.length === 0) {
    return {
      sourceCurrencyCode: null,
      targetCurrencyCode: null,
    };
  }

  const codeById = toMap(
    await Promise.all(
      Array.from(new Set(currencyIds)).map(
        async (currencyId): Promise<readonly [string, string | null]> =>
          [
            currencyId,
            (await deps.currencies.findById(currencyId))?.code ?? null,
          ] as const,
      ),
    ),
  );

  return {
    sourceCurrencyCode: workflow.intake.moneyRequest.sourceCurrencyId
      ? (codeById.get(workflow.intake.moneyRequest.sourceCurrencyId) ?? null)
      : null,
    targetCurrencyCode: workflow.intake.moneyRequest.targetCurrencyId
      ? (codeById.get(workflow.intake.moneyRequest.targetCurrencyId) ?? null)
      : null,
  };
}

async function toPortalIntakeSummary(
  workflow: DealWorkflowProjection,
  deps: Pick<DealProjectionsWorkflowDeps, "currencies">,
) {
  const currencyCodes = await resolvePortalIntakeCurrencyCodes(workflow, deps);

  return {
    contractNumber: workflow.intake.incomingReceipt?.contractNumber ?? null,
    customerNote: workflow.intake.common.customerNote,
    expectedAmount: workflow.intake.incomingReceipt?.expectedAmount ?? null,
    invoiceNumber: workflow.intake.incomingReceipt?.invoiceNumber ?? null,
    purpose: workflow.intake.moneyRequest.purpose,
    requestedExecutionDate: workflow.intake.common.requestedExecutionDate,
    sourceAmount: workflow.intake.moneyRequest.sourceAmount,
    sourceCurrencyCode: currencyCodes.sourceCurrencyCode,
    sourceCurrencyId: workflow.intake.moneyRequest.sourceCurrencyId,
    targetCurrencyCode: currencyCodes.targetCurrencyCode,
    targetCurrencyId: workflow.intake.moneyRequest.targetCurrencyId,
  };
}

export async function buildPortalProjection(
  input: {
    attachments: DealAttachmentRecord[];
    workflow: DealWorkflowProjection;
  },
  deps: Pick<DealProjectionsWorkflowDeps, "currencies">,
): Promise<PortalDealProjection> {
  const customerSafeTimeline = getCustomerSafeTimeline(input.workflow.timeline);
  const attachments = buildCustomerSafeAttachments(
    input.attachments,
    input.workflow,
  );
  const hasRequiredInvoice =
    input.workflow.summary.type !== "payment" ||
    attachments.some((attachment) => attachment.purpose === "invoice");
  const submissionCompleteness = buildPortalSubmissionCompleteness({
    attachments: input.attachments,
    workflow: input.workflow,
  });

  return {
    attachments,
    calculationSummary: input.workflow.summary.calculationId
      ? { id: input.workflow.summary.calculationId }
      : null,
    customerSafeIntake: await toPortalIntakeSummary(input.workflow, deps),
    nextAction: mapPortalNextAction({
      hasRequiredInvoice,
      nextAction: input.workflow.nextAction,
    }),
    quoteSummary: buildPortalQuoteSummary(input.workflow),
    requiredActions: buildPortalRequiredActions({
      hasRequiredInvoice,
      nextAction: input.workflow.nextAction,
      submissionCompleteness,
    }),
    submissionCompleteness,
    summary: {
      applicantDisplayName:
        getApplicantParticipant(input.workflow)?.displayName ?? null,
      createdAt: input.workflow.summary.createdAt,
      id: input.workflow.summary.id,
      status: input.workflow.summary.status,
      type: input.workflow.summary.type,
    },
    timeline: customerSafeTimeline,
  };
}

export function toPortalListItem(projection: PortalDealProjection) {
  return {
    applicantDisplayName: projection.summary.applicantDisplayName,
    attachmentCount: projection.attachments.length,
    calculationSummary: projection.calculationSummary,
    createdAt: projection.summary.createdAt,
    id: projection.summary.id,
    nextAction: projection.nextAction,
    quoteExpiresAt: projection.quoteSummary?.expiresAt ?? null,
    status: projection.summary.status,
    submissionComplete: projection.submissionCompleteness.complete,
    type: projection.summary.type,
  };
}

export function isDealOwnedByCustomer(
  workflow: DealWorkflowProjection,
  customerId: string,
) {
  return getCustomerParticipant(workflow)?.customerId === customerId;
}
