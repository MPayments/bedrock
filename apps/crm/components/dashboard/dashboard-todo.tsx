"use client";

import { type HTMLAttributes, useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import {
  Calendar as CalendarIcon,
  GripVertical,
  ListTodo,
  Plus,
  Trash2,
  User,
} from "lucide-react";

import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";
import { Checkbox } from "@bedrock/sdk-ui/components/checkbox";
import { Input } from "@bedrock/sdk-ui/components/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@bedrock/sdk-ui/components/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@bedrock/sdk-ui/components/table";

import { UserCombobox } from "@/components/calendar/user-combobox";
import { DatePicker } from "@/components/ui/date-picker";
import {
  createCrmTask,
  deleteCrmTask,
  listCrmTasks,
  reorderCrmTasks,
  updateCrmTask,
} from "@/lib/tasks/client";
import type { CrmTask } from "@/lib/tasks/contracts";
import { useCrmTaskCapabilities } from "@/lib/tasks/use-task-capabilities";
import { cn } from "@/lib/utils";

function DraggableTodoRow({
  item,
  onToggle,
  onRename,
  onDelete,
  onDateChange,
}: {
  item: CrmTask;
  onToggle: (id: string, checked: boolean) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onDateChange: (id: string, date: Date | undefined) => void;
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
    if (next && next !== item.title) {
      onRename(item.id, next);
    }
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
          onCheckedChange={(value) => onToggle(item.id, !!value)}
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
              onChange={(event) => setTempTitle(event.target.value)}
              onBlur={commitRename}
              onKeyDown={(event) => {
                if (event.key === "Enter") commitRename();
                if (event.key === "Escape") setIsEditing(false);
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
          <PopoverTrigger render={<Button variant="ghost" size="icon" />}>
            <CalendarIcon size={16} />
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
  const { capabilities, isLoading: isCapabilitiesLoading } =
    useCrmTaskCapabilities();
  const [items, setItems] = useState<CrmTask[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDate, setNewTaskDate] = useState<Date | undefined>(undefined);
  const [newTaskAssignee, setNewTaskAssignee] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  const loadTasks = useCallback(async () => {
    if (!capabilities?.currentUserId) {
      return;
    }

    try {
      setIsLoading(true);
      const today = format(new Date(), "yyyy-MM-dd");
      const tasks = await listCrmTasks({
        completed: false,
        dateTo: today,
        includeNoDueDate: true,
      });
      setItems(tasks);
    } catch (error) {
      console.error("Failed to load CRM tasks:", error);
    } finally {
      setIsLoading(false);
    }
  }, [capabilities?.currentUserId]);

  useEffect(() => {
    if (capabilities?.currentUserId) {
      void loadTasks();
    }
  }, [capabilities?.currentUserId, loadTasks]);

  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {}),
  );

  const itemIds = useMemo(() => items.map((item) => item.id), [items]);

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    setItems((previousItems) => {
      const oldIndex = previousItems.findIndex((item) => item.id === active.id);
      const newIndex = previousItems.findIndex((item) => item.id === over.id);
      const reordered = arrayMove(previousItems, oldIndex, newIndex);

      void reorderCrmTasks({
        orderedTaskIds: reordered.map((item) => item.id),
      }).catch((error) => {
        console.error("Failed to reorder CRM tasks:", error);
        void loadTasks();
      });

      return reordered.map((item, index) => ({
        ...item,
        sortOrder: index,
      }));
    });
  }

  async function handleToggle(id: string, checked: boolean) {
    const itemToToggle = items.find((item) => item.id === id);

    if (checked) {
      setItems((previousItems) => previousItems.filter((item) => item.id !== id));
    } else {
      setItems((previousItems) =>
        previousItems.map((item) =>
          item.id === id ? { ...item, completed: checked } : item,
        ),
      );
    }

    try {
      await updateCrmTask(id, { completed: checked });
    } catch (error) {
      console.error("Failed to toggle CRM task:", error);
      if (checked && itemToToggle) {
        setItems((previousItems) => [...previousItems, itemToToggle]);
      } else {
        setItems((previousItems) =>
          previousItems.map((item) =>
            item.id === id ? { ...item, completed: !checked } : item,
          ),
        );
      }
    }
  }

  async function handleRename(id: string, title: string) {
    setItems((previousItems) =>
      previousItems.map((item) => (item.id === id ? { ...item, title } : item)),
    );

    try {
      await updateCrmTask(id, { title });
    } catch (error) {
      console.error("Failed to rename CRM task:", error);
      void loadTasks();
    }
  }

  async function handleDelete(id: string) {
    setItems((previousItems) => previousItems.filter((item) => item.id !== id));

    try {
      await deleteCrmTask(id);
    } catch (error) {
      console.error("Failed to delete CRM task:", error);
      void loadTasks();
    }
  }

  async function handleDateChange(id: string, date: Date | undefined) {
    setItems((previousItems) =>
      previousItems.map((item) =>
        item.id === id
          ? { ...item, dueDate: date ? format(date, "yyyy-MM-dd") : null }
          : item,
      ),
    );

    try {
      await updateCrmTask(id, {
        dueDate: date ? format(date, "yyyy-MM-dd") : null,
      });
    } catch (error) {
      console.error("Failed to update CRM task date:", error);
      void loadTasks();
    }
  }

  async function handleCreate() {
    const title = newTaskTitle.trim();

    if (!title || !capabilities?.currentUserId) {
      return;
    }

    try {
      const newTask = await createCrmTask({
        assigneeUserId: newTaskAssignee,
        dueDate: newTaskDate ? format(newTaskDate, "yyyy-MM-dd") : null,
        title,
      });
      setItems((previousItems) => [...previousItems, newTask]);
      setNewTaskTitle("");
      setNewTaskDate(undefined);
      setNewTaskAssignee(undefined);
    } catch (error) {
      console.error("Failed to create CRM task:", error);
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
              onChange={(event) => setNewTaskTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void handleCreate();
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
              {capabilities?.canAssignOthers && (
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
                onClick={() => void handleCreate()}
                disabled={
                  isLoading || isCapabilitiesLoading || !newTaskTitle.trim()
                }
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
