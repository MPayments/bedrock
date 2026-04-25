"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Info } from "lucide-react";

import { Button } from "@bedrock/sdk-ui/components/button";

import {
  getDealLegKindLabel,
  getFinanceDealDisplayTitle,
} from "@/features/treasury/deals/labels";
import type {
  FinanceDealPaymentStep,
  FinanceDealWorkbench,
} from "@/features/treasury/deals/lib/queries";
import { StepCard } from "@/features/treasury/steps/components/step-card";
import type { PartyKind } from "@/features/treasury/steps/lib/party-options";
import { executeMutation } from "@/lib/resources/http";

import { DealAttachmentsCard } from "./deal-attachments-card";
import { DealTimelineCard } from "./deal-timeline-card";
import { ExecutionContextGrid } from "./execution/context-grid";
import { ExecutionReconciliationSection } from "./execution/reconciliation-section";
import { ExecutionTimelinePane } from "./execution/timeline-pane";
import { RouteSwapDialog } from "./route-swap-dialog";
import { UploadAttachmentDialog } from "./upload-attachment-dialog";
import { DealContextContent } from "./workbench/deal-context-content";
import { DealExecutionHeaderSummary } from "./workbench/deal-execution-header-summary";
import { useWorkbenchActions } from "./workbench/use-workbench-actions";
import { refreshPage } from "./workbench/utils";
import { FinanceDealWorkspaceLayout } from "./workspace-layout";

function expectedPostingDocTypes(
  kind: FinanceDealPaymentStep["kind"],
): string[] {
  switch (kind) {
    case "payin":
      return ["invoice"];
    case "fx_conversion":
      return ["exchange", "fx_execute"];
    case "intracompany_transfer":
      return ["transfer_intra"];
    case "intercompany_funding":
      return ["transfer_intercompany"];
    case "payout":
      return ["transfer_resolution"];
    case "internal_transfer":
      return ["transfer_intra"];
    default:
      return [];
  }
}

