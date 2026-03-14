import type { ReactNode } from "react";

import { Badge } from "@bedrock/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@bedrock/ui/components/table";

import { formatAmountByCurrency, formatDate } from "@/lib/format";
import { getOperationCodeLabel } from "@/features/operations/journal/lib/operation-code-labels";
import { getPostingCodeLabel } from "@/features/operations/journal/lib/posting-code-labels";

import type { OperationDetailsDto } from "../lib/queries";

const OPERATION_STATUS: Record<string, string> = {
  posted: "проведено",
  pending: "ожидает",
  failed: "ошибка",
};

const DIMENSION_KEY: Record<string, string> = {
  organizationRequisiteId: "реквизит орг.",
  counterpartyId: "контрагент",
  customerId: "клиент",
  orderId: "заявка",
  feeBucket: "статья комиссии",
  clearingKind: "вид клиринга",
};

const CLEARING_KIND: Record<string, string> = {
  intercompany: "между контрагентами",
  treasury_fx: "казначейский FX",
};

const TB_PLAN_TYPE: Record<string, string> = {
  create: "Создание",
  post_pending: "Подтверждение pending",
  void_pending: "Отмена pending",
};

function statusVariant(status: "pending" | "posted" | "failed") {
  if (status === "posted") return "default" as const;
  if (status === "pending") return "secondary" as const;
  return "destructive" as const;
}

function translateDimValue(
  key: string,
  value: string,
  labels: Record<string, string>,
): string {
  if (key === "clearingKind") return CLEARING_KIND[value] ?? value;
  if (labels[value]) return labels[value];
  return value.length > 20 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value;
}

function formatIntegerString(value: string): string {
  try {
    return new Intl.NumberFormat("ru-RU").format(BigInt(value));
  } catch {
    return value;
  }
}

function DimensionBadges({
  dims,
  labels,
}: {
  dims: Record<string, string> | null;
  labels: Record<string, string>;
}) {
  if (!dims) return null;
  const entries = Object.entries(dims);
  if (entries.length === 0) return null;

  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {entries.map(([key, value]) => (
        <Badge
          key={key}
          variant="outline"
          className="text-muted-foreground text-[11px] font-normal"
          title={`${key}: ${value}`}
        >
          {DIMENSION_KEY[key] ?? key}: {translateDimValue(key, value, labels)}
        </Badge>
      ))}
    </div>
  );
}

function SummaryItem({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div>
      <div className="text-muted-foreground text-sm">{label}</div>
      <div className="mt-1">{value}</div>
    </div>
  );
}

function TbAccountCell({
  debitTbAccountId,
  creditTbAccountId,
}: {
  debitTbAccountId: string | null;
  creditTbAccountId: string | null;
}) {
  return (
    <div className="space-y-2 text-xs">
      <div>
        <div className="text-muted-foreground mb-1">Дебет</div>
        <div className="font-mono break-all">
          {debitTbAccountId ?? "\u2014"}
        </div>
      </div>
      <div>
        <div className="text-muted-foreground mb-1">Кредит</div>
        <div className="font-mono break-all">
          {creditTbAccountId ?? "\u2014"}
        </div>
      </div>
    </div>
  );
}

