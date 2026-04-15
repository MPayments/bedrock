"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ArrowRightLeft,
  Calculator,
  Clock3,
  LineChart,
  ListChecks,
  Save,
  Workflow,
} from "lucide-react";

import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@bedrock/sdk-ui/components/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@bedrock/sdk-ui/components/dialog";
import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Label } from "@bedrock/sdk-ui/components/label";
import { toast } from "@bedrock/sdk-ui/components/sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@bedrock/sdk-ui/components/table";
import { Alert, AlertDescription, AlertTitle } from "@bedrock/sdk-ui/components/alert";
import { Textarea } from "@bedrock/sdk-ui/components/textarea";

import {
  formatQuoteAmountsSummary,
  formatQuoteRateSummary,
  refreshPage,
} from "@/features/treasury/deals/components/workbench";
import { FinanceDealWorkspaceLayout } from "@/features/treasury/deals/components/workspace-layout";
import {
  getFinanceDealDisplayTitle,
  getFinanceDealStatusLabel,
  getFinanceDealTypeLabel,
} from "@/features/treasury/deals/labels";
import type {
  FinanceCalculationCompare,
  FinanceCalculationDetails,
  FinanceDealCalculationWorkspace,
} from "@/features/treasury/deals/lib/calculation-workspace";
import { executeMutation } from "@/lib/resources/http";
import {
  formatDate,
  formatMinorAmountWithCurrency,
} from "@/lib/format";
import { formatRate } from "@/features/treasury/rates/lib/format";
import { formatMajorAmount } from "@/lib/format";

type CalculationWorkspaceProps = {
  data: FinanceDealCalculationWorkspace;
};

