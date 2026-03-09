"use client";

import { type MouseEvent, useMemo, useState } from "react";
import { Check, PlusCircle, XCircle } from "lucide-react";

import { Badge } from "@multihansa/ui/components/badge";
import { Button } from "@multihansa/ui/components/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@multihansa/ui/components/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@multihansa/ui/components/popover";
import { Separator } from "@multihansa/ui/components/separator";
import { cn } from "@multihansa/ui/lib/utils";

export type CurrencyFacetOption = {
  count: number;
  name: string;
  value: string;
};

type CurrencyFacetedFilterProps = {
  emptyMessage?: string;
  options: CurrencyFacetOption[];
  placeholder: string;
  title: string;
  value?: string;
  onChange: (value?: string) => void;
};

export function CurrencyFacetedFilter({
  emptyMessage = "Валюты не найдены",
  options,
  placeholder,
  title,
  value,
  onChange,
}: CurrencyFacetedFilterProps) {
  const [open, setOpen] = useState(false);

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value),
    [options, value],
  );
  const canReset = value !== undefined;

  function handleSelect(nextValue: string) {
    onChange(nextValue === value ? undefined : nextValue);
    setOpen(false);
  }

  function handleReset(event?: MouseEvent) {
    event?.stopPropagation();
    onChange(undefined);
  }

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
        {canReset ? (
          <div
            role="button"
            aria-label={`Сбросить фильтр ${title.toLowerCase()}`}
            tabIndex={0}
            className="rounded-sm opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            onClick={handleReset}
          >
            <XCircle />
          </div>
        ) : (
          <PlusCircle />
        )}
        {title}
        {selectedOption ? (
          <>
            <Separator
              orientation="vertical"
              className="mx-0.5 data-[orientation=vertical]:h-4"
            />
            <Badge variant="secondary" className="rounded-sm px-1 font-normal">
              {selectedOption.value}
            </Badge>
          </>
        ) : null}
      </PopoverTrigger>

      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder={placeholder} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup className="max-h-[300px] overflow-y-auto overflow-x-hidden">
              {options.map((option) => {
                const isSelected = option.value === value;

                return (
                  <CommandItem
                    key={option.value}
                    onSelect={() => handleSelect(option.value)}
                  >
                    <div
                      className={cn(
                        "flex size-4 items-center justify-center rounded-sm border border-primary",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "opacity-50 [&_svg]:invisible",
                      )}
                    >
                      <Check className="size-3" />
                    </div>
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="font-medium">{option.value}</span>
                      <span className="text-muted-foreground truncate text-xs">
                        {option.name}
                      </span>
                    </div>
                    <span className="text-muted-foreground font-mono text-xs">
                      {option.count}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {canReset ? (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => {
                      onChange(undefined);
                      setOpen(false);
                    }}
                    className="justify-center text-center"
                  >
                    Сбросить фильтр
                  </CommandItem>
                </CommandGroup>
              </>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
