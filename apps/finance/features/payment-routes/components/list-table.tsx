"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef, Row as TanstackRow } from "@tanstack/react-table";

import { Badge } from "@bedrock/sdk-ui/components/badge";
import { EntityTableShell } from "@bedrock/sdk-tables-ui/components/entity-table-shell";
import { DataTableColumnHeader } from "@bedrock/sdk-tables-ui/components/data-table-column-header";

import { formatDate } from "@/lib/format";
import type { EntityListResult } from "@bedrock/sdk-tables-ui/components/entity-table-shell";

import { formatCurrencyMinorAmount } from "../lib/format";
import type {
  PaymentRouteConstructorOptions,
  PaymentRouteTemplateListItem,
} from "../lib/queries";
import { PaymentRouteRowActions } from "./row-actions";

type PaymentRoutesTableProps = {
  currencies: PaymentRouteConstructorOptions["currencies"];
  promise: Promise<EntityListResult<PaymentRouteTemplateListItem>>;
};

function buildColumns(
  currencies: PaymentRouteConstructorOptions["currencies"],
): ColumnDef<PaymentRouteTemplateListItem>[] {
  function getCurrency(currencyId: string) {
    return currencies.find((currency) => currency.id === currencyId) ?? null;
  }

  return [
    {
      accessorKey: "name",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Маршрут" />,
      cell: ({ row }) => (
        <div className="space-y-1">
          <div className="font-medium">{row.original.name}</div>
          <div className="text-xs text-muted-foreground">
            {row.original.sourceParticipant.displayName} →{" "}
            {row.original.destinationParticipant.displayName}
          </div>
        </div>
      ),
      meta: {
        label: "Маршрут",
        placeholder: "Поиск по названию...",
        variant: "text",
      },
      enableColumnFilter: true,
      enableSorting: true,
    },
    {
      id: "sourceParticipant",
      header: () => "Клиент",
      cell: ({ row }) => row.original.sourceParticipant.displayName,
      enableSorting: false,
    },
    {
      id: "destinationParticipant",
      header: () => "Бенефициар",
      cell: ({ row }) => row.original.destinationParticipant.displayName,
      enableSorting: false,
    },
    {
      id: "currencies",
      header: () => "Валюты",
      cell: ({ row }) => {
        const currencyIn = getCurrency(row.original.currencyInId);
        const currencyOut = getCurrency(row.original.currencyOutId);

        return `${currencyIn?.code ?? "?"} → ${currencyOut?.code ?? "?"}`;
      },
      enableSorting: false,
    },
    {
      accessorKey: "hopCount",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Шаги" />,
      cell: ({ row }) => row.original.hopCount,
      enableSorting: false,
    },
    {
      id: "lastFee",
      header: () => "Последняя комиссия",
      cell: ({ row }) => {
        const feeTotals = row.original.lastCalculation?.feeTotals ?? [];

        if (feeTotals.length === 0) {
          return "—";
        }

        return feeTotals
          .map((feeTotal) =>
            formatCurrencyMinorAmount(
              feeTotal.amountMinor,
              getCurrency(feeTotal.currencyId),
            ),
          )
          .join(" + ");
      },
      enableSorting: false,
    },
    {
      accessorKey: "status",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Статус" />,
      cell: ({ row }) => (
        <Badge variant={row.original.status === "active" ? "outline" : "secondary"}>
          {row.original.status === "active" ? "Активный" : "Архив"}
        </Badge>
      ),
      meta: {
        label: "Статус",
        options: [
          { label: "Активный", value: "active" },
          { label: "Архив", value: "archived" },
        ],
        variant: "select",
      },
      enableColumnFilter: true,
      enableSorting: true,
    },
    {
      accessorKey: "updatedAt",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Обновлен" />,
      cell: ({ row }) => formatDate(row.original.updatedAt),
      enableSorting: true,
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <PaymentRouteRowActions
          routeId={row.original.id}
          routeName={row.original.name}
        />
      ),
      size: 48,
    },
  ];
}

export function PaymentRoutesTable({
  currencies,
  promise,
}: PaymentRoutesTableProps) {
  const router = useRouter();
  const columns = React.useMemo(() => buildColumns(currencies), [currencies]);

  return (
    <EntityTableShell
      promise={promise}
      columns={columns}
      getRowId={(row) => row.id}
      initialState={{
        sorting: [{ id: "updatedAt", desc: true }],
      }}
      onRowDoubleClick={(row: TanstackRow<PaymentRouteTemplateListItem>) => {
        router.push(`/routes/constructor/${row.original.id}`);
      }}
    />
  );
}
