import Link from "next/link";
import { Activity, ArrowRightLeft, ListChecks, ShieldCheck, Workflow } from "lucide-react";

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
import { ExecutionActualEntryActions } from "@/features/treasury/deals/components/execution-actual-entry-actions";
import {
  getDealLegKindLabel,
  getDealLegStateLabel,
  getFinanceDealDisplayTitle,
  getFinanceDealStatusLabel,
  getFinanceDealTypeLabel,
} from "@/features/treasury/deals/labels";
import type { FinanceDealExecutionWorkspace } from "@/features/treasury/deals/lib/execution-workspace";
import type { FinanceProfitabilityAmount } from "@/features/treasury/deals/lib/queries";
import {
  getTreasuryOperationInstructionStatusLabel,
  getTreasuryOperationInstructionStatusVariant,
  getTreasuryOperationKindLabel,
  getTreasuryOperationKindVariant,
} from "@/features/treasury/operations/lib/labels";
import { formatDate, formatMinorAmountWithCurrency } from "@/lib/format";

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

function getCoverageLabel(value: string) {
  switch (value) {
    case "complete":
      return "Actuals собраны";
    case "partial":
      return "Actuals частичные";
    case "not_started":
      return "Actuals нет";
    default:
      return value;
  }
}

function getCashMovementDirectionLabel(value: string) {
  switch (value) {
    case "credit":
      return "Credit";
    case "debit":
      return "Debit";
    default:
      return value;
  }
}

function getCoverageVariant(value: string) {
  switch (value) {
    case "complete":
      return "default" as const;
    case "partial":
      return "secondary" as const;
    case "not_started":
      return "outline" as const;
    default:
      return "outline" as const;
  }
}

function formatCompactId(value: string) {
  return value.slice(0, 8);
}

function getExecutionActualCount(data: FinanceDealExecutionWorkspace) {
  return data.fills.length + data.fees.length + data.cashMovements.length;
}

function formatAmounts(
  items: FinanceProfitabilityAmount[] | null | undefined,
) {
  if (!items || !Array.isArray(items) || items.length === 0) {
    return "0";
  }

  return items
    .map((item) => formatMinorAmountWithCurrency(item.amountMinor, item.currencyCode))
    .join(" · ");
}

function formatAmountByCurrencyId(
  amountMinor: string | null,
  currencyId: string | null,
  currencies: FinanceDealExecutionWorkspace["currencies"],
) {
  if (!amountMinor || !currencyId) {
    return "—";
  }

  const currencyCode =
    currencies.find((currency) => currency.id === currencyId)?.code ?? currencyId;

  return formatMinorAmountWithCurrency(amountMinor, currencyCode);
}

function formatLegLabel(
  leg:
    | FinanceDealExecutionWorkspace["deal"]["executionPlan"][number]
    | null
    | undefined,
) {
  if (!leg) {
    return "—";
  }

  return `${leg.idx}. ${getDealLegKindLabel(leg.kind)}`;
}

