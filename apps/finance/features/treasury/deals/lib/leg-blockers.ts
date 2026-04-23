import {
  formatDealWorkflowMessage,
  formatOperationalPositionIssue,
} from "@/features/treasury/deals/labels";
import type { FinanceDealWorkbench } from "@/features/treasury/deals/lib/queries";

import { LEG_PRIMARY_POSITION_KIND_MAP } from "./execution-summary";

type Leg = FinanceDealWorkbench["executionPlan"][number];

const DOC_TYPE_LEG_KINDS: Record<string, readonly string[]> = {
  invoice: ["collect"],
  exchange: ["convert"],
  transfer_intra: ["transit_hold"],
  transfer_intercompany: ["transit_hold"],
  transfer_resolution: ["settle_exporter"],
  payment_acceptance: ["payout"],
  acceptance: ["payout"],
};

function collectLegOperationalBlocker(
  deal: FinanceDealWorkbench,
  leg: Leg,
): string | null {
  const positionKind = LEG_PRIMARY_POSITION_KIND_MAP[leg.kind];
  if (!positionKind) return null;
  const blockedPosition = deal.operationalState.positions.find(
    (position) =>
      position.kind === positionKind && position.state === "blocked",
  );
  if (!blockedPosition) return null;
  return formatOperationalPositionIssue({ kind: blockedPosition.kind });
}

function collectLegDocumentBlockers(
  deal: FinanceDealWorkbench,
  leg: Leg,
): string[] {
  const messages: string[] = [];
  for (const requirement of deal.formalDocumentRequirements) {
    if (
      requirement.state !== "missing" &&
      requirement.state !== "in_progress"
    ) {
      continue;
    }
    const relatedLegKinds = DOC_TYPE_LEG_KINDS[requirement.docType];
    if (!relatedLegKinds?.includes(leg.kind)) continue;
    for (const reason of requirement.blockingReasons) {
      messages.push(formatDealWorkflowMessage(reason));
    }
  }
  return messages;
}

function collectLegAttachmentBlockers(
  deal: FinanceDealWorkbench,
  leg: Leg,
): string[] {
  if (leg.kind !== "collect") return [];
  const messages: string[] = [];
  for (const requirement of deal.attachmentRequirements) {
    if (requirement.state !== "missing") continue;
    if (requirement.code !== "invoice") continue;
    for (const reason of requirement.blockingReasons) {
      messages.push(formatDealWorkflowMessage(reason));
    }
  }
  return messages;
}

export function collectLegBlockers(
  deal: FinanceDealWorkbench,
  leg: Leg,
  limit = 3,
): string[] {
  const messages = new Set<string>();

  if (leg.state === "blocked") {
    messages.add(
      formatDealWorkflowMessage(`Execution leg is blocked: ${leg.kind}`),
    );
  }

  const operationalBlocker = collectLegOperationalBlocker(deal, leg);
  if (operationalBlocker) {
    messages.add(operationalBlocker);
  }

  for (const reason of collectLegDocumentBlockers(deal, leg)) {
    messages.add(reason);
  }

  for (const reason of collectLegAttachmentBlockers(deal, leg)) {
    messages.add(reason);
  }

  return Array.from(messages).slice(0, limit);
}
