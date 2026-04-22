"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";

import {
  EntityWorkspaceTabs,
  type EntityWorkspaceTab,
} from "@/components/entities/workspace-layout";
import {
  getFinanceDealDisplayTitle,
} from "@/features/treasury/deals/labels";
import type { FinanceDealWorkbench } from "@/features/treasury/deals/lib/queries";

import { DealTimelineCard } from "./deal-timeline-card";
import { ExecutionSummaryRail } from "./execution-summary-rail";
import { ExecutionTimelinePane } from "./execution/timeline-pane";
import { QuoteRequestDialog } from "./quote-request-dialog";
import { UploadAttachmentDialog } from "./upload-attachment-dialog";
import { DealContextContent } from "./workbench/deal-context-content";
import { DealExecutionHeaderSummary } from "./workbench/deal-execution-header-summary";
import { DocumentsTab } from "./workbench/documents-tab";
import { ExecutionTab } from "./workbench/execution-tab";
import { OverviewTab } from "./workbench/overview-tab";
import { PricingTab } from "./workbench/pricing-tab";
import { useWorkbenchActions } from "./workbench/use-workbench-actions";
import {
  DEAL_PAGE_TAB_META,
  DEFAULT_DEAL_PAGE_TAB,
  getCalculationDisabledReason,
  getDealTabHref,
  getQuoteCreationDisabledReason,
  isDealPageTab,
  refreshPage,
} from "./workbench/utils";
import { FinanceDealWorkspaceLayout } from "./workspace-layout";

export type FinanceDealWorkbenchProps = {
  deal: FinanceDealWorkbench;
};

export function FinanceDealWorkbench({ deal }: FinanceDealWorkbenchProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isQuoteDialogOpen, setIsQuoteDialogOpen] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [selectedLegIdx, setSelectedLegIdx] = useState<number | null>(
    () => deal.executionPlan[0]?.idx ?? null,
  );
  const [timelineFilter, setTimelineFilter] = useState<"all" | "pending">(
    "all",
  );

  const { actions, state } = useWorkbenchActions(deal);

  const tabParam = searchParams.get("tab");
  const activeTab = isDealPageTab(tabParam) ? tabParam : DEFAULT_DEAL_PAGE_TAB;
  const quoteCreationDisabledReason = getQuoteCreationDisabledReason(deal);
  const calculationDisabledReason = getCalculationDisabledReason(deal);
  const workspaceTabs: EntityWorkspaceTab[] = DEAL_PAGE_TAB_META.map((tab) => ({
    id: tab.value,
    label: tab.label,
    icon: tab.icon,
    href: getDealTabHref(pathname, searchParams, tab.value),
  }));
  const title = getFinanceDealDisplayTitle({
    applicantDisplayName: deal.summary.applicantDisplayName,
    id: deal.summary.id,
    type: deal.summary.type,
  });
  const documentsTabReturnTo = getDealTabHref(
    pathname,
    searchParams,
    "documents",
  );
  const executionTabReturnTo = getDealTabHref(
    pathname,
    searchParams,
    "execution",
  );

  return (
    <>
      <FinanceDealWorkspaceLayout title={title}>
        <div className="space-y-6">
          <DealExecutionHeaderSummary deal={deal} />
          <EntityWorkspaceTabs value={activeTab} tabs={workspaceTabs} />

          <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
            <div className="space-y-6">
              {activeTab === "overview" ? <OverviewTab deal={deal} /> : null}
              {activeTab === "pricing" ? (
                <PricingTab
                  calculationDisabledReason={calculationDisabledReason}
                  deal={deal}
                  isAcceptingQuoteId={state.isAcceptingQuoteId}
                  isCreatingCalculation={state.isCreatingCalculation}
                  onAcceptQuote={actions.acceptQuote}
                  onCreateCalculation={actions.createCalculation}
                  onOpenQuoteDialog={() => setIsQuoteDialogOpen(true)}
                  quoteCreationDisabledReason={quoteCreationDisabledReason}
                />
              ) : null}
              {activeTab === "documents" ? (
                <DocumentsTab
                  deal={deal}
                  deletingAttachmentId={state.deletingAttachmentId}
                  documentsTabReturnTo={documentsTabReturnTo}
                  onAttachmentDelete={actions.deleteAttachment}
                  onAttachmentDownload={actions.downloadAttachment}
                  onAttachmentUpload={() => setIsUploadDialogOpen(true)}
                />
              ) : null}
              {activeTab === "execution" ? (
                <ExecutionTab
                  deal={deal}
                  documentsTabHref={documentsTabReturnTo}
                  executionTabReturnTo={executionTabReturnTo}
                  ignoringExceptionId={state.ignoringExceptionId}
                  isClosingDeal={state.isClosingDeal}
                  isCreatingLegOperationId={state.isCreatingLegOperationId}
                  isRequestingExecution={state.isRequestingExecution}
                  isRunningReconciliation={state.isRunningReconciliation}
                  isResolvingLegId={state.isResolvingLegId}
                  onCloseDeal={actions.closeDeal}
                  onCreateLegOperation={actions.createLegOperation}
                  onIgnoreReconciliationException={
                    actions.ignoreReconciliationException
                  }
                  onRequestExecution={actions.requestExecution}
                  onRunReconciliation={actions.runReconciliation}
                  onResolveLeg={actions.resolveLeg}
                  selectedLegIdx={selectedLegIdx}
                />
              ) : null}
            </div>

            <div className="space-y-6">
              {activeTab === "execution" ? (
                <ExecutionTimelinePane
                  filter={timelineFilter}
                  legs={deal.executionPlan}
                  onFilterChange={setTimelineFilter}
                  onSelectLeg={setSelectedLegIdx}
                  selectedLegIdx={selectedLegIdx}
                />
              ) : (
                <ExecutionSummaryRail deal={deal} />
              )}

              <DealTimelineCard
                executionPlan={deal.executionPlan}
                timeline={deal.timeline}
                maxItems={8}
              />

              {activeTab !== "overview" ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Контекст сделки</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <DealContextContent deal={deal} />
                  </CardContent>
                </Card>
              ) : null}
            </div>
          </div>
        </div>
      </FinanceDealWorkspaceLayout>

      <QuoteRequestDialog
        dealId={deal.summary.id}
        disabledReason={quoteCreationDisabledReason}
        open={isQuoteDialogOpen}
        quoteAmount={deal.pricing.quoteAmount}
        quoteAmountSide={deal.pricing.quoteAmountSide}
        sourceCurrencyId={deal.pricing.sourceCurrencyId}
        targetCurrencyId={deal.pricing.targetCurrencyId}
        onOpenChange={setIsQuoteDialogOpen}
        onSuccess={() => refreshPage(router)}
      />

      <UploadAttachmentDialog
        dealId={deal.summary.id}
        open={isUploadDialogOpen}
        onOpenChange={setIsUploadDialogOpen}
        onSuccess={() => refreshPage(router)}
      />
    </>
  );
}
