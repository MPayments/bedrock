"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { Badge } from "@bedrock/sdk-ui/components/badge";

import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { formatDate } from "@/lib/format";
import type { FinanceDealListItem } from "@/features/treasury/deals/lib/queries";
import {
  formatDealNextAction,
  formatDealWorkflowMessage,
  getFinanceDealBlockerStateOptions,
  getFinanceDealQueueLabel,
  getFinanceDealQueueOptions,
  getFinanceDealQueueVariant,
  getFinanceDealStageLabel,
  getFinanceDealStageOptions,
  getFinanceDealStatusLabel,
  getFinanceDealStatusOptions,
  getFinanceDealStatusVariant,
  getFinanceDealTypeLabel,
  getFinanceDealTypeOptions,
} from "@/features/treasury/deals/labels";

import { FinanceDealRowActions } from "./row-actions";

export const columns: ColumnDef<FinanceDealListItem>[] = [
  {
    accessorKey: "applicantName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Заявитель" />
    ),
    cell: ({ row }) => row.original.applicantName ?? "—",
    meta: {
      label: "Заявитель",
      placeholder: "Поиск по заявителю...",
      variant: "text",
    },
    enableColumnFilter: true,
    enableSorting: true,
  },
  {
    accessorKey: "internalEntityName",
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        label="Внутренняя организация"
      />
    ),
    cell: ({ row }) => row.original.internalEntityName ?? "—",
    meta: {
      label: "Внутренняя организация",
      placeholder: "Поиск по организации...",
      variant: "text",
    },
    enableColumnFilter: true,
    enableSorting: true,
  },
  {
    accessorKey: "queue",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Очередь" />
    ),
    cell: ({ row }) => (
      <div className="space-y-1">
        <Badge variant={getFinanceDealQueueVariant(row.original.queue)}>
          {getFinanceDealQueueLabel(row.original.queue)}
        </Badge>
        <div className="text-xs text-muted-foreground">
          {formatDealWorkflowMessage(row.original.queueReason)}
        </div>
      </div>
    ),
    meta: {
      label: "Очередь",
      options: getFinanceDealQueueOptions(),
      variant: "select",
    },
    enableColumnFilter: true,
    enableSorting: true,
  },
  {
    accessorKey: "stage",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Этап" />
    ),
    cell: ({ row }) => (
      <div className="space-y-1">
        <div className="font-medium">{getFinanceDealStageLabel(row.original.stage)}</div>
        <div className="text-xs text-muted-foreground">
          {row.original.stageReason}
        </div>
      </div>
    ),
    meta: {
      label: "Этап",
      options: getFinanceDealStageOptions(),
      variant: "select",
    },
    enableColumnFilter: true,
    enableSorting: false,
  },
  {
    accessorKey: "type",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Тип сделки" />
    ),
    cell: ({ row }) => getFinanceDealTypeLabel(row.original.type),
    meta: {
      label: "Тип сделки",
      options: getFinanceDealTypeOptions(),
      variant: "select",
    },
    enableColumnFilter: true,
    enableSorting: true,
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Статус" />
    ),
    cell: ({ row }) => (
      <div className="space-y-1">
        <Badge variant={getFinanceDealStatusVariant(row.original.status)}>
          {getFinanceDealStatusLabel(row.original.status)}
        </Badge>
        {row.original.blockingReasons.length > 0 ? (
          <div className="text-xs text-red-600">
            Блокеры: {row.original.blockingReasons.length}
          </div>
        ) : null}
      </div>
    ),
    meta: {
      label: "Статус",
      options: getFinanceDealStatusOptions(),
      variant: "select",
    },
    enableColumnFilter: true,
    enableSorting: true,
  },
  {
    id: "blockerState",
    accessorFn: (row) => row.blockerState,
    header: () => null,
    cell: () => null,
    meta: {
      label: "Блокеры",
      options: getFinanceDealBlockerStateOptions(),
      variant: "select",
    },
    enableColumnFilter: true,
    enableHiding: false,
    enableSorting: false,
  },
  {
    accessorKey: "nextAction",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Следующий шаг" />
    ),
    cell: ({ row }) => (
      <div className="max-w-72 text-sm text-foreground">
        {formatDealNextAction(row.original.nextAction)}
      </div>
    ),
    enableSorting: false,
  },
  {
    id: "executionSummary",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Исполнение" />
    ),
    cell: ({ row }) => (
      <div className="space-y-1 text-sm">
        <div>
          {row.original.executionSummary.doneLegCount} /{" "}
          {row.original.executionSummary.totalLegCount}
        </div>
        {row.original.executionSummary.blockedLegCount > 0 ? (
          <div className="text-xs text-red-600">
            Блокировано: {row.original.executionSummary.blockedLegCount}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">Без блокеров</div>
        )}
      </div>
    ),
    enableSorting: false,
  },
  {
    id: "documentSummary",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Документы" />
    ),
    cell: ({ row }) => (
      <div className="space-y-1 text-sm text-muted-foreground">
        <div>Документы: {row.original.documentSummary.formalDocumentCount}</div>
        <div>Вложения: {row.original.documentSummary.attachmentCount}</div>
      </div>
    ),
    enableSorting: false,
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Создана" />
    ),
    cell: ({ row }) => formatDate(row.original.createdAt),
    enableSorting: true,
  },
  {
    id: "actions",
    cell: ({ row }) => (
      <FinanceDealRowActions
        applicantName={row.original.applicantName}
        dealId={row.original.dealId}
      />
    ),
    size: 48,
  },
];
