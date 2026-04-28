import { Fragment } from "react";
import Link from "next/link";

import { formatDecimalString } from "@bedrock/shared/money";
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
import { cn } from "@bedrock/sdk-ui/lib/utils";

import { formatDate } from "@/lib/format";
import { currencySymbol } from "@/features/treasury/rates/lib/format";

import { TreasuryBalancesEvaluationCurrencySwitcher } from "./evaluation-currency-switcher";
import type { TreasuryBalancesDashboardViewModel } from "../lib/presenter";

const TONE_STYLES = [
  {
    bar: "bg-sky-500",
    badge: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    card: "border-sky-500/20 bg-sky-500/5",
  },
  {
    bar: "bg-emerald-500",
    badge:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    card: "border-emerald-500/20 bg-emerald-500/5",
  },
  {
    bar: "bg-violet-500",
    badge:
      "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
    card: "border-violet-500/20 bg-violet-500/5",
  },
  {
    bar: "bg-amber-500",
    badge:
      "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    card: "border-amber-500/20 bg-amber-500/5",
  },
  {
    bar: "bg-rose-500",
    badge: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    card: "border-rose-500/20 bg-rose-500/5",
  },
  {
    bar: "bg-slate-500",
    badge:
      "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300",
    card: "border-slate-500/20 bg-slate-500/5",
  },
] as const;

function getToneStyle(index: number) {
  return TONE_STYLES[index % TONE_STYLES.length] ?? TONE_STYLES[0];
}

function buildBalancesHref(
  organizationId: string,
  evaluationCurrency: string,
  hash?: string,
) {
  const params = new URLSearchParams({
    evaluationCurrency,
    organizationId,
  });
  const query = params.toString();

  return hash
    ? `/treasury/balances?${query}#${hash}`
    : `/treasury/balances?${query}`;
}

function formatBalanceAmount(amount: string) {
  const fractionDigits = /^-?\d+(?:[.,](\d+))?$/.exec(amount.trim())?.[1]?.length ?? 0;

  try {
    return formatDecimalString(amount, {
      decimalSeparator: ".",
      groupSeparator: ",",
      maximumFractionDigits: fractionDigits,
      minimumFractionDigits: 0,
    });
  } catch {
    return amount;
  }
}

function formatCurrencyMixAmount(amount: string, currency: string) {
  const symbol = currencySymbol(currency);
  const formattedAmount = formatBalanceAmount(amount);

  return `${symbol}${symbol.length > 1 ? " " : ""}${formattedAmount}`;
}

function formatCurrencyCodeAmount(amount: string, currency: string) {
  return `${formatBalanceAmount(amount)} ${currency}`;
}

const INVENTORY_RECONCILIATION_LABELS = {
  inventory_exceeds_balance: "Инвентарь выше учёта",
  matched: "Сверено",
  missing_balance: "Нет учётного баланса",
} as const;

const INVENTORY_RECONCILIATION_BADGE_CLASS = {
  inventory_exceeds_balance:
    "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  matched:
    "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  missing_balance:
    "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300",
} as const;

