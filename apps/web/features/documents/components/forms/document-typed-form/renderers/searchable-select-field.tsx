"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@bedrock/sdk-ui/components/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@bedrock/sdk-ui/components/popover";

import { cn } from "@bedrock/sdk-ui/lib/utils";

export type SearchableSelectOption = {
  value: string;
  label: string;
  search?: string;
};

type SearchableSelectFieldProps = {
  value: string;
  options: SearchableSelectOption[];
  placeholder: string;
  searchPlaceholder: string;
  emptyLabel: string;
  disabled?: boolean;
  invalid?: boolean;
  inputId?: string;
  clearable?: boolean;
  onValueChange: (value: string) => void;
};

export function SearchableSelectField({
  value,
  options,
  placeholder,
  searchPlaceholder,
  emptyLabel,
  disabled = false,
  invalid = false,
  inputId,
  clearable = false,
  onValueChange,
}: SearchableSelectFieldProps) {
  const [open, setOpen] = useState(false);
  const selectedOption = options.find((option) => option.value === value);
  const displayLabel = selectedOption?.label ?? (value ? value.trim() : placeholder);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between font-normal"
            aria-invalid={invalid}
            disabled={disabled}
          />
        }
      >
        <span
          className={cn(
            "truncate",
            selectedOption || value ? undefined : "text-muted-foreground",
          )}
        >
          {displayLabel || placeholder}
        </span>
        <ChevronDown className="text-muted-foreground size-4" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--anchor-width) p-0">
        <Command>
          <CommandInput id={inputId} placeholder={searchPlaceholder} />
          <CommandList className="max-h-64">
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={(
                    option.search ?? `${option.label} ${option.value}`
                  ).toLowerCase()}
                  data-checked={value === option.value || undefined}
                  onSelect={() => {
                    onValueChange(
                      clearable && value === option.value ? "" : option.value,
                    );
                    setOpen(false);
                  }}
                >
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
