"use client"

import * as React from "react"
import {
  endOfMonth,
  endOfQuarter,
  endOfWeek,
  endOfYear,
  format,
  isSameDay,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
  type Locale,
} from "date-fns"
import { ru } from "date-fns/locale"
import { Calendar as CalendarIcon, X } from "lucide-react"
import type { DateRange } from "react-day-picker"

import { Button } from "@bedrock/sdk-ui/components/button"
import { Calendar } from "@bedrock/sdk-ui/components/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@bedrock/sdk-ui/components/popover"
import { cn } from "@bedrock/sdk-ui/lib/utils"

export type { DateRange } from "react-day-picker"

export type DatePickerRangePreset = {
  label: string
  value: DateRange | (() => DateRange)
}

type DatePickerTriggerRenderProps = {
  clear: () => void
  hasValue: boolean
  label: string
  open: boolean
}

type DatePickerBaseProps = {
  align?: React.ComponentProps<typeof PopoverContent>["align"]
  allowClear?: boolean
  buttonSize?: React.ComponentProps<typeof Button>["size"]
  buttonVariant?: React.ComponentProps<typeof Button>["variant"]
  calendarClassName?: string
  captionLayout?: React.ComponentProps<typeof Calendar>["captionLayout"]
  className?: string
  clearable?: boolean
  clearLabel?: string
  contentClassName?: string
  defaultMonth?: Date
  disabled?: boolean
  id?: string
  locale?: Locale
  placeholder?: string
  renderTrigger?: (
    props: DatePickerTriggerRenderProps
  ) => React.ReactElement
}

type SingleDatePickerProps = DatePickerBaseProps & {
  mode?: "single"
  onChange?: (date: Date | undefined) => void
  value?: Date
}

type RangeDatePickerProps = DatePickerBaseProps & {
  mode: "range"
  numberOfMonths?: number
  onChange?: (range: DateRange | undefined) => void
  presets?: DatePickerRangePreset[] | false
  value?: DateRange
}

export type DatePickerProps = SingleDatePickerProps | RangeDatePickerProps

function getDefaultRangePresets(): DatePickerRangePreset[] {
  const today = new Date()

  return [
    {
      label: "Сегодня",
      value: {
        from: today,
        to: today,
      },
    },
    {
      label: "Вчера",
      value: () => {
        const yesterday = subDays(today, 1)
        return {
          from: yesterday,
          to: yesterday,
        }
      },
    },
    {
      label: "Последние 7 дней",
      value: {
        from: subDays(today, 6),
        to: today,
      },
    },
    {
      label: "Последние 30 дней",
      value: {
        from: subDays(today, 29),
        to: today,
      },
    },
    {
      label: "Текущая неделя",
      value: {
        from: startOfWeek(today, { locale: ru }),
        to: endOfWeek(today, { locale: ru }),
      },
    },
    {
      label: "Текущий месяц",
      value: {
        from: startOfMonth(today),
        to: endOfMonth(today),
      },
    },
    {
      label: "Прошлый месяц",
      value: () => {
        const lastMonth = subMonths(today, 1)
        return {
          from: startOfMonth(lastMonth),
          to: endOfMonth(lastMonth),
        }
      },
    },
    {
      label: "Текущий квартал",
      value: {
        from: startOfQuarter(today),
        to: endOfQuarter(today),
      },
    },
    {
      label: "Текущий год",
      value: {
        from: startOfYear(today),
        to: endOfYear(today),
      },
    },
  ]
}

function formatSingleDateLabel(
  value: Date | undefined,
  placeholder: string,
  locale: Locale | undefined
) {
  if (!value) {
    return placeholder
  }

  return format(value, "d MMMM yyyy", { locale: locale ?? ru })
}

function formatRangeDateLabel(
  value: DateRange | undefined,
  placeholder: string,
  locale: Locale | undefined
) {
  if (!value?.from && !value?.to) {
    return placeholder
  }

  if (!value?.from || !value?.to || isSameDay(value.from, value.to)) {
    return format(value.from ?? value.to!, "d MMM yyyy", {
      locale: locale ?? ru,
    })
  }

  if (value.from.getFullYear() === value.to.getFullYear()) {
    return `${format(value.from, "d MMM", { locale: locale ?? ru })} - ${format(
      value.to,
      "d MMM yyyy",
      { locale: locale ?? ru }
    )}`
  }

  return `${format(value.from, "d MMM yyyy", {
    locale: locale ?? ru,
  })} - ${format(value.to, "d MMM yyyy", { locale: locale ?? ru })}`
}

