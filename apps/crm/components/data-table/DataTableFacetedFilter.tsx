import * as React from "react";
import { Check, PlusCircle } from "lucide-react";
import { Column } from "@tanstack/react-table";

import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@bedrock/sdk-ui/components/command";
import { Popover, PopoverContent, PopoverTrigger } from "@bedrock/sdk-ui/components/popover";
import { Button } from "@bedrock/sdk-ui/components/button";
import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Separator } from "@bedrock/sdk-ui/components/separator";

interface DataTableFacetedFilterProps<
  TData,
  TValue extends string | number | symbol,
> {
  column?: Column<TData, TValue>;
  title?: string;
  options: Record<
    TValue,
    {
      value: TValue;
      label: string;
      colorClass: string;
      icon?: React.ComponentType<{ className?: string }>;
    }
  >;
}

export function DataTableFacetedFilter<
  TData,
  TValue extends string | number | symbol,
>({ column, title, options }: DataTableFacetedFilterProps<TData, TValue>) {
  const facets = column?.getFacetedUniqueValues();
  const selectedValues = new Set(column?.getFilterValue() as TValue[]);
  type Option = DataTableFacetedFilterProps<TData, TValue>["options"][TValue];
  const optionValues = Object.values(options) as Option[];

  return (
    <Popover>
      <PopoverTrigger
        render={<Button variant="outline" size="sm" className="h-8 border" />}
      >
        <PlusCircle className="size-4" />
        {title}
        {selectedValues?.size > 0 && (
          <>
            <Separator orientation="vertical" className="mx-2 h-4" />
            <Badge
              variant="secondary"
              className="rounded-sm px-1 font-normal lg:hidden"
            >
              {selectedValues.size}
            </Badge>
            <div className="hidden space-x-1 lg:flex">
              {selectedValues.size > 2 ? (
                <Badge
                  variant="secondary"
                  className="rounded-sm px-1 font-normal"
                >
                  {selectedValues.size} выбрано
                </Badge>
              ) : (
                Array.from(selectedValues)
                  .map((value) => options[value])
                  .map(({ label, colorClass, icon: Icon }) => (
                    <Badge
                      key={String(label)}
                      variant="secondary"
                      className={cn("rounded-sm px-1 font-normal", colorClass)}
                    >
                      {Icon && <Icon className="mr-1 inline-block h-4 w-4" />}
                      {label}
                    </Badge>
                  ))
              )}
            </div>
          </>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <Command>
          <CommandInput placeholder={title} />
          <CommandList>
            <CommandEmpty>Не найдено</CommandEmpty>
            <CommandGroup>
              {optionValues.map((option) => {
                const isSelected = selectedValues.has(option.value);
                const Icon = option.icon;
                return (
                  <CommandItem
                    key={String(option.value)}
                    onSelect={() => {
                      if (isSelected) {
                        selectedValues.delete(option.value);
                      } else {
                        selectedValues.add(option.value);
                      }
                      const filterValues = Array.from(selectedValues);
                      column?.setFilterValue(
                        filterValues.length ? filterValues : undefined
                      );
                    }}
                  >
                    <div
                      className={cn(
                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "opacity-50 [&_svg]:invisible"
                      )}
                    >
                      <Check className={cn("h-4 w-4")} />
                    </div>
                    {Icon && (
                      <Icon className="flex-shrink-0 mr-2 size-4 text-muted-foreground" />
                    )}
                    <span>{option.label}</span>
                    {facets?.get(option.value) && (
                      <span className="flex items-center justify-center w-4 h-4 ml-auto font-mono text-xs">
                        {facets.get(option.value)}
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
                    onSelect={() => column?.setFilterValue(undefined)}
                    className="justify-center text-center"
                  >
                    Очистить фильтр
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
