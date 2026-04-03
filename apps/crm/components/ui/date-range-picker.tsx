"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subDays,
  subMonths,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
} from "date-fns";
import { ru } from "date-fns/locale";
import type { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@bedrock/sdk-ui/components/button";
import { Calendar } from "@bedrock/sdk-ui/components/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@bedrock/sdk-ui/components/popover";

export interface DateRangePickerProps {
  value?: DateRange;
  onChange?: (range: DateRange | undefined) => void;
  className?: string;
  placeholder?: string;
  align?: "start" | "center" | "end";
}

interface DatePreset {
  label: string;
  getValue: () => DateRange;
}

const getPresets = (): DatePreset[] => {
  const today = new Date();

  return [
    {
      label: "Сегодня",
      getValue: () => ({
        from: today,
        to: today,
      }),
    },
    {
      label: "Вчера",
      getValue: () => {
        const yesterday = subDays(today, 1);
        return {
          from: yesterday,
          to: yesterday,
        };
      },
    },
    {
      label: "Последние 7 дней",
      getValue: () => ({
        from: subDays(today, 6),
        to: today,
      }),
    },
    {
      label: "Последние 30 дней",
      getValue: () => ({
        from: subDays(today, 29),
        to: today,
      }),
    },
    {
      label: "Текущая неделя",
      getValue: () => ({
        from: startOfWeek(today, { locale: ru }),
        to: endOfWeek(today, { locale: ru }),
      }),
    },
    {
      label: "Текущий месяц",
      getValue: () => ({
        from: startOfMonth(today),
        to: endOfMonth(today),
      }),
    },
    {
      label: "Прошлый месяц",
      getValue: () => {
        const lastMonth = subMonths(today, 1);
        return {
          from: startOfMonth(lastMonth),
          to: endOfMonth(lastMonth),
        };
      },
    },
    {
      label: "Текущий квартал",
      getValue: () => ({
        from: startOfQuarter(today),
        to: endOfQuarter(today),
      }),
    },
    {
      label: "Текущий год",
      getValue: () => ({
        from: startOfYear(today),
        to: endOfYear(today),
      }),
    },
  ];
};

export function DateRangePicker({
  value,
  onChange,
  className,
  placeholder = "Выберите период",
  align = "start",
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const presets = React.useMemo(() => getPresets(), []);

  const handlePresetClick = (preset: DatePreset) => {
    onChange?.(preset.getValue());
    setOpen(false);
  };

  const handleReset = () => {
    onChange?.(undefined);
    setOpen(false);
  };

  const formatDateRange = (range: DateRange | undefined) => {
    if (!range?.from) return placeholder;

    if (!range.to || range.from.getTime() === range.to.getTime()) {
      return format(range.from, "d MMM yyyy", { locale: ru });
    }

    // Если тот же год, показываем год только один раз
    if (range.from.getFullYear() === range.to.getFullYear()) {
      return `${format(range.from, "d MMM", { locale: ru })} — ${format(range.to, "d MMM yyyy", { locale: ru })}`;
    }

    return `${format(range.from, "d MMM yyyy", { locale: ru })} — ${format(range.to, "d MMM yyyy", { locale: ru })}`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            className={cn(
              "justify-start text-left font-normal",
              !value?.from && "text-muted-foreground",
              className
            )}
          />
        }
      >
        <CalendarIcon className="mr-2 h-4 w-4" />
        {formatDateRange(value)}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align={align}>
        <div className="flex">
          {/* Пресеты слева */}
          <div className="border-r p-3 space-y-1 max-w-[160px]">
            <p className="text-xs font-medium text-muted-foreground mb-2 px-2 whitespace-nowrap">
              Быстрый выбор
            </p>
            {presets.map((preset) => (
              <Button
                key={preset.label}
                variant="ghost"
                size="sm"
                className="w-full justify-start text-sm font-normal h-7 px-2 whitespace-nowrap"
                onClick={() => handlePresetClick(preset)}
              >
                {preset.label}
              </Button>
            ))}
            <div className="pt-2 border-t mt-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-sm font-normal h-7 px-2 text-muted-foreground whitespace-nowrap"
                onClick={handleReset}
              >
                Сбросить
              </Button>
            </div>
          </div>

          {/* Календарь справа */}
          <div className="p-3">
            <Calendar
              mode="range"
              selected={value}
              onSelect={onChange}
              numberOfMonths={2}
              locale={ru}
              defaultMonth={value?.from || new Date()}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