export function DatePicker(props: DatePickerProps) {
  const {
    align = "start",
    allowClear,
    buttonSize = "default",
    buttonVariant = "outline",
    calendarClassName,
    captionLayout = "label",
    className,
    clearable,
    clearLabel = "Очистить",
    contentClassName,
    defaultMonth,
    disabled = false,
    id,
    locale = ru,
    placeholder,
    renderTrigger,
  } = props
  const [open, setOpen] = React.useState(false)
  const isRangeMode = props.mode === "range"
  const rangeProps = props.mode === "range" ? props : undefined
  const singleProps = props.mode === "range" ? undefined : props
  const rangeValue = rangeProps?.value
  const singleValue = singleProps?.value
  const resolvedClearable = clearable ?? allowClear ?? true
  const resolvedPlaceholder =
    placeholder ?? (isRangeMode ? "Выберите период" : "Выберите дату")
  const resolvedPresets =
    isRangeMode && rangeProps?.presets !== false
      ? rangeProps?.presets ?? getDefaultRangePresets()
      : []

  const label = isRangeMode
    ? formatRangeDateLabel(rangeValue, resolvedPlaceholder, locale)
    : formatSingleDateLabel(singleValue, resolvedPlaceholder, locale)
  const hasValue = isRangeMode
    ? Boolean(rangeValue?.from || rangeValue?.to)
    : Boolean(singleValue)
  const resolvedDefaultMonth = React.useMemo(() => {
    if (defaultMonth) {
      return defaultMonth
    }

    if (isRangeMode) {
      return rangeValue?.from ?? rangeValue?.to ?? new Date()
    }

    return singleValue ?? new Date()
  }, [defaultMonth, isRangeMode, rangeValue?.from, rangeValue?.to, singleValue])

  const clear = React.useCallback(() => {
    if (isRangeMode) {
      rangeProps?.onChange?.(undefined)
    } else {
      singleProps?.onChange?.(undefined)
    }
  }, [isRangeMode, rangeProps, singleProps])

  const trigger = renderTrigger ? (
    renderTrigger({
      clear,
      hasValue,
      label,
      open,
    })
  ) : (
    <Button
      variant={buttonVariant}
      size={buttonSize}
      disabled={disabled}
      id={id}
      className={cn(
        "justify-start text-left font-normal",
        !hasValue && "text-muted-foreground",
        className
      )}
      aria-label={label}
    />
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={trigger}>
        {renderTrigger ? null : (
          <>
            <CalendarIcon className="size-4" />
            <span className="truncate">{label}</span>
            {resolvedClearable && hasValue ? (
              <span
                aria-label={clearLabel}
                className="ml-auto inline-flex pointer-events-auto opacity-50 transition-opacity hover:opacity-100"
                onClick={(event) => {
                  event.stopPropagation()
                  clear()
                }}
              >
                <X className="size-4" />
              </span>
            ) : null}
          </>
        )}
      </PopoverTrigger>
      <PopoverContent
        align={align}
        className={cn(
          "w-auto p-0",
          isRangeMode && resolvedPresets.length > 0 && "overflow-hidden",
          contentClassName
        )}
      >
        {isRangeMode ? (
          resolvedPresets.length > 0 ? (
            <div className="flex">
              <div className="border-r p-3 space-y-1 max-w-[160px]">
                <p className="text-muted-foreground mb-2 px-2 text-xs font-medium whitespace-nowrap">
                  Быстрый выбор
                </p>
                {resolvedPresets.map((preset) => (
                  <Button
                    key={preset.label}
                    variant="ghost"
                    size="sm"
                    className="h-7 w-full justify-start px-2 text-sm font-normal whitespace-nowrap"
                    onClick={() => {
                      const nextValue =
                        typeof preset.value === "function"
                          ? preset.value()
                          : preset.value
                      rangeProps?.onChange?.(nextValue)
                      setOpen(false)
                    }}
                  >
                    {preset.label}
                  </Button>
                ))}
                {resolvedClearable && hasValue ? (
                  <div className="border-t pt-2 mt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground h-7 w-full justify-start px-2 text-sm font-normal whitespace-nowrap"
                      onClick={() => {
                        clear()
                        setOpen(false)
                      }}
                    >
                      {clearLabel}
                    </Button>
                  </div>
                ) : null}
              </div>
              <div className="p-3">
                <Calendar
                  className={calendarClassName}
                  captionLayout={captionLayout}
                  defaultMonth={resolvedDefaultMonth}
                  locale={locale}
                  mode="range"
                  numberOfMonths={rangeProps?.numberOfMonths ?? 2}
                  selected={rangeValue}
                  onSelect={(nextValue) => {
                    const hasRangeValue = Boolean(
                      nextValue?.from || nextValue?.to
                    )
                    rangeProps?.onChange?.(hasRangeValue ? nextValue : undefined)
                    if (nextValue?.from && nextValue?.to) {
                      setOpen(false)
                    }
                  }}
                />
              </div>
            </div>
          ) : (
            <Calendar
              className={calendarClassName}
              captionLayout={captionLayout}
              defaultMonth={resolvedDefaultMonth}
              locale={locale}
              mode="range"
              numberOfMonths={rangeProps?.numberOfMonths ?? 2}
              selected={rangeValue}
              onSelect={(nextValue) => {
                const hasRangeValue = Boolean(nextValue?.from || nextValue?.to)
                rangeProps?.onChange?.(hasRangeValue ? nextValue : undefined)
                if (nextValue?.from && nextValue?.to) {
                  setOpen(false)
                }
              }}
            />
          )
        ) : (
          <div>
            <Calendar
              className={calendarClassName}
              captionLayout={captionLayout}
              defaultMonth={resolvedDefaultMonth}
              locale={locale}
              mode="single"
              selected={singleValue}
              onSelect={(nextValue) => {
                singleProps?.onChange?.(nextValue)
                if (nextValue) {
                  setOpen(false)
                }
              }}
            />
            {resolvedClearable && hasValue ? (
              <div className="border-t p-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground h-7 w-full justify-start px-2 text-sm font-normal"
                  onClick={() => {
                    clear()
                    setOpen(false)
                  }}
                >
                  {clearLabel}
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
