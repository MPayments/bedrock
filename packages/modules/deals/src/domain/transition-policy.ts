import { DEAL_REQUIRED_SECTION_IDS_BY_TYPE, DEAL_STATUS_TRANSITIONS } from "./constants";
import {
  isOperationalPositionAtLeastReady,
  isOperationalPositionDone,
  listRequiredOperationalPositionKinds,
} from "./operational-state";
import type {
  DealApproval,
  DealHeader,
  DealOperationalState,
  DealRelatedFormalDocument,
  DealSectionCompleteness,
  DealTransitionBlocker,
  DealTransitionReadiness,
  DealWorkflowLeg,
  DealWorkflowParticipant,
} from "../application/contracts/dto";
import type { DealStatus, DealType } from "../application/contracts/zod";

const OPENING_DOCUMENT_TYPE_BY_DEAL_TYPE: Record<DealType, string> = {
  payment: "invoice",
  currency_exchange: "exchange",
  currency_transit: "invoice",
  exporter_settlement: "invoice",
  internal_treasury: "exchange",
};

const CLOSING_DOCUMENT_TYPE_BY_DEAL_TYPE: Record<DealType, string | null> = {
  payment: "acceptance",
  currency_exchange: null,
  currency_transit: "acceptance",
  exporter_settlement: "acceptance",
  internal_treasury: null,
};

const PRICING_AND_LATER_STATUSES: DealStatus[] = [
  "pricing",
  "quoted",
  "awaiting_customer_approval",
  "awaiting_internal_approval",
  "approved_for_execution",
  "executing",
  "partially_executed",
  "executed",
  "reconciling",
  "closed",
];

const QUOTED_AND_LATER_STATUSES: DealStatus[] = [
  "quoted",
  "awaiting_customer_approval",
  "awaiting_internal_approval",
  "approved_for_execution",
  "executing",
  "partially_executed",
  "executed",
  "reconciling",
  "closed",
];

const APPROVED_FOR_EXECUTION_AND_LATER_STATUSES: DealStatus[] = [
  "approved_for_execution",
  "executing",
  "partially_executed",
  "executed",
  "reconciling",
  "closed",
];

const EXECUTING_AND_LATER_STATUSES: DealStatus[] = [
  "executing",
  "partially_executed",
  "executed",
  "reconciling",
  "closed",
];

const EXECUTED_AND_LATER_STATUSES: DealStatus[] = [
  "executed",
  "reconciling",
  "closed",
];

type TransitionPolicyHeader = DealHeader;

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

