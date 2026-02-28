"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";

import { Badge } from "@bedrock/ui/components/badge";

import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { formatDate } from "@/lib/format";
import type { DocumentDto } from "@/app/(shell)/operations/lib/queries";

function badgeVariant(
  value: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (value === "posted" || value === "approved") return "default";
  if (value === "failed" || value === "rejected") return "destructive";
  if (value === "posting" || value === "pending") return "secondary";
  return "outline";
}

export function getDocumentColumns(): ColumnDef<DocumentDto>[] {
  return [
    {
      id: "query",
      accessorFn: (row) =>
        [
          row.docNo,
          row.id,
          row.docType,
          row.title,
          row.memo ?? "",
          row.currency ?? "",
          row.counterpartyId ?? "",
          row.customerId ?? "",
          row.operationalAccountId ?? "",
        ]
          .filter((value) => value.length > 0)
          .join(" "),
      header: () => null,
      cell: () => null,
      meta: {
        label: "Поиск",
        variant: "text",
        placeholder: "Поиск по номеру, типу, заголовку...",
      },
      enableColumnFilter: true,
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "docNo",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Документ" />
      ),
      cell: ({ row }) => (
        <div className="space-y-1">
          <Link
            href={`/operations/${row.original.docType}/${row.original.id}`}
            className="font-medium hover:underline"
          >
            {row.original.docNo}
          </Link>
          <div className="text-muted-foreground text-xs">{row.original.title}</div>
        </div>
      ),
      enableSorting: false,
    },
    {
      accessorKey: "docType",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Тип" />
      ),
      cell: ({ row }) => <Badge variant="outline">{row.original.docType}</Badge>,
      meta: {
        label: "Тип",
        variant: "multiSelect",
        options: [],
      },
      enableColumnFilter: true,
      enableSorting: false,
    },
    {
      accessorKey: "occurredAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Дата" />
      ),
      cell: ({ row }) => formatDate(row.original.occurredAt),
      enableSorting: true,
    },
    {
      accessorKey: "approvalStatus",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Согласование" />
      ),
      cell: ({ row }) => (
        <Badge variant={badgeVariant(row.original.approvalStatus)}>
          {row.original.approvalStatus}
        </Badge>
      ),
      meta: {
        label: "Согласование",
        variant: "multiSelect",
        options: [
          { label: "Не нужно", value: "not_required" },
          { label: "Ожидает", value: "pending" },
          { label: "Согласован", value: "approved" },
          { label: "Отклонен", value: "rejected" },
        ],
      },
      enableColumnFilter: true,
      enableSorting: false,
    },
    {
      accessorKey: "postingStatus",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Проведение" />
      ),
      cell: ({ row }) => (
        <Badge variant={badgeVariant(row.original.postingStatus)}>
          {row.original.postingStatus}
        </Badge>
      ),
      meta: {
        label: "Проведение",
        variant: "multiSelect",
        options: [
          { label: "Не требуется", value: "not_required" },
          { label: "Не проведен", value: "unposted" },
          { label: "В обработке", value: "posting" },
          { label: "Проведен", value: "posted" },
          { label: "Ошибка", value: "failed" },
        ],
      },
      enableColumnFilter: true,
      enableSorting: false,
    },
    {
      accessorKey: "lifecycleStatus",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Lifecycle" />
      ),
      cell: ({ row }) => (
        <Badge variant={badgeVariant(row.original.lifecycleStatus)}>
          {row.original.lifecycleStatus}
        </Badge>
      ),
      meta: {
        label: "Lifecycle",
        variant: "multiSelect",
        options: [
          { label: "Активен", value: "active" },
          { label: "Отменен", value: "cancelled" },
          { label: "Voided", value: "voided" },
          { label: "Archived", value: "archived" },
        ],
      },
      enableColumnFilter: true,
      enableSorting: false,
    },
    {
      accessorKey: "postingOperationId",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Ledger" />
      ),
      cell: ({ row }) =>
        row.original.postingOperationId ? (
          <Link
            href={`/operations/journal/${row.original.postingOperationId}`}
            className="font-mono text-xs hover:underline"
          >
            {row.original.postingOperationId.slice(0, 8)}
          </Link>
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        ),
      enableSorting: false,
    },
  ];
}