export function TreasuryOrganizationBalancesView({
  asOf,
  viewModel,
}: {
  asOf: string;
  viewModel: TreasuryBalancesDashboardViewModel | null;
}) {
  if (!viewModel) {
    return (
      <Card className="rounded-sm">
        <CardHeader className="border-b">
          <CardTitle>Балансы отсутствуют</CardTitle>
          <CardDescription>Состояние на {formatDate(asOf)}.</CardDescription>
        </CardHeader>
        <CardContent className="py-8 text-sm text-muted-foreground">
          Позиции казначейских организаций пока отсутствуют.
        </CardContent>
      </Card>
    );
  }

  const {
    allAccountsRows,
    allOrganizationAccountGroups,
    organizationOptions,
    selectedOrganizationMetrics,
    selectedOrganizationSummary,
  } = viewModel;

  return (
    <div className="space-y-6">
      <div className="overflow-hidden bg-muted/50 rounded-xl">
        <div className="px-4 py-2">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">
                  Состояние на {formatDate(selectedOrganizationSummary.asOf)}
                </Badge>
              </div>
              <div className="space-y-2">
                <CardTitle className="text-3xl tracking-tight">
                  {selectedOrganizationSummary.organizationName}
                </CardTitle>
                <CardDescription className="max-w-2xl text-sm md:text-base text-foreground">
                  {selectedOrganizationSummary.requisitesCount} счетов по{" "}
                  {selectedOrganizationSummary.currencyCount} валютам в
                  казначействе
                </CardDescription>
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-sm md:text-base">
                  <span className="text-foreground">Совокупная оценка в</span>
                  <TreasuryBalancesEvaluationCurrencySwitcher
                    options={
                      selectedOrganizationSummary.evaluationCurrencyOptions
                    }
                    value={selectedOrganizationSummary.evaluationCurrency}
                  />
                </div>
                <div className="text-3xl font-semibold tracking-tight tabular-nums">
                  {selectedOrganizationSummary.totalEvaluation.amount
                    ? formatCurrencyMixAmount(
                        selectedOrganizationSummary.totalEvaluation.amount,
                        selectedOrganizationSummary.totalEvaluation.currency,
                      )
                    : "—"}
                </div>
                {selectedOrganizationSummary.totalEvaluation
                  .isComplete ? null : (
                  <div className="text-xs text-muted-foreground">
                    Недостаточно курсов для полной оценки
                    {selectedOrganizationSummary.totalEvaluation
                      .missingCurrencies.length > 0
                      ? `: ${selectedOrganizationSummary.totalEvaluation.missingCurrencies.join(", ")}`
                      : ""}
                    .
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="mt-1 text-sm font-medium">
                    Номинальное распределение по позиции
                  </div>
                </div>
                <Badge variant="outline" className="rounded-full">
                  {selectedOrganizationSummary.currencyCount} валют
                </Badge>
              </div>

              <div className="space-y-3">
                <div className="flex gap-1.5">
                  {selectedOrganizationSummary.currencyMix.map((currency) => (
                    <div
                      key={`${currency.currency}:amount`}
                      className="min-w-0"
                      style={{ width: `${currency.sharePercent}%` }}
                    >
                      <div className="truncate text-lg font-semibold tabular-nums">
                        {formatCurrencyMixAmount(
                          currency.ledgerBalance,
                          currency.currency,
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-1 rounded-full">
                  {selectedOrganizationSummary.currencyMix.map((currency) => {
                    const tone = getToneStyle(currency.toneIndex);

                    return (
                      <div
                        key={currency.currency}
                        className={cn("h-3 rounded-full", tone.bar)}
                        style={{ width: `${currency.sharePercent}%` }}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {selectedOrganizationMetrics.map((metric) => (
          <Card key={metric.key}>
            <CardHeader className="border-b">
              <CardTitle>{metric.label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {metric.values.map((value) => {
                const tone = getToneStyle(value.toneIndex);

                return (
                  <div
                    key={`${metric.key}:${value.currency}`}
                    className="flex items-center justify-between gap-3"
                  >
                    <span
                      className={cn(
                        "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-sm font-medium",
                        tone.badge,
                      )}
                    >
                      <span className="text-base leading-none">
                        {currencySymbol(value.currency)}
                      </span>
                      {value.currency}
                    </span>
                    <span className="text-sm font-semibold tabular-nums">
                      {formatCurrencyCodeAmount(value.amount, value.currency)}
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="border-b border-border/60">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-1">
                <CardTitle>Все счета</CardTitle>
                <CardDescription>
                  {allAccountsRows.length} счетов по{" "}
                  {organizationOptions.length} казначейским организациям. Выбор
                  сверху влияет только на сводку.
                </CardDescription>
              </div>
            </div>

            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {allOrganizationAccountGroups.map((organization) => (
                <Button
                  key={organization.organizationId}
                  className="rounded-full"
                  nativeButton={false}
                  render={
                    <Link
                      href={buildBalancesHref(
                        organization.organizationId,
                        selectedOrganizationSummary.evaluationCurrency,
                        organization.anchorId,
                      )}
                    />
                  }
                  size="sm"
                  variant={organization.isSelected ? "default" : "outline"}
                >
                  {organization.organizationName}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="">
          <Table className="min-w-[1280px]">
            <TableHeader>
              <TableRow>
                <TableHead>Реквизит</TableHead>
                <TableHead>Идентификатор</TableHead>
                <TableHead>Валюта</TableHead>
                <TableHead className="text-right">Позиция</TableHead>
                <TableHead className="text-right">Доступно по учёту</TableHead>
                <TableHead className="text-right">Учётный резерв</TableHead>
                <TableHead className="text-right">Доступно в инвентаре</TableHead>
                <TableHead className="text-right">Резерв инвентаря</TableHead>
                <TableHead>Сверка</TableHead>
                <TableHead className="text-right">В обработке</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allOrganizationAccountGroups.map((organization) => (
                <Fragment key={organization.organizationId}>
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={10} className="px-0 py-0">
                      <div
                        id={organization.anchorId}
                        className={cn(
                          "scroll-mt-24 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-4",
                          organization.isSelected
                            ? "bg-primary/5"
                            : "bg-muted/20",
                        )}
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-base font-semibold tracking-tight">
                              {organization.organizationName}
                            </span>
                            {organization.isSelected ? (
                              <Badge
                                variant="secondary"
                                className="rounded-full"
                              >
                                В фокусе
                              </Badge>
                            ) : null}
                          </div>
                          <div className="text-muted-foreground text-xs">
                            {organization.accountCount} счетов ·{" "}
                            {organization.currencies.join(", ")}
                          </div>
                        </div>
                        {organization.isSelected ? null : (
                          <Button
                            nativeButton={false}
                            render={
                              <Link
                                href={buildBalancesHref(
                                  organization.organizationId,
                                  selectedOrganizationSummary.evaluationCurrency,
                                  organization.anchorId,
                                )}
                              />
                            }
                            size="sm"
                            variant="outline"
                          >
                            Показать в сводке
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>

                  {organization.rows.map((row) => {
                    const tone = getToneStyle(row.toneIndex);

                    return (
                      <TableRow
                        key={row.key}
                        className={cn(
                          row.isSelectedOrganization &&
                            "bg-primary/5 hover:bg-primary/10",
                        )}
                      >
                        <TableCell className="font-medium">
                          {row.requisiteLabel}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {row.requisiteIdentity}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn("rounded-full border", tone.badge)}
                          >
                            {row.currency}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {formatCurrencyCodeAmount(
                            row.ledgerBalance,
                            row.currency,
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrencyCodeAmount(
                            row.available,
                            row.currency,
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrencyCodeAmount(
                            row.reserved,
                            row.currency,
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrencyCodeAmount(
                            row.inventoryAvailable,
                            row.currency,
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrencyCodeAmount(
                            row.inventoryReserved,
                            row.currency,
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              "rounded-full",
                              INVENTORY_RECONCILIATION_BADGE_CLASS[
                                row.inventoryReconciliationStatus
                              ],
                            )}
                          >
                            {
                              INVENTORY_RECONCILIATION_LABELS[
                                row.inventoryReconciliationStatus
                              ]
                            }
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrencyCodeAmount(
                            row.pending,
                            row.currency,
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
