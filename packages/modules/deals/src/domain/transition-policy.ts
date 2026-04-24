import { DEAL_REQUIRED_SECTION_IDS_BY_TYPE, DEAL_STATUS_TRANSITIONS } from "./constants";
import {
  isOperationalPositionAtLeastReady,
  isOperationalPositionDone,
  listRequiredOperationalPositionKinds,
} from "./operational-state";
import { dealIntakeHasConvertLeg } from "./workflow";
import type {
  DealApproval,
  DealIntakeDraft,
  DealOperationalState,
  DealQuoteAcceptance,
  DealRelatedFormalDocument,
  DealSectionCompleteness,
  DealStatus,
  DealTransitionBlocker,
  DealTransitionReadiness,
  DealType,
  DealWorkflowLeg,
  DealWorkflowParticipant,
} from "./model";

const OPENING_DOCUMENT_TYPE_BY_DEAL_TYPE: Record<DealType, string> = {
  payment: "invoice",
  currency_exchange: "exchange",
  currency_transit: "invoice",
  exporter_settlement: "invoice",
};

const CLOSING_DOCUMENT_TYPE_BY_DEAL_TYPE: Record<DealType, string | null> = {
  payment: "acceptance",
  currency_exchange: null,
  currency_transit: "acceptance",
  exporter_settlement: "acceptance",
};

const SUBMITTED_AND_LATER_STATUSES: DealStatus[] = [
  "submitted",
  "preparing_documents",
  "awaiting_funds",
  "awaiting_payment",
  "closing_documents",
  "done",
];

const PREPARING_AND_LATER_STATUSES: DealStatus[] = [
  "preparing_documents",
  "awaiting_funds",
  "awaiting_payment",
  "closing_documents",
  "done",
];

const AWAITING_FUNDS_AND_LATER_STATUSES: DealStatus[] = [
  "awaiting_funds",
  "awaiting_payment",
  "closing_documents",
  "done",
];

const AWAITING_PAYMENT_AND_LATER_STATUSES: DealStatus[] = [
  "awaiting_payment",
  "closing_documents",
  "done",
];

const CLOSING_AND_LATER_STATUSES: DealStatus[] = [
  "closing_documents",
  "done",
];

type TransitionPolicyIntake = DealIntakeDraft;

function pushOnce(
  blockers: DealTransitionBlocker[],
  blocker: DealTransitionBlocker,
) {
  if (!blockers.some((candidate) => candidate.code === blocker.code)) {
    blockers.push(blocker);
  }
}

function isFormalDocumentReady(document: DealRelatedFormalDocument): boolean {
  return (
    document.lifecycleStatus === "active" &&
    document.submissionStatus === "submitted" &&
    (document.approvalStatus === "approved" ||
      document.approvalStatus === "not_required") &&
    (document.postingStatus === "posted" ||
      document.postingStatus === "not_required")
  );
}

function hasParticipant(
  participants: DealWorkflowParticipant[],
  role: DealWorkflowParticipant["role"],
): boolean {
  return participants.some((participant) => participant.role === role);
}

