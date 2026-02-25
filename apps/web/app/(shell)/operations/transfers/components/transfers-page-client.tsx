"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@bedrock/ui/components/badge";
import { Button } from "@bedrock/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@bedrock/ui/components/dialog";
import { Input } from "@bedrock/ui/components/input";
import { Label } from "@bedrock/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bedrock/ui/components/select";
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
  formOptions: TransferFormOptions;
}

type SettlementMode = "immediate" | "pending";

type CreateTransferFormState = {
  sourceAccountId: string;
  destinationAccountId: string;
  amountMajor: string;
  memo: string;
  settlementMode: SettlementMode;
  timeoutSeconds: string;
};

const INITIAL_CREATE_FORM: CreateTransferFormState = {
  sourceAccountId: "",
  destinationAccountId: "",
  amountMajor: "",
  memo: "",
  settlementMode: "immediate",
  timeoutSeconds: "86400",
};

function resolveStatusBadge(
  status: TransferDto["status"],
): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } {
  if (status === "draft") return { label: "Черновик", variant: "outline" };
  if (status === "approved_pending_posting") {
    return { label: "В постинге", variant: "secondary" };
  }
  if (status === "pending") return { label: "Ожидает settle/void", variant: "secondary" };
  if (status === "settle_pending_posting") return { label: "Settle в постинге", variant: "secondary" };
  if (status === "void_pending_posting") return { label: "Void в постинге", variant: "secondary" };
  if (status === "posted") return { label: "Проведен", variant: "default" };
  if (status === "voided") return { label: "Аннулирован", variant: "outline" };
  if (status === "rejected") return { label: "Отклонен", variant: "outline" };
  return { label: "Ошибка", variant: "destructive" };
}

function majorToMinor(
  input: string,
  precision: number,
): { ok: true; value: string } | { ok: false; error: string } {
  const normalized = input.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    return { ok: false, error: "Сумма должна быть положительным числом" };
  }

  const [intPartRaw = "0", fracPartRaw = ""] = normalized.split(".");
  if (fracPartRaw.length > precision) {
    return {
      ok: false,
      error: `Слишком много знаков после запятой. Допустимо: ${precision}`,
    };
  }

  const intPart = intPartRaw.replace(/^0+(?=\d)/, "") || "0";
  const fracPart = fracPartRaw.padEnd(precision, "0");
  const scale = 10n ** BigInt(precision);
  const value = BigInt(intPart) * scale + BigInt(fracPart || "0");

  if (value <= 0n) {
    return { ok: false, error: "Сумма должна быть больше нуля" };
  }

  return { ok: true, value: value.toString() };
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

function createIdempotencyKey(prefix: string) {
  const random = typeof crypto !== "undefined" ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  return `${prefix}:${random}`;
}

