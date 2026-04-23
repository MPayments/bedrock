"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Info } from "lucide-react";

import { Button } from "@bedrock/sdk-ui/components/button";

import { getFinanceDealDisplayTitle } from "@/features/treasury/deals/labels";
import type { FinanceDealWorkbench } from "@/features/treasury/deals/lib/queries";

import { DealAttachmentsCard } from "./deal-attachments-card";
import { DealTimelineCard } from "./deal-timeline-card";
import { ExecutionContextGrid } from "./execution/context-grid";
import { ExecutionLegEditor } from "./execution/leg-editor";
import { ExecutionReconciliationSection } from "./execution/reconciliation-section";
import { ExecutionTimelinePane } from "./execution/timeline-pane";
import { InstructionArtifactDrawer } from "./instruction-artifact-drawer";
import { RouteSwapDialog } from "./route-swap-dialog";
import { UploadAttachmentDialog } from "./upload-attachment-dialog";
import { DealContextContent } from "./workbench/deal-context-content";
import { DealExecutionHeaderSummary } from "./workbench/deal-execution-header-summary";
import { useWorkbenchActions } from "./workbench/use-workbench-actions";
import { refreshPage } from "./workbench/utils";
import { FinanceDealWorkspaceLayout } from "./workspace-layout";

export type FinanceDealWorkbenchProps = {
  deal: FinanceDealWorkbench;
};

export function FinanceDealWorkbench({ deal }: FinanceDealWorkbenchProps) {
  const router = useRouter();
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isSwapRouteOpen, setIsSwapRouteOpen] = useState(false);
  const [artifactInstructionId, setArtifactInstructionId] = useState<
    string | null
  >(null);
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

  const operationsById = useMemo(
    () =>
      new Map(
        deal.relatedResources.operations.map(
          (operation) => [operation.id, operation] as const,
        ),
      ),
    [deal.relatedResources.operations],
  );

  const selectedLeg = useMemo(
    () =>
      deal.executionPlan.find((leg) => leg.idx === selectedLegIdx) ??
      deal.executionPlan[0] ??
      null,
    [deal.executionPlan, selectedLegIdx],
  );

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

              {selectedLeg ? (
                <ExecutionLegEditor
                  canWrite={canWrite}
                  deal={deal}
                  isCreatingLegOperationId={state.isCreatingLegOperationId}
                  isRequestingExecution={state.isRequestingExecution}
                  isResolvingLegId={state.isResolvingLegId}
                  leg={selectedLeg}
                  onAmended={() => router.refresh()}
                  onCreateLegOperation={actions.createLegOperation}
                  onOpenArtifact={setArtifactInstructionId}
                  onRequestExecution={actions.requestExecution}
                  onResolveLeg={actions.resolveLeg}
                  operationsById={operationsById}
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
      {artifactInstructionId !== null ? (
        <InstructionArtifactDrawer
          dealId={deal.summary.id}
          instructionId={artifactInstructionId}
          open
          onOpenChange={(open) => {
            if (!open) setArtifactInstructionId(null);
          }}
          onSuccess={() => router.refresh()}
        />
      ) : null}
    </>
  );
}
