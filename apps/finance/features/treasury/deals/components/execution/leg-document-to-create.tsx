"use client";

import Link from "next/link";
import { FileText } from "lucide-react";

import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Button } from "@bedrock/sdk-ui/components/button";

import {
  buildDocumentCreateHref,
  buildDocumentDetailsHref,
} from "@/features/documents/lib/routes";
import type {
  FinanceDealRouteAttachmentParticipant,
  FinanceDealWorkbench,
} from "@/features/treasury/deals/lib/queries";

type Leg = FinanceDealWorkbench["executionPlan"][number];

const DOC_TYPE_LABEL: Record<string, string> = {
  invoice: "Инвойс",
  exchange: "Документ обмена",
  transfer_intra: "Внутренний перевод",
  transfer_intercompany: "Межкомпанейский перевод",
  transfer_resolution: "Документ урегулирования",
  acceptance: "Акт приёмки",
};

interface ResolvedLegDocType {
  docType: string;
  reason: string | null;
}

function resolveLegDocType(
  leg: Leg,
  deal: FinanceDealWorkbench,
): ResolvedLegDocType | null {
  if (leg.kind === "collect") return { docType: "invoice", reason: null };
  if (leg.kind === "convert") return { docType: "exchange", reason: null };
  if (leg.kind === "settle_exporter") {
    return { docType: "transfer_resolution", reason: null };
  }
  if (leg.kind === "payout") return null;
  if (leg.kind === "transit_hold") {
    const attachment = deal.pricing.routeAttachment;
    if (!attachment || !leg.routeSnapshotLegId) return null;
    const hopPosition = attachment.legs.findIndex(
      (routeLeg) => routeLeg.id === leg.routeSnapshotLegId,
    );
    if (hopPosition < 0) return null;
    const from: FinanceDealRouteAttachmentParticipant | undefined =
      attachment.participants[hopPosition];
    const to: FinanceDealRouteAttachmentParticipant | undefined =
      attachment.participants[hopPosition + 1];
    if (!from || !to) return null;
    if (from.binding === "abstract" || to.binding === "abstract") {
      return {
        docType: "transfer_intra",
        reason:
          "Участники шага не привязаны к юр. лицу — документ нельзя создать автоматически.",
      };
    }
    if (from.entityId && to.entityId && from.entityId === to.entityId) {
      return { docType: "transfer_intra", reason: null };
    }
    return { docType: "transfer_intercompany", reason: null };
  }
  return null;
}

export interface LegDocumentToCreateProps {
  canWrite: boolean;
  deal: FinanceDealWorkbench;
  leg: Leg;
}

export function LegDocumentToCreate({
  canWrite,
  deal,
  leg,
}: LegDocumentToCreateProps) {
  const resolved = resolveLegDocType(leg, deal);
  if (!resolved) return null;

  const label = DOC_TYPE_LABEL[resolved.docType] ?? resolved.docType;
  const existingDoc = deal.relatedResources.formalDocuments.find(
    (doc) => doc.docType === resolved.docType,
  );
  const dealHref = `/treasury/deals/${encodeURIComponent(deal.summary.id)}`;
  const createHref = buildDocumentCreateHref(resolved.docType, {
    dealId: deal.summary.id,
    returnTo: dealHref,
  });
  const openHref = existingDoc
    ? buildDocumentDetailsHref(resolved.docType, existingDoc.id)
    : null;

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed border-muted-foreground/40 bg-muted/20 px-4 py-3"
      data-testid={`finance-deal-leg-document-${leg.idx}`}
    >
      <div className="flex items-start gap-2">
        <FileText className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">Документ к созданию:</span>
            <Badge variant="outline">{label}</Badge>
          </div>
          {resolved.reason ? (
            <div className="text-muted-foreground mt-1 text-xs">
              {resolved.reason}
            </div>
          ) : null}
          {existingDoc?.postingStatus ? (
            <div className="text-muted-foreground mt-1 text-xs">
              Статус: {existingDoc.postingStatus}
              {existingDoc.lifecycleStatus
                ? ` · ${existingDoc.lifecycleStatus}`
                : ""}
            </div>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {existingDoc && openHref ? (
          <Button
            data-testid={`finance-deal-leg-document-open-${leg.idx}`}
            size="sm"
            variant="outline"
            nativeButton={false}
            render={<Link href={openHref} />}
          >
            Открыть документ
          </Button>
        ) : createHref ? (
          <Button
            data-testid={`finance-deal-leg-document-create-${leg.idx}`}
            size="sm"
            variant="outline"
            disabled={!canWrite || resolved.reason !== null}
            nativeButton={false}
            render={<Link href={createHref} />}
          >
            Создать документ
          </Button>
        ) : (
          <Button size="sm" variant="outline" disabled>
            Недоступно
          </Button>
        )}
      </div>
    </div>
  );
}