function collectSubmittedBlockers(input: {
  completeness: DealSectionCompleteness[];
  intake: TransitionPolicyIntake;
  participants: DealWorkflowParticipant[];
}): DealTransitionBlocker[] {
  const blockers: DealTransitionBlocker[] = [];

  for (const sectionId of DEAL_REQUIRED_SECTION_IDS_BY_TYPE[input.intake.type]) {
    const section = input.completeness.find((item) => item.sectionId === sectionId);
    if (!section?.complete) {
      pushOnce(blockers, {
        code: "intake_incomplete",
        message: "Required intake sections are incomplete",
        meta: {
          sectionId,
        },
      });
    }
  }

  const requiredRoles: {
    resolved: boolean;
    role:
      | "customer"
      | "applicant"
      | "internal_entity"
      | "external_payer"
      | "external_beneficiary";
  }[] = [
    {
      resolved: hasParticipant(input.participants, "customer"),
      role: "customer",
    },
    {
      resolved: hasParticipant(input.participants, "applicant"),
      role: "applicant",
    },
    {
      resolved: hasParticipant(input.participants, "internal_entity"),
      role: "internal_entity",
    },
  ];

  const requiredSections = new Set<string>(
    DEAL_REQUIRED_SECTION_IDS_BY_TYPE[input.intake.type],
  );

  if (requiredSections.has("incomingReceipt")) {
    requiredRoles.push({
      resolved:
        hasParticipant(input.participants, "external_payer") ||
        Boolean(input.intake.incomingReceipt.payerSnapshot),
      role: "external_payer",
    });
  }

  if (
    requiredSections.has("externalBeneficiary")
  ) {
    requiredRoles.push({
      resolved:
        hasParticipant(input.participants, "external_beneficiary") ||
        Boolean(input.intake.externalBeneficiary.beneficiarySnapshot),
      role: "external_beneficiary",
    });
  }

  for (const role of requiredRoles) {
    if (!role.resolved) {
      blockers.push({
        code: "participant_missing",
        message: `Required participant is unresolved: ${role.role}`,
        meta: {
          role: role.role,
        },
      });
    }
  }

  return blockers;
}

function collectPreparingDocumentsBlockers(input: {
  acceptance: DealQuoteAcceptance | null;
  approvals: DealApproval[];
  calculationId: string | null;
  hasConvert: boolean;
  now: Date;
}): DealTransitionBlocker[] {
  const blockers: DealTransitionBlocker[] = [];

  if (input.hasConvert) {
    if (!input.acceptance) {
      blockers.push({
        code: "accepted_quote_missing",
        message: "An accepted quote is required for convert deals",
      });
    } else {
      const quoteLockedForExecution =
        input.acceptance.quoteStatus === "used";
      const quoteActiveAndUnexpired =
        input.acceptance.quoteStatus === "active" &&
        (!input.acceptance.expiresAt ||
          input.acceptance.expiresAt.getTime() > input.now.getTime());

      if (!quoteLockedForExecution && !quoteActiveAndUnexpired) {
        blockers.push({
          code: "accepted_quote_inactive",
          message: "The accepted quote is no longer executable",
          meta: {
            quoteId: input.acceptance.quoteId,
            quoteStatus: input.acceptance.quoteStatus,
          },
        });
      }
    }

    if (!input.calculationId) {
      blockers.push({
        code: "calculation_missing",
        message: "A calculation derived from the accepted quote is required",
      });
    }
  }

  for (const approval of input.approvals) {
    if (approval.status === "pending") {
      blockers.push({
        code: "approval_pending",
        message: `Approval is still pending: ${approval.approvalType}`,
        meta: {
          approvalId: approval.id,
          approvalType: approval.approvalType,
        },
      });
    }

    if (approval.status === "rejected") {
      blockers.push({
        code: "approval_rejected",
        message: `Approval was rejected: ${approval.approvalType}`,
        meta: {
          approvalId: approval.id,
          approvalType: approval.approvalType,
        },
      });
    }
  }

  return blockers;
}

function collectPositionBlockers(input: {
  minimum: "done" | "ready";
  positions: DealOperationalState["positions"];
  requiredKinds: DealOperationalState["positions"][number]["kind"][];
}): DealTransitionBlocker[] {
  const blockers: DealTransitionBlocker[] = [];

  for (const kind of input.requiredKinds) {
    const position = input.positions.find((candidate) => candidate.kind === kind);

    if (!position) {
      blockers.push({
        code: "operational_position_incomplete",
        message: `Operational position is missing: ${kind}`,
        meta: {
          kind,
          minimum: input.minimum,
        },
      });
      continue;
    }

    if (position.state === "blocked") {
      blockers.push({
        code: "operational_position_blocked",
        message: `Operational position is blocked: ${kind}`,
        meta: {
          kind,
          minimum: input.minimum,
          reasonCode: position.reasonCode,
          sourceRefs: position.sourceRefs,
          state: position.state,
        },
      });
      continue;
    }

    const meetsMinimum =
      input.minimum === "done"
        ? isOperationalPositionDone(position.state)
        : isOperationalPositionAtLeastReady(position.state);

    if (!meetsMinimum) {
      blockers.push({
        code: "operational_position_incomplete",
        message:
          input.minimum === "done"
            ? `Operational position is not complete: ${kind}`
            : `Operational position is not ready: ${kind}`,
        meta: {
          kind,
          minimum: input.minimum,
          reasonCode: position.reasonCode,
          sourceRefs: position.sourceRefs,
          state: position.state,
        },
      });
    }
  }

  return blockers;
}

