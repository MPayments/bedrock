"use client";

import type * as React from "react";

import { EntityDeleteDialog } from "@/components/entities/entity-delete-dialog";

type DeleteActionResult = Promise<boolean | void> | boolean | void;

type CurrencyDeleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deleting: boolean;
  onDelete: () => DeleteActionResult;
  trigger?: React.ComponentProps<typeof EntityDeleteDialog>["trigger"];
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
  return (
    <EntityDeleteDialog
      open={open}
      onOpenChange={onOpenChange}
      deleting={deleting}
      onDelete={onDelete}
      trigger={trigger}
      disableDelete={disableDelete}
      title="Удалить валюту?"
      description="Валюта будет удалена без возможности восстановления."
    />
  );
}
