"use client";

import * as React from "react";
import { addDays, format, isToday, startOfWeek } from "date-fns";
import { ru } from "date-fns/locale";

import { Checkbox } from "@bedrock/sdk-ui/components/checkbox";

import type { CrmTask } from "@/lib/tasks/contracts";
import { cn } from "@/lib/utils";

interface WeekViewProps {
  currentDate: Date;
  tasksByDate: Record<string, CrmTask[]>;
  onDateClick: (date: Date) => void;
  onTodoClick: (task: CrmTask) => void;
  onTodoToggle?: (taskId: string, completed: boolean) => void;
}

export function WeekView({
  currentDate,
  tasksByDate,
  onDateClick,
  onTodoClick,
  onTodoToggle,
}: WeekViewProps) {
  const weekStart = startOfWeek(currentDate, { locale: ru });
  const weekDays = Array.from({ length: 7 }, (_, index) =>
    addDays(weekStart, index),
  );

  const getTodosForDate = (date: Date): CrmTask[] => {
    const dateString = format(date, "yyyy-MM-dd");
    return tasksByDate[dateString] || [];
  };

  return (
    <div className="flex-1 flex flex-col">
      <div className="grid grid-cols-7 border-b">
        {weekDays.map((date, index) => {
          const isCurrentDay = isToday(date);
          const dayTasks = getTodosForDate(date);

          return (
            <div
              key={index}
              className={cn(
                "p-3 border-r last:border-r-0 cursor-pointer hover:bg-muted/50 transition-colors",
                isCurrentDay && "bg-primary/5",
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
                    isCurrentDay && "bg-primary text-primary-foreground",
                  )}
                >
                  {format(date, "d")}
                </div>
                {dayTasks.length > 0 && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {dayTasks.filter((task) => !task.completed).length} задач
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex-1 grid grid-cols-7">
        {weekDays.map((date, index) => {
          const dayTasks = getTodosForDate(date);
          const isCurrentDay = isToday(date);

          return (
            <div
              key={index}
              className={cn(
                "border-r last:border-r-0 p-2 overflow-y-auto",
                isCurrentDay && "bg-primary/5",
              )}
            >
              <div className="space-y-2">
                {dayTasks.length === 0 ? (
                  <div className="text-xs text-muted-foreground text-center py-4">
                    Нет задач
                  </div>
                ) : (
                  dayTasks.map((task) => (
                    <div
                      key={task.id}
                      className={cn(
                        "p-2 rounded-md border cursor-pointer transition-colors",
                        task.completed
                          ? "bg-muted border-muted"
                          : "bg-card hover:bg-muted/50 border-border",
                      )}
                      onClick={() => onTodoClick(task)}
                    >
                      <div className="flex items-start gap-2">
                        {onTodoToggle && (
                          <Checkbox
                            checked={task.completed}
                            onCheckedChange={(checked) => {
                              onTodoToggle(task.id, !!checked);
                            }}
                            onClick={(event) => event.stopPropagation()}
                            className="mt-0.5"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div
                            className={cn(
                              "text-sm font-medium break-words",
                              task.completed &&
                                "line-through text-muted-foreground",
                            )}
                          >
                            {task.title}
                          </div>
                          {task.description && (
                            <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {task.description}
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
