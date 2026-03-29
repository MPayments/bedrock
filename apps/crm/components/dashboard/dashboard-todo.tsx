"use client";

import { type HTMLAttributes, useMemo, useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { API_BASE_URL } from "@/lib/constants";
import {
  Calendar as CalendarIcon,
  Plus,
  Trash2,
  GripVertical,
  User,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  useSensor,
  useSensors,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useSession } from "@/lib/auth-client";

import { Card, CardContent, CardTitle, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { UserCombobox } from "@/components/calendar/user-combobox";
import { Badge } from "@/components/ui/badge";
import { ListTodo } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type TodoItem = {
  id: number;
  title: string;
  completed: boolean;
  order: number;
  agentId: string;
  dueDate?: string;
  assignedBy?: string;
  description?: string;
  assignedByUser?: {
    id: string;
    name: string;
  };
};

function DraggableTodoRow({
  item,
  onToggle,
  onRename,
  onDelete,
  onDateChange,
}: {
  item: TodoItem;
  onToggle: (id: number, checked: boolean) => void;
  onRename: (id: number, title: string) => void;
  onDelete: (id: number) => void;
  onDateChange: (id: number, date: Date | undefined) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });
  const [isEditing, setIsEditing] = useState(false);
  const [tempTitle, setTempTitle] = useState(item.title);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  function commitRename() {
    const next = tempTitle.trim();
    if (next && next !== item.title) onRename(item.id, next);
    setIsEditing(false);
  }

  return (
    <TableRow
      ref={setNodeRef}
      data-dragging={isDragging}
      className="relative z-0 data-[dragging=true]:z-10 data-[dragging=true]:opacity-80"
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <TableCell>
        <GripVertical
          {...attributes}
          {...listeners}
          size={16}
          className="cursor-grab"
        />
      </TableCell>
      <TableCell>
        <Checkbox
          checked={item.completed}
          onCheckedChange={(v) => onToggle(item.id, !!v)}
          aria-label="Mark completed"
        />
      </TableCell>
      <TableCell
        onDoubleClick={() => {
          setTempTitle(item.title);
          setIsEditing(true);
        }}
      >
        <div className="flex flex-col gap-1">
          {isEditing ? (
            <Input
              autoFocus
              value={tempTitle}
              onChange={(e) => setTempTitle(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") setIsEditing(false);
              }}
              className="h-8"
            />
          ) : (
            <span
              className={
                item.completed
                  ? "line-through text-muted-foreground"
                  : undefined
              }
            >
              {item.title}
            </span>
          )}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {item.dueDate && (
              <Badge variant="outline" className="text-xs">
                {format(new Date(item.dueDate), "d MMM", { locale: ru })}
              </Badge>
            )}
            {item.assignedByUser?.name && (
              <span className="flex items-center gap-1">
                <User size={12} />
                {item.assignedByUser.name}
              </span>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell className="float-right space-x-2">
        <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon">
              <CalendarIcon size={16} />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <DatePicker
              value={item.dueDate ? new Date(item.dueDate) : undefined}
              onChange={(date) => {
                onDateChange(item.id, date);
                setDatePickerOpen(false);
              }}
              allowClear
            />
          </PopoverContent>
        </Popover>
        <Button variant="ghost" size="icon" onClick={() => onDelete(item.id)}>
          <Trash2 size={16} />
        </Button>
      </TableCell>
    </TableRow>
  );
}

export function DashboardTodo({ className }: HTMLAttributes<HTMLDivElement>) {
  const { data: session } = useSession();
  const agentId = (session?.user as any)?.id;
  const isAdmin = session?.user?.role === "admin";

  const [items, setItems] = useState<TodoItem[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDate, setNewTaskDate] = useState<Date | undefined>(undefined);
  const [newTaskAssignee, setNewTaskAssignee] = useState<string | undefined>(
    undefined
  );
  const [isLoading, setIsLoading] = useState(false);

  // Загрузка задач при монтировании
  useEffect(() => {
    if (agentId) {
      loadTodos();
    }
  }, [agentId]);

  async function loadTodos() {
    if (!agentId) return;

    try {
      setIsLoading(true);
      // Получаем все незакрытые задачи с датой до сегодня (включительно) или без даты
      const today = format(new Date(), "yyyy-MM-dd");
      const response = await fetch(
        `${API_BASE_URL}/todos?agentId=${agentId}&includeNoDueDate=true&dateTo=${today}&completed=false`,
        { credentials: "include" }
      );
      if (response.ok) {
        const data = await response.json();
        setItems(Array.isArray(data) ? data : data.data ?? []);
      }
    } catch (error) {
      console.error("Failed to load todos:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {})
  );

  const itemIds = useMemo(() => items.map((i) => i.id), [items]);

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setItems((prev) => {
      const oldIndex = prev.findIndex((i) => i.id === active.id);
      const newIndex = prev.findIndex((i) => i.id === over.id);
      const reordered = arrayMove(prev, oldIndex, newIndex);

      // Обновляем порядок на сервере
      const itemsWithOrder = reordered.map((item, index) => ({
        id: item.id,
        order: index,
      }));

      fetch(`${API_BASE_URL}/todos/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: itemsWithOrder }),
      }).catch((error) => console.error("Failed to reorder todos:", error));

      return reordered.map((item, index) => ({ ...item, order: index }));
    });
  }

  async function handleToggle(id: number, checked: boolean) {
    // Сохраняем задачу для возможного отката
    const itemToToggle = items.find((it) => it.id === id);

    // Оптимистичное обновление UI - если задача закрывается, удаляем её из списка
    if (checked) {
      setItems((prev) => prev.filter((it) => it.id !== id));
    } else {
      setItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, completed: checked } : it))
      );
    }

    try {
      const response = await fetch(`${API_BASE_URL}/todos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: checked }),
      });

      if (!response.ok) {
        // Откатываем изменения при ошибке
        if (checked && itemToToggle) {
          setItems((prev) => [...prev, itemToToggle]);
        } else {
          setItems((prev) =>
            prev.map((it) =>
              it.id === id ? { ...it, completed: !checked } : it
            )
          );
        }
      }
    } catch (error) {
      console.error("Failed to toggle todo:", error);
      // Откатываем изменения при ошибке
      if (checked && itemToToggle) {
        setItems((prev) => [...prev, itemToToggle]);
      } else {
        setItems((prev) =>
          prev.map((it) => (it.id === id ? { ...it, completed: !checked } : it))
        );
      }
    }
  }

  async function handleRename(id: number, title: string) {
    // Оптимистичное обновление UI
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, title } : it))
    );

    try {
      const response = await fetch(`${API_BASE_URL}/todos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });

      if (!response.ok) {
        // Перезагружаем при ошибке
        loadTodos();
      }
    } catch (error) {
      console.error("Failed to rename todo:", error);
      loadTodos();
    }
  }

  async function handleDelete(id: number) {
    // Оптимистичное удаление из UI
    setItems((prev) => prev.filter((it) => it.id !== id));

    try {
      const response = await fetch(`${API_BASE_URL}/todos/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        // Перезагружаем при ошибке
        loadTodos();
      }
    } catch (error) {
      console.error("Failed to delete todo:", error);
      loadTodos();
    }
  }

  async function handleDateChange(id: number, date: Date | undefined) {
    // Оптимистичное обновление UI
    setItems((prev) =>
      prev.map((it) =>
        it.id === id
          ? { ...it, dueDate: date ? format(date, "yyyy-MM-dd") : undefined }
          : it
      )
    );

    try {
      const response = await fetch(`${API_BASE_URL}/todos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dueDate: date ? format(date, "yyyy-MM-dd") : null,
        }),
      });

      if (!response.ok) {
        loadTodos();
      }
    } catch (error) {
      console.error("Failed to update date:", error);
      loadTodos();
    }
  }

  async function handleCreate() {
    const title = newTaskTitle.trim();
    if (!title || !agentId) return;

    try {
      const response = await fetch(`${API_BASE_URL}/todos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: newTaskAssignee || agentId,
          title,
          order: items.length,
          dueDate: newTaskDate ? format(newTaskDate, "yyyy-MM-dd") : null,
          assignedBy: isAdmin && newTaskAssignee ? agentId : null,
        }),
      });

      if (response.ok) {
        const newTodo = await response.json();
        setItems((prev) => [...prev, newTodo]);
        setNewTaskTitle("");
        setNewTaskDate(undefined);
        setNewTaskAssignee(undefined);
      }
    } catch (error) {
      console.error("Failed to create todo:", error);
    }
  }

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader className="shrink-0">
        <CardTitle className="flex items-center gap-2">
          <ListTodo className="h-5 w-5 text-muted-foreground" />
          Задачи на день
          {items.length > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {items.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 overflow-auto">
        <div className="border rounded-md">
          <div className="p-2 border-b space-y-2">
            <Input
              className="border-none shadow-none focus:outline-none"
              placeholder="Новая задача..."
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleCreate();
                }
              }}
            />
            <div className="flex items-center gap-2">
              <DatePicker
                value={newTaskDate}
                onChange={setNewTaskDate}
                placeholder="Без даты"
                className="w-[180px]"
                allowClear
              />
              {isAdmin && (
                <UserCombobox
                  value={newTaskAssignee}
                  onValueChange={setNewTaskAssignee}
                  placeholder="Исполнитель..."
                  className="flex-1"
                />
              )}
              <Button
                variant="default"
                size="sm"
                onClick={handleCreate}
                disabled={isLoading || !newTaskTitle.trim()}
              >
                <Plus className="mr-2 h-4 w-4" />
                Создать
              </Button>
            </div>
          </div>
          <DndContext
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            sensors={sensors}
            onDragEnd={handleDragEnd}
          >
            <Table>
              <TableBody>
                <SortableContext
                  items={itemIds}
                  strategy={verticalListSortingStrategy}
                >
                  {items.map((item) => (
                    <DraggableTodoRow
                      key={item.id}
                      item={item}
                      onToggle={handleToggle}
                      onRename={handleRename}
                      onDelete={handleDelete}
                      onDateChange={handleDateChange}
                    />
                  ))}
                </SortableContext>
              </TableBody>
            </Table>
          </DndContext>
        </div>
      </CardContent>
    </Card>
  );
}