function collectDocumentBlockers(input: {
  codeMissing: DealTransitionBlocker["code"];
  codeNotReady: DealTransitionBlocker["code"];
  documents: DealRelatedFormalDocument[];
  docType: string | null;
  messagePrefix: string;
}): DealTransitionBlocker[] {
  if (!input.docType) {
    return [];
  }

  const blockers: DealTransitionBlocker[] = [];
  const matchingDocuments = input.documents.filter(
    (document) => document.docType === input.docType,
  );

  if (matchingDocuments.length === 0) {
    blockers.push({
      code: input.codeMissing,
      message: `${input.messagePrefix} document is required: ${input.docType}`,
      meta: {
        docType: input.docType,
      },
    });

    return blockers;
  }

  if (!matchingDocuments.some(isFormalDocumentReady)) {
    blockers.push({
      code: input.codeNotReady,
      message: `${input.messagePrefix} document is not ready: ${input.docType}`,
      meta: {
        docType: input.docType,
      },
    });
  }

  return blockers;
}

function collectLegReadyBlockers(legs: DealWorkflowLeg[]): DealTransitionBlocker[] {
  const blockers: DealTransitionBlocker[] = [];

  for (const leg of legs) {
    if (leg.state === "blocked") {
      blockers.push({
        code: "execution_leg_blocked",
        message: `Execution leg is blocked: ${leg.kind}`,
        meta: {
          idx: leg.idx,
          kind: leg.kind,
        },
      });
      continue;
    }

    if (leg.state === "pending") {
      blockers.push({
        code: "execution_leg_not_ready",
        message: `Execution leg is not ready: ${leg.kind}`,
        meta: {
          idx: leg.idx,
          kind: leg.kind,
        },
      });
    }
  }

  return blockers;
}

function collectLegDoneBlockers(
  legs: DealWorkflowLeg[],
  kinds: DealWorkflowLeg["kind"][],
): DealTransitionBlocker[] {
  const blockers: DealTransitionBlocker[] = [];

  for (const leg of legs.filter((candidate) => kinds.includes(candidate.kind))) {
    if (leg.state === "done" || leg.state === "skipped") {
      continue;
    }

    blockers.push({
      code: leg.state === "blocked"
        ? "execution_leg_blocked"
        : "execution_leg_not_done",
      message:
        leg.state === "blocked"
          ? `Execution leg is blocked: ${leg.kind}`
          : `Execution leg is not complete: ${leg.kind}`,
      meta: {
        idx: leg.idx,
        kind: leg.kind,
        state: leg.state,
      },
    });
  }

  return blockers;
}