function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `idem-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function findQuoteDetailsById(
  deal: FinanceDealCalculationWorkspace["deal"],
  quoteId: string | null | undefined,
) {
  if (!quoteId) {
    return null;
  }

  return deal.quoteHistory.find((quote) => quote.id === quoteId) ?? null;
}

function formatAmountByCurrencyId(
  amountMinor: string,
  currencyId: string,
  currencies: FinanceDealCalculationWorkspace["currencies"],
) {
  const currencyCode =
    currencies.find((currency) => currency.id === currencyId)?.code ?? currencyId;

  return formatMinorAmountWithCurrency(amountMinor, currencyCode);
}

function formatProvenanceRecord(value: Record<string, unknown> | null) {
  if (!value) {
    return null;
  }

  return JSON.stringify(value, null, 2);
}

function SnapshotSummaryCards({
  calculation,
  currencies,
}: {
  calculation: FinanceCalculationDetails;
  currencies: FinanceDealCalculationWorkspace["currencies"];
}) {
  const snapshot = calculation.currentSnapshot;

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <div className="rounded-lg border px-4 py-3">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          Сумма расчета
        </div>
        <div className="mt-1 text-lg font-semibold">
          {formatAmountByCurrencyId(
            snapshot.totalAmountMinor,
            snapshot.calculationCurrencyId,
            currencies,
          )}
        </div>
      </div>
      <div className="rounded-lg border px-4 py-3">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          Gross revenue
        </div>
        <div className="mt-1 text-lg font-semibold">
          {formatAmountByCurrencyId(
            snapshot.grossRevenueInBaseMinor,
            snapshot.baseCurrencyId,
            currencies,
          )}
        </div>
      </div>
      <div className="rounded-lg border px-4 py-3">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          Расходы
        </div>
        <div className="mt-1 text-lg font-semibold">
          {formatAmountByCurrencyId(
            snapshot.expenseAmountInBaseMinor,
            snapshot.baseCurrencyId,
            currencies,
          )}
        </div>
      </div>
      <div className="rounded-lg border px-4 py-3">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          Pass-through
        </div>
        <div className="mt-1 text-lg font-semibold">
          {formatAmountByCurrencyId(
            snapshot.passThroughAmountInBaseMinor,
            snapshot.baseCurrencyId,
            currencies,
          )}
        </div>
      </div>
      <div className="rounded-lg border px-4 py-3">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          Net margin
        </div>
        <div className="mt-1 text-lg font-semibold">
          {formatAmountByCurrencyId(
            snapshot.netMarginInBaseMinor,
            snapshot.baseCurrencyId,
            currencies,
          )}
        </div>
      </div>
    </div>
  );
}

function CalculationSnapshotCompareDrawer({
  compare,
  currencies,
}: {
  compare: FinanceCalculationCompare;
  currencies: FinanceDealCalculationWorkspace["currencies"];
}) {
  const totalItems = [
    {
      key: "grossRevenueInBaseMinor",
      label: "Gross revenue",
      value: compare.totals.grossRevenueInBaseMinor,
      currencyId: compare.left.currentSnapshot.baseCurrencyId,
    },
    {
      key: "expenseAmountInBaseMinor",
      label: "Расходы",
      value: compare.totals.expenseAmountInBaseMinor,
      currencyId: compare.left.currentSnapshot.baseCurrencyId,
    },
    {
      key: "passThroughAmountInBaseMinor",
      label: "Pass-through",
      value: compare.totals.passThroughAmountInBaseMinor,
      currencyId: compare.left.currentSnapshot.baseCurrencyId,
    },
    {
      key: "netMarginInBaseMinor",
      label: "Net margin",
      value: compare.totals.netMarginInBaseMinor,
      currencyId: compare.left.currentSnapshot.baseCurrencyId,
    },
    {
      key: "totalInBaseMinor",
      label: "Total in base",
      value: compare.totals.totalInBaseMinor,
      currencyId: compare.left.currentSnapshot.baseCurrencyId,
    },
    {
      key: "totalWithExpensesInBaseMinor",
      label: "Total with expenses",
      value: compare.totals.totalWithExpensesInBaseMinor,
      currencyId: compare.left.currentSnapshot.baseCurrencyId,
    },
  ] as const;

  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button variant="outline">
            <ArrowRightLeft className="mr-2 h-4 w-4" />
            Сравнить snapshots
          </Button>
        }
      />
      <SheetContent className="w-full max-w-5xl overflow-y-auto sm:max-w-5xl">
        <SheetHeader>
          <SheetTitle>Сравнение расчетов</SheetTitle>
          <SheetDescription>
            Слева текущий snapshot, справа предыдущий. Все дельты считаются на backend
            через <code>GET /deals/{"{id}"}/calculations/compare</code>.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="grid gap-3 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Текущий snapshot</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>Calculation: {compare.left.id.slice(0, 8)}</div>
                <div>Snapshot #{compare.left.currentSnapshot.snapshotNumber}</div>
                <div>
                  Timestamp: {formatDate(compare.left.currentSnapshot.calculationTimestamp)}
                </div>
                <div>
                  Rate:{" "}
                  {formatMajorAmount(
                    formatRate(
                      compare.left.currentSnapshot.rateNum,
                      compare.left.currentSnapshot.rateDen,
                    ),
                  )}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Предыдущий snapshot</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>Calculation: {compare.right.id.slice(0, 8)}</div>
                <div>Snapshot #{compare.right.currentSnapshot.snapshotNumber}</div>
                <div>
                  Timestamp: {formatDate(compare.right.currentSnapshot.calculationTimestamp)}
                </div>
                <div>
                  Rate:{" "}
                  {formatMajorAmount(
                    formatRate(
                      compare.right.currentSnapshot.rateNum,
                      compare.right.currentSnapshot.rateDen,
                    ),
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Итоговые дельты</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {totalItems.map((item) => (
                <div key={item.key} className="rounded-lg border px-4 py-3">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    {item.label}
                  </div>
                  <div className="mt-2 space-y-1 text-sm">
                    <div>
                      Left:{" "}
                      <span className="font-medium">
                        {formatAmountByCurrencyId(
                          item.value.leftMinor,
                          item.currencyId,
                          currencies,
                        )}
                      </span>
                    </div>
                    <div>
                      Right:{" "}
                      <span className="font-medium">
                        {formatAmountByCurrencyId(
                          item.value.rightMinor,
                          item.currencyId,
                          currencies,
                        )}
                      </span>
                    </div>
                    <div>
                      Delta:{" "}
                      <span className="font-medium">
                        {formatAmountByCurrencyId(
                          item.value.deltaMinor,
                          item.currencyId,
                          currencies,
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Line diffs</CardTitle>
              <CardDescription>
                Component-level differences between the current and previous snapshots.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Component</TableHead>
                      <TableHead>Kind</TableHead>
                      <TableHead>Classification</TableHead>
                      <TableHead>Left</TableHead>
                      <TableHead>Right</TableHead>
                      <TableHead>Delta</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {compare.lineDiffs.map((line) => (
                      <TableRow key={`${line.componentCode}:${line.kind}:${line.routeLegId ?? "none"}`}>
                        <TableCell>{line.componentCode}</TableCell>
                        <TableCell>{line.kind}</TableCell>
                        <TableCell>{line.classification ?? "—"}</TableCell>
                        <TableCell>
                          {formatAmountByCurrencyId(
                            line.leftAmountMinor,
                            line.currencyId,
                            currencies,
                          )}
                        </TableCell>
                        <TableCell>
                          {formatAmountByCurrencyId(
                            line.rightAmountMinor,
                            line.currencyId,
                            currencies,
                          )}
                        </TableCell>
                        <TableCell>
                          {formatAmountByCurrencyId(
                            line.deltaAmountMinor,
                            line.currencyId,
                            currencies,
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function CalculationWorkspace({ data }: CalculationWorkspaceProps) {
  const router = useRouter();
  const [isCreatingCalculation, setIsCreatingCalculation] = useState(false);
  const [isAcceptingCalculation, setIsAcceptingCalculation] = useState(false);
  const [isSupersedingCalculation, setIsSupersedingCalculation] = useState(false);
  const [isSupersedeDialogOpen, setIsSupersedeDialogOpen] = useState(false);
  const [supersedeReason, setSupersedeReason] = useState("");
  const title = getFinanceDealDisplayTitle({
    applicantDisplayName: data.deal.summary.applicantDisplayName,
    id: data.deal.summary.id,
    type: data.deal.summary.type,
  });

  const currentCalculation =
    data.currentCalculation ?? data.comparison?.left ?? null;
  const acceptedCalculation = data.deal.acceptedCalculation;

  const currentQuote = useMemo(() => {
    const currentHistoryItem =
      data.deal.calculationHistory.find(
        (item) => item.calculationId === data.deal.summary.calculationId,
      ) ?? data.deal.calculationHistory[0] ?? null;

    return findQuoteDetailsById(data.deal, currentHistoryItem?.sourceQuoteId);
  }, [data.deal]);
  const acceptedQuote = useMemo(
    () =>
      findQuoteDetailsById(
        data.deal,
        acceptedCalculation?.quoteProvenance?.sourceQuoteId ??
          acceptedCalculation?.quoteProvenance?.fxQuoteId,
      ),
    [acceptedCalculation, data.deal],
  );

  async function handleCreateCalculation() {
    setIsCreatingCalculation(true);

    const result = await executeMutation({
      fallbackMessage: "Не удалось создать расчет по маршруту",
      request: () =>
        fetch(
          `/v1/deals/${encodeURIComponent(data.deal.summary.id)}/calculations/from-route`,
          {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": createIdempotencyKey(),
            },
            body: JSON.stringify({}),
          },
        ),
    });

    setIsCreatingCalculation(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("Расчет по маршруту создан");
    refreshPage(router);
  }

  async function handleAcceptCalculation() {
    if (!currentCalculation) {
      return;
    }

    setIsAcceptingCalculation(true);

    const result = await executeMutation({
      fallbackMessage: "Не удалось принять расчет",
      request: () =>
        fetch(
          `/v1/deals/${encodeURIComponent(data.deal.summary.id)}/calculations/${encodeURIComponent(currentCalculation.id)}/accept`,
          {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": createIdempotencyKey(),
            },
            body: JSON.stringify({
              calculationId: currentCalculation.id,
            }),
          },
        ),
    });

    setIsAcceptingCalculation(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("Расчет принят как commercial freeze");
    refreshPage(router);
  }

  async function handleSupersedeCalculation() {
    if (!acceptedCalculation) {
      return;
    }

    setIsSupersedingCalculation(true);

    const result = await executeMutation({
      fallbackMessage: "Не удалось supersede расчет",
      request: () =>
        fetch(
          `/v1/deals/${encodeURIComponent(data.deal.summary.id)}/calculations/${encodeURIComponent(acceptedCalculation.calculationId)}/supersede`,
          {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": createIdempotencyKey(),
            },
            body: JSON.stringify({
              calculationId: acceptedCalculation.calculationId,
              reason: supersedeReason.trim() || null,
            }),
          },
        ),
    });

    setIsSupersedingCalculation(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("Принятый расчет superseded");
    setSupersedeReason("");
    setIsSupersedeDialogOpen(false);
    refreshPage(router);
  }

  function handleSupersedeDialogChange(nextOpen: boolean) {
    if (!nextOpen) {
      setSupersedeReason("");
    }

    setIsSupersedeDialogOpen(nextOpen);
  }

  return (
    <>
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
              render={<Link href={`/treasury/deals/${data.deal.summary.id}/execution`} />}
            >
              <ListChecks className="mr-2 h-4 w-4" />
              Исполнение
            </Button>
            {data.deal.actions.canAcceptCalculation && currentCalculation ? (
              <Button onClick={handleAcceptCalculation} disabled={isAcceptingCalculation}>
                <Save className="mr-2 h-4 w-4" />
                {isAcceptingCalculation ? "Принимаем..." : "Accept current calculation"}
              </Button>
            ) : null}
            {data.deal.actions.canSupersedeCalculation && acceptedCalculation ? (
              <Button
                variant="outline"
                onClick={() => setIsSupersedeDialogOpen(true)}
                disabled={isSupersedingCalculation}
              >
                Supersede accepted
              </Button>
            ) : null}
            <Button
              onClick={handleCreateCalculation}
              disabled={
                isCreatingCalculation || !data.deal.actions.canCreateCalculation
              }
            >
              <Save className="mr-2 h-4 w-4" />
              {isCreatingCalculation ? "Создание..." : "Создать from route"}
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
                История: {data.deal.calculationHistory.length}
              </Badge>
            </div>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_repeat(2,minmax(0,180px))]">
              <div className="rounded-lg border bg-background/70 px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Сделка
                </div>
                <div className="mt-1 text-sm font-medium">
                  {data.deal.summary.applicantDisplayName ?? "—"}
                </div>
              </div>
              <div className="rounded-lg border bg-background/70 px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Текущий calculation
                </div>
                <div className="mt-1 text-sm font-medium">
                  {currentCalculation ? currentCalculation.id.slice(0, 8) : "Не создан"}
                </div>
              </div>
              <div className="rounded-lg border bg-background/70 px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Snapshot
                </div>
                <div className="mt-1 text-lg font-semibold">
                  {currentCalculation?.currentSnapshot.snapshotNumber ?? "—"}
                </div>
              </div>
              <div className="rounded-lg border bg-background/70 px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Timestamp
                </div>
                <div className="mt-1 text-sm font-medium">
                  {currentCalculation
                    ? formatDate(currentCalculation.currentSnapshot.calculationTimestamp)
                    : "—"}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Save className="h-5 w-5 text-muted-foreground" />
                  Commercial freeze
                </CardTitle>
                <CardDescription>
                  Accepted calculation is the only commercial freeze point for the deal.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {acceptedCalculation ? (
                  <Badge variant="secondary">Accepted</Badge>
                ) : (
                  <Badge variant="outline">Not accepted</Badge>
                )}
                {currentCalculation ? (
                  <Badge variant="outline">
                    Current state: {currentCalculation.currentSnapshot.state}
                  </Badge>
                ) : null}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {acceptedCalculation ? (
              <>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <div className="rounded-lg border px-4 py-3">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Accepted calculation
                    </div>
                    <div className="mt-1 text-sm font-semibold">
                      {acceptedCalculation.calculationId.slice(0, 8)}
                    </div>
                  </div>
                  <div className="rounded-lg border px-4 py-3">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Snapshot
                    </div>
                    <div className="mt-1 text-sm font-semibold">
                      {acceptedCalculation.snapshotId.slice(0, 8)}
                    </div>
                  </div>
                  <div className="rounded-lg border px-4 py-3">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Accepted at
                    </div>
                    <div className="mt-1 text-sm font-semibold">
                      {formatDate(acceptedCalculation.acceptedAt)}
                    </div>
                  </div>
                  <div className="rounded-lg border px-4 py-3">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Route version
                    </div>
                    <div className="mt-1 text-sm font-semibold">
                      {acceptedCalculation.routeVersionId?.slice(0, 8) ?? "—"}
                    </div>
                  </div>
                  <div className="rounded-lg border px-4 py-3">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      State
                    </div>
                    <div className="mt-1 text-sm font-semibold">
                      {acceptedCalculation.state}
                    </div>
                  </div>
                </div>

                {acceptedQuote ? (
                  <div className="rounded-lg border p-4">
                    <div className="font-medium">
                      {formatQuoteAmountsSummary(acceptedQuote)}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Quote provenance: {formatQuoteRateSummary(acceptedQuote)}
                    </div>
                  </div>
                ) : null}

                {acceptedCalculation.quoteProvenance ? (
                  <div className="rounded-lg border p-4">
                    <div className="text-sm font-medium">Quote provenance</div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <div className="text-sm">
                        Source quote:{" "}
                        {acceptedCalculation.quoteProvenance.sourceQuoteId ?? "—"}
                      </div>
                      <div className="text-sm">
                        FX quote: {acceptedCalculation.quoteProvenance.fxQuoteId ?? "—"}
                      </div>
                    </div>
                  </div>
                ) : null}

                {formatProvenanceRecord(acceptedCalculation.pricingProvenance) ? (
                  <div className="rounded-lg border p-4">
                    <div className="text-sm font-medium">Pricing provenance</div>
                    <pre className="mt-2 overflow-x-auto rounded-md bg-muted/30 p-3 text-xs">
                      {formatProvenanceRecord(acceptedCalculation.pricingProvenance)}
                    </pre>
                  </div>
                ) : null}
              </>
            ) : (
              <Alert>
                <Clock3 className="h-4 w-4" />
                <AlertTitle>Принятого расчета пока нет</AlertTitle>
                <AlertDescription>
                  Calculation должен пройти явный accept в Finance, прежде чем
                  сделка сможет перейти к исполнению как commercial freeze.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {currentCalculation ? (
          <>
            <Card>
              <CardHeader className="border-b">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      <Calculator className="h-5 w-5 text-muted-foreground" />
                      Current snapshot
                    </CardTitle>
                    <CardDescription>
                      Snapshot #{currentCalculation.currentSnapshot.snapshotNumber} · state{" "}
                      {currentCalculation.currentSnapshot.state}
                    </CardDescription>
                  </div>
                  {data.comparison ? (
                    <CalculationSnapshotCompareDrawer
                      compare={data.comparison}
                      currencies={data.currencies}
                    />
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {currentQuote ? (
                  <div className="rounded-lg border p-4">
                    <div className="font-medium">
                      {formatQuoteAmountsSummary(currentQuote)}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Курс: {formatQuoteRateSummary(currentQuote)}
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg border p-4">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Rate
                    </div>
                    <div className="mt-1 text-lg font-semibold">
                      {formatMajorAmount(
                        formatRate(
                          currentCalculation.currentSnapshot.rateNum,
                          currentCalculation.currentSnapshot.rateDen,
                        ),
                      )}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Source: {currentCalculation.currentSnapshot.rateSource}
                    </div>
                  </div>
                  <div className="rounded-lg border p-4">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Расчетная валюта
                    </div>
                    <div className="mt-1 text-lg font-semibold">
                      {data.currencies.find(
                        (currency) =>
                          currency.id ===
                          currentCalculation.currentSnapshot.calculationCurrencyId,
                      )?.code ?? currentCalculation.currentSnapshot.calculationCurrencyId}
                    </div>
                  </div>
                  <div className="rounded-lg border p-4">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Base currency
                    </div>
                    <div className="mt-1 text-lg font-semibold">
                      {data.currencies.find(
                        (currency) =>
                          currency.id === currentCalculation.currentSnapshot.baseCurrencyId,
                      )?.code ?? currentCalculation.currentSnapshot.baseCurrencyId}
                    </div>
                  </div>
                </div>

                <SnapshotSummaryCards
                  calculation={currentCalculation}
                  currencies={data.currencies}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LineChart className="h-5 w-5 text-muted-foreground" />
                  Calculation lines
                </CardTitle>
                <CardDescription>
                  Route economics preserved at line level: component, family, kind,
                  source kind.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Component</TableHead>
                        <TableHead>Family</TableHead>
                        <TableHead>Kind</TableHead>
                        <TableHead>Classification</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentCalculation.lines.map((line) => (
                        <TableRow key={line.idx}>
                          <TableCell>{line.idx}</TableCell>
                          <TableCell>{line.componentCode ?? "—"}</TableCell>
                          <TableCell>{line.componentFamily ?? "—"}</TableCell>
                          <TableCell>{line.kind}</TableCell>
                          <TableCell>{line.classification ?? "—"}</TableCell>
                          <TableCell>{line.sourceKind}</TableCell>
                          <TableCell>
                            {formatAmountByCurrencyId(
                              line.amountMinor,
                              line.currencyId,
                              data.currencies,
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <Alert>
            <Clock3 className="h-4 w-4" />
            <AlertTitle>Расчет еще не создан</AlertTitle>
            <AlertDescription>
              Сохраните маршрут и создайте route-based calculation, чтобы зафиксировать
              economics snapshot и открыть compare с последующими версиями.
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>История расчетов</CardTitle>
            <CardDescription>
              Все версии, привязанные к сделке. Compare строится current vs previous на
              backend.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.deal.calculationHistory.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                По сделке еще нет расчетов.
              </div>
            ) : (
              <div className="space-y-2">
                {data.deal.calculationHistory.map((item, index) => (
                  <div
                    key={item.calculationId}
                    className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          Расчет {data.deal.calculationHistory.length - index}
                        </span>
                        {data.deal.summary.calculationId === item.calculationId ? (
                          <Badge variant="secondary">Актуальный</Badge>
                        ) : null}
                        {acceptedCalculation?.calculationId === item.calculationId ? (
                          <Badge variant="outline">Commercial freeze</Badge>
                        ) : null}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Создан {formatDate(item.createdAt)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Rate{" "}
                        {formatMajorAmount(formatRate(item.rateNum, item.rateDen))}
                      </div>
                    </div>
                    <Badge variant="outline">{item.calculationId.slice(0, 8)}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        </div>
      </FinanceDealWorkspaceLayout>

      <Dialog open={isSupersedeDialogOpen} onOpenChange={handleSupersedeDialogChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Supersede accepted calculation</DialogTitle>
            <DialogDescription>
              Accepted calculation больше не будет считаться действующим commercial
              freeze. Причина опциональна, но лучше оставить короткий контекст.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="supersede-calculation-reason">Причина</Label>
            <Textarea
              id="supersede-calculation-reason"
              value={supersedeReason}
              onChange={(event) => setSupersedeReason(event.target.value)}
              disabled={isSupersedingCalculation}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              disabled={isSupersedingCalculation}
              onClick={() => handleSupersedeDialogChange(false)}
            >
              Отмена
            </Button>
            <Button
              type="button"
              disabled={isSupersedingCalculation}
              onClick={handleSupersedeCalculation}
            >
              {isSupersedingCalculation ? "Superseding..." : "Supersede calculation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
