"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { ExternalLink } from "lucide-react";

import { Badge } from "@bedrock/sdk-ui/components/badge";
import { DataTableColumnHeader } from "@bedrock/sdk-tables-ui/components/data-table-column-header";
import { formatCompactId } from "@bedrock/shared/core/uuid";

import type { TreasuryOperationRow } from "../lib/queries";
import { formatDate } from "@/lib/format";
import {
  STEP_STATE_LABELS,
  stepBadgeVariant,
} from "@/features/treasury/steps/lib/step-helpers";

const KIND_LABELS: Record<TreasuryOperationRow["kind"], string> = {
  payin: "Входящий платёж",
  fx_conversion: "Конверсия",
  payout: "Выплата",
  intracompany_transfer: "Внутренний перевод",
  intercompany_funding: "Межкомпанейское фондирование",
  internal_transfer: "Собственный перевод",
};

const PURPOSE_LABELS: Record<TreasuryOperationRow["purpose"], string> = {
  deal_leg: "Шаг сделки",
  pre_fund: "Пре-фондирование",
  standalone_payment: "Отдельная операция",
};

const STATE_FILTER_OPTIONS: Array<{
  label: string;
  value: TreasuryOperationRow["state"];
}> = (
  [
    "draft",
    "scheduled",
    "pending",
    "processing",
    "completed",
    "failed",
    "returned",
    "cancelled",
    "skipped",
  ] as const
).map((state) => ({ label: STEP_STATE_LABELS[state], value: state }));

const PURPOSE_FILTER_OPTIONS: Array<{
  label: string;
  value: TreasuryOperationRow["purpose"];
}> = (["deal_leg", "pre_fund", "standalone_payment"] as const).map(
  (purpose) => ({ label: PURPOSE_LABELS[purpose], value: purpose }),
);

function formatAmount(
  amount: string | null,
  currencyId: string,
): string {
  if (!amount) return "—";
  // Amount is in minor units as a decimal string — render as-is with a short
  // currency tag (full currency catalog resolution happens on the detail
  // page / step card).
  return `${amount} · ${formatCompactId(currencyId)}`;
}

export const columns: ColumnDef<TreasuryOperationRow>[] = [
  {
    accessorKey: "kind",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Тип" />
    ),
    cell: ({ row }) => (
      <Badge variant="outline">{KIND_LABELS[row.original.kind]}</Badge>
    ),
    enableSorting: false,
  },
  {
    accessorKey: "state",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Статус" />
    ),
    cell: ({ row }) => (
      <Badge variant={stepBadgeVariant(row.original.state)}>
        {STEP_STATE_LABELS[row.original.state]}
      </Badge>
    ),
    meta: {
      label: "Статус",
      options: STATE_FILTER_OPTIONS,
      variant: "multiSelect",
    },
    enableColumnFilter: true,
    enableSorting: false,
  },
  {
    accessorKey: "purpose",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Контекст" />
    ),
    cell: ({ row }) => {
      const step = row.original;
      if (step.purpose === "deal_leg" && step.dealId) {
        return (
          <Link
            href={`/treasury/deals/${step.dealId}`}
            className="inline-flex items-center gap-1 text-sm underline-offset-2 hover:underline"
          >
            Сделка #{formatCompactId(step.dealId)}
            <ExternalLink className="size-3" />
          </Link>
        );
      }
      return (
        <span className="text-sm text-muted-foreground">
          {PURPOSE_LABELS[step.purpose]}
        </span>
      );
    },
    meta: {
      label: "Контекст",
      options: PURPOSE_FILTER_OPTIONS,
      variant: "select",
    },
    enableColumnFilter: true,
    enableSorting: false,
  },
  {
    id: "amounts",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Сумма" />
    ),
    cell: ({ row }) => (
      <div className="space-y-1 text-sm">
        <div>
          {formatAmount(
            row.original.fromAmountMinor,
            row.original.fromCurrencyId,
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          →{" "}
          {formatAmount(
            row.original.toAmountMinor,
            row.original.toCurrencyId,
          )}
        </div>
      </div>
    ),
    enableSorting: false,
  },
  {
    id: "attempts",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Попыток" />
    ),
    cell: ({ row }) => (
      <span className="text-sm tabular-nums">
        {row.original.attempts.length}
      </span>
    ),
    enableSorting: false,
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Создана" />
    ),
    cell: ({ row }) => formatDate(row.original.createdAt),
    meta: {
      label: "Создана",
      variant: "dateRange",
    },
    enableColumnFilter: true,
    enableSorting: true,
  },
];
