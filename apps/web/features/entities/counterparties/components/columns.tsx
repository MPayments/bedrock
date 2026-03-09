"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@multihansa/ui/components/badge";
import { Users, Vault } from "lucide-react";

import { DataTableColumnHeader } from "@/components/data-table/column-header";
import type { SerializedCounterparty } from "@/features/entities/counterparties/lib/types";
import { formatDate } from "@/lib/format";
import {
  COUNTERPARTY_COUNTRY_OPTIONS,
  getCountryPresentation,
} from "../lib/countries";
import {
  getCounterpartyGroupDisplayLabel,
  getCounterpartyGroupPresentation,
} from "../lib/group-label";
import type { CounterpartyGroupOption } from "../lib/queries";
import { CounterpartyRowActions } from "./counterparty-row-actions";

type CounterpartyColumnsOptions = {
  detailsBasePath?: string;
  groupFilterOptions?: CounterpartyGroupOption[];
  lockedGroupFilterIds?: string[];
};

function kindLabel(kind: string) {
  if (kind === "individual") return "Физ. лицо";
  return "Юр. лицо";
}

export function getColumns(
  groupOptions: CounterpartyGroupOption[],
  options: CounterpartyColumnsOptions = {},
): ColumnDef<SerializedCounterparty>[] {
  const {
    detailsBasePath = "/entities/counterparties",
    groupFilterOptions: rawGroupFilterOptions,
    lockedGroupFilterIds,
  } = options;
  const groupFilterSource = rawGroupFilterOptions ?? groupOptions;
  const countryFilterOptions = COUNTERPARTY_COUNTRY_OPTIONS.map((country) => ({
    value: country.value,
    label: country.label,
  }));
  const groupFilterOptions = groupFilterSource
    .map((group) => {
      const presentation = getCounterpartyGroupPresentation(group.name);
      return {
        value: group.id,
        label: getCounterpartyGroupDisplayLabel(group),
        icon:
          presentation.icon === "vault"
            ? (props: React.SVGProps<SVGSVGElement>) => <Vault {...props} />
            : presentation.icon === "users"
              ? (props: React.SVGProps<SVGSVGElement>) => <Users {...props} />
              : undefined,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
  const groupPresentationById = new Map(
    groupOptions.map((group) => [
      group.id,
      {
        ...getCounterpartyGroupPresentation(group.name),
        label: getCounterpartyGroupDisplayLabel(group),
      },
    ]),
  );

  return [
    {
      accessorKey: "shortName",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Краткое имя" />
      ),
      enableColumnFilter: true,
      enableSorting: true,
      enableHiding: true,
    },
    {
      accessorKey: "fullName",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Полное имя" />
      ),
      meta: {
        label: "Полное имя",
        variant: "text",
        placeholder: "Поиск по полному имени...",
      },
      enableColumnFilter: true,
      enableSorting: true,
      enableHiding: true,
    },
    {
      accessorKey: "kind",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Тип" />
      ),
      cell: ({ row }) => {
        const kind = row.getValue<string>("kind");
        return <Badge variant="secondary">{kindLabel(kind)}</Badge>;
      },
      meta: {
        label: "Тип",
        variant: "multiSelect",
        options: [
          { value: "legal_entity", label: "Юр. лицо" },
          { value: "individual", label: "Физ. лицо" },
        ],
      },
      enableColumnFilter: true,
      enableSorting: true,
      enableHiding: true,
    },
    {
      accessorKey: "country",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Страна" />
      ),
      cell: ({ row }) => {
        const rawCountry = row.getValue<string | null>("country");
        const presentation = getCountryPresentation(rawCountry);

        if (presentation) {
          return presentation.label;
        }

        if (typeof rawCountry === "string" && rawCountry.trim().length > 0) {
          return rawCountry.trim().toUpperCase();
        }

        return "—";
      },
      meta: {
        label: "Страна",
        variant: "multiSelect",
        options: countryFilterOptions,
      },
      enableColumnFilter: true,
      enableSorting: true,
      enableHiding: true,
    },
    {
      accessorKey: "customerId",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Customer ID" />
      ),
      cell: ({ row }) => row.getValue("customerId") || "—",
      enableColumnFilter: false,
      enableSorting: false,
      enableHiding: true,
    },
    {
      id: "groupIds",
      accessorFn: (row) => row.groupIds.length,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Группы"/>
      ),
      meta: {
        label: "Группы",
        variant: "multiSelect",
        options: groupFilterOptions,
        lockedFilterValues: lockedGroupFilterIds,
      },
      cell: ({ row }) => {
        if (row.original.groupIds.length === 0) {
          return "—";
        }

        return (
          <div className="flex flex-wrap gap-1">
            {row.original.groupIds.map((groupId) => {
              const presentation = groupPresentationById.get(groupId);
              const groupName = presentation?.label ?? "Неизвестная группа";
              const GroupIcon =
                presentation?.icon === "vault"
                  ? Vault
                  : presentation?.icon === "users"
                    ? Users
                    : null;
              return (
                <Badge key={groupId} variant="outline">
                  <span className="inline-flex items-center gap-1">
                    {GroupIcon ? <GroupIcon className="size-3.5" /> : null}
                    {groupName}
                  </span>
                </Badge>
              );
            })}
          </div>
        );
      },
      enableColumnFilter: true,
      enableSorting: true,
      enableHiding: true,
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Дата создания" />
      ),
      cell: ({ row }) => formatDate(row.getValue("createdAt")),
      enableSorting: true,
      enableHiding: true,
    },
    {
      accessorKey: "updatedAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Дата обновления" />
      ),
      cell: ({ row }) => formatDate(row.getValue("updatedAt")),
      enableSorting: true,
      enableHiding: true,
      enableColumnFilter: false,
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <CounterpartyRowActions
          counterparty={row.original}
          detailsBasePath={detailsBasePath}
        />
      ),
      size: 48,
    },
  ];
}
