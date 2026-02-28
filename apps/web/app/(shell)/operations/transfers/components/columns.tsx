"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";

import { Badge } from "@bedrock/ui/components/badge";
import { Button } from "@bedrock/ui/components/button";

import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { formatDate } from "@/lib/format";
import type { TransferDto, TransferFormOptions } from "../lib/queries";

const STATUS_FILTER_OPTIONS = [
  { label: "Черновик", value: "draft" },
  { label: "В проведении", value: "approved_pending_posting" },
  { label: "Ожидает settle/void", value: "pending" },
  { label: "Settle в проведении", value: "settle_pending_posting" },
  { label: "Void в проведении", value: "void_pending_posting" },
  { label: "Проведен", value: "posted" },
  { label: "Аннулирован", value: "voided" },
  { label: "Отклонен", value: "rejected" },
  { label: "Ошибка", value: "failed" },
];

const KIND_FILTER_OPTIONS = [
  { label: "Intra-org", value: "intra_org" },
  { label: "Cross-org", value: "cross_org" },
];

const SETTLEMENT_MODE_FILTER_OPTIONS = [
  { label: "Immediate", value: "immediate" },
  { label: "Pending", value: "pending" },
];

function resolveStatusBadge(status: TransferDto["status"]): {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
} {
  if (status === "draft") return { label: "Черновик", variant: "outline" };
  if (status === "approved_pending_posting") {
    return { label: "В постинге", variant: "secondary" };
  }
  if (status === "pending") {
    return { label: "Ожидает settle/void", variant: "secondary" };
  }
  if (status === "settle_pending_posting") {
    return { label: "Settle в постинге", variant: "secondary" };
  }
  if (status === "void_pending_posting") {
    return { label: "Void в постинге", variant: "secondary" };
  }
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

type TransferColumnsOptions = {
  currencies: TransferFormOptions["currencies"];
  actionTransferId: string | null;
  onApprove: (transfer: TransferDto) => Promise<void>;
  onReject: (transfer: TransferDto) => Promise<void>;
  onSettle: (transfer: TransferDto) => Promise<void>;
  onVoid: (transfer: TransferDto) => Promise<void>;
};

export function getColumns({
  currencies,
  actionTransferId,
  onApprove,
  onReject,
  onSettle,
  onVoid,
}: TransferColumnsOptions): ColumnDef<TransferDto>[] {
  const currencyById = new Map(
    currencies.map((item) => [
      item.id,
      { code: item.code, precision: item.precision },
    ]),
  );

  return [
    {
      id: "query",
      accessorFn: (row) =>
        [
          row.id,
          row.memo ?? "",
          row.idempotencyKey,
          row.ledgerOperationId ?? "",
          row.sourceCounterpartyName ?? row.sourceCounterpartyId,
          row.destinationCounterpartyName ?? row.destinationCounterpartyId,
          row.sourceOperationalAccountLabel ?? row.sourceOperationalAccountId,
          row.destinationOperationalAccountLabel ??
            row.destinationOperationalAccountId,
          row.currencyCode ?? "",
        ]
          .filter((value) => value.length > 0)
          .join(" "),
      header: () => null,
      cell: () => null,
      meta: {
        label: "Поиск",
        variant: "text",
        placeholder: "Поиск по ID, memo, контрагенту...",
      },
      enableColumnFilter: true,
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "id",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="ID" />
      ),
      cell: ({ row }) => (
        <Link
          href={`/operations/transfers/${row.original.id}`}
          className="font-mono text-xs hover:underline"
        >
          {row.original.id.slice(0, 8)}
        </Link>
      ),
      enableSorting: false,
      enableHiding: true,
    },
    {
      id: "source",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Источник" />
      ),
      cell: ({ row }) => (
        <div className="text-sm">
          <div>
            {row.original.sourceCounterpartyName ??
              row.original.sourceCounterpartyId}
          </div>
          <div className="text-muted-foreground text-xs">
            {row.original.sourceOperationalAccountLabel ??
              row.original.sourceOperationalAccountId}
          </div>
        </div>
      ),
      enableSorting: false,
      enableHiding: true,
    },
    {
      id: "destination",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Назначение" />
      ),
      cell: ({ row }) => (
        <div className="text-sm">
          <div>
            {row.original.destinationCounterpartyName ??
              row.original.destinationCounterpartyId}
          </div>
          <div className="text-muted-foreground text-xs">
            {row.original.destinationOperationalAccountLabel ??
              row.original.destinationOperationalAccountId}
          </div>
        </div>
      ),
      enableSorting: false,
      enableHiding: true,
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Статус" />
      ),
      cell: ({ row }) => {
        const status = resolveStatusBadge(row.original.status);
        return <Badge variant={status.variant}>{status.label}</Badge>;
      },
      meta: {
        label: "Статус",
        variant: "multiSelect",
        options: STATUS_FILTER_OPTIONS,
      },
      enableColumnFilter: true,
      enableSorting: false,
      enableHiding: true,
    },
    {
      accessorKey: "kind",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Тип" />
      ),
      cell: ({ row }) => (
        <Badge variant="outline">
          {row.original.kind === "cross_org" ? "Cross-org" : "Intra-org"}
        </Badge>
      ),
      meta: {
        label: "Тип",
        variant: "multiSelect",
        options: KIND_FILTER_OPTIONS,
      },
      enableColumnFilter: true,
      enableSorting: false,
      enableHiding: true,
    },
    {
      accessorKey: "settlementMode",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Settlement" />
      ),
      cell: ({ row }) => (
        <Badge variant="outline">
          {row.original.settlementMode === "pending" ? "Pending" : "Immediate"}
        </Badge>
      ),
      meta: {
        label: "Settlement",
        variant: "multiSelect",
        options: SETTLEMENT_MODE_FILTER_OPTIONS,
      },
      enableColumnFilter: true,
      enableSorting: false,
      enableHiding: true,
    },
    {
      id: "amountMinor",
      accessorFn: (row) => row.amountMinor,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Сумма" />
      ),
      cell: ({ row }) => {
        const currency =
          currencyById.get(row.original.currencyId) ??
          (row.original.currencyCode
            ? { code: row.original.currencyCode, precision: 2 }
            : { code: "N/A", precision: 2 });

        return (
          <div className="text-right">
            {formatMinorAmount(
              row.original.amountMinor,
              currency.code,
              currency.precision,
            )}
          </div>
        );
      },
      enableSorting: false,
      enableHiding: true,
    },
    {
      accessorKey: "ledgerOperationId",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Операция" />
      ),
      cell: ({ row }) =>
        row.original.ledgerOperationId ? (
          <Link
            href={`/operations/journal/${row.original.ledgerOperationId}`}
            className="font-mono text-xs underline"
          >
            {row.original.ledgerOperationId.slice(0, 8)}
          </Link>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      enableSorting: false,
      enableHiding: true,
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Создан" />
      ),
      cell: ({ row }) => (
        <div className="text-xs">{formatDate(row.original.createdAt)}</div>
      ),
      enableSorting: true,
      enableHiding: true,
    },
    {
      id: "actions",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Действия" />
      ),
      cell: ({ row }) => {
        const transfer = row.original;
        const busy = actionTransferId === transfer.id;

        return (
          <div className="flex justify-end gap-2">
            {transfer.status === "draft" ? (
              <>
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => void onApprove(transfer)}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void onReject(transfer)}
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
                  onClick={() => void onSettle(transfer)}
                >
                  Settle
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void onVoid(transfer)}
                >
                  Void
                </Button>
              </>
            ) : null}
          </div>
        );
      },
      enableSorting: false,
      enableHiding: false,
      size: 180,
    },
  ];
}