export function OperationDetailsCards({
  details,
  title,
  description = "Детали операции, состав проводок и план TigerBeetle.",
  showTbPlan = true,
}: {
  details: OperationDetailsDto;
  title?: ReactNode;
  description?: ReactNode;
  showTbPlan?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Card className="rounded-sm">
        <CardHeader className="border-b">
          <CardTitle>{title ?? `Операция ${details.operation.id}`}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryItem
              label="Статус"
              value={
                <Badge variant={statusVariant(details.operation.status)}>
                  {OPERATION_STATUS[details.operation.status] ??
                    details.operation.status}
                </Badge>
              }
            />
            <SummaryItem
              label="Код операции"
              value={
                <div>
                  <div
                    className="font-medium"
                    title={details.operation.operationCode}
                  >
                    {getOperationCodeLabel(details.operation.operationCode)}
                  </div>
                  <div className="text-muted-foreground font-mono text-xs">
                    {details.operation.operationCode}
                  </div>
                </div>
              }
            />
            <SummaryItem
              label="Источник"
              value={
                <div className="text-sm">
                  <div className="text-muted-foreground">
                    {details.operation.sourceType}
                  </div>
                  <div className="font-mono text-xs break-all">
                    {details.operation.sourceId}
                  </div>
                </div>
              }
            />
            <SummaryItem
              label="Дата проводки"
              value={formatDate(details.operation.postingDate)}
            />
            <SummaryItem
              label="Создана"
              value={formatDate(details.operation.createdAt)}
            />
            <SummaryItem
              label="Проведена"
              value={
                details.operation.postedAt
                  ? formatDate(details.operation.postedAt)
                  : "\u2014"
              }
            />
            <SummaryItem
              label="Проводки"
              value={
                <div className="space-y-2">
                  <div>{details.operation.postingCount}</div>
                  {details.operation.currencies.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {details.operation.currencies.map((currency) => (
                        <Badge
                          key={currency}
                          variant="outline"
                          className="font-normal"
                        >
                          {currency}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>
              }
            />
            <SummaryItem
              label="Попыток outbox"
              value={
                <div>
                  <div>{details.operation.outboxAttempts}</div>
                  {details.operation.lastOutboxErrorAt ? (
                    <div className="text-muted-foreground text-xs">
                      Последняя ошибка:{" "}
                      {formatDate(details.operation.lastOutboxErrorAt)}
                    </div>
                  ) : null}
                </div>
              }
            />
          </div>
          {details.operation.error ? (
            <p className="text-destructive mt-4 text-sm">
              {details.operation.error}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="rounded-sm">
        <CardHeader className="border-b">
          <CardTitle>Проводки</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">№</TableHead>
                  <TableHead className="min-w-64">Дебет</TableHead>
                  <TableHead className="min-w-64">Кредит</TableHead>
                  <TableHead className="min-w-56">Код проводки</TableHead>
                  <TableHead className="min-w-40">Примечание</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {details.postings.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-muted-foreground h-16 text-center"
                    >
                      Проводки отсутствуют
                    </TableCell>
                  </TableRow>
                ) : (
                  details.postings.map((posting) => {
                    const amountFormatted = formatAmountByCurrency(
                      posting.amount,
                      posting.currency,
                    );

                    return (
                      <TableRow key={posting.id} className="align-top">
                        <TableCell>{posting.lineNo}</TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {posting.debitAccountNo ?? posting.debitInstanceId}
                          </div>
                          {posting.bookName ? (
                            <div className="text-muted-foreground mt-1 text-xs">
                              {posting.bookName}
                            </div>
                          ) : null}
                          <DimensionBadges
                            dims={posting.debitDimensions}
                            labels={details.dimensionLabels}
                          />
                          <div className="mt-1 font-mono text-sm font-semibold text-red-600 dark:text-red-400">
                            -{amountFormatted}{" "}
                            <span className="font-normal">
                              {posting.currency}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {posting.creditAccountNo ?? posting.creditInstanceId}
                          </div>
                          {posting.bookName ? (
                            <div className="text-muted-foreground mt-1 text-xs">
                              {posting.bookName}
                            </div>
                          ) : null}
                          <DimensionBadges
                            dims={posting.creditDimensions}
                            labels={details.dimensionLabels}
                          />
                          <div className="mt-1 font-mono text-sm font-semibold text-green-600 dark:text-green-400">
                            +{amountFormatted}{" "}
                            <span className="font-normal">
                              {posting.currency}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          <div
                            className="font-medium"
                            title={posting.postingCode}
                          >
                            {getPostingCodeLabel(posting.postingCode)}
                          </div>
                          <div className="text-muted-foreground font-mono mt-1">
                            {posting.postingCode}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {posting.memo ?? "\u2014"}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {showTbPlan ? (
        <Card className="rounded-sm">
          <CardHeader className="border-b">
            <CardTitle>План TigerBeetle</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">№</TableHead>
                    <TableHead className="min-w-56">Действие</TableHead>
                    <TableHead className="min-w-72">TB счета</TableHead>
                    <TableHead className="min-w-56">Параметры</TableHead>
                    <TableHead className="min-w-48">Статус</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {details.tbPlans.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-muted-foreground h-16 text-center"
                      >
                        План TigerBeetle отсутствует
                      </TableCell>
                    </TableRow>
                  ) : (
                    details.tbPlans.map((plan) => (
                      <TableRow key={plan.id} className="align-top">
                        <TableCell>{plan.lineNo}</TableCell>
                        <TableCell className="text-xs">
                          <div className="font-medium text-sm">
                            {TB_PLAN_TYPE[plan.type] ?? plan.type}
                          </div>
                          <div className="text-muted-foreground mt-1">
                            transfer
                          </div>
                          <div className="font-mono break-all">
                            {plan.transferId}
                          </div>
                          {plan.pendingId ? (
                            <>
                              <div className="text-muted-foreground mt-2">
                                pending
                              </div>
                              <div className="font-mono break-all">
                                {plan.pendingId}
                              </div>
                            </>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <TbAccountCell
                            debitTbAccountId={plan.debitTbAccountId}
                            creditTbAccountId={plan.creditTbAccountId}
                          />
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="font-mono text-sm font-semibold">
                            {formatIntegerString(plan.amount)}
                          </div>
                          <div className="text-muted-foreground mt-1">
                            ledger {plan.tbLedger} / code {plan.code}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1">
                            <Badge
                              variant={plan.isLinked ? "default" : "outline"}
                            >
                              {plan.isLinked ? "linked" : "unlinked"}
                            </Badge>
                            <Badge
                              variant={plan.isPending ? "secondary" : "outline"}
                            >
                              {plan.isPending ? "pending" : "final"}
                            </Badge>
                          </div>
                          {plan.pendingRef ? (
                            <div className="text-muted-foreground mt-2">
                              pending ref:{" "}
                              <span className="font-mono break-all">
                                {plan.pendingRef}
                              </span>
                            </div>
                          ) : null}
                          {plan.timeoutSeconds > 0 ? (
                            <div className="text-muted-foreground mt-1">
                              timeout: {plan.timeoutSeconds}s
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-xs">
                          <Badge variant={statusVariant(plan.status)}>
                            {OPERATION_STATUS[plan.status] ?? plan.status}
                          </Badge>
                          <div className="text-muted-foreground mt-2">
                            {formatDate(plan.createdAt)}
                          </div>
                          {plan.error ? (
                            <div className="text-destructive mt-2 break-words">
                              {plan.error}
                            </div>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
