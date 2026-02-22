"use client";

import type { Column } from "@tanstack/react-table";
import { Check, PlusCircle, XCircle } from "lucide-react";
import * as React from "react";

import { Badge } from "@bedrock/ui/components/badge";
import { Button } from "@bedrock/ui/components/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@bedrock/ui/components/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@bedrock/ui/components/popover";
import { Separator } from "@bedrock/ui/components/separator";
import { cn } from "@bedrock/ui/lib/utils";
import type { Option } from "@/types/data-table";

interface DataTableFacetedFilterProps<TData, TValue> {
  column?: Column<TData, TValue>;
  title?: string;
  options: Option[];
}

type DataTableFacetedFilterMode = "single" | "multi";

type DataTableFacetedFilterBaseProps<TData, TValue> =
  DataTableFacetedFilterProps<TData, TValue> & {
    mode: DataTableFacetedFilterMode;
  };

function DataTableFacetedFilterBase<TData, TValue>({
  column,
  title,
  options,
  mode,
}: DataTableFacetedFilterBaseProps<TData, TValue>) {
  const isMultiSelectMode = mode === "multi";
  const [open, setOpen] = React.useState(false);

  const columnFilterValue = column?.getFilterValue();
  const selectedValues = React.useMemo(
    () => {
      if (Array.isArray(columnFilterValue)) {
        return new Set(columnFilterValue.map(String));
      }
      if (typeof columnFilterValue === "string") {
        return new Set([columnFilterValue]);
      }
      return new Set<string>();
    },
    [columnFilterValue],
  );

  const onItemSelect = React.useCallback(
    (option: Option, isSelected: boolean) => {
      if (!column) return;

      if (isMultiSelectMode) {
        const newSelectedValues = new Set(selectedValues);
        if (isSelected) {
          newSelectedValues.delete(option.value);
        } else {
          newSelectedValues.add(option.value);
        }
        const filterValues = Array.from(newSelectedValues);
        column.setFilterValue(filterValues.length ? filterValues : undefined);
      } else {
        column.setFilterValue(isSelected ? undefined : option.value);
        setOpen(false);
      }
    },
    [column, isMultiSelectMode, selectedValues],
  );

  const onReset = React.useCallback(
    (event?: React.MouseEvent) => {
      event?.stopPropagation();
      column?.setFilterValue(undefined);
    },
    [column],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="border-dashed font-normal"
          />
        }
      >
          {selectedValues?.size > 0 ? (
            <div
              role="button"
              aria-label={`Clear ${title} filter`}
              tabIndex={0}
              className="rounded-sm opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              onClick={onReset}
            >
              <XCircle />
            </div>
          ) : (
            <PlusCircle />
          )}
          {title}
          {selectedValues?.size > 0 && (
            <>
              <Separator
                orientation="vertical"
                className="mx-0.5 data-[orientation=vertical]:h-4"
              />
              <Badge
                variant="secondary"
                className="rounded-sm px-1 font-normal lg:hidden"
              >
                {selectedValues.size}
              </Badge>
              <div className="hidden items-center gap-1 lg:flex">
                {selectedValues.size > 2 ? (
                  <Badge
                    variant="secondary"
                    className="rounded-sm px-1 font-normal"
                  >
                    {selectedValues.size} выбрано
                  </Badge>
                ) : (
                  options
                    .filter((option) => selectedValues.has(option.value))
                    .map((option) => (
                      <Badge
                        variant="secondary"
                        key={option.value}
                        className="rounded-sm px-1 font-normal"
                      >
                        {option.label}
                      </Badge>
                    ))
                )}
              </div>
            </>
          )}
      </PopoverTrigger>
      <PopoverContent className="w-50 p-0" align="start">
        <Command>
          <CommandInput placeholder={title} />
          <CommandList className="max-h-full">
            <CommandEmpty>Не найдено результатов</CommandEmpty>
            <CommandGroup className="max-h-[300px] scroll-py-1 overflow-y-auto overflow-x-hidden">
              {options.map((option) => {
                const isSelected = selectedValues.has(option.value);

                return (
                  <CommandItem
                    key={option.value}
                    onSelect={() => onItemSelect(option, isSelected)}
                  >
                    <div
                      className={cn(
                        "flex size-4 items-center justify-center rounded-sm border border-primary",
                        isSelected
                          ? "bg-primary"
                          : "opacity-50 [&_svg]:invisible",
                      )}
                    >
                      <Check />
                    </div>
                    {option.icon && <option.icon />}
                    <span className="truncate">{option.label}</span>
                    {option.count && (
                      <span className="ml-auto font-mono text-xs">
                        {option.count}
                      </span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {selectedValues.size > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => onReset()}
                    className="justify-center text-center"
                  >
                    Сбросить фильтры
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function DataTableFacetedFilter<TData, TValue>(
  props: DataTableFacetedFilterProps<TData, TValue>,
) {
  return <DataTableFacetedFilterBase mode="single" {...props} />;
}

export function DataTableFacetedMultiFilter<TData, TValue>(
  props: DataTableFacetedFilterProps<TData, TValue>,
) {
  return <DataTableFacetedFilterBase mode="multi" {...props} />;
}
