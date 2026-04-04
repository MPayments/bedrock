"use client";

import * as React from "react";
import { format } from "date-fns";
import { Trash2 } from "lucide-react";

import { Button } from "@bedrock/sdk-ui/components/button";
import { DatePicker } from "@bedrock/sdk-ui/components/date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@bedrock/sdk-ui/components/dialog";
import { Input } from "@bedrock/sdk-ui/components/input";
import { Label } from "@bedrock/sdk-ui/components/label";
import { Textarea } from "@bedrock/sdk-ui/components/textarea";

import type { CrmTask } from "@/lib/tasks/contracts";
import { useCrmTaskCapabilities } from "@/lib/tasks/use-task-capabilities";

import { UserCombobox } from "./user-combobox";

export type TaskDialogValue = {
  id?: string;
  title: string;
  description?: string;
  dueDate?: string;
  assigneeUserId?: string;
  dealId?: string | null;
};

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: CrmTask;
  onSave: (task: TaskDialogValue) => void;
  onDelete?: (id: string) => void;
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
  const { capabilities } = useCrmTaskCapabilities();

  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [dueDate, setDueDate] = React.useState<Date | undefined>(undefined);
  const [assigneeId, setAssigneeId] = React.useState<string | undefined>();
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      return;
    }

    if (task) {
      setTitle(task.title || "");
      setDescription(task.description || "");
      setDueDate(task.dueDate ? new Date(task.dueDate) : undefined);
      setAssigneeId(task.assigneeUserId);
      return;
    }

    setTitle("");
    setDescription("");
    setDueDate(defaultDate);
    setAssigneeId(capabilities?.currentUserId);
  }, [open, task, defaultDate, capabilities?.currentUserId]);

  const handleSave = async () => {
    if (!title.trim()) {
      return;
    }

    setIsSaving(true);

    try {
      await onSave({
        ...(task?.id && { id: task.id }),
        title: title.trim(),
        description: description.trim() || undefined,
        dueDate: dueDate ? format(dueDate, "yyyy-MM-dd") : undefined,
        assigneeUserId: assigneeId || capabilities?.currentUserId,
        dealId: task?.dealId,
      });
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
              onChange={(event) => setTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void handleSave();
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
              onChange={(event) => setDescription(event.target.value)}
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

          {capabilities?.canAssignOthers && (
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
              onClick={() => void handleDelete()}
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
            <Button
              onClick={() => void handleSave()}
              disabled={isSaving || !title.trim()}
            >
              {isSaving ? "Сохранение..." : "Сохранить"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
