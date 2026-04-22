"use client";

import Link from "next/link";
import { AlertCircle, ArrowRight, PlayCircle } from "lucide-react";

import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Button } from "@bedrock/sdk-ui/components/button";

import {
  buildDocumentCreateHref,
  buildDocumentDetailsHref,
} from "@/features/documents/lib/routes";
import {
  getDealLegKindLabel,
  getDealLegStateLabel,
} from "@/features/treasury/deals/labels";
import { collectFinanceDealTopBlockers } from "@/features/treasury/deals/lib/execution-summary";

import { getLegKindIcon } from "./leg-icon";
import { OperationDocumentTimeline } from "./operation-document-timeline";
import { resolveOperationNextAction } from "./operation-next-action";
import type { FinanceDealWorkbench } from "@/features/treasury/deals/lib/queries";
import {
  getTreasuryOperationInstructionStatusLabel,
  getTreasuryOperationInstructionStatusVariant,
  getTreasuryOperationKindLabel,
  getTreasuryOperationKindVariant,
  getTreasuryOperationProjectedStateLabel,
  getTreasuryOperationProjectedStateVariant,
} from "@/features/treasury/operations/lib/labels";

type Leg = FinanceDealWorkbench["executionPlan"][number];
type Operation = FinanceDealWorkbench["relatedResources"]["operations"][number];

export interface ExecutionLegEditorProps {
  canWrite: boolean;
  deal: FinanceDealWorkbench;
  documentsTabHref: string;
  executionTabReturnTo: string;
  isCreatingLegOperationId: string | null;
  isRequestingExecution: boolean;
  isResolvingLegId: string | null;
  leg: Leg;
  onCreateLegOperation: (legId: string) => void;
  onOpenAmendLeg: (legIdx: number) => void;
  onOpenArtifact: (instructionId: string) => void;
  onRequestExecution: () => void;
  onResolveLeg: (legId: string) => void;
  operationsById: Map<string, Operation>;
}