function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `idem-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export type FinanceDealWorkbenchProps = {
  deal: FinanceDealWorkbench;
};

export function FinanceDealWorkbench({ deal }: FinanceDealWorkbenchProps) {
  const router = useRouter();
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isSwapRouteOpen, setIsSwapRouteOpen] = useState(false);
  const [selectedLegIdx, setSelectedLegIdx] = useState<number | null>(
    () => deal.executionPlan[0]?.idx ?? null,
  );
  const [timelineFilter, setTimelineFilter] = useState<"all" | "pending">(
    "all",
  );

  const { actions, state } = useWorkbenchActions(deal);

  const title = getFinanceDealDisplayTitle({
    applicantDisplayName: deal.summary.applicantDisplayName,
    id: deal.summary.id,
    type: deal.summary.type,
  });

  const canWrite = !(
    deal.summary.status === "draft" ||
    deal.summary.status === "rejected" ||
    deal.summary.status === "done" ||
    deal.summary.status === "cancelled"
  );

  const selectedLeg = useMemo(
    () =>
      deal.executionPlan.find((leg) => leg.idx === selectedLegIdx) ??
      deal.executionPlan[0] ??
      null,
    [deal.executionPlan, selectedLegIdx],
  );

  const selectedStep = useMemo(
    () =>
      selectedLeg
        ? (deal.executionSteps.find(
            (step) => step.dealLegIdx === selectedLeg.idx,
          ) ?? null)
        : null,
    [deal.executionSteps, selectedLeg],
  );

  const {
    fromCurrencyCode,
    fromPartyDisplayName,
    fromPartyKind,
    toCurrencyCode,
    toPartyDisplayName,
    toPartyKind,
  } = useMemo(() => {
    const attachment = deal.pricing.routeAttachment;
    if (!attachment || !selectedLeg) {
      return {
        fromCurrencyCode: null,
        fromPartyDisplayName: null,
        fromPartyKind: null,
        toCurrencyCode: null,
        toPartyDisplayName: null,
        toPartyKind: null,
      };
    }
    const source = attachment.participants[selectedLeg.idx - 1] ?? null;
    const destination = attachment.participants[selectedLeg.idx] ?? null;
    const legSnapshot = attachment.legs[selectedLeg.idx - 1] ?? null;
    const pickKind = (entityKind: string | null): PartyKind | null =>
      entityKind === "organization" ||
      entityKind === "counterparty" ||
      entityKind === "customer"
        ? entityKind
        : null;
    return {
      fromCurrencyCode: legSnapshot?.fromCurrencyCode ?? null,
      fromPartyDisplayName: source?.displayName ?? null,
      fromPartyKind: pickKind(source?.entityKind ?? null),
      toCurrencyCode: legSnapshot?.toCurrencyCode ?? null,
      toPartyDisplayName: destination?.displayName ?? null,
      toPartyKind: pickKind(destination?.entityKind ?? null),
    };
  }, [deal.pricing.routeAttachment, selectedLeg]);

  async function autoLinkPostingsForStep(step: FinanceDealPaymentStep) {
    const expectedDocTypes = expectedPostingDocTypes(step.kind);
    if (expectedDocTypes.length === 0) return;
    const alreadyLinked = new Set(
      step.postings.map((posting) => posting.kind),
    );
    const candidates = deal.relatedResources.formalDocuments.filter(
      (doc) =>
        expectedDocTypes.includes(doc.docType) &&
        !alreadyLinked.has(doc.docType) &&
        doc.lifecycleStatus !== "cancelled",
    );
    for (const doc of candidates) {
      await executeMutation({
        fallbackMessage: "Не удалось связать документ со шагом",
        request: () =>
          fetch(
            `/v1/treasury/steps/${encodeURIComponent(step.id)}/postings`,
            {
              method: "POST",
              credentials: "include",
              headers: {
                "Content-Type": "application/json",
                "Idempotency-Key": createIdempotencyKey(),
              },
              body: JSON.stringify({
                documentId: doc.id,
                kind: doc.docType,
              }),
            },
          ),
      });
    }
  }

  async function handleStepChanged(step: FinanceDealPaymentStep) {
    await autoLinkPostingsForStep(step);
    router.refresh();
  }

  return (
    <>
      <FinanceDealWorkspaceLayout title={title}>
        <div className="space-y-6">
          <DealExecutionHeaderSummary deal={deal} />

          <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
            <div className="space-y-6">
              {deal.actions.canCloseDeal ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    data-testid="finance-deal-close"
                    size="sm"
                    variant="secondary"
                    disabled={state.isClosingDeal}
                    onClick={actions.closeDeal}
                  >
                    {state.isClosingDeal ? "Закрываем..." : "Закрыть сделку"}
                  </Button>
                </div>
              ) : null}

              {selectedStep && selectedLeg ? (
                <StepCard
                  step={selectedStep}
                  title={`Шаг ${selectedLeg.idx} · ${getDealLegKindLabel(
                    selectedLeg.kind,
                  )}`}
                  uploadAssetPath={`/v1/deals/${encodeURIComponent(
                    deal.summary.id,
                  )}/attachments`}
                  fromCurrencyCode={fromCurrencyCode}
                  fromPartyDisplayName={fromPartyDisplayName}
                  fromPartyKind={fromPartyKind}
                  toCurrencyCode={toCurrencyCode}
                  toPartyDisplayName={toPartyDisplayName}
                  toPartyKind={toPartyKind}
                  disabled={!canWrite}
                  onChanged={handleStepChanged}
                />
              ) : (
                <div className="bg-card text-muted-foreground rounded-lg border p-6 text-sm">
                  Шагов исполнения ещё нет. Сначала зафиксируйте коммерческие
                  условия и выберите маршрут.
                </div>
              )}

              <DealAttachmentsCard
                canUpload={deal.actions.canUploadAttachment}
                deal={deal}
                deletingAttachmentId={state.deletingAttachmentId}
                onDeleteAttachment={actions.deleteAttachment}
                onDownloadAttachment={actions.downloadAttachment}
                onOpenUpload={() => setIsUploadDialogOpen(true)}
              />

              <ExecutionContextGrid
                canWrite={canWrite}
                deal={deal}
                onOpenSwapRoute={() => setIsSwapRouteOpen(true)}
              />

              <ExecutionReconciliationSection
                canRunReconciliation={deal.actions.canRunReconciliation}
                dealId={deal.summary.id}
                exceptions={deal.relatedResources.reconciliationExceptions}
                ignoringExceptionId={state.ignoringExceptionId}
                isRunningReconciliation={state.isRunningReconciliation}
                onIgnoreReconciliationException={
                  actions.ignoreReconciliationException
                }
                onRunReconciliation={actions.runReconciliation}
                summary={deal.reconciliationSummary}
              />
            </div>

            <div className="space-y-6 self-start lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
              <ExecutionTimelinePane
                filter={timelineFilter}
                legs={deal.executionPlan}
                onFilterChange={setTimelineFilter}
                onSelectLeg={setSelectedLegIdx}
                selectedLegIdx={selectedLegIdx}
              />

              <DealTimelineCard
                executionPlan={deal.executionPlan}
                timeline={deal.timeline}
                maxItems={8}
              />

              <section className="bg-card rounded-lg border">
                <header className="flex items-center gap-2 border-b p-3">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  <div className="text-sm font-semibold">Контекст сделки</div>
                </header>
                <div className="p-3">
                  <DealContextContent deal={deal} />
                </div>
              </section>
            </div>
          </div>
        </div>
      </FinanceDealWorkspaceLayout>

      <UploadAttachmentDialog
        dealId={deal.summary.id}
        open={isUploadDialogOpen}
        onOpenChange={setIsUploadDialogOpen}
        onSuccess={() => refreshPage(router)}
      />

      <RouteSwapDialog
        dealId={deal.summary.id}
        open={isSwapRouteOpen}
        onOpenChange={setIsSwapRouteOpen}
        onSuccess={() => router.refresh()}
      />
    </>
  );
}
