import Link from "next/link";
import { AlertCircle, ArrowRightLeft, ShieldCheck } from "lucide-react";

import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@bedrock/sdk-ui/components/table";
import { Alert, AlertDescription, AlertTitle } from "@bedrock/sdk-ui/components/alert";

import { FinanceDealWorkspaceLayout } from "@/features/treasury/deals/components/workspace-layout";
import {
  getFinanceDealDisplayTitle,
  getFinanceDealStatusLabel,
  getFinanceDealTypeLabel,
} from "@/features/treasury/deals/labels";
import type { FinanceDealReconciliationWorkspace } from "@/features/treasury/deals/lib/reconciliation-workspace";
import type { FinanceProfitabilityAmount } from "@/features/treasury/deals/lib/queries";
import { formatDate, formatMinorAmountWithCurrency } from "@/lib/format";

function getReconciliationStateLabel(value: string) {
  switch (value) {
    case "blocked":
      return "Есть исключения";
    case "clear":
      return "Сверка завершена";
    case "not_started":
      return "Сверка не требуется";
    case "pending":
      return "Сверка ожидается";
    default:
      return value;
  }
}

function getReconciliationStateVariant(value: string) {
  switch (value) {
    case "blocked":
      return "destructive" as const;
    case "clear":
      return "default" as const;
    case "pending":
      return "secondary" as const;
    case "not_started":
      return "outline" as const;
    default:
      return "outline" as const;
  }
}

function getFactSourceKindLabel(value: string) {
  switch (value) {
    case "manual":
      return "Вручную";
    case "provider":
      return "Провайдер";
    case "reconciliation":
      return "Сверка";
    case "system":
      return "Система";
    default:
      return value;
  }
}

function formatAmounts(items: FinanceProfitabilityAmount[] | null | undefined) {
  if (!items || items.length === 0) {
    return "0";
  }

  return items
    .map((item) => formatMinorAmountWithCurrency(item.amountMinor, item.currencyCode))
    .join(" · ");
}

function getReconciliationActualCount(
  data: FinanceDealReconciliationWorkspace,
) {
  return (
    data.fills.filter((fill) => fill.sourceKind === "reconciliation").length +
    data.fees.filter((fee) => fee.sourceKind === "reconciliation").length +
    data.cashMovements.filter((movement) => movement.sourceKind === "reconciliation")
      .length
  );
}