function VarianceSummaryCard({ data }: { data: FinanceDealExecutionWorkspace }) {
  const variance = data.deal.profitabilityVariance;

  if (!variance) {
    return (
      <Alert>
        <Activity className="h-4 w-4" />
        <AlertTitle>Фактическая вариативность пока не рассчитана</AlertTitle>
        <AlertDescription>
          Система покажет expected vs actual после появления execution actuals по
          операциям сделки.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-muted-foreground" />
              Expected vs Actual
            </CardTitle>
            <CardDescription>
              Расчет {formatCompactId(variance.calculationId)} · coverage{" "}
              {variance.actualCoverage.factCount}/{variance.actualCoverage.operationCount}
            </CardDescription>
          </div>
          <Badge variant={getCoverageVariant(variance.actualCoverage.state)}>
            {getCoverageLabel(variance.actualCoverage.state)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Expected net margin
            </div>
            <div className="mt-1 text-sm font-semibold">
              {formatAmounts(variance.expectedNetMargin)}
            </div>
          </div>
          <div className="rounded-lg border px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Realized net margin
            </div>
            <div className="mt-1 text-sm font-semibold">
              {formatAmounts(variance.realizedNetMargin)}
            </div>
          </div>
          <div className="rounded-lg border px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Net delta
            </div>
            <div className="mt-1 text-sm font-semibold">
              {formatAmounts(variance.netMarginVariance)}
            </div>
          </div>
          <div className="rounded-lg border px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Actual expense
            </div>
            <div className="mt-1 text-sm font-semibold">
              {formatAmounts(variance.actualExpense)}
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-lg border p-4">
            <div className="text-sm font-medium">Coverage</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border bg-muted/20 px-3 py-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Legs with actuals
                </div>
                <div className="mt-1 text-lg font-semibold">
                  {variance.actualCoverage.legsWithFacts}/
                  {variance.actualCoverage.totalLegCount}
                </div>
              </div>
              <div className="rounded-md border bg-muted/20 px-3 py-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Terminal ops
                </div>
                <div className="mt-1 text-lg font-semibold">
                  {variance.actualCoverage.terminalOperationCount}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <div className="text-sm font-medium">Variance by cost family</div>
            {variance.varianceByCostFamily.length === 0 ? (
              <div className="mt-3 text-sm text-muted-foreground">
                Детализация по cost family пока не собрана.
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                {variance.varianceByCostFamily.map((item) => (
                  <div
                    key={`${item.family}:${item.classification}`}
                    className="rounded-md border px-3 py-2"
                  >
                    <div className="text-sm font-medium">
                      {item.family.replaceAll("_", " ")}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {item.classification}
                    </div>
                    <div className="mt-2 text-sm">
                      {formatAmounts(item.variance)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="mb-3 text-sm font-medium">Variance by leg</div>
          {variance.varianceByLeg.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              По этапам маршрута фактические отклонения еще не собраны.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Leg</TableHead>
                    <TableHead>Expected from</TableHead>
                    <TableHead>Actual from</TableHead>
                    <TableHead>Expected to</TableHead>
                    <TableHead>Actual to</TableHead>
                    <TableHead>Fees</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {variance.varianceByLeg.map((item) => (
                    <TableRow key={item.routeLegId}>
                      <TableCell>
                        {item.idx}. {getDealLegKindLabel(item.kind)}
                      </TableCell>
                      <TableCell>
                        {item.expectedFrom
                          ? formatMinorAmountWithCurrency(
                              item.expectedFrom.amountMinor,
                              item.expectedFrom.currencyCode,
                            )
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {item.actualFrom
                          ? formatMinorAmountWithCurrency(
                              item.actualFrom.amountMinor,
                              item.actualFrom.currencyCode,
                            )
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {item.expectedTo
                          ? formatMinorAmountWithCurrency(
                              item.expectedTo.amountMinor,
                              item.expectedTo.currencyCode,
                            )
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {item.actualTo
                          ? formatMinorAmountWithCurrency(
                              item.actualTo.amountMinor,
                              item.actualTo.currencyCode,
                            )
                          : "—"}
                      </TableCell>
                      <TableCell>{formatAmounts(item.actualFees)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ExecutionActualsCard({
  currencies,
  data,
  legsById,
  operationsById,
}: {
  currencies: FinanceDealExecutionWorkspace["currencies"];
  data: FinanceDealExecutionWorkspace;
  legsById: Map<string, FinanceDealExecutionWorkspace["deal"]["executionPlan"][number]>;
  operationsById: Map<
    string,
    FinanceDealExecutionWorkspace["deal"]["relatedResources"]["operations"][number]
  >;
}) {
  const hasActuals = getExecutionActualCount(data) > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-muted-foreground" />
              Actual execution actuals
            </CardTitle>
            <CardDescription>
              Нормализованные fills, fees и cash movements из provider callbacks,
              manual entry и reconciliation.
            </CardDescription>
          </div>
          <ExecutionActualEntryActions
            currencies={currencies}
            deal={data.deal}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {!data.deal.actions.canRecordExecutionFill &&
        !data.deal.actions.canRecordExecutionFee &&
        !data.deal.actions.canRecordCashMovement ? (
          <div className="rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground">
            Manual actual entry доступен только после принятия расчета и
            материализации treasury operations.
          </div>
        ) : null}

        {!hasActuals ? (
          <div className="text-sm text-muted-foreground">
            Execution actuals по сделке пока не записаны.
          </div>
        ) : null}

        {data.fills.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium">Execution fills</div>
              <Badge variant="outline">{data.fills.length}</Badge>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Executed</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Operation</TableHead>
                    <TableHead>Leg</TableHead>
                    <TableHead>Sold</TableHead>
                    <TableHead>Bought</TableHead>
                    <TableHead>External ref</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.fills.map((fill) => {
                    const operation = operationsById.get(fill.operationId) ?? null;
                    const leg = fill.routeLegId
                      ? legsById.get(fill.routeLegId) ?? null
                      : null;

                    return (
                      <TableRow key={fill.id}>
                        <TableCell>
                          <div className="text-sm">{formatDate(fill.executedAt)}</div>
                          <div className="text-xs text-muted-foreground">
                            {fill.confirmedAt ? formatDate(fill.confirmedAt) : "—"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {getFactSourceKindLabel(fill.sourceKind)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {operation ? (
                            <div className="space-y-1">
                              <div className="text-sm font-medium">
                                {getTreasuryOperationKindLabel(operation.kind)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {formatCompactId(operation.id)}
                              </div>
                            </div>
                          ) : (
                            formatCompactId(fill.operationId)
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{formatLegLabel(leg)}</div>
                          {leg ? (
                            <div className="text-xs text-muted-foreground">
                              {getDealLegStateLabel(leg.state)}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          {formatAmountByCurrencyId(
                            fill.soldAmountMinor,
                            fill.soldCurrencyId,
                            currencies,
                          )}
                        </TableCell>
                        <TableCell>
                          {formatAmountByCurrencyId(
                            fill.boughtAmountMinor,
                            fill.boughtCurrencyId,
                            currencies,
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {fill.externalRecordId ?? fill.providerRef ?? "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : null}

        {data.fees.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium">Execution fees</div>
              <Badge variant="outline">{data.fees.length}</Badge>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Charged</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Operation</TableHead>
                    <TableHead>Leg</TableHead>
                    <TableHead>Family</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>External ref</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.fees.map((fee) => {
                    const operation = operationsById.get(fee.operationId) ?? null;
                    const leg = fee.routeLegId ? legsById.get(fee.routeLegId) ?? null : null;

                    return (
                      <TableRow key={fee.id}>
                        <TableCell>
                          <div className="text-sm">{formatDate(fee.chargedAt)}</div>
                          <div className="text-xs text-muted-foreground">
                            {fee.confirmedAt ? formatDate(fee.confirmedAt) : "—"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {getFactSourceKindLabel(fee.sourceKind)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {operation ? (
                            <div className="space-y-1">
                              <div className="text-sm font-medium">
                                {getTreasuryOperationKindLabel(operation.kind)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {formatCompactId(operation.id)}
                              </div>
                            </div>
                          ) : (
                            formatCompactId(fee.operationId)
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{formatLegLabel(leg)}</div>
                          {leg ? (
                            <div className="text-xs text-muted-foreground">
                              {getDealLegStateLabel(leg.state)}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-sm">{fee.feeFamily}</TableCell>
                        <TableCell>
                          {formatAmountByCurrencyId(
                            fee.amountMinor,
                            fee.currencyId,
                            currencies,
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {fee.externalRecordId ?? fee.providerRef ?? "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : null}

        {data.cashMovements.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium">Cash movements</div>
              <Badge variant="outline">{data.cashMovements.length}</Badge>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Booked</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Operation</TableHead>
                    <TableHead>Leg</TableHead>
                    <TableHead>Direction</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>External ref</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.cashMovements.map((movement) => {
                    const operation = operationsById.get(movement.operationId) ?? null;
                    const leg = movement.routeLegId
                      ? legsById.get(movement.routeLegId) ?? null
                      : null;

                    return (
                      <TableRow key={movement.id}>
                        <TableCell>
                          <div className="text-sm">{formatDate(movement.bookedAt)}</div>
                          <div className="text-xs text-muted-foreground">
                            {movement.valueDate ? formatDate(movement.valueDate) : "—"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {getFactSourceKindLabel(movement.sourceKind)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {operation ? (
                            <div className="space-y-1">
                              <div className="text-sm font-medium">
                                {getTreasuryOperationKindLabel(operation.kind)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {formatCompactId(operation.id)}
                              </div>
                            </div>
                          ) : (
                            formatCompactId(movement.operationId)
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{formatLegLabel(leg)}</div>
                          {leg ? (
                            <div className="text-xs text-muted-foreground">
                              {getDealLegStateLabel(leg.state)}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell>{getCashMovementDirectionLabel(movement.direction)}</TableCell>
                        <TableCell>
                          {formatAmountByCurrencyId(
                            movement.amountMinor,
                            movement.currencyId,
                            currencies,
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {movement.externalRecordId ??
                            movement.statementRef ??
                            movement.providerRef ??
                            "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function CloseBlockersPanel({ data }: { data: FinanceDealExecutionWorkspace }) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-muted-foreground" />
          Close blockers
        </CardTitle>
        <CardDescription>
          Закрытие зависит от исполнения, сверки, документов и realized profitability.
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

export function ExecutionWorkspace({ data }: { data: FinanceDealExecutionWorkspace }) {
  const title = getFinanceDealDisplayTitle({
    applicantDisplayName: data.deal.summary.applicantDisplayName,
    id: data.deal.summary.id,
    type: data.deal.summary.type,
  });

  const operationsById = new Map(
    data.deal.relatedResources.operations.map((operation) => [operation.id, operation]),
  );
  const legsById = new Map(
    data.deal.executionPlan
      .filter((leg) => leg.id)
      .map((leg) => [leg.id as string, leg]),
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
            render={<Link href={`/treasury/deals/${data.deal.summary.id}/compose`} />}
          >
            <Workflow className="mr-2 h-4 w-4" />
            Маршрут
          </Button>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={`/treasury/deals/${data.deal.summary.id}/calculation`} />}
          >
            <ArrowRightLeft className="mr-2 h-4 w-4" />
            Расчет
          </Button>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={`/treasury/deals/${data.deal.summary.id}/reconciliation`} />}
          >
            <ShieldCheck className="mr-2 h-4 w-4" />
            Сверка
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
              <Badge variant="outline">
                Operations: {data.deal.relatedResources.operations.length}
              </Badge>
              <Badge variant="outline">Actuals: {getExecutionActualCount(data)}</Badge>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border bg-background/70 px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Planned instructions
                </div>
                <div className="mt-1 text-lg font-semibold">
                  {data.deal.instructionSummary.planned}
                </div>
              </div>
              <div className="rounded-lg border bg-background/70 px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Submitted / settled
                </div>
                <div className="mt-1 text-lg font-semibold">
                  {data.deal.instructionSummary.submitted} /{" "}
                  {data.deal.instructionSummary.settled}
                </div>
              </div>
              <div className="rounded-lg border bg-background/70 px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Failed / returned
                </div>
                <div className="mt-1 text-lg font-semibold">
                  {data.deal.instructionSummary.failed} /{" "}
                  {data.deal.instructionSummary.returned}
                </div>
              </div>
              <div className="rounded-lg border bg-background/70 px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Queue
                </div>
                <div className="mt-1 text-sm font-semibold">
                  {data.deal.queueContext.queueReason}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <VarianceSummaryCard data={data} />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-muted-foreground" />
              Treasury operations
            </CardTitle>
            <CardDescription>
              Сгенерированные операции и состояние последней инструкции по каждой из них.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.deal.relatedResources.operations.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                Операции по сделке пока не материализованы.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Operation</TableHead>
                      <TableHead>Instruction</TableHead>
                      <TableHead>Latest outcome</TableHead>
                      <TableHead>Source ref</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.deal.relatedResources.operations.map((operation) => (
                      <TableRow key={operation.id}>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={getTreasuryOperationKindVariant(operation.kind)}>
                              {getTreasuryOperationKindLabel(operation.kind)}
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
                          <div className="mt-2 text-xs text-muted-foreground">
                            {formatCompactId(operation.id)}
                          </div>
                        </TableCell>
                        <TableCell>
                          {operation.latestInstruction ? (
                            <div className="text-sm">
                              <div>{operation.latestInstruction.state}</div>
                              <div className="text-xs text-muted-foreground">
                                Attempt {operation.latestInstruction.attempt}
                              </div>
                            </div>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          {operation.latestInstruction ? (
                            <div className="text-sm text-muted-foreground">
                              {formatDate(operation.latestInstruction.updatedAt)}
                            </div>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {operation.sourceRef}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            nativeButton={false}
                            render={<Link href={operation.operationHref} />}
                          >
                            Открыть
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <ExecutionActualsCard
          currencies={data.currencies}
          data={data}
          legsById={legsById}
          operationsById={operationsById}
        />

        <CloseBlockersPanel data={data} />
      </div>
    </FinanceDealWorkspaceLayout>
  );
}