export function TransfersPageClient({
  transfers,
  formOptions,
}: TransfersPageClientProps) {
  const router = useRouter();
  const [createForm, setCreateForm] = useState<CreateTransferFormState>(
    INITIAL_CREATE_FORM,
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [submittingCreate, setSubmittingCreate] = useState(false);
  const [actionTransferId, setActionTransferId] = useState<string | null>(null);

  const counterpartyById = useMemo(
    () => new Map(formOptions.counterparties.map((item) => [item.id, item.shortName])),
    [formOptions.counterparties],
  );
  const currencyById = useMemo(
    () =>
      new Map(
        formOptions.currencies.map((item) => [
          item.id,
          { code: item.code, precision: item.precision },
        ]),
      ),
    [formOptions.currencies],
  );
  const accountById = useMemo(
    () => new Map(formOptions.accounts.map((account) => [account.id, account])),
    [formOptions.accounts],
  );

  const selectedSourceAccount = createForm.sourceAccountId
    ? accountById.get(createForm.sourceAccountId) ?? null
    : null;
  const selectedDestinationAccount = createForm.destinationAccountId
    ? accountById.get(createForm.destinationAccountId) ?? null
    : null;
  const selectedCurrency = selectedSourceAccount
    ? currencyById.get(selectedSourceAccount.currencyId) ?? null
    : null;

  async function handleCreateTransfer() {
    if (!selectedSourceAccount || !selectedDestinationAccount) {
      toast.error("Выберите счет источника и назначения");
      return;
    }

    if (selectedSourceAccount.id === selectedDestinationAccount.id) {
      toast.error("Счета источника и назначения должны отличаться");
      return;
    }

    if (selectedSourceAccount.currencyId !== selectedDestinationAccount.currencyId) {
      toast.error("Счета должны быть в одной валюте");
      return;
    }

    const currency = currencyById.get(selectedSourceAccount.currencyId);
    if (!currency) {
      toast.error("Не найдена валюта выбранного счета");
      return;
    }

    const converted = majorToMinor(createForm.amountMajor, currency.precision);
    if (!converted.ok) {
      toast.error(converted.error);
      return;
    }

    setSubmittingCreate(true);

    const timeoutSeconds =
      createForm.settlementMode === "pending"
        ? Number(createForm.timeoutSeconds)
        : undefined;

    const result = await executeMutation<{ transferId: string }>({
      request: () =>
        apiClient.v1.transfers.drafts.$post({
          json: {
            sourceAccountId: selectedSourceAccount.id,
            destinationAccountId: selectedDestinationAccount.id,
            idempotencyKey: createIdempotencyKey("ui:transfer:create"),
            amountMinor: converted.value,
            memo: createForm.memo.trim() || undefined,
            settlementMode: createForm.settlementMode,
            timeoutSeconds:
              createForm.settlementMode === "pending" &&
              Number.isFinite(timeoutSeconds) &&
              timeoutSeconds &&
              timeoutSeconds > 0
                ? timeoutSeconds
                : undefined,
          },
        }),
      fallbackMessage: "Не удалось создать черновик перевода",
      parseData: async (response) => (await response.json()) as { transferId: string },
    });

    setSubmittingCreate(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    setCreateOpen(false);
    setCreateForm(INITIAL_CREATE_FORM);
    toast.success("Черновик перевода создан");
    router.push(`/operations/transfers/${result.data.transferId}`);
    router.refresh();
  }

  async function handleApprove(transfer: TransferDto) {
    setActionTransferId(transfer.id);
    const result = await executeMutation<{ transferId: string; ledgerOperationId: string }>({
      request: () =>
        apiClient.v1.transfers[":id"].approve.$post({
          param: { id: transfer.id },
          json: {
            occurredAt: new Date().toISOString(),
          },
        }),
      fallbackMessage: "Не удалось подтвердить перевод",
      parseData: async (response) =>
        (await response.json()) as { transferId: string; ledgerOperationId: string },
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
      parseData: async (response) => (await response.json()) as { transferId: string },
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
    const result = await executeMutation<{ transferId: string; ledgerOperationId: string }>({
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
        (await response.json()) as { transferId: string; ledgerOperationId: string },
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
    const result = await executeMutation<{ transferId: string; ledgerOperationId: string }>({
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
        (await response.json()) as { transferId: string; ledgerOperationId: string },
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
        <CardHeader className="border-b">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Переводы</CardTitle>
              <CardDescription>
                Создание, подтверждение и обработка intra/cross-org переводов.
              </CardDescription>
            </div>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger render={<Button size="sm" />}>
                Создать перевод
              </DialogTrigger>
              <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                  <DialogTitle>Новый перевод</DialogTitle>
                  <DialogDescription>
                    Перевод будет создан как черновик и потребует подтверждения checker-ом.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-3">
                  <div className="grid gap-1.5">
                    <Label>Счет источника</Label>
                    <Select
                      value={createForm.sourceAccountId}
                      onValueChange={(value) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          sourceAccountId: value ?? "",
                        }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Выберите счет источника" />
                      </SelectTrigger>
                      <SelectContent>
                        {formOptions.accounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.label} · {counterpartyById.get(account.counterpartyId) ?? account.counterpartyId}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-1.5">
                    <Label>Счет назначения</Label>
                    <Select
                      value={createForm.destinationAccountId}
                      onValueChange={(value) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          destinationAccountId: value ?? "",
                        }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Выберите счет назначения" />
                      </SelectTrigger>
                      <SelectContent>
                        {formOptions.accounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.label} · {counterpartyById.get(account.counterpartyId) ?? account.counterpartyId}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-1.5">
                    <Label>Сумма ({selectedCurrency?.code ?? "валюта"})</Label>
                    <Input
                      value={createForm.amountMajor}
                      onChange={(event) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          amountMajor: event.target.value,
                        }))
                      }
                      placeholder="Например 1000.25"
                    />
                  </div>

                  <div className="grid gap-1.5">
                    <Label>Settlement mode</Label>
                    <Select
                      value={createForm.settlementMode}
                      onValueChange={(value) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          settlementMode: value as SettlementMode,
                        }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="immediate">Immediate</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {createForm.settlementMode === "pending" ? (
                    <div className="grid gap-1.5">
                      <Label>Timeout (секунды)</Label>
                      <Input
                        type="number"
                        value={createForm.timeoutSeconds}
                        onChange={(event) =>
                          setCreateForm((prev) => ({
                            ...prev,
                            timeoutSeconds: event.target.value,
                          }))
                        }
                        min={1}
                        max={604800}
                      />
                    </div>
                  ) : null}

                  <div className="grid gap-1.5">
                    <Label>Мемо</Label>
                    <Input
                      value={createForm.memo}
                      onChange={(event) =>
                        setCreateForm((prev) => ({ ...prev, memo: event.target.value }))
                      }
                      placeholder="Комментарий (опционально)"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setCreateOpen(false)}
                    disabled={submittingCreate}
                  >
                    Отмена
                  </Button>
                  <Button onClick={handleCreateTransfer} disabled={submittingCreate}>
                    {submittingCreate ? "Создание..." : "Создать черновик"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
      </Card>

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
                  <TableCell colSpan={9} className="text-muted-foreground h-20 text-center">
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
                        <Link href={`/operations/transfers/${transfer.id}`} className="hover:underline">
                          {transfer.id.slice(0, 8)}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{transfer.sourceCounterpartyName ?? transfer.sourceCounterpartyId}</div>
                          <div className="text-muted-foreground text-xs">
                            {transfer.sourceAccountLabel ?? transfer.sourceAccountId}
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
                            {transfer.destinationAccountLabel ??
                              transfer.destinationAccountId}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {transfer.kind === "cross_org" ? "Cross-org" : "Intra-org"} ·{" "}
                          {transfer.settlementMode}
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
                              <Button size="sm" disabled={busy} onClick={() => handleApprove(transfer)}>
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
                              <Button size="sm" disabled={busy} onClick={() => handleSettle(transfer)}>
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