function CloseBlockersPanel({ data }: { data: FinanceDealReconciliationWorkspace }) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-muted-foreground" />
          Close blockers
        </CardTitle>
        <CardDescription>
          Блокеры закрытия после сверки и variance review.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {data.deal.closeReadiness.criteria.map((criterion) => (
            <div
              key={criterion.code}
              className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
            >
              <span>{criterion.label}</span>
              <Badge variant={criterion.satisfied ? "default" : "outline"}>
                {criterion.satisfied ? "OK" : "Ожидает"}
              </Badge>
            </div>
          ))}
        </div>

        {data.deal.closeReadiness.blockers.length > 0 ? (
          <div className="rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground">
            {data.deal.closeReadiness.blockers.join(" ")}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            Явных блокеров закрытия сейчас нет.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ReconciliationWorkspace({
  data,
}: {
  data: FinanceDealReconciliationWorkspace;
}) {
  const title = getFinanceDealDisplayTitle({
    applicantDisplayName: data.deal.summary.applicantDisplayName,
    id: data.deal.summary.id,
    type: data.deal.summary.type,
  });
  const reconciliationFills = data.fills.filter(
    (fill) => fill.sourceKind === "reconciliation",
  );
  const reconciliationFees = data.fees.filter(
    (fee) => fee.sourceKind === "reconciliation",
  );
  const reconciliationCashMovements = data.cashMovements.filter(
    (movement) => movement.sourceKind === "reconciliation",
  );

  return (
    <FinanceDealWorkspaceLayout
      backHref={`/treasury/deals/${data.deal.summary.id}`}
      title={title}
      actions={
        <>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={`/treasury/deals/${data.deal.summary.id}/execution`} />}
          >
            <ArrowRightLeft className="mr-2 h-4 w-4" />
            Исполнение
          </Button>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={`/treasury/deals/${data.deal.summary.id}/calculation`} />}
          >
            <ShieldCheck className="mr-2 h-4 w-4" />
            Расчет
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <Card className="border-muted-foreground/10 bg-gradient-to-br from-background via-background to-muted/30">
          <CardContent className="space-y-5 pt-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">
                {getFinanceDealTypeLabel(data.deal.summary.type)}
              </Badge>
              <Badge variant="outline">
                {getFinanceDealStatusLabel(data.deal.summary.status)}
              </Badge>
              <Badge
                variant={getReconciliationStateVariant(data.deal.reconciliationSummary.state)}
              >
                {getReconciliationStateLabel(data.deal.reconciliationSummary.state)}
              </Badge>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border bg-background/70 px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Required ops
                </div>
                <div className="mt-1 text-lg font-semibold">
                  {data.deal.reconciliationSummary.requiredOperationCount}
                </div>
              </div>
              <div className="rounded-lg border bg-background/70 px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Reconciled ops
                </div>
                <div className="mt-1 text-lg font-semibold">
                  {data.deal.reconciliationSummary.reconciledOperationCount}
                </div>
              </div>
              <div className="rounded-lg border bg-background/70 px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Open exceptions
                </div>
                <div className="mt-1 text-lg font-semibold">
                  {data.deal.reconciliationSummary.openExceptionCount}
                </div>
              </div>
              <div className="rounded-lg border bg-background/70 px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Normalized actuals
                </div>
                <div className="mt-1 text-lg font-semibold">
                  {getReconciliationActualCount(data)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-muted-foreground" />
              Matched records
            </CardTitle>
            <CardDescription>
              Нормализованные reconciliation actuals, подтвержденные внешними выписками.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {getReconciliationActualCount(data) === 0 ? (
              <div className="text-sm text-muted-foreground">
                По сделке пока нет execution actuals, пришедших именно из reconciliation.
              </div>
            ) : (
              <>
                {reconciliationFills.length > 0 ? (
                  <div className="space-y-3">
                    <div className="text-sm font-medium">Execution fills</div>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Executed</TableHead>
                            <TableHead>Operation</TableHead>
                            <TableHead>Source</TableHead>
                            <TableHead>Sold</TableHead>
                            <TableHead>Bought</TableHead>
                            <TableHead>External ref</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {reconciliationFills.map((fill) => (
                            <TableRow key={fill.id}>
                              <TableCell>{formatDate(fill.executedAt)}</TableCell>
                              <TableCell>{fill.operationId.slice(0, 8)}</TableCell>
                              <TableCell>{getFactSourceKindLabel(fill.sourceKind)}</TableCell>
                              <TableCell>{fill.soldAmountMinor ?? "—"}</TableCell>
                              <TableCell>{fill.boughtAmountMinor ?? "—"}</TableCell>
                              <TableCell>
                                {fill.externalRecordId ?? fill.providerRef ?? "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : null}

                {reconciliationFees.length > 0 ? (
                  <div className="space-y-3">
                    <div className="text-sm font-medium">Execution fees</div>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Charged</TableHead>
                            <TableHead>Operation</TableHead>
                            <TableHead>Family</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>External ref</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {reconciliationFees.map((fee) => (
                            <TableRow key={fee.id}>
                              <TableCell>{formatDate(fee.chargedAt)}</TableCell>
                              <TableCell>{fee.operationId.slice(0, 8)}</TableCell>
                              <TableCell>{fee.feeFamily}</TableCell>
                              <TableCell>{fee.amountMinor ?? "—"}</TableCell>
                              <TableCell>
                                {fee.externalRecordId ?? fee.providerRef ?? "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : null}

                {reconciliationCashMovements.length > 0 ? (
                  <div className="space-y-3">
                    <div className="text-sm font-medium">Cash movements</div>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Booked</TableHead>
                            <TableHead>Operation</TableHead>
                            <TableHead>Direction</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>External ref</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {reconciliationCashMovements.map((movement) => (
                            <TableRow key={movement.id}>
                              <TableCell>{formatDate(movement.bookedAt)}</TableCell>
                              <TableCell>{movement.operationId.slice(0, 8)}</TableCell>
                              <TableCell>{movement.direction}</TableCell>
                              <TableCell>{movement.amountMinor ?? "—"}</TableCell>
                              <TableCell>
                                {movement.externalRecordId ??
                                  movement.statementRef ??
                                  movement.providerRef ??
                                  "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-muted-foreground" />
              Open exceptions
            </CardTitle>
            <CardDescription>
              Исключения, которые мешают закрыть сделку или требуют explanation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.deal.relatedResources.reconciliationExceptions.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                Открытых reconciliation exceptions нет.
              </div>
            ) : (
              <div className="space-y-3">
                {data.deal.relatedResources.reconciliationExceptions.map((exception) => (
                  <div key={exception.id} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={exception.blocking ? "destructive" : "outline"}>
                        {exception.state}
                      </Badge>
                      <span className="text-sm font-medium">{exception.reasonCode}</span>
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      External record: {exception.externalRecordId}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Operation: {exception.operationId.slice(0, 8)}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {formatDate(exception.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Variance explanations</CardTitle>
            <CardDescription>
              Сводка отклонений, которую оператор сверяет с matched records и exceptions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.deal.profitabilityVariance ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-lg border px-4 py-3">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Expected net
                  </div>
                  <div className="mt-1 text-sm font-semibold">
                    {formatAmounts(data.deal.profitabilityVariance.expectedNetMargin)}
                  </div>
                </div>
                <div className="rounded-lg border px-4 py-3">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Realized net
                  </div>
                  <div className="mt-1 text-sm font-semibold">
                    {formatAmounts(data.deal.profitabilityVariance.realizedNetMargin)}
                  </div>
                </div>
                <div className="rounded-lg border px-4 py-3">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Delta
                  </div>
                  <div className="mt-1 text-sm font-semibold">
                    {formatAmounts(data.deal.profitabilityVariance.netMarginVariance)}
                  </div>
                </div>
                <div className="rounded-lg border px-4 py-3">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Actual expense
                  </div>
                  <div className="mt-1 text-sm font-semibold">
                    {formatAmounts(data.deal.profitabilityVariance.actualExpense)}
                  </div>
                </div>
              </div>
            ) : (
              <Alert>
                <AlertTitle>Variance еще не рассчитана</AlertTitle>
                <AlertDescription>
                  Реализованная прибыльность появится после достаточного покрытия execution
                  actuals.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <CloseBlockersPanel data={data} />
      </div>
    </FinanceDealWorkspaceLayout>
  );
}
