"use client";

import * as React from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  format,
  isSameMonth,
  isSameDay,
  isToday,
} from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface TodoItem {
  id?: number;
  title: string;
  completed?: boolean;
  dueDate?: string;
  agentId?: number;
  assignedBy?: number;
  description?: string;
}

interface MonthViewProps {
  currentDate: Date;
  todos: Record<string, TodoItem[]>;
  onDateClick: (date: Date) => void;
  onTodoClick: (todo: TodoItem) => void;
}

export function MonthView({
  currentDate,
  todos,
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
    for (let i = 0; i < 7; i++) {
      days.push(day);
      day = addDays(day, 1);
    }
    dateRows.push(days);
    days = [];
  }

  const getTodosForDate = (date: Date): TodoItem[] => {
    const dateStr = format(date, "yyyy-MM-dd");
    return todos[dateStr] || [];
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Шапка с днями недели */}
      <div className="grid grid-cols-7 border-b">
        {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day, idx) => (
          <div
            key={idx}
            className="p-2 text-center text-sm font-medium text-muted-foreground border-r last:border-r-0"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Сетка календаря */}
      <div className="flex-1 grid grid-rows-[repeat(auto-fit,minmax(0,1fr))]">
        {dateRows.map((row, rowIdx) => (
          <div
            key={rowIdx}
            className="grid grid-cols-7 border-b last:border-b-0"
          >
            {row.map((date, colIdx) => {
              const dateTodos = getTodosForDate(date);
              const isCurrentMonth = isSameMonth(date, monthStart);
              const isCurrentDay = isToday(date);

              return (
                <div
                  key={colIdx}
                  className={cn(
                    "border-r last:border-r-0 p-2 min-h-[100px] cursor-pointer hover:bg-muted/50 transition-colors overflow-hidden",
                    !isCurrentMonth && "bg-muted/20 text-muted-foreground"
                  )}
                  onClick={() => onDateClick(date)}
                >
                  {/* Число */}
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={cn(
                        "text-sm font-medium h-6 w-6 flex items-center justify-center rounded-full",
                        isCurrentDay &&
                          "bg-primary text-primary-foreground font-bold"
                      )}
                    >
                      {format(date, "d")}
                    </span>
                    {dateTodos.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {dateTodos.length}
                      </span>
                    )}
                  </div>

                  {/* Задачи */}
                  <div className="space-y-1">
                    {dateTodos.slice(0, 3).map((todo) => (
                      <div
                        key={todo.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onTodoClick(todo);
                        }}
                        className={cn(
                          "text-xs p-1 rounded truncate cursor-pointer transition-colors",
                          todo.completed
                            ? "bg-muted text-muted-foreground line-through"
                            : "bg-primary/10 text-primary hover:bg-primary/20"
                        )}
                      >
                        {todo.title}
                      </div>
                    ))}
                    {dateTodos.length > 3 && (
                      <div className="text-xs text-muted-foreground px-1">
                        +{dateTodos.length - 3} ещё
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
