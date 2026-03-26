"use client";

import * as React from "react";
import {
  startOfWeek,
  endOfWeek,
  addDays,
  format,
  isToday,
  isSameDay,
} from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";

interface TodoItem {
  id?: number;
  title: string;
  completed?: boolean;
  dueDate?: string;
  agentId?: number;
  assignedBy?: number;
  description?: string;
}

interface WeekViewProps {
  currentDate: Date;
  todos: Record<string, TodoItem[]>;
  onDateClick: (date: Date) => void;
  onTodoClick: (todo: TodoItem) => void;
  onTodoToggle?: (todoId: number, completed: boolean) => void;
}

export function WeekView({
  currentDate,
  todos,
  onDateClick,
  onTodoClick,
  onTodoToggle,
}: WeekViewProps) {
  const weekStart = startOfWeek(currentDate, { locale: ru });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const getTodosForDate = (date: Date): TodoItem[] => {
    const dateStr = format(date, "yyyy-MM-dd");
    return todos[dateStr] || [];
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Шапка с днями недели */}
      <div className="grid grid-cols-7 border-b">
        {weekDays.map((date, idx) => {
          const isCurrentDay = isToday(date);
          const dayTodos = getTodosForDate(date);

          return (
            <div
              key={idx}
              className={cn(
                "p-3 border-r last:border-r-0 cursor-pointer hover:bg-muted/50 transition-colors",
                isCurrentDay && "bg-primary/5"
              )}
              onClick={() => onDateClick(date)}
            >
              <div className="text-center">
                <div className="text-xs text-muted-foreground uppercase">
                  {format(date, "EEE", { locale: ru })}
                </div>
                <div
                  className={cn(
                    "text-lg font-semibold mt-1 h-8 w-8 mx-auto flex items-center justify-center rounded-full",
                    isCurrentDay && "bg-primary text-primary-foreground"
                  )}
                >
                  {format(date, "d")}
                </div>
                {dayTodos.length > 0 && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {dayTodos.filter((t) => !t.completed).length} задач
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Задачи по дням */}
      <div className="flex-1 grid grid-cols-7">
        {weekDays.map((date, idx) => {
          const dayTodos = getTodosForDate(date);
          const isCurrentDay = isToday(date);

          return (
            <div
              key={idx}
              className={cn(
                "border-r last:border-r-0 p-2 overflow-y-auto",
                isCurrentDay && "bg-primary/5"
              )}
            >
              <div className="space-y-2">
                {dayTodos.length === 0 ? (
                  <div className="text-xs text-muted-foreground text-center py-4">
                    Нет задач
                  </div>
                ) : (
                  dayTodos.map((todo) => (
                    <div
                      key={todo.id}
                      className={cn(
                        "p-2 rounded-md border cursor-pointer transition-colors",
                        todo.completed
                          ? "bg-muted border-muted"
                          : "bg-card hover:bg-muted/50 border-border"
                      )}
                      onClick={() => onTodoClick(todo)}
                    >
                      <div className="flex items-start gap-2">
                        {onTodoToggle && todo.id && (
                          <Checkbox
                            checked={todo.completed}
                            onCheckedChange={(checked) => {
                              onTodoToggle(todo.id!, !!checked);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="mt-0.5"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div
                            className={cn(
                              "text-sm font-medium break-words",
                              todo.completed &&
                                "line-through text-muted-foreground"
                            )}
                          >
                            {todo.title}
                          </div>
                          {todo.description && (
                            <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {todo.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
