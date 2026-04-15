import {
  AlertCircle,
} from "lucide-react";

import {
  Alert,
  AlertDescription,
} from "@bedrock/sdk-ui/components/alert";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";

import {
  formatDealNextAction,
  formatDealWorkflowMessage,
} from "./constants";
import { DealInfoCard } from "./deal-info-card";
import { CounterpartyCard } from "./counterparty-card";
import { OrganizationCard } from "./organization-card";
import { OrganizationRequisiteCard } from "./organization-requisite-card";
import type {
  ApiCrmDealWorkbenchProjection,
  ApiCurrency,
} from "./types";

type DealOverviewTabProps = {
  commentValue: string;
  isEditingComment: boolean;
  isSavingComment: boolean;
  onCommentChange: (value: string) => void;
  onCancelEdit: () => void;
  onEditComment: () => void;
  onSaveComment: () => void;
  currency: ApiCurrency | null;
  workbench: ApiCrmDealWorkbenchProjection;
};

const REQUIRED_SECTION_IDS_BY_TYPE: Record<
  ApiCrmDealWorkbenchProjection["summary"]["type"],
  ApiCrmDealWorkbenchProjection["sectionCompleteness"][number]["sectionId"][]
> = {
  payment: ["common", "moneyRequest", "externalBeneficiary"],
  currency_exchange: ["common", "moneyRequest", "settlementDestination"],
  currency_transit: [
    "common",
    "moneyRequest",
    "incomingReceipt",
    "externalBeneficiary",
  ],
  exporter_settlement: [
    "common",
    "moneyRequest",
    "incomingReceipt",
    "settlementDestination",
  ],
};

function collectTopBlockers(
  workbench: ApiCrmDealWorkbenchProjection,
) {
  const messages = new Set<string>();
  const requiredSections = new Set(
    REQUIRED_SECTION_IDS_BY_TYPE[workbench.summary.type],
  );

  workbench.transitionReadiness.forEach((item) => {
    if (!item.allowed) {
      item.blockers.forEach((blocker) => messages.add(blocker.message));
    }
  });
  workbench.sectionCompleteness.forEach((section) => {
    if (!section.complete && requiredSections.has(section.sectionId)) {
      section.blockingReasons.forEach((reason) => messages.add(reason));
    }
  });
  workbench.evidenceRequirements.forEach((requirement) => {
    if (requirement.state === "missing") {
      requirement.blockingReasons.forEach((reason) => messages.add(reason));
    }
  });
  workbench.documentRequirements.forEach((requirement) => {
    if (
      requirement.state === "missing" ||
      requirement.state === "in_progress"
    ) {
      requirement.blockingReasons.forEach((reason) => messages.add(reason));
    }
  });

  return Array.from(messages).slice(0, 4);
}

export function DealOverviewTab({
  commentValue,
  isEditingComment,
  isSavingComment,
  onCommentChange,
  onCancelEdit,
  onEditComment,
  onSaveComment,
  currency,
  workbench,
}: DealOverviewTabProps) {
  const blockers = collectTopBlockers(workbench);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
              Что нужно сделать сейчас
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted/40 px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Следующий шаг
              </div>
              <div className="mt-1 text-base font-medium">
                {formatDealNextAction(workbench.nextAction)}
              </div>
            </div>

            {blockers.length > 0 ? (
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">
                  Что блокирует движение сделки
                </div>
                <div className="space-y-2">
                  {blockers.map((blocker) => (
                    <Alert key={blocker} variant="warning" className="py-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        {formatDealWorkflowMessage(blocker)}
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                Критичных блокировок сейчас нет.
              </div>
            )}
          </CardContent>
        </Card>

        <DealInfoCard
          commentValue={commentValue}
          currency={currency}
          isEditingComment={isEditingComment}
          isSavingComment={isSavingComment}
          onCancelEdit={onCancelEdit}
          onCommentChange={onCommentChange}
          onEditComment={onEditComment}
          onSaveComment={onSaveComment}
          workbench={workbench}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <CounterpartyCard counterparty={workbench.context.applicant} />
        <OrganizationCard organization={workbench.context.internalEntity} />
        <OrganizationRequisiteCard
          provider={workbench.context.internalEntityRequisiteProvider}
          requisite={workbench.context.internalEntityRequisite}
        />
      </div>
    </div>
  );
}
