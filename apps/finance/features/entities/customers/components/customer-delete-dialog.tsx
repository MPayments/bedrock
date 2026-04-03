"use client";

import type * as React from "react";

import { EntityDeleteDialog } from "@/components/entities/entity-delete-dialog";

type DeleteActionResult = Promise<boolean | void> | boolean | void;

type CustomerDeleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deleting: boolean;
  onDelete: () => DeleteActionResult;
  description?: React.ReactNode;
  trigger?: React.ComponentProps<typeof EntityDeleteDialog>["trigger"];
  disableDelete?: boolean;
};

export function CustomerDeleteDialog({
  open,
  onOpenChange,
  deleting,
  onDelete,
  description = "Клиент будет удален без возможности восстановления.",
  trigger,
  disableDelete = false,
}: CustomerDeleteDialogProps) {
  return (
    <EntityDeleteDialog
      open={open}
      onOpenChange={onOpenChange}
      deleting={deleting}
      onDelete={onDelete}
      trigger={trigger}
      disableDelete={disableDelete}
      title="Удалить клиента?"
      description={description}
    />
  );
}
