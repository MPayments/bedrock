import { notFound } from "next/navigation";

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

import { formatAmount, formatDate } from "@/lib/format";
import { getOperationById } from "@/features/operations/journal/lib/queries";
import { getOperationCodeLabel } from "@/features/operations/journal/lib/operation-code-labels";
import { getPostingCodeLabel } from "@/features/operations/journal/lib/posting-code-labels";

interface OperationDetailsPageProps {
  params: Promise<{ operationId: string }>;
}

const OPERATION_STATUS: Record<string, string> = {
  posted: "проведено",
  pending: "ожидает",
  failed: "ошибка",
};

const DIMENSION_KEY: Record<string, string> = {
  counterpartyAccountId: "опер. счёт",
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
  return value.length > 20 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;
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
      {entries.map(([k, v]) => (
        <Badge
          key={k}
          variant="outline"
          className="text-muted-foreground text-[11px] font-normal"
          title={`${k}: ${v}`}
        >
          {DIMENSION_KEY[k] ?? k}: {translateDimValue(k, v, labels)}
        </Badge>
      ))}
    </div>
  );
}

export default async function OperationDetailsPage({
  params,
}: OperationDetailsPageProps) {
  const { operationId } = await params;
  const details = await getOperationById(operationId);

  if (!details) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="rounded-sm">
        <CardHeader className="border-b">
          <CardTitle>Операция {details.operation.id}</CardTitle>
          <CardDescription>
            Детали операции, состав проводок и план TigerBeetle.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <div className="text-muted-foreground text-sm">Статус</div>
              <div className="mt-1">
                <Badge variant={statusVariant(details.operation.status)}>
                  {OPERATION_STATUS[details.operation.status] ??
                    details.operation.status}
                </Badge>
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-sm">Код операции</div>
              <div
                className="mt-1 font-medium"
                title={details.operation.operationCode}
              >
                {getOperationCodeLabel(details.operation.operationCode)}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-sm">Источник</div>
              <div className="mt-1 text-sm">
                <span className="text-muted-foreground">
                  {details.operation.sourceType}
                </span>
                {" / "}
                <span className="font-mono text-xs">
                  {details.operation.sourceId}
                </span>
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-sm">Создана</div>
              <div className="mt-1">
                {formatDate(details.operation.createdAt)}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-sm">Проведена</div>
              <div className="mt-1">
                {details.operation.postedAt
                  ? formatDate(details.operation.postedAt)
                  : "—"}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-sm">
                Попыток outbox
              </div>
              <div className="mt-1">{details.operation.outboxAttempts}</div>
            </div>
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">№</TableHead>
                <TableHead>Дебет</TableHead>
                <TableHead>Кредит</TableHead>
                <TableHead>Код проводки</TableHead>
                <TableHead>Примечание</TableHead>
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
                  const amountFormatted = formatAmount(
                    posting.amountMinor,
                    posting.currencyPrecision,
                  );
                  return (
                    <TableRow key={posting.id} className="align-top">
                      <TableCell>{posting.lineNo}</TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {posting.debitAccountNo ?? posting.debitInstanceId}
                        </div>
                        <DimensionBadges
                          dims={posting.debitDimensions}
                          labels={details.dimensionLabels}
                        />
                        <div className="mt-1 font-mono text-sm font-semibold text-red-600 dark:text-red-400">
                          −{amountFormatted}{" "}
                          <span className="font-normal">
                            {posting.currency}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {posting.creditAccountNo ?? posting.creditInstanceId}
                        </div>
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
                        <span
                          className="font-mono text-muted-foreground"
                          title={posting.postingCode}
                        >
                          {getPostingCodeLabel(posting.postingCode)}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-40 truncate text-xs">
                        {posting.memo ?? "—"}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
