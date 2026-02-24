"use client";

import type * as React from "react";
import { Trash2 } from "lucide-react";

import { Button } from "@bedrock/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@bedrock/ui/components/dialog";
import { Spinner } from "@bedrock/ui/components/spinner";

type DeleteActionResult = Promise<boolean | void> | boolean | void;

type CurrencyDeleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deleting: boolean;
  onDelete: () => DeleteActionResult;
  trigger?: React.ComponentProps<typeof DialogTrigger>["render"];
  disableDelete?: boolean;
};

export function CurrencyDeleteDialog({
  open,
  onOpenChange,
  deleting,
  onDelete,
  trigger,
  disableDelete = false,
}: CurrencyDeleteDialogProps) {
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
          Удалить
        </DialogTrigger>
      ) : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Удалить валюту?</DialogTitle>
          <DialogDescription>
            Валюта будет удалена без возможности восстановления.
          </DialogDescription>
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
            {deleting ? <Spinner className="size-4" /> : <Trash2 className="size-4" />}
            {deleting ? "Удаление..." : "Удалить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
