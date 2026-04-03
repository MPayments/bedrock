"use client";

import * as React from "react";
import { CalendarIcon, X } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

import { cn } from "@/lib/utils";
import { Button } from "@bedrock/sdk-ui/components/button";
import { Calendar } from "@bedrock/sdk-ui/components/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@bedrock/sdk-ui/components/popover";

export interface DatePickerProps {
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  className?: string;
  placeholder?: string;
  align?: "start" | "center" | "end";
  disabled?: boolean;
  allowClear?: boolean;
}

export function DatePicker({
  value,
  onChange,
  className,
  placeholder = "Выберите дату",
  align = "start",
  disabled = false,
  allowClear = true,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (date: Date | undefined) => {
    onChange?.(date);
    if (date) {
      setOpen(false);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange?.(undefined);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            disabled={disabled}
            className={cn(
              "justify-start text-left font-normal",
              !value && "text-muted-foreground",
              className
            )}
          />
        }
      >
        <CalendarIcon className="mr-2 h-4 w-4" />
        {value ? format(value, "d MMMM yyyy", { locale: ru }) : placeholder}
        {allowClear && value && (
          <X
            className="ml-auto h-4 w-4 opacity-50 hover:opacity-100"
            onClick={handleClear}
          />
        )}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align={align}>
        <Calendar
          mode="single"
          selected={value}
          onSelect={handleSelect}
          locale={ru}
          defaultMonth={value || new Date()}
        />
      </PopoverContent>
    </Popover>
  );
}
