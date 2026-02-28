"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@bedrock/ui/components/badge";
import { Button } from "@bedrock/ui/components/button";
import { Card, CardContent } from "@bedrock/ui/components/card";
import { toast } from "@bedrock/ui/components/sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@bedrock/ui/components/table";

import { apiClient } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { executeMutation } from "@/lib/resources/http";
import type { TransferDto, TransferFormOptions } from "../lib/queries";

interface TransfersPageClientProps {
  transfers: TransferDto[];
  currencies: TransferFormOptions["currencies"];
}

function resolveStatusBadge(status: TransferDto["status"]): {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
} {
  if (status === "draft") return { label: "Черновик", variant: "outline" };
  if (status === "approved_pending_posting") {
    return { label: "В постинге", variant: "secondary" };
  }
  if (status === "pending")
    return { label: "Ожидает settle/void", variant: "secondary" };
  if (status === "settle_pending_posting")
    return { label: "Settle в постинге", variant: "secondary" };
  if (status === "void_pending_posting")
    return { label: "Void в постинге", variant: "secondary" };
  if (status === "posted") return { label: "Проведен", variant: "default" };
  if (status === "voided") return { label: "Аннулирован", variant: "outline" };
  if (status === "rejected") return { label: "Отклонен", variant: "outline" };
  return { label: "Ошибка", variant: "destructive" };
}

function formatMinorAmount(
  amountMinor: string,
  currencyCode: string,
  precision: number,
) {
  const value = amountMinor.startsWith("-")
    ? amountMinor.slice(1)
    : amountMinor;
  const negative = amountMinor.startsWith("-");
  const padded = precision > 0 ? value.padStart(precision + 1, "0") : value;
  const integerPart = precision > 0 ? padded.slice(0, -precision) : padded;
  const fractionPart = precision > 0 ? padded.slice(-precision) : "";
  const major = precision > 0 ? `${integerPart}.${fractionPart}` : integerPart;
  return `${negative ? "-" : ""}${major} ${currencyCode}`;
}

function createIdempotencyKey(prefix: string) {
  const random =
    typeof crypto !== "undefined"
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `${prefix}:${random}`;
}

