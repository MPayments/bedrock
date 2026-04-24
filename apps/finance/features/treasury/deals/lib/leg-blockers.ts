import { LEG_KIND_REQUIRED_DOC_TYPE } from "@bedrock/deals/contracts";

import {
  formatDealWorkflowMessage,
  formatOperationalPositionIssue,
} from "@/features/treasury/deals/labels";
import type { FinanceDealWorkbench } from "@/features/treasury/deals/lib/queries";

import { LEG_PRIMARY_POSITION_KIND_MAP } from "./execution-summary";

type Leg = FinanceDealWorkbench["executionPlan"][number];

// Inverted view of the canonical `LEG_KIND_REQUIRED_DOC_TYPE` map from the
// deals module — docType → legKind(s). The canonical map only covers per-leg
// doc types; here we add the runtime-resolved transit_hold variants and the
// deal-level closing docs that can still surface as requirements against a
// specific leg kind.
const DOC_TYPE_LEG_KINDS: Record<string, readonly string[]> = (() => {
  const inverted: Record<string, string[]> = {};
  for (const [legKind, docType] of Object.entries(LEG_KIND_REQUIRED_DOC_TYPE)) {
    if (!docType) continue;
    inverted[docType] ??= [];
    inverted[docType].push(legKind);
  }
  // Extensions not in the canonical map:
  inverted.transfer_intra = ["transit_hold"];
  inverted.transfer_intercompany = ["transit_hold"];
  inverted.payment_acceptance = ["payout"];
  inverted.acceptance = ["payout"];
  return inverted;
})();

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
