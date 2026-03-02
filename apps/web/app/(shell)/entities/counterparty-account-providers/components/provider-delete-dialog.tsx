"use client";

import type * as React from "react";

import { EntityDeleteDialog } from "@/components/entities/entity-delete-dialog";

type DeleteActionResult = Promise<boolean | void> | boolean | void;

type ProviderDeleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deleting: boolean;
  onDelete: () => DeleteActionResult;
  trigger?: React.ComponentProps<typeof EntityDeleteDialog>["trigger"];
  disableDelete?: boolean;
};

export function ProviderDeleteDialog({
  open,
  onOpenChange,
  deleting,
  onDelete,
  trigger,
  disableDelete = false,
}: ProviderDeleteDialogProps) {
  return (
    <EntityDeleteDialog
      open={open}
      onOpenChange={onOpenChange}
      deleting={deleting}
      onDelete={onDelete}
      trigger={trigger}
      disableDelete={disableDelete}
      title="Удалить провайдера?"
      description="Провайдер будет удалён без возможности восстановления. Если к нему привязаны счета, удаление невозможно."
    />
  );
}