export function TransfersPageClient({
  transfers,
  currencies,
}: TransfersPageClientProps) {
  const router = useRouter();
  const [actionTransferId, setActionTransferId] = useState<string | null>(null);

  const currencyById = useMemo(
    () =>
      new Map(
        currencies.map((item) => [
          item.id,
          { code: item.code, precision: item.precision },
        ]),
      ),
    [currencies],
  );

  async function handleApprove(transfer: TransferDto) {
    setActionTransferId(transfer.id);
    const result = await executeMutation<{
      transferId: string;
      ledgerOperationId: string;
    }>({
      request: () =>
        apiClient.v1.transfers[":id"].approve.$post({
          param: { id: transfer.id },
          json: {
            occurredAt: new Date().toISOString(),
          },
        }),
      fallbackMessage: "Не удалось подтвердить перевод",
      parseData: async (response) =>
        (await response.json()) as {
          transferId: string;
          ledgerOperationId: string;
        },
    });
    setActionTransferId(null);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("Перевод подтвержден");
    router.refresh();
  }

  async function handleReject(transfer: TransferDto) {
    const reason = window.prompt("Причина отклонения");
    if (reason === null) return;
    if (reason.trim().length === 0) {
      toast.error("Причина отклонения обязательна");
      return;
    }

    setActionTransferId(transfer.id);
    const result = await executeMutation<{ transferId: string }>({
      request: () =>
        apiClient.v1.transfers[":id"].reject.$post({
          param: { id: transfer.id },
          json: {
            occurredAt: new Date().toISOString(),
            reason,
          },
        }),
      fallbackMessage: "Не удалось отклонить перевод",
      parseData: async (response) =>
        (await response.json()) as { transferId: string },
    });
    setActionTransferId(null);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("Перевод отклонен");
    router.refresh();
  }

  async function handleSettle(transfer: TransferDto) {
    setActionTransferId(transfer.id);
    const result = await executeMutation<{
      transferId: string;
      ledgerOperationId: string;
    }>({
      request: () =>
        apiClient.v1.transfers[":id"].settle.$post({
          param: { id: transfer.id },
          json: {
            eventIdempotencyKey: createIdempotencyKey("ui:transfer:settle"),
            occurredAt: new Date().toISOString(),
          },
        }),
      fallbackMessage: "Не удалось провести settle",
      parseData: async (response) =>
        (await response.json()) as {
          transferId: string;
          ledgerOperationId: string;
        },
    });
    setActionTransferId(null);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("Pending перевод проведен");
    router.refresh();
  }

  async function handleVoid(transfer: TransferDto) {
    const reason = window.prompt("Причина void (опционально)");
    if (reason === null) return;

    setActionTransferId(transfer.id);
    const result = await executeMutation<{
      transferId: string;
      ledgerOperationId: string;
    }>({
      request: () =>
        apiClient.v1.transfers[":id"].void.$post({
          param: { id: transfer.id },
          json: {
            eventIdempotencyKey: createIdempotencyKey("ui:transfer:void"),
            occurredAt: new Date().toISOString(),
            reason: reason.trim() || undefined,
          },
        }),
      fallbackMessage: "Не удалось выполнить void",
      parseData: async (response) =>
        (await response.json()) as {
          transferId: string;
          ledgerOperationId: string;
        },
    });
    setActionTransferId(null);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("Pending перевод аннулирован");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="rounded-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Источник</TableHead>
                <TableHead>Назначение</TableHead>
                <TableHead>Режим</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="text-right">Сумма</TableHead>
                <TableHead>Операция</TableHead>
                <TableHead className="text-right">Создан</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transfers.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="text-muted-foreground h-20 text-center"
                  >
                    Переводы не найдены
                  </TableCell>
                </TableRow>
              ) : (
                transfers.map((transfer) => {
                  const status = resolveStatusBadge(transfer.status);
                  const currency =
                    currencyById.get(transfer.currencyId) ??
                    (transfer.currencyCode
                      ? { code: transfer.currencyCode, precision: 2 }
                      : { code: "N/A", precision: 2 });
                  const busy = actionTransferId === transfer.id;

                  return (
                    <TableRow key={transfer.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/operations/transfers/${transfer.id}`}
                          className="hover:underline"
                        >
                          {transfer.id.slice(0, 8)}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>
                            {transfer.sourceCounterpartyName ??
                              transfer.sourceCounterpartyId}
                          </div>
                          <div className="text-muted-foreground text-xs">
                            {transfer.sourceOperationalAccountLabel ??
                              transfer.sourceOperationalAccountId}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>
                            {transfer.destinationCounterpartyName ??
                              transfer.destinationCounterpartyId}
                          </div>
                          <div className="text-muted-foreground text-xs">
                            {transfer.destinationOperationalAccountLabel ??
                              transfer.destinationOperationalAccountId}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {transfer.kind === "cross_org"
                            ? "Cross-org"
                            : "Intra-org"}{" "}
                          · {transfer.settlementMode}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatMinorAmount(
                          transfer.amountMinor,
                          currency.code,
                          currency.precision,
                        )}
                      </TableCell>
                      <TableCell>
                        {transfer.ledgerOperationId ? (
                          <Link
                            href={`/operations/journal/${transfer.ledgerOperationId}`}
                            className="underline"
                          >
                            {transfer.ledgerOperationId.slice(0, 8)}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {formatDate(transfer.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          {transfer.status === "draft" ? (
                            <>
                              <Button
                                size="sm"
                                disabled={busy}
                                onClick={() => handleApprove(transfer)}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() => handleReject(transfer)}
                              >
                                Reject
                              </Button>
                            </>
                          ) : null}
                          {transfer.status === "pending" ? (
                            <>
                              <Button
                                size="sm"
                                disabled={busy}
                                onClick={() => handleSettle(transfer)}
                              >
                                Settle
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() => handleVoid(transfer)}
                              >
                                Void
                              </Button>
                            </>
                          ) : null}
                        </div>
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
