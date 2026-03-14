"use client";

import type * as React from "react";
import { Trash2 } from "lucide-react";

import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@bedrock/sdk-ui/components/dialog";
import { Spinner } from "@bedrock/sdk-ui/components/spinner";

type DeleteActionResult = Promise<boolean | void> | boolean | void;

type EntityDeleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deleting: boolean;
  onDelete: () => DeleteActionResult;
  title: string;
  description: React.ReactNode;
  trigger?: React.ComponentProps<typeof DialogTrigger>["render"];
  disableDelete?: boolean;
  actionLabel?: string;
  deletingLabel?: string;
};

export function EntityDeleteDialog({
  open,
  onOpenChange,
  deleting,
  onDelete,
  title,
  description,
  trigger,
  disableDelete = false,
  actionLabel = "Удалить",
  deletingLabel = "Удаление...",
}: EntityDeleteDialogProps) {
  const deleteDisabled = deleting || disableDelete;

  async function handleDeleteClick() {
    const result = await onDelete();
    if (result !== false) {
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger ? (
        <DialogTrigger render={trigger}>
          <Trash2 className="size-4" />
          {actionLabel}
        </DialogTrigger>
      ) : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose
            render={
              <Button variant="outline" type="button" disabled={deleteDisabled} />
            }
          >
            Отмена
          </DialogClose>
          <Button
            variant="destructive"
            type="button"
            disabled={deleteDisabled}
            onClick={handleDeleteClick}
          >
            {deleting ? (
              <Spinner className="size-4" />
            ) : (
              <Trash2 className="size-4" />
            )}
            {deleting ? deletingLabel : actionLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
