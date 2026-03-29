"use client";

import * as React from "react";
import { API_BASE_URL } from "@/lib/constants";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Plus,
} from "lucide-react";
import { format, addMonths, subMonths, addWeeks, subWeeks } from "date-fns";
import { ru } from "date-fns/locale";

import { Button } from "@bedrock/sdk-ui/components/button";
import { Card, CardContent, CardHeader } from "@bedrock/sdk-ui/components/card";
import { Tabs, TabsList, TabsTrigger } from "@bedrock/sdk-ui/components/tabs";
import { MonthView } from "./month-view";
import { WeekView } from "./week-view";
import { TaskDialog, type TodoItem } from "./task-dialog";

type ViewMode = "month" | "week";

interface CalendarViewProps {
  initialDate?: Date;
}

export function CalendarView({ initialDate = new Date() }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = React.useState(initialDate);
  const [viewMode, setViewMode] = React.useState<ViewMode>("month");
  const [todos, setTodos] = React.useState<Record<string, TodoItem[]>>({});
  const [loading, setLoading] = React.useState(false);
  const [selectedTodo, setSelectedTodo] = React.useState<
    TodoItem | undefined
  >();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>();

  // Загрузка задач с сервера
  const fetchTodos = React.useCallback(async () => {
    try {
      setLoading(true);
      const month = format(currentDate, "yyyy-MM");
      const res = await fetch(`${API_BASE_URL}/todos/calendar?month=${month}`, {
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(`Ошибка загрузки: ${res.status}`);
      }

      const data = await res.json();
      setTodos(data.todos || {});
    } catch (err) {
      console.error("Calendar fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [currentDate]);

  React.useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);

  // Навигация
  const handlePrevious = () => {
    if (viewMode === "month") {
      setCurrentDate(subMonths(currentDate, 1));
    } else {
      setCurrentDate(subWeeks(currentDate, 1));
    }
  };

  const handleNext = () => {
    if (viewMode === "month") {
      setCurrentDate(addMonths(currentDate, 1));
    } else {
      setCurrentDate(addWeeks(currentDate, 1));
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Обработчики задач
  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setSelectedTodo(undefined);
    setDialogOpen(true);
  };

  const handleTodoClick = (todo: TodoItem) => {
    setSelectedTodo(todo);
    setSelectedDate(todo.dueDate ? new Date(todo.dueDate) : undefined);
    setDialogOpen(true);
  };

  const handleCreateTodo = () => {
    setSelectedTodo(undefined);
    setSelectedDate(undefined);
    setDialogOpen(true);
  };

  const handleSaveTodo = async (task: TodoItem) => {
    try {
      if (task.id) {
        // Обновление
        const res = await fetch(`${API_BASE_URL}/todos/${task.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: task.title,
            description: task.description,
            dueDate: task.dueDate,
          }),
        });

        if (!res.ok) throw new Error("Failed to update todo");
      } else {
        // Создание
        const res = await fetch(`${API_BASE_URL}/todos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentId: task.agentId,
            title: task.title,
            description: task.description,
            dueDate: task.dueDate,
            assignedBy: task.assignedBy,
            order: 0,
          }),
        });

        if (!res.ok) throw new Error("Failed to create todo");
      }

      // Перезагружаем задачи
      await fetchTodos();
    } catch (error) {
      console.error("Error saving todo:", error);
    }
  };

  const handleDeleteTodo = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/todos/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete todo");

      // Перезагружаем задачи
      await fetchTodos();
    } catch (error) {
      console.error("Error deleting todo:", error);
    }
  };

  const handleTodoToggle = async (todoId: number, completed: boolean) => {
    try {
      const res = await fetch(`${API_BASE_URL}/todos/${todoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed }),
      });

      if (!res.ok) throw new Error("Failed to toggle todo");

      // Перезагружаем задачи
      await fetchTodos();
    } catch (error) {
      console.error("Error toggling todo:", error);
    }
  };

  const getTitle = () => {
    if (viewMode === "month") {
      return format(currentDate, "LLLL yyyy", { locale: ru });
    } else {
      return `Неделя ${format(currentDate, "w, yyyy", { locale: ru })}`;
    }
  };

  return (
    <>
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" onClick={handleToday}>
                Сегодня
              </Button>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handlePrevious}
                  disabled={loading}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="min-w-[200px] text-center font-semibold capitalize">
                  {getTitle()}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleNext}
                  disabled={loading}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Tabs
                value={viewMode}
                onValueChange={(value) => setViewMode(value as ViewMode)}
              >
                <TabsList>
                  <TabsTrigger value="month">Месяц</TabsTrigger>
                  <TabsTrigger value="week">Неделя</TabsTrigger>
                </TabsList>
              </Tabs>
              <Button size="sm" onClick={handleCreateTodo}>
                <Plus className="mr-2 h-4 w-4" />
                Задача
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 p-0 overflow-hidden flex flex-col">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-muted-foreground">Загрузка...</div>
            </div>
          ) : viewMode === "month" ? (
            <MonthView
              currentDate={currentDate}
              todos={todos}
              onDateClick={handleDateClick}
              onTodoClick={handleTodoClick}
            />
          ) : (
            <WeekView
              currentDate={currentDate}
              todos={todos}
              onDateClick={handleDateClick}
              onTodoClick={handleTodoClick}
              onTodoToggle={handleTodoToggle}
            />
          )}
        </CardContent>
      </Card>

      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={selectedTodo}
        defaultDate={selectedDate}
        onSave={handleSaveTodo}
        onDelete={handleDeleteTodo}
      />
    </>
  );
}
