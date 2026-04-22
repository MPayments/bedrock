"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Button } from "@bedrock/sdk-ui/components/button";

import type { FinanceDealWorkbench } from "@/features/treasury/deals/lib/queries";

import { ExecutionContextGrid } from "../execution/context-grid";
import { ExecutionLegEditor } from "../execution/leg-editor";
import { ExecutionReconciliationSection } from "../execution/reconciliation-section";
import { InstructionArtifactDrawer } from "../instruction-artifact-drawer";
import { LegAmendmentDrawer } from "../leg-amendment-drawer";
import { RouteSwapDialog } from "../route-swap-dialog";

export type ExecutionTabProps = {
  deal: FinanceDealWorkbench;
  documentsTabHref: string;
  executionTabReturnTo: string;
  ignoringExceptionId: string | null;
  isClosingDeal: boolean;
  isCreatingLegOperationId: string | null;
  isRequestingExecution: boolean;
  isRunningReconciliation: boolean;
  isResolvingLegId: string | null;
  onCloseDeal: () => void;
  onCreateLegOperation: (legId: string) => void;
  onIgnoreReconciliationException: (exceptionId: string) => void;
  onRequestExecution: () => void;
  onRunReconciliation: () => void;
  onResolveLeg: (legId: string) => void;
  selectedLegIdx: number | null;
};

export function ExecutionTab({
  deal,
  documentsTabHref,
  executionTabReturnTo,
  ignoringExceptionId,
  isClosingDeal,
  isCreatingLegOperationId,
  isRequestingExecution,
  isRunningReconciliation,
  isResolvingLegId,
  onCloseDeal,
  onCreateLegOperation,
  onIgnoreReconciliationException,
  onRequestExecution,
  onRunReconciliation,
  onResolveLeg,
  selectedLegIdx,
}: ExecutionTabProps) {
  const router = useRouter();
  const [isSwapRouteOpen, setIsSwapRouteOpen] = useState(false);
  const [amendLegIdx, setAmendLegIdx] = useState<number | null>(null);
  const [artifactInstructionId, setArtifactInstructionId] = useState<
    string | null
  >(null);
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
  const hasActions =
    deal.actions.canRequestExecution || deal.actions.canCloseDeal;

  return (
    <div className="space-y-6">
      {hasActions ? (
        <div className="flex flex-wrap items-center gap-2">
          {deal.actions.canRequestExecution ? (
            <Button
              data-testid="finance-deal-request-execution"
              size="sm"
              disabled={isRequestingExecution}
              onClick={onRequestExecution}
            >
              {isRequestingExecution
                ? "Материализуем..."
                : "Запросить исполнение"}
            </Button>
          ) : null}
          {deal.actions.canCloseDeal ? (
            <Button
              data-testid="finance-deal-close"
              size="sm"
              variant="secondary"
              disabled={isClosingDeal}
              onClick={onCloseDeal}
            >
              {isClosingDeal ? "Закрываем..." : "Закрыть сделку"}
            </Button>
          ) : null}
        </div>
      ) : null}

      {selectedLeg ? (
        <ExecutionLegEditor
          canWrite={canWrite}
          deal={deal}
          documentsTabHref={documentsTabHref}
          executionTabReturnTo={executionTabReturnTo}
          isCreatingLegOperationId={isCreatingLegOperationId}
          isRequestingExecution={isRequestingExecution}
          isResolvingLegId={isResolvingLegId}
          leg={selectedLeg}
          onCreateLegOperation={onCreateLegOperation}
          onOpenAmendLeg={setAmendLegIdx}
          onOpenArtifact={setArtifactInstructionId}
          onRequestExecution={onRequestExecution}
          onResolveLeg={onResolveLeg}
          operationsById={operationsById}
        />
      ) : (
        <div className="bg-card text-muted-foreground rounded-lg border p-6 text-sm">
          Шагов исполнения ещё нет. Сначала зафиксируйте коммерческие условия
          и выберите маршрут.
        </div>
      )}

      <ExecutionContextGrid
        canWrite={canWrite}
        deal={deal}
        onOpenSwapRoute={() => setIsSwapRouteOpen(true)}
      />

      <ExecutionReconciliationSection
        canRunReconciliation={deal.actions.canRunReconciliation}
        dealId={deal.summary.id}
        exceptions={deal.relatedResources.reconciliationExceptions}
        executionTabReturnTo={executionTabReturnTo}
        ignoringExceptionId={ignoringExceptionId}
        isRunningReconciliation={isRunningReconciliation}
        onIgnoreReconciliationException={onIgnoreReconciliationException}
        onRunReconciliation={onRunReconciliation}
        summary={deal.reconciliationSummary}
      />

      <RouteSwapDialog
        dealId={deal.summary.id}
        open={isSwapRouteOpen}
        onOpenChange={setIsSwapRouteOpen}
        onSuccess={() => router.refresh()}
      />
      {amendLegIdx !== null ? (
        <LegAmendmentDrawer
          dealId={deal.summary.id}
          legIdx={amendLegIdx}
          open
          onOpenChange={(open) => {
            if (!open) setAmendLegIdx(null);
          }}
          onSuccess={() => router.refresh()}
        />
      ) : null}
      {artifactInstructionId !== null ? (
        <InstructionArtifactDrawer
          instructionId={artifactInstructionId}
          open
          onOpenChange={(open) => {
            if (!open) setArtifactInstructionId(null);
          }}
          onSuccess={() => router.refresh()}
        />
      ) : null}
    </div>
  );
}
