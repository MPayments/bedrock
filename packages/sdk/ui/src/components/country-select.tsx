"use client"

import { useMemo, useState } from "react"
import { ChevronDown, X } from "lucide-react"

import {
  COUNTRIES,
  getCountryByAlpha2,
  normalizeToAlpha2,
  type CountryRecord,
} from "@bedrock/shared/reference-data"
import { Button } from "@bedrock/sdk-ui/components/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@bedrock/sdk-ui/components/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@bedrock/sdk-ui/components/popover"
import { cn } from "@bedrock/sdk-ui/lib/utils"

type CountryOption = {
  label: string
  search: string
  value: string
}

const COUNTRY_OPTIONS: CountryOption[] = COUNTRIES.map((country: CountryRecord) => ({
  value: country.alpha2,
  label: `${country.emoji} ${country.name}`,
  search: `${country.alpha2} ${country.alpha3} ${country.name}`.toLowerCase(),
})).sort((a: CountryOption, b: CountryOption) => a.label.localeCompare(b.label))

export type CountrySelectProps = {
  value: string
  onValueChange: (nextValue: string) => void
  disabled?: boolean
  invalid?: boolean
  placeholder?: string
  searchPlaceholder?: string
  emptyLabel?: string
  clearable?: boolean
  clearLabel?: string
  id?: string
  className?: string
}

export function CountrySelect({
  value,
  onValueChange,
  disabled = false,
  invalid = false,
  placeholder = "Select country",
  searchPlaceholder = "Search country...",
  emptyLabel = "Country not found",
  clearable = false,
  clearLabel = "Clear selection",
  id,
  className,
}: CountrySelectProps) {
  const [open, setOpen] = useState(false)

  const trimmedValue = value.trim()
  const normalizedCode = useMemo(
    () => (trimmedValue ? normalizeToAlpha2(trimmedValue) : null),
    [trimmedValue]
  )
  const selectedCountry = normalizedCode ? getCountryByAlpha2(normalizedCode) : null
  const selectedLabel = selectedCountry
    ? `${selectedCountry.emoji} ${selectedCountry.name}`
    : trimmedValue
      ? trimmedValue.toUpperCase()
      : ""

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            className={cn("w-full justify-between font-normal", className)}
            aria-invalid={invalid}
            disabled={disabled}
          />
        }
      >
        <span
          className={cn(
            "truncate",
            selectedLabel ? undefined : "text-muted-foreground"
          )}
        >
          {selectedLabel || placeholder}
        </span>
        <ChevronDown className="text-muted-foreground size-4" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--anchor-width) p-0">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList className="max-h-64">
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            <CommandGroup>
              {COUNTRY_OPTIONS.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.search}
                  data-checked={normalizedCode === option.value || undefined}
                  onSelect={() => {
                    onValueChange(option.value)
                    setOpen(false)
                  }}
                >
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
            {clearable && trimmedValue ? (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    value="__clear__"
                    onSelect={() => {
                      onValueChange("")
                      setOpen(false)
                    }}
                  >
                    <X className="size-4" />
                    {clearLabel}
                  </CommandItem>
                </CommandGroup>
              </>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