function collectHeaderBlockers(input: {
  completeness: DealSectionCompleteness[];
  header: TransitionPolicyHeader;
  participants: DealWorkflowParticipant[];
}): DealTransitionBlocker[] {
  const blockers: DealTransitionBlocker[] = [];

  for (const sectionId of DEAL_REQUIRED_SECTION_IDS_BY_TYPE[input.header.type]) {
    const section = input.completeness.find((item) => item.sectionId === sectionId);
    if (!section?.complete) {
      pushOnce(blockers, {
        code: "header_incomplete",
        message: "Required deal header sections are incomplete",
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
    DEAL_REQUIRED_SECTION_IDS_BY_TYPE[input.header.type],
  );

  if (requiredSections.has("incomingReceipt")) {
    requiredRoles.push({
      resolved:
        hasParticipant(input.participants, "external_payer") ||
        Boolean(input.header.incomingReceipt.payerSnapshot),
      role: "external_payer",
    });
  }

  if (
    requiredSections.has("externalBeneficiary")
  ) {
    requiredRoles.push({
      resolved:
        hasParticipant(input.participants, "external_beneficiary") ||
        Boolean(input.header.externalBeneficiary.beneficiarySnapshot),
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

function latestApprovalStatus(
  approvals: DealApproval[],
  approvalType: DealApproval["approvalType"],
) {
  return [...approvals]
    .filter((approval) => approval.approvalType === approvalType)
    .sort((left, right) => right.requestedAt.getTime() - left.requestedAt.getTime())
    .at(0)?.status ?? null;
}

function collectCalculationBlockers(input: {
  calculationId: string | null;
}): DealTransitionBlocker[] {
  if (input.calculationId) {
    return [];
  }

  return [
    {
      code: "calculation_missing",
      message: "A route-based calculation is required",
    },
  ];
}

function collectApprovalBlockers(input: {
  approvals: DealApproval[];
  requireCustomerApproval: boolean;
  requireInternalApproval: boolean;
}): DealTransitionBlocker[] {
  const blockers: DealTransitionBlocker[] = [];
  const requiredApprovalTypes = [
    input.requireCustomerApproval ? ("commercial" as const) : null,
    input.requireInternalApproval ? ("operations" as const) : null,
  ].filter((value): value is "commercial" | "operations" => value !== null);

  for (const approvalType of requiredApprovalTypes) {
    const status = latestApprovalStatus(input.approvals, approvalType);

    if (status === "approved") {
      continue;
    }

    blockers.push({
      code: status === "rejected" ? "approval_rejected" : "approval_pending",
      message:
        status === "rejected"
          ? `Approval was rejected: ${approvalType}`
          : `Approval is still pending: ${approvalType}`,
      meta: {
        approvalType,
      },
    });
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
  approvals: DealApproval[];
  calculationId: string | null;
  completeness: DealSectionCompleteness[];
  documents: DealRelatedFormalDocument[];
  executionPlan: DealWorkflowLeg[];
  header: TransitionPolicyHeader;
  now: Date;
  operationalState: DealOperationalState;
  participants: DealWorkflowParticipant[];
  status: DealStatus;
  targetStatus: DealStatus;
}): DealTransitionReadiness {
  const blockers: DealTransitionBlocker[] = [];

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

  const requiresHeaderChecks = PRICING_AND_LATER_STATUSES.includes(
    input.targetStatus,
  );

  if (requiresHeaderChecks) {
    blockers.push(
      ...collectHeaderBlockers({
        completeness: input.completeness,
        header: input.header,
        participants: input.participants,
      }),
    );
  }

  const requiresCalculationChecks = QUOTED_AND_LATER_STATUSES.includes(
    input.targetStatus,
  );

  if (requiresCalculationChecks) {
    blockers.push(
      ...collectCalculationBlockers({
        calculationId: input.calculationId,
      }),
    );
  }

  if (input.targetStatus === "awaiting_internal_approval") {
    blockers.push(
      ...collectApprovalBlockers({
        approvals: input.approvals,
        requireCustomerApproval: true,
        requireInternalApproval: false,
      }),
    );
  }

  if (APPROVED_FOR_EXECUTION_AND_LATER_STATUSES.includes(input.targetStatus)) {
    blockers.push(
      ...collectApprovalBlockers({
        approvals: input.approvals,
        requireCustomerApproval: true,
        requireInternalApproval: true,
      }),
    );
  }

  const requiresApprovedChecks =
    APPROVED_FOR_EXECUTION_AND_LATER_STATUSES.includes(input.targetStatus);

  if (requiresApprovedChecks) {
    blockers.push(
      ...collectDocumentBlockers({
        codeMissing: "opening_document_missing",
        codeNotReady: "opening_document_not_ready",
        documents: input.documents,
        docType: OPENING_DOCUMENT_TYPE_BY_DEAL_TYPE[input.header.type],
        messagePrefix: "Opening",
      }),
    );
  }

  const requiresExecutingChecks =
    EXECUTING_AND_LATER_STATUSES.includes(input.targetStatus);

  if (requiresExecutingChecks) {
    const downstreamPositionKinds = listRequiredOperationalPositionKinds(
      input.header.type,
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

  const requiresExecutedChecks = EXECUTED_AND_LATER_STATUSES.includes(
    input.targetStatus,
  );

  if (requiresExecutedChecks) {
    const downstreamPositionKinds = listRequiredOperationalPositionKinds(
      input.header.type,
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

  if (input.targetStatus === "closed") {
    blockers.push(
      ...collectDocumentBlockers({
        codeMissing: "closing_document_missing",
        codeNotReady: "closing_document_not_ready",
        documents: input.documents,
        docType: CLOSING_DOCUMENT_TYPE_BY_DEAL_TYPE[input.header.type],
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
  approvals: DealApproval[];
  calculationId: string | null;
  completeness: DealSectionCompleteness[];
  documents: DealRelatedFormalDocument[];
  executionPlan: DealWorkflowLeg[];
  header: TransitionPolicyHeader;
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
