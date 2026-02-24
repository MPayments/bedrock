"use client";

import type { Column, Table } from "@tanstack/react-table";
import { X } from "lucide-react";
import * as React from "react";

import { Button } from "@bedrock/ui/components/button";
import { Input } from "@bedrock/ui/components/input";
import { cn } from "@bedrock/ui/lib/utils";
import {
  DataTableDateFilter,
  DataTableDateRangeFilter,
} from "@/components/data-table/date-filter";
import {
  DataTableFacetedFilter,
  DataTableFacetedMultiFilter,
} from "@/components/data-table/faceted-filter";
import { DataTableSliderFilter } from "@/components/data-table/slider-filter";
import { DataTableViewOptions } from "@/components/data-table/view-options";

interface DataTableToolbarProps<TData> extends React.ComponentProps<"div"> {
  table: Table<TData>;
}

function normalizeFilterValues(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }

  if (value === null || value === undefined) {
    return [];
  }

  return [String(value)];
}

export function DataTableToolbar<TData>({
  table,
  children,
  className,
  ...props
}: DataTableToolbarProps<TData>) {
  const columns = React.useMemo(
    () => table.getAllColumns().filter((column) => column.getCanFilter()),
    [table],
  );
  const lockedFiltersByColumnId = React.useMemo(() => {
    const map = new Map<string, string[]>();

    for (const column of columns) {
      const values = column.columnDef.meta?.lockedFilterValues;
      if (!values || values.length === 0) {
        continue;
      }

      map.set(column.id, Array.from(new Set(values)));
    }

    return map;
  }, [columns]);
  const columnFilters = table.getState().columnFilters;
  const isFiltered = React.useMemo(() => {
    return columnFilters.some((filter) => {
      const lockedValues = lockedFiltersByColumnId.get(filter.id);
      if (!lockedValues || lockedValues.length === 0) {
        return true;
      }

      const normalizedValues = normalizeFilterValues(filter.value);
      if (normalizedValues.length !== lockedValues.length) {
        return true;
      }

      const normalizedSet = new Set(normalizedValues);
      return lockedValues.some((value) => !normalizedSet.has(value));
    });
  }, [columnFilters, lockedFiltersByColumnId]);

  const onReset = React.useCallback(() => {
    if (lockedFiltersByColumnId.size === 0) {
      table.resetColumnFilters();
      return;
    }

    table.setColumnFilters(
      Array.from(lockedFiltersByColumnId.entries()).map(([id, value]) => ({
        id,
        value,
      })),
    );
  }, [lockedFiltersByColumnId, table]);

  return (
    <div
      role="toolbar"
      aria-orientation="horizontal"
      className={cn(
        "flex w-full items-start justify-between gap-2 p-1",
        className,
      )}
      {...props}
    >
      <div className="flex flex-1 flex-wrap items-center gap-2">
        {columns.map((column) => (
          <DataTableToolbarFilter key={column.id} column={column} />
        ))}
        {isFiltered && (
          <Button
            aria-label="Сбросить фильтры"
            variant="outline"
            size="sm"
            className="border-dashed"
            onClick={onReset}
          >
            <X />
            Сбросить
          </Button>
        )}
      </div>
      <div className="flex items-center gap-2">
        {children}
        <DataTableViewOptions table={table} align="end" />
      </div>
    </div>
  );
}
interface DataTableToolbarFilterProps<TData> {
  column: Column<TData>;
}

function DataTableToolbarFilter<TData>({
  column,
}: DataTableToolbarFilterProps<TData>) {
  {
    const columnMeta = column.columnDef.meta;

    const onFilterRender = React.useCallback(() => {
      if (!columnMeta?.variant) return null;

      switch (columnMeta.variant) {
        case "text":
          return (
            <Input
              placeholder={columnMeta.placeholder ?? columnMeta.label}
              value={(column.getFilterValue() as string) ?? ""}
              onChange={(event) => column.setFilterValue(event.target.value)}
              className="h-8 w-40 lg:w-56"
            />
          );

        case "number":
          return (
            <div className="relative">
              <Input
                type="number"
                inputMode="numeric"
                placeholder={columnMeta.placeholder ?? columnMeta.label}
                value={(column.getFilterValue() as string) ?? ""}
                onChange={(event) => column.setFilterValue(event.target.value)}
                className={cn("h-8 w-[120px]", columnMeta.unit && "pr-8")}
              />
              {columnMeta.unit && (
                <span className="absolute top-0 right-0 bottom-0 flex items-center rounded-r-md bg-accent px-2 text-muted-foreground text-sm">
                  {columnMeta.unit}
                </span>
              )}
            </div>
          );

        case "range":
          return (
            <DataTableSliderFilter
              column={column}
              title={columnMeta.label ?? column.id}
            />
          );

        case "date":
          return (
            <DataTableDateFilter
              column={column}
              title={columnMeta.label ?? column.id}
            />
          );

        case "dateRange":
          return (
            <DataTableDateRangeFilter
              column={column}
              title={columnMeta.label ?? column.id}
            />
          );

        case "select":
          return (
            <DataTableFacetedFilter
              column={column}
              title={columnMeta.label ?? column.id}
              options={columnMeta.options ?? []}
            />
          );

        case "multiSelect":
          return (
            <DataTableFacetedMultiFilter
              column={column}
              title={columnMeta.label ?? column.id}
              options={columnMeta.options ?? []}
            />
          );

        default:
          return null;
      }
    }, [column, columnMeta]);

    return onFilterRender();
  }
}
