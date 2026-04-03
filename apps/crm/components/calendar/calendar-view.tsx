"use client";

import * as React from "react";
import { addMonths, addWeeks, format, subMonths, subWeeks } from "date-fns";
import { ru } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { Button } from "@bedrock/sdk-ui/components/button";
import { Card, CardContent, CardHeader } from "@bedrock/sdk-ui/components/card";
import { Tabs, TabsList, TabsTrigger } from "@bedrock/sdk-ui/components/tabs";

import { MonthView } from "./month-view";
import { TaskDialog, type TaskDialogValue } from "./task-dialog";
import { WeekView } from "./week-view";
import {
  createCrmTask,
  deleteCrmTask,
  getCrmTaskCalendar,
  updateCrmTask,
} from "@/lib/tasks/client";
import type { CrmTask } from "@/lib/tasks/contracts";

type ViewMode = "month" | "week";

interface CalendarViewProps {
  initialDate?: Date;
}

export function CalendarView({ initialDate = new Date() }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = React.useState(initialDate);
  const [viewMode, setViewMode] = React.useState<ViewMode>("month");
  const [tasksByDate, setTasksByDate] = React.useState<Record<string, CrmTask[]>>(
    {},
  );
  const [loading, setLoading] = React.useState(false);
  const [selectedTask, setSelectedTask] = React.useState<CrmTask | undefined>();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>();

  const fetchTasks = React.useCallback(async () => {
    try {
      setLoading(true);
      const month = format(currentDate, "yyyy-MM");
      const response = await getCrmTaskCalendar({ month });
      setTasksByDate(response.tasks || {});
    } catch (error) {
      console.error("Calendar fetch error:", error);
    } finally {
      setLoading(false);
    }
  }, [currentDate]);

  React.useEffect(() => {
    void fetchTasks();
  }, [fetchTasks]);

  const handlePrevious = () => {
    if (viewMode === "month") {
      setCurrentDate(subMonths(currentDate, 1));
      return;
    }

    setCurrentDate(subWeeks(currentDate, 1));
  };

  const handleNext = () => {
    if (viewMode === "month") {
      setCurrentDate(addMonths(currentDate, 1));
      return;
    }

    setCurrentDate(addWeeks(currentDate, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setSelectedTask(undefined);
    setDialogOpen(true);
  };

  const handleTaskClick = (task: CrmTask) => {
    setSelectedTask(task);
    setSelectedDate(task.dueDate ? new Date(task.dueDate) : undefined);
    setDialogOpen(true);
  };

  const handleCreateTask = () => {
    setSelectedTask(undefined);
    setSelectedDate(undefined);
    setDialogOpen(true);
  };

  const handleSaveTask = async (task: TaskDialogValue) => {
    try {
      if (task.id) {
        await updateCrmTask(task.id, {
          assigneeUserId: task.assigneeUserId,
          description: task.description ?? null,
          dueDate: task.dueDate ?? null,
          title: task.title,
        });
      } else {
        await createCrmTask({
          assigneeUserId: task.assigneeUserId,
          description: task.description ?? null,
          dueDate: task.dueDate ?? null,
          title: task.title,
        });
      }

      await fetchTasks();
    } catch (error) {
      console.error("Error saving CRM task:", error);
    }
  };

  const handleDeleteTask = async (id: string) => {
    try {
      await deleteCrmTask(id);
      await fetchTasks();
    } catch (error) {
      console.error("Error deleting CRM task:", error);
    }
  };

  const handleTaskToggle = async (taskId: string, completed: boolean) => {
    try {
      await updateCrmTask(taskId, { completed });
      await fetchTasks();
    } catch (error) {
      console.error("Error toggling CRM task:", error);
    }
  };

  const getTitle = () => {
    if (viewMode === "month") {
      return format(currentDate, "LLLL yyyy", { locale: ru });
    }

    return `Неделя ${format(currentDate, "w, yyyy", { locale: ru })}`;
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
              <Button size="sm" onClick={handleCreateTask}>
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
              tasksByDate={tasksByDate}
              onDateClick={handleDateClick}
              onTodoClick={handleTaskClick}
            />
          ) : (
            <WeekView
              currentDate={currentDate}
              tasksByDate={tasksByDate}
              onDateClick={handleDateClick}
              onTodoClick={handleTaskClick}
              onTodoToggle={handleTaskToggle}
            />
          )}
        </CardContent>
      </Card>

      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={selectedTask}
        defaultDate={selectedDate}
        onSave={handleSaveTask}
        onDelete={handleDeleteTask}
      />
    </>
  );
}
