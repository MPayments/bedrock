import {
  formatDealWorkflowMessage,
  formatOperationalPositionIssue,
  getFinancePrimaryOperationalPositionLabel,
  isPrimaryOperationalPositionVisible,
} from "@/features/treasury/deals/labels";

export const FINANCE_DEAL_BLOCKER_STATE_VALUES = [
  "blocked",
  "clear",
] as const;

export type FinanceDealBlockerState =
  (typeof FINANCE_DEAL_BLOCKER_STATE_VALUES)[number];

type FinanceDealListItemForBlockerState = {
  blockingReasons: string[];
  executionSummary: {
    blockedLegCount: number;
  };
  queue: string;
};

type FinanceDealAttachmentRequirement = {
  blockingReasons: string[];
  state: string;
};

type FinanceDealFormalDocumentRequirement = {
  blockingReasons: string[];
  state: string;
};

type FinanceDealExecutionLeg = {
  idx: number;
  kind: string;
  state: string;
};

type FinanceDealOperationalPosition = {
  kind: string;
  state: string;
};

type FinanceDealOperationalState = {
  positions: FinanceDealOperationalPosition[];
};

type FinanceDealQueueContext = {
  blockers: string[];
};

type FinanceDealExecutionInput = {
  attachmentRequirements: FinanceDealAttachmentRequirement[];
  executionPlan: FinanceDealExecutionLeg[];
  formalDocumentRequirements: FinanceDealFormalDocumentRequirement[];
  operationalState: FinanceDealOperationalState;
  queueContext: FinanceDealQueueContext;
};

export type FinanceDealExecutionLegSummary = {
  blocker: string | null;
  idx: number;
  kind: string;
  primaryPositionKind: string | null;
  primaryPositionLabel: string | null;
  state: string;
};

const LEG_PRIMARY_POSITION_KIND_MAP: Record<string, string | null> = {
  collect: "customer_receivable",
  convert: null,
  payout: "provider_payable",
  settle_exporter: "provider_payable",
  transit_hold: "in_transit",
};

export function deriveFinanceDealBlockerState(
  item: FinanceDealListItemForBlockerState,
): FinanceDealBlockerState {
  const isBlocked =
    item.blockingReasons.length > 0 ||
    item.executionSummary.blockedLegCount > 0 ||
    item.queue === "failed_instruction";

  return isBlocked ? "blocked" : "clear";
}

export function getFinanceDealExecutionProgress(
  deal: Pick<FinanceDealExecutionInput, "executionPlan" | "operationalState">,
) {
  const blockedLegCount = deal.executionPlan.filter((leg) => leg.state === "blocked")
    .length;
  const doneLegCount = deal.executionPlan.filter((leg) => leg.state === "done").length;

  return {
    blockedLegCount,
    doneLegCount,
    issueCount: getFinanceDealExecutionIssueCount(deal),
    totalLegCount: deal.executionPlan.length,
  };
}

export function getFinanceDealExecutionIssueCount(
  deal: Pick<FinanceDealExecutionInput, "executionPlan" | "operationalState">,
) {
  return (
    deal.executionPlan.filter((leg) => leg.state === "blocked").length +
    deal.operationalState.positions.filter(
      (position) =>
        isPrimaryOperationalPositionVisible(position.kind) &&
        position.state === "blocked",
    ).length
  );
}

export function collectFinanceDealTopBlockers(
  deal: FinanceDealExecutionInput,
  limit = 3,
) {
  const messages = new Set<string>();

  deal.queueContext.blockers.forEach((blocker) =>
    messages.add(formatDealWorkflowMessage(blocker)),
  );

  deal.attachmentRequirements
    .filter((requirement) => requirement.state === "missing")
    .forEach((requirement) =>
      requirement.blockingReasons.forEach((reason) =>
        messages.add(formatDealWorkflowMessage(reason)),
      ),
    );

  deal.formalDocumentRequirements
    .filter(
      (requirement) =>
        requirement.state === "in_progress" || requirement.state === "missing",
    )
    .forEach((requirement) =>
      requirement.blockingReasons.forEach((reason) =>
        messages.add(formatDealWorkflowMessage(reason)),
      ),
    );

  deal.operationalState.positions
    .filter(
      (position) =>
        isPrimaryOperationalPositionVisible(position.kind) &&
        position.state === "blocked",
    )
    .forEach((position) =>
      messages.add(
        formatOperationalPositionIssue({
          kind: position.kind,
        }),
      ),
    );

  return Array.from(messages).slice(0, limit);
}

export function deriveFinanceDealExecutionLegSummaries(
  deal: Pick<FinanceDealExecutionInput, "executionPlan" | "operationalState">,
): FinanceDealExecutionLegSummary[] {
  return deal.executionPlan.map((leg) => {
    const primaryPositionKind = LEG_PRIMARY_POSITION_KIND_MAP[leg.kind] ?? null;
    const primaryPosition =
      primaryPositionKind === null
        ? null
        : deal.operationalState.positions.find(
            (item) => item.kind === primaryPositionKind,
          ) ?? null;

    let blocker: string | null = null;

    if (leg.state === "blocked") {
      blocker = formatDealWorkflowMessage(`Execution leg is blocked: ${leg.kind}`);
    } else if (primaryPosition?.state === "blocked") {
      blocker = formatOperationalPositionIssue({
        kind: primaryPosition.kind,
      });
    }

    return {
      blocker,
      idx: leg.idx,
      kind: leg.kind,
      primaryPositionKind,
      primaryPositionLabel:
        primaryPositionKind === null
          ? null
          : getFinancePrimaryOperationalPositionLabel(primaryPositionKind),
      state: leg.state,
    };
  });
}
