import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@bedrock/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/ui/components/card";

import { formatDate } from "@/lib/format";

import { TransferActionsClient } from "../components/transfer-actions-client";
import { getTransferById, getTransferFormOptions } from "../lib/queries";

interface TransferDetailsPageProps {
  params: Promise<{ id: string }>;
}

function statusLabel(status: string) {
  if (status === "draft") return "Черновик";
  if (status === "approved_pending_posting") return "В постинге";
  if (status === "pending") return "Ожидает settle/void";
  if (status === "settle_pending_posting") return "Settle в постинге";
  if (status === "void_pending_posting") return "Void в постинге";
  if (status === "posted") return "Проведен";
  if (status === "voided") return "Аннулирован";
  if (status === "rejected") return "Отклонен";
  return "Ошибка";
}

function formatMinorAmount(amountMinor: string, currencyCode: string, precision: number) {
  const value = amountMinor.startsWith("-") ? amountMinor.slice(1) : amountMinor;
  const negative = amountMinor.startsWith("-");
  const padded = precision > 0 ? value.padStart(precision + 1, "0") : value;
  const integerPart = precision > 0 ? padded.slice(0, -precision) : padded;
  const fractionPart = precision > 0 ? padded.slice(-precision) : "";
  const major = precision > 0 ? `${integerPart}.${fractionPart}` : integerPart;
  return `${negative ? "-" : ""}${major} ${currencyCode}`;
}

export default async function TransferDetailsPage({
  params,
}: TransferDetailsPageProps) {
  const { id } = await params;
  const [transfer, formOptions] = await Promise.all([
    getTransferById(id),
    getTransferFormOptions(),
  ]);

  if (!transfer) {
    notFound();
  }

  const currency =
    formOptions.currencies.find((item) => item.id === transfer.currencyId) ??
    (transfer.currencyCode
      ? { id: transfer.currencyId, code: transfer.currencyCode, name: transfer.currencyCode, precision: 2 }
      : { id: transfer.currencyId, code: "N/A", name: "N/A", precision: 2 });

  return (
    <div className="flex flex-col gap-4">
      <Card className="rounded-sm">
        <CardHeader className="border-b">
          <CardTitle>Перевод {transfer.id}</CardTitle>
          <CardDescription>
            Детали перевода, статус и жизненный цикл approve/reject/settle/void.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-muted-foreground text-sm">Статус</div>
              <div className="mt-1">
                <Badge variant={transfer.status === "failed" ? "destructive" : "secondary"}>
                  {statusLabel(transfer.status)}
                </Badge>
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-sm">Сумма</div>
              <div className="mt-1 font-medium">
                {formatMinorAmount(transfer.amountMinor, currency.code, currency.precision)}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-sm">Источник</div>
              <div className="mt-1">
                {transfer.sourceCounterpartyName ?? transfer.sourceCounterpartyId} /{" "}
                {transfer.sourceAccountLabel ?? transfer.sourceAccountId}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-sm">Назначение</div>
              <div className="mt-1">
                {transfer.destinationCounterpartyName ??
                  transfer.destinationCounterpartyId}{" "}
                / {transfer.destinationAccountLabel ?? transfer.destinationAccountId}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-sm">Kind / Settlement</div>
              <div className="mt-1">
                {transfer.kind} / {transfer.settlementMode}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-sm">Создан</div>
              <div className="mt-1">{formatDate(transfer.createdAt)}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-sm">Одобрено</div>
              <div className="mt-1">
                {transfer.approvedAt ? formatDate(transfer.approvedAt) : "—"}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-sm">Отклонено</div>
              <div className="mt-1">
                {transfer.rejectedAt ? formatDate(transfer.rejectedAt) : "—"}
              </div>
            </div>
          </div>

          {transfer.ledgerOperationId ? (
            <div className="text-sm">
              Ledger operation:{" "}
              <Link
                href={`/operations/journal/${transfer.ledgerOperationId}`}
                className="underline"
              >
                {transfer.ledgerOperationId}
              </Link>
            </div>
          ) : null}

          {transfer.lastError ? (
            <div className="text-destructive text-sm">Ошибка: {transfer.lastError}</div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="rounded-sm">
        <CardHeader className="border-b">
          <CardTitle>Действия</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <TransferActionsClient transfer={transfer} />
        </CardContent>
      </Card>
    </div>
  );
}
