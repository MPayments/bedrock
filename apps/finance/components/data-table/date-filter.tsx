"use client";

import type { Column } from "@tanstack/react-table";
import { CalendarIcon, XCircle } from "lucide-react";
import * as React from "react";

import { Button } from "@bedrock/sdk-ui/components/button";
import {
  DatePicker,
  type DateRange,
} from "@bedrock/sdk-ui/components/date-picker";
import { Separator } from "@bedrock/sdk-ui/components/separator";

function parseAsDate(timestamp: number | string | undefined): Date | undefined {
  if (!timestamp) return undefined;
  const numericTimestamp =
    typeof timestamp === "string" ? Number(timestamp) : timestamp;
  const date = new Date(numericTimestamp);
  return !Number.isNaN(date.getTime()) ? date : undefined;
}

function parseColumnFilterValue(value: unknown) {
  if (value === null || value === undefined) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === "number" || typeof item === "string") {
        return item;
      }
      return undefined;
    });
  }

  if (typeof value === "string" || typeof value === "number") {
    return [value];
  }

  return [];
}

interface DataTableDateFilterProps<TData> {
  column: Column<TData, unknown>;
  title?: string;
}

type DataTableDateFilterMode = "single" | "range";

type DataTableDateFilterBaseProps<TData> = DataTableDateFilterProps<TData> & {
  mode: DataTableDateFilterMode;
};

function DataTableDateFilterBase<TData>({
  column,
  title,
  mode,
}: DataTableDateFilterBaseProps<TData>) {
  const isRangeMode = mode === "range";
  const columnFilterValue = column.getFilterValue();

  const selectedRange = React.useMemo<DateRange | undefined>(() => {
    if (!isRangeMode || !columnFilterValue) {
      return undefined;
    }

    const timestamps = parseColumnFilterValue(columnFilterValue);
    const from = parseAsDate(timestamps[0]);
    const to = parseAsDate(timestamps[1]);

    return from || to ? { from, to } : undefined;
  }, [columnFilterValue, isRangeMode]);

  const selectedDate = React.useMemo<Date | undefined>(() => {
    if (isRangeMode || !columnFilterValue) {
      return undefined;
    }

    const timestamps = parseColumnFilterValue(columnFilterValue);
    return parseAsDate(timestamps[0]);
  }, [columnFilterValue, isRangeMode]);

  const renderTrigger = React.useCallback(
    ({
      clear,
      hasValue,
      label,
    }: {
      clear: () => void;
      hasValue: boolean;
      label: string;
      open: boolean;
    }) => (
      <Button
        variant="outline"
        size="sm"
        className="border-dashed font-normal"
      >
        {hasValue ? (
          <div
            role="button"
            aria-label={`Clear ${title} filter`}
            tabIndex={0}
            onClick={(event) => {
              event.stopPropagation();
              clear();
            }}
            className="rounded-sm opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <XCircle />
          </div>
        ) : (
          <CalendarIcon />
        )}
        {title ? (
          <span className="flex items-center gap-2">
            <span>{title}</span>
            {hasValue ? (
              <>
                <Separator
                  orientation="vertical"
                  className="mx-0.5 data-[orientation=vertical]:h-4"
                />
                <span>{label}</span>
              </>
            ) : null}
          </span>
        ) : (
          <span>{label}</span>
        )}
      </Button>
    ),
    [title],
  );

  if (isRangeMode) {
    return (
      <DatePicker
        mode="range"
        value={selectedRange}
        onChange={(date) => {
          if (!date) {
            column.setFilterValue(undefined);
            return;
          }

          const from = date.from?.getTime();
          const to = date.to?.getTime();
          column.setFilterValue(from || to ? [from, to] : undefined);
        }}
        align="start"
        captionLayout="dropdown"
        presets={false}
        renderTrigger={renderTrigger}
      />
    );
  }

  return (
    <DatePicker
      value={selectedDate}
      onChange={(date) => {
        column.setFilterValue(date ? date.getTime() : undefined);
      }}
      align="start"
      captionLayout="dropdown"
      renderTrigger={renderTrigger}
    />
  );
}

export function DataTableDateFilter<TData>(props: DataTableDateFilterProps<TData>) {
  return <DataTableDateFilterBase mode="single" {...props} />;
}

export function DataTableDateRangeFilter<TData>(
  props: DataTableDateFilterProps<TData>,
) {
  return <DataTableDateFilterBase mode="range" {...props} />;
}
