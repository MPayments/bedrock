"use client";

import { useRouter } from "next/navigation";
import type { Row as TanstackRow } from "@tanstack/react-table";
import * as React from "react";

import { toast } from "@bedrock/ui/components/sonner";

import {
  EntityTableShell,
  type EntityListResult,
} from "@/components/entities/entity-table-shell";
import { apiClient } from "@/lib/api-client";
import { executeMutation } from "@/lib/resources/http";
import type { TransferDto, TransferFormOptions } from "../lib/queries";
import { getColumns } from "./columns";

interface TransfersPageClientProps {
  promise: Promise<EntityListResult<TransferDto>>;
  currencies: TransferFormOptions["currencies"];
}

function createIdempotencyKey(prefix: string) {
  const random =
    typeof crypto !== "undefined"
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `${prefix}:${random}`;
}

export function TransfersPageClient({
  promise,
  currencies,
}: TransfersPageClientProps) {
  const router = useRouter();
  const [actionTransferId, setActionTransferId] = React.useState<string | null>(
    null,
  );

  const handleApprove = React.useCallback(
    async (transfer: TransferDto) => {
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
    },
    [router],
  );

  const handleReject = React.useCallback(
    async (transfer: TransferDto) => {
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
    },
    [router],
  );

  const handleSettle = React.useCallback(
    async (transfer: TransferDto) => {
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
    },
    [router],
  );

  const handleVoid = React.useCallback(
    async (transfer: TransferDto) => {
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
    },
    [router],
  );

  const columns = React.useMemo(
    () =>
      getColumns({
        currencies,
        actionTransferId,
        onApprove: handleApprove,
        onReject: handleReject,
        onSettle: handleSettle,
        onVoid: handleVoid,
      }),
    [
      actionTransferId,
      currencies,
      handleApprove,
      handleReject,
      handleSettle,
      handleVoid,
    ],
  );

  const handleRowDoubleClick = React.useCallback(
    (row: TanstackRow<TransferDto>) => {
      router.push(`/operations/transfers/${row.original.id}`);
    },
    [router],
  );

  return (
    <EntityTableShell
      promise={promise}
      columns={columns}
      initialState={{
        sorting: [{ id: "createdAt", desc: true }],
        columnVisibility: {
          query: false,
        },
      }}
      getRowId={(row) => row.id}
      onRowDoubleClick={handleRowDoubleClick}
    />
  );
}