function NoOperationsHint({
  deal,
  documentsTabHref,
  isRequestingExecution,
  onRequestExecution,
}: {
  deal: FinanceDealWorkbench;
  documentsTabHref: string;
  isRequestingExecution: boolean;
  onRequestExecution: () => void;
}) {
  if (deal.actions.canRequestExecution) {
    return (
      <div className="flex flex-col gap-3 rounded-md border border-emerald-300/60 bg-emerald-50 p-4 text-sm dark:border-emerald-900/50 dark:bg-emerald-950/20">
        <div className="flex items-start gap-2">
          <PlayCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <div className="space-y-1">
            <div className="font-medium text-emerald-950 dark:text-emerald-100">
              Можно запросить исполнение
            </div>
            <div className="text-emerald-900/80 dark:text-emerald-100/80">
              По команде бэкенд создаст операции под каждый шаг сделки и
              привяжет платёжные инструкции. После этого на каждом шаге
              появятся действия «Подготовить», «Подтвердить», «Отметить
              возврат».
            </div>
          </div>
        </div>
        <div>
          <Button
            data-testid="finance-deal-request-execution-inline"
            size="sm"
            disabled={isRequestingExecution}
            onClick={onRequestExecution}
          >
            {isRequestingExecution
              ? "Материализуем..."
              : "Запросить исполнение"}
          </Button>
        </div>
      </div>
    );
  }

  const blockers = collectFinanceDealTopBlockers(deal, 3);

  return (
    <div className="flex flex-col gap-3 rounded-md border border-amber-300/60 bg-amber-50 p-4 text-sm dark:border-amber-900/50 dark:bg-amber-950/20">
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div className="space-y-1">
          <div className="font-medium text-amber-950 dark:text-amber-100">
            Операции появятся после устранения блокировок
          </div>
          <div className="text-amber-900/80 dark:text-amber-100/80">
            Сделка ещё не готова к материализации казначейских операций.
            Разберитесь с требованиями ниже, и в этом блоке станет доступна
            команда «Запросить исполнение».
          </div>
        </div>
      </div>
      {blockers.length > 0 ? (
        <ul className="list-disc space-y-0.5 pl-10 text-amber-900/90 dark:text-amber-100/90">
          {blockers.map((blocker) => (
            <li key={blocker}>{blocker}</li>
          ))}
        </ul>
      ) : null}
      <div>
        <Button
          size="sm"
          variant="outline"
          nativeButton={false}
          render={<Link href={documentsTabHref} />}
        >
          Перейти к документам
          <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function ExecutionLegEditor({
  canWrite,
  deal,
  documentsTabHref,
  executionTabReturnTo,
  isCreatingLegOperationId,
  isRequestingExecution,
  isResolvingLegId,
  leg,
  onCreateLegOperation,
  onOpenAmendLeg,
  onOpenArtifact,
  onRequestExecution,
  onResolveLeg,
  operationsById,
}: ExecutionLegEditorProps) {
  const linkedOperations = leg.operationRefs
    .map((ref) => operationsById.get(ref.operationId) ?? null)
    .filter((operation): operation is Operation => operation !== null);

  const exchangeDocumentAction = leg.actions.exchangeDocument;
  const canResolveLegBlocker =
    deal.actions.canResolveExecutionBlocker &&
    leg.state === "blocked" &&
    Boolean(leg.id);
  const canCreateLegOperation =
    leg.actions.canCreateLegOperation && Boolean(leg.id);
  const canAmendLeg =
    canWrite && leg.state !== "in_progress" && leg.state !== "done";

  const exchangeDocumentCreateHref = exchangeDocumentAction?.createAllowed
    ? buildDocumentCreateHref(exchangeDocumentAction.docType, {
        dealId: deal.summary.id,
        returnTo: executionTabReturnTo,
      })
    : null;
  const exchangeDocumentOpenHref =
    exchangeDocumentAction?.openAllowed &&
    exchangeDocumentAction.activeDocumentId
      ? buildDocumentDetailsHref(
          exchangeDocumentAction.docType,
          exchangeDocumentAction.activeDocumentId,
        )
      : null;
  const exchangeDocumentActionHref =
    exchangeDocumentCreateHref ?? exchangeDocumentOpenHref;
  const KindIcon = getLegKindIcon(leg.kind);

  return (
    <section
      className="bg-card rounded-lg border"
      data-testid={`finance-deal-leg-editor-${leg.idx}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b p-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div
              className="bg-muted text-muted-foreground flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
              title={`Шаг ${leg.idx}`}
            >
              <KindIcon className="h-3.5 w-3.5" />
            </div>
            <span className="font-semibold">
              {getDealLegKindLabel(leg.kind)}
            </span>
            <Badge
              data-testid={`finance-deal-leg-editor-state-${leg.idx}`}
              variant="outline"
            >
              {getDealLegStateLabel(leg.state)}
            </Badge>
          </div>
          {leg.kind === "convert" && deal.pricing.fundingMessage ? (
            <div className="text-muted-foreground text-sm">
              {deal.pricing.fundingMessage}
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canAmendLeg ? (
            <Button
              data-testid={`finance-deal-leg-amend-${leg.idx}`}
              size="sm"
              variant="outline"
              onClick={() => onOpenAmendLeg(leg.idx)}
            >
              Править шаг
            </Button>
          ) : null}
          {canResolveLegBlocker && leg.id ? (
            <Button
              size="sm"
              variant="outline"
              disabled={isResolvingLegId === leg.id}
              onClick={() => onResolveLeg(leg.id!)}
            >
              {isResolvingLegId === leg.id
                ? "Устраняем..."
                : "Устранить блокер"}
            </Button>
          ) : null}
          {canCreateLegOperation && leg.id ? (
            <Button
              size="sm"
              variant="outline"
              disabled={isCreatingLegOperationId === leg.id}
              onClick={() => onCreateLegOperation(leg.id!)}
            >
              {isCreatingLegOperationId === leg.id
                ? "Создаём..."
                : "Создать операцию"}
            </Button>
          ) : null}
          {exchangeDocumentActionHref ? (
            <Button
              data-testid={`finance-deal-exchange-document-action-${leg.idx}`}
              size="sm"
              variant="outline"
              nativeButton={false}
              render={<Link href={exchangeDocumentActionHref} />}
            >
              {exchangeDocumentCreateHref ? "Создать обмен" : "Открыть обмен"}
            </Button>
          ) : null}
        </div>
      </header>

      <div className="p-4">
        {linkedOperations.length === 0 ? (
          leg.operationRefs.length > 0 ? (
            <div className="border-muted-foreground/40 text-muted-foreground rounded-md border border-dashed bg-muted/30 p-4 text-sm">
              Операция привязана к шагу, но карточка операции сейчас
              недоступна.
            </div>
          ) : (
            <NoOperationsHint
              deal={deal}
              documentsTabHref={documentsTabHref}
              isRequestingExecution={isRequestingExecution}
              onRequestExecution={onRequestExecution}
            />
          )
        ) : (
          <div className="flex flex-col gap-3">
            {linkedOperations.map((operation) => {
              const nextAction = resolveOperationNextAction({
                kind: operation.kind,
                projectedState: operation.projectedState,
              });
              const nextActionHref = nextAction
                ? buildDocumentCreateHref(nextAction.docType, {
                    dealId: deal.summary.id,
                    returnTo: executionTabReturnTo,
                  })
                : null;

              return (
                <div
                  key={operation.id}
                  className="bg-muted/20 rounded-md border p-3"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant={getTreasuryOperationKindVariant(
                            operation.kind,
                          )}
                        >
                          {getTreasuryOperationKindLabel(operation.kind)}
                        </Badge>
                        <Badge
                          data-testid={`finance-deal-operation-projected-state-${operation.id}`}
                          variant={getTreasuryOperationProjectedStateVariant(
                            operation.projectedState,
                          )}
                        >
                          {getTreasuryOperationProjectedStateLabel(
                            operation.projectedState,
                          )}
                        </Badge>
                        <Badge
                          variant={getTreasuryOperationInstructionStatusVariant(
                            operation.instructionStatus,
                          )}
                        >
                          {getTreasuryOperationInstructionStatusLabel(
                            operation.instructionStatus,
                          )}
                        </Badge>
                      </div>
                      <div className="text-muted-foreground text-xs font-mono">
                        {operation.sourceRef}
                      </div>
                      <OperationDocumentTimeline
                        formalDocuments={deal.relatedResources.formalDocuments}
                        operationKind={operation.kind}
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {nextAction && nextActionHref ? (
                        <Button
                          data-testid={`finance-deal-operation-next-action-${operation.id}`}
                          size="sm"
                          nativeButton={false}
                          render={<Link href={nextActionHref} />}
                          title={nextAction.description}
                        >
                          {nextAction.buttonLabel}
                        </Button>
                      ) : null}
                      {operation.latestInstruction ? (
                        <Button
                          data-testid={`finance-deal-instruction-artifact-${operation.id}`}
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            onOpenArtifact(operation.latestInstruction!.id)
                          }
                        >
                          Подтверждение
                        </Button>
                      ) : null}
                      <Button
                        data-testid={`finance-deal-operation-open-${operation.id}`}
                        size="sm"
                        variant="ghost"
                        nativeButton={false}
                        render={<Link href={operation.operationHref} />}
                      >
                        Админ-вид
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
