"use client";

import type * as React from "react";

import { EntityDeleteDialog } from "@/components/entities/entity-delete-dialog";

type DeleteActionResult = Promise<boolean | void> | boolean | void;

type AccountDeleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deleting: boolean;
  onDelete: () => DeleteActionResult;
  trigger?: React.ComponentProps<typeof EntityDeleteDialog>["trigger"];
  disableDelete?: boolean;
};

export function AccountDeleteDialog({
  open,
  onOpenChange,
  deleting,
  onDelete,
  trigger,
  disableDelete = false,
}: AccountDeleteDialogProps) {
  return (
    <EntityDeleteDialog
      open={open}
      onOpenChange={onOpenChange}
      deleting={deleting}
      onDelete={onDelete}
      trigger={trigger}
      disableDelete={disableDelete}
      title="Удалить счёт?"
      description="Счёт будет удалён без возможности восстановления."
    />
  );
}
