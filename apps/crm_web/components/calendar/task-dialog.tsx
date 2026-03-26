"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useSession } from "@/lib/auth-client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { UserCombobox } from "./user-combobox";

export interface TodoItem {
  id?: number;
  title: string;
  description?: string;
  dueDate?: string;
  agentId?: number;
  assignedBy?: number;
  completed?: boolean;
  order?: number;
}

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: TodoItem;
  onSave: (task: TodoItem) => void;
  onDelete?: (id: number) => void;
  defaultDate?: Date;
}

export function TaskDialog({
  open,
  onOpenChange,
  task,
  onSave,
  onDelete,
  defaultDate,
}: TaskDialogProps) {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.isAdmin ?? false;
  const currentUserId = (session?.user as any)?.id;

  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [dueDate, setDueDate] = React.useState<Date | undefined>(undefined);
  const [assigneeId, setAssigneeId] = React.useState<number | undefined>(
    undefined
  );
  const [isSaving, setIsSaving] = React.useState(false);

  // Инициализация формы
  React.useEffect(() => {
    if (open) {
      if (task) {
        setTitle(task.title || "");
        setDescription(task.description || "");
        setDueDate(task.dueDate ? new Date(task.dueDate) : undefined);
        setAssigneeId(task.agentId);
      } else {
        setTitle("");
        setDescription("");
        setDueDate(defaultDate);
        setAssigneeId(currentUserId);
      }
    }
  }, [open, task, defaultDate, currentUserId]);

  const handleSave = async () => {
    if (!title.trim()) {
      return;
    }

    setIsSaving(true);

    try {
      const taskData: TodoItem = {
        ...(task?.id && { id: task.id }),
        title: title.trim(),
        description: description.trim() || undefined,
        dueDate: dueDate ? format(dueDate, "yyyy-MM-dd") : undefined,
        agentId: assigneeId || currentUserId,
        assignedBy: currentUserId,
      };

      await onSave(taskData);
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (task?.id && onDelete) {
      if (confirm("Вы уверены, что хотите удалить эту задачу?")) {
        await onDelete(task.id);
        onOpenChange(false);
      }
    }
  };

  const isEditing = !!task?.id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Редактировать задачу" : "Новая задача"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Внесите изменения в задачу"
              : "Создайте новую задачу для себя или другого пользователя"}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="title">
              Название <span className="text-red-500">*</span>
            </Label>
            <Input
              id="title"
              placeholder="Название задачи"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSave();
                }
              }}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Описание</Label>
            <Textarea
              id="description"
              placeholder="Дополнительная информация о задаче"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="dueDate">Дата выполнения</Label>
            <DatePicker
              value={dueDate}
              onChange={setDueDate}
              placeholder="Без даты"
              className="w-full"
            />
          </div>

          {isAdmin && (
            <div className="grid gap-2">
              <Label htmlFor="assignee">Исполнитель</Label>
              <UserCombobox
                value={assigneeId}
                onValueChange={setAssigneeId}
                placeholder="Выберите исполнителя"
                className="w-full"
              />
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-between sm:justify-between">
          {isEditing && onDelete && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={isSaving}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Удалить
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Отмена
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !title.trim()}>
              {isSaving ? "Сохранение..." : "Сохранить"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
