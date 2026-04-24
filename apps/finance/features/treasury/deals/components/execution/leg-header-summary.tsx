"use client";

import type {
  FinanceDealRouteAttachment,
  FinanceDealRouteAttachmentLeg,
  FinanceDealWorkbench,
} from "@/features/treasury/deals/lib/queries";
import { formatRate } from "@/features/treasury/rates/lib/format";
import { formatMinorAmountWithCurrency } from "@/lib/format";

type Leg = FinanceDealWorkbench["executionPlan"][number];
type DealParticipant = NonNullable<
  FinanceDealWorkbench["workflow"]
>["participants"][number];

function findRouteHop(
  leg: Leg,
  routeAttachment: FinanceDealRouteAttachment | null,
): FinanceDealRouteAttachmentLeg | null {
  if (!routeAttachment || !leg.routeSnapshotLegId) return null;
  return (
    routeAttachment.legs.find(
      (routeLeg) => routeLeg.id === leg.routeSnapshotLegId,
    ) ?? null
  );
}

function findDealParticipant(
  deal: FinanceDealWorkbench,
  role: DealParticipant["role"],
): string | null {
  const participant = deal.workflow?.participants.find(
    (candidate) => candidate.role === role,
  );
  return participant?.displayName ?? null;
}

function findHopParticipantName(
  leg: Leg,
  routeAttachment: FinanceDealRouteAttachment | null,
  side: "from" | "to",
): string | null {
  if (!routeAttachment || !leg.routeSnapshotLegId) return null;
  const hopIdx = routeAttachment.legs.findIndex(
    (routeLeg) => routeLeg.id === leg.routeSnapshotLegId,
  );
  if (hopIdx < 0) return null;
  const participant =
    side === "from"
      ? routeAttachment.participants[hopIdx]
      : routeAttachment.participants[hopIdx + 1];
  return participant?.displayName ?? null;
}

function formatAmount(
  amountMinor: string | null,
  currencyCode: string | null,
): string | null {
  if (!amountMinor || !currencyCode) return null;
  return formatMinorAmountWithCurrency(amountMinor, currencyCode);
}

function buildSummary(leg: Leg, deal: FinanceDealWorkbench): string | null {
  const routeAttachment = deal.pricing.routeAttachment;
  const hop = findRouteHop(leg, routeAttachment);

  switch (leg.kind) {
    case "collect": {
      const invoiceDoc = deal.relatedResources.formalDocuments.find(
        (doc) => doc.docType === "invoice",
      );
      const amount = deal.acceptedQuoteDetails
        ? formatAmount(
            deal.acceptedQuoteDetails.fromAmountMinor,
            deal.acceptedQuoteDetails.fromCurrency,
          )
        : null;
      const payer =
        findDealParticipant(deal, "external_payer") ??
        findDealParticipant(deal, "applicant");
      const parts: string[] = [];
      if (invoiceDoc) parts.push(`Инвойс ${invoiceDoc.id.slice(0, 8)}…`);
      else if (payer) parts.push(payer);
      if (amount) parts.push(amount);
      return parts.length > 0 ? parts.join(" · ") : null;
    }

    case "convert": {
      if (!hop) return null;
      const rate =
        hop.rateNum && hop.rateDen
          ? `курс ${formatRate(hop.rateNum, hop.rateDen)}`
          : null;
      const fromAmount = formatAmount(hop.fromAmountMinor, hop.fromCurrencyCode);
      const toAmount = formatAmount(hop.toAmountMinor, hop.toCurrencyCode);
      const flow =
        fromAmount && toAmount
          ? `${fromAmount} → ${toAmount}`
          : fromAmount ?? toAmount;
      return [rate, flow].filter(Boolean).join(" · ") || null;
    }

    case "transit_hold": {
      if (!hop) return null;
      const fromName = findHopParticipantName(leg, routeAttachment, "from");
      const toName = findHopParticipantName(leg, routeAttachment, "to");
      const flow =
        fromName && toName ? `${fromName} → ${toName}` : fromName ?? toName;
      const amount = formatAmount(hop.toAmountMinor, hop.toCurrencyCode);
      return [flow, amount].filter(Boolean).join(" · ") || null;
    }

    case "payout":
    case "settle_exporter": {
      const beneficiary = findDealParticipant(deal, "external_beneficiary");
      const amount = deal.acceptedQuoteDetails
        ? formatAmount(
            deal.acceptedQuoteDetails.toAmountMinor,
            deal.acceptedQuoteDetails.toCurrency,
          )
        : null;
      const parts: string[] = [];
      if (beneficiary) parts.push(beneficiary);
      if (amount) parts.push(amount);
      return parts.length > 0 ? parts.join(" · ") : null;
    }

    default:
      return null;
  }
}

export interface LegHeaderSummaryProps {
  deal: FinanceDealWorkbench;
  leg: Leg;
}

export function LegHeaderSummary({ deal, leg }: LegHeaderSummaryProps) {
  const summary = buildSummary(leg, deal);
  if (!summary) return null;
  return (
    <div
      className="text-muted-foreground font-mono text-xs"
      data-testid={`finance-deal-leg-summary-${leg.idx}`}
    >
      {summary}
    </div>
  );
}
