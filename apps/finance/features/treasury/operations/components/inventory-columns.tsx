"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { ExternalLink } from "lucide-react";

import { Badge } from "@bedrock/sdk-ui/components/badge";
import { DataTableColumnHeader } from "@bedrock/sdk-tables-ui/components/data-table-column-header";
import { formatCompactId } from "@bedrock/shared/core/uuid";
import {
  formatFractionDecimal,
  minorToAmountString,
} from "@bedrock/shared/money";

import { formatDate } from "@/lib/format";
import { listCurrencyOptions } from "@/features/treasury/steps/lib/currency-options";
import { resolvePartyDisplayName } from "@/features/treasury/steps/lib/party-options";

import type { TreasuryInventoryPositionRow } from "../lib/queries";

const INVENTORY_STATE_LABELS: Record<TreasuryInventoryPositionRow["state"], string> = {
  cancelled: "Отменена",
  exhausted: "Исчерпана",
  open: "Доступна",
};
const RECONCILIATION_LABELS: Record<
  TreasuryInventoryPositionRow["ledger"]["reconciliationStatus"],
  string
> = {
  inventory_exceeds_balance: "Инвентарь больше баланса",
  matched: "С балансом",
  missing_balance: "Нет ledger-баланса",
};

function stateBadgeVariant(
  state: TreasuryInventoryPositionRow["state"],
): "default" | "destructive" | "outline" | "secondary" {
  switch (state) {
    case "open":
      return "default";
    case "cancelled":
      return "secondary";
    default:
      return "outline";
  }
}

function useCurrencyCodes() {
  const [codes, setCodes] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    let cancelled = false;
    listCurrencyOptions().then((options) => {
      if (!cancelled) {
        setCodes(new Map(options.map((option) => [option.id, option.code])));
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return codes;
}

function AmountCell({
  amountMinor,
  currencyId,
}: {
  amountMinor: string;
  currencyId: string;
}) {
  const codes = useCurrencyCodes();
  const code = codes.get(currencyId);
  if (!code) return <span className="tabular-nums">{amountMinor}</span>;
  return (
    <span className="tabular-nums">
      {minorToAmountString(amountMinor, { currency: code })} {code}
    </span>
  );
}

function CostRateCell({ position }: { position: TreasuryInventoryPositionRow }) {
  const codes = useCurrencyCodes();
  const costCurrency = codes.get(position.costCurrencyId);
  const acquiredCurrency = codes.get(position.currencyId);
  const rate = formatFractionDecimal(
    position.costAmountMinor,
    position.acquiredAmountMinor,
    {
      scale: 8,
      trimTrailingZeros: true,
    },
  );
  return (
    <span className="text-sm tabular-nums">
      {costCurrency && acquiredCurrency
        ? `1 ${acquiredCurrency} = ${rate} ${costCurrency}`
        : rate}
    </span>
  );
}

function OwnerCell({ ownerPartyId }: { ownerPartyId: string }) {
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    resolvePartyDisplayName(ownerPartyId).then((resolved) => {
      if (!cancelled) setLabel(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [ownerPartyId]);
  return <span className="text-sm">{label ?? `#${formatCompactId(ownerPartyId)}`}</span>;
}

export const inventoryColumns: ColumnDef<TreasuryInventoryPositionRow>[] = [
  {
    accessorKey: "currencyId",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Валюта" />
    ),
    cell: ({ row }) => (
      <AmountCell
        amountMinor={row.original.acquiredAmountMinor}
        currencyId={row.original.currencyId}
      />
    ),
    enableSorting: false,
  },
  {
    accessorKey: "availableAmountMinor",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Доступно" />
    ),
    cell: ({ row }) => (
      <AmountCell
        amountMinor={row.original.availableAmountMinor}
        currencyId={row.original.currencyId}
      />
    ),
    enableSorting: false,
  },
  {
    id: "cost",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Себестоимость" />
    ),
    cell: ({ row }) => (
      <div className="space-y-1">
        <AmountCell
          amountMinor={row.original.costAmountMinor}
          currencyId={row.original.costCurrencyId}
        />
        <div className="text-muted-foreground text-xs">
          <CostRateCell position={row.original} />
        </div>
      </div>
    ),
    enableSorting: false,
  },
  {
    accessorKey: "ownerPartyId",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Владелец" />
    ),
    cell: ({ row }) => <OwnerCell ownerPartyId={row.original.ownerPartyId} />,
    enableSorting: false,
  },
  {
    accessorKey: "state",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Статус" />
    ),
    cell: ({ row }) => (
      <Badge variant={stateBadgeVariant(row.original.state)}>
        {INVENTORY_STATE_LABELS[row.original.state]}
      </Badge>
    ),
    enableSorting: false,
  },
  {
    id: "ledger",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Баланс" />
    ),
    cell: ({ row }) => (
      <div className="space-y-1">
        <div className="text-xs text-muted-foreground">
          Баланс:{" "}
          {minorToAmountString(row.original.ledger.ledgerAvailableMinor, {
            currency: row.original.ledger.currency,
          })}{" "}
          {row.original.ledger.currency}
        </div>
        <Badge
          variant={
            row.original.ledger.reconciliationStatus === "matched"
              ? "outline"
              : "destructive"
          }
        >
          {RECONCILIATION_LABELS[row.original.ledger.reconciliationStatus]}
        </Badge>
      </div>
    ),
    enableSorting: false,
  },
  {
    accessorKey: "sourceOrderId",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Источник" />
    ),
    cell: ({ row }) => (
      <Link
        href={`/treasury/operations/orders/${row.original.sourceOrderId}`}
        className="inline-flex items-center gap-1 text-sm underline-offset-2 hover:underline"
      >
        Ордер #{formatCompactId(row.original.sourceOrderId)}
        <ExternalLink className="size-3" />
      </Link>
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
];
