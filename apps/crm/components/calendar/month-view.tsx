"use client";

import * as React from "react";
import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ru } from "date-fns/locale";

import type { CrmTask } from "@/lib/tasks/contracts";
import { cn } from "@/lib/utils";

interface MonthViewProps {
  currentDate: Date;
  tasksByDate: Record<string, CrmTask[]>;
  onDateClick: (date: Date) => void;
  onTodoClick: (task: CrmTask) => void;
}

export function MonthView({
  currentDate,
  tasksByDate,
  onDateClick,
  onTodoClick,
}: MonthViewProps) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { locale: ru });
  const endDate = endOfWeek(monthEnd, { locale: ru });

  const dateRows: Date[][] = [];
  let days: Date[] = [];
  let day = startDate;

  while (day <= endDate) {
    for (let index = 0; index < 7; index += 1) {
      days.push(day);
      day = addDays(day, 1);
    }
    dateRows.push(days);
    days = [];
  }

  const getTodosForDate = (date: Date): CrmTask[] => {
    const dateString = format(date, "yyyy-MM-dd");
    return tasksByDate[dateString] || [];
  };

  return (
    <div className="flex-1 flex flex-col">
      <div className="grid grid-cols-7 border-b">
        {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((dayLabel, index) => (
          <div
            key={index}
            className="p-2 text-center text-sm font-medium text-muted-foreground border-r last:border-r-0"
          >
            {dayLabel}
          </div>
        ))}
      </div>

      <div className="flex-1 grid grid-rows-[repeat(auto-fit,minmax(0,1fr))]">
        {dateRows.map((row, rowIndex) => (
          <div
            key={rowIndex}
            className="grid grid-cols-7 border-b last:border-b-0"
          >
            {row.map((date, columnIndex) => {
              const dateTasks = getTodosForDate(date);
              const isCurrentMonth = isSameMonth(date, monthStart);
              const isCurrentDay = isToday(date);

              return (
                <div
                  key={columnIndex}
                  className={cn(
                    "border-r last:border-r-0 p-2 min-h-[100px] cursor-pointer hover:bg-muted/50 transition-colors overflow-hidden",
                    !isCurrentMonth && "bg-muted/20 text-muted-foreground",
                  )}
                  onClick={() => onDateClick(date)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={cn(
                        "text-sm font-medium h-6 w-6 flex items-center justify-center rounded-full",
                        isCurrentDay &&
                          "bg-primary text-primary-foreground font-bold",
                      )}
                    >
                      {format(date, "d")}
                    </span>
                    {dateTasks.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {dateTasks.length}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    {dateTasks.slice(0, 3).map((task) => (
                      <div
                        key={task.id}
                        onClick={(event) => {
                          event.stopPropagation();
                          onTodoClick(task);
                        }}
                        className={cn(
                          "text-xs p-1 rounded truncate cursor-pointer transition-colors",
                          task.completed
                            ? "bg-muted text-muted-foreground line-through"
                            : "bg-primary/10 text-primary hover:bg-primary/20",
                        )}
                      >
                        {task.title}
                      </div>
                    ))}
                    {dateTasks.length > 3 && (
                      <div className="text-xs text-muted-foreground px-1">
                        +{dateTasks.length - 3} ещё
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