export function evaluateDealTransitionReadiness(input: {
  acceptance: DealQuoteAcceptance | null;
  approvals: DealApproval[];
  calculationId: string | null;
  completeness: DealSectionCompleteness[];
  documents: DealRelatedFormalDocument[];
  executionPlan: DealWorkflowLeg[];
  intake: TransitionPolicyIntake;
  now: Date;
  operationalState: DealOperationalState;
  participants: DealWorkflowParticipant[];
  status: DealStatus;
  targetStatus: DealStatus;
}): DealTransitionReadiness {
  const blockers: DealTransitionBlocker[] = [];
  const hasConvert = dealIntakeHasConvertLeg(input.intake);

  if (
    !DEAL_STATUS_TRANSITIONS[input.status].includes(input.targetStatus) &&
    input.targetStatus !== input.status
  ) {
    return {
      allowed: false,
      blockers: [
        {
          code: "execution_leg_not_ready",
          message: `Cannot transition from ${input.status} to ${input.targetStatus}`,
          meta: {
            from: input.status,
            to: input.targetStatus,
          },
        },
      ],
      targetStatus: input.targetStatus,
    };
  }

  const requiresSubmittedChecks = SUBMITTED_AND_LATER_STATUSES.includes(
    input.targetStatus,
  );

  if (requiresSubmittedChecks) {
    blockers.push(
      ...collectSubmittedBlockers({
        completeness: input.completeness,
        intake: input.intake,
        participants: input.participants,
      }),
    );
  }

  const requiresPreparingChecks = PREPARING_AND_LATER_STATUSES.includes(
    input.targetStatus,
  );

  if (requiresPreparingChecks) {
    blockers.push(
      ...collectPreparingDocumentsBlockers({
        acceptance: input.acceptance,
        approvals: input.approvals,
        calculationId: input.calculationId,
        hasConvert,
        now: input.now,
      }),
    );
  }

  const requiresAwaitingFundsChecks = AWAITING_FUNDS_AND_LATER_STATUSES.includes(
    input.targetStatus,
  );

  if (requiresAwaitingFundsChecks) {
    blockers.push(
      ...collectDocumentBlockers({
        codeMissing: "opening_document_missing",
        codeNotReady: "opening_document_not_ready",
        documents: input.documents,
        docType: OPENING_DOCUMENT_TYPE_BY_DEAL_TYPE[input.intake.type],
        messagePrefix: "Opening",
      }),
    );
  }

  const requiresAwaitingPaymentChecks =
    AWAITING_PAYMENT_AND_LATER_STATUSES.includes(input.targetStatus);

  if (requiresAwaitingPaymentChecks) {
    const downstreamPositionKinds = listRequiredOperationalPositionKinds(
      input.intake.type,
    ).filter((kind) => kind !== "customer_receivable");

    blockers.push(
      ...collectPositionBlockers({
        minimum: "done",
        positions: input.operationalState.positions,
        requiredKinds: ["customer_receivable"],
      }),
      ...collectPositionBlockers({
        minimum: "ready",
        positions: input.operationalState.positions,
        requiredKinds: downstreamPositionKinds,
      }),
      ...collectLegDoneBlockers(input.executionPlan, ["collect", "convert"]),
      ...collectLegReadyBlockers(
        input.executionPlan.filter((leg) =>
          ["payout", "transit_hold", "settle_exporter"].includes(leg.kind),
        ),
      ),
    );
  }

  const requiresClosingChecks = CLOSING_AND_LATER_STATUSES.includes(
    input.targetStatus,
  );

  if (requiresClosingChecks) {
    const downstreamPositionKinds = listRequiredOperationalPositionKinds(
      input.intake.type,
    ).filter((kind) => kind !== "customer_receivable");

    blockers.push(
      ...collectPositionBlockers({
        minimum: "done",
        positions: input.operationalState.positions,
        requiredKinds: downstreamPositionKinds,
      }),
      ...collectLegDoneBlockers(input.executionPlan, [
        "payout",
        "transit_hold",
        "settle_exporter",
      ]),
    );
  }

  if (input.targetStatus === "done") {
    blockers.push(
      ...collectDocumentBlockers({
        codeMissing: "closing_document_missing",
        codeNotReady: "closing_document_not_ready",
        documents: input.documents,
        docType: CLOSING_DOCUMENT_TYPE_BY_DEAL_TYPE[input.intake.type],
        messagePrefix: "Closing",
      }),
    );
  }

  return {
    allowed: blockers.length === 0,
    blockers,
    targetStatus: input.targetStatus,
  };
}

export function listDealTransitionReadiness(input: {
  acceptance: DealQuoteAcceptance | null;
  approvals: DealApproval[];
  calculationId: string | null;
  completeness: DealSectionCompleteness[];
  documents: DealRelatedFormalDocument[];
  executionPlan: DealWorkflowLeg[];
  intake: TransitionPolicyIntake;
  now: Date;
  operationalState: DealOperationalState;
  participants: DealWorkflowParticipant[];
  status: DealStatus;
}): DealTransitionReadiness[] {
  return DEAL_STATUS_TRANSITIONS[input.status].map((targetStatus) =>
    evaluateDealTransitionReadiness({
      ...input,
      targetStatus,
    }),
  );
}
