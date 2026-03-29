"use client";

import type * as React from "react";

import { EntityDeleteDialog } from "@/components/entities/entity-delete-dialog";

type DeleteActionResult = Promise<boolean | void> | boolean | void;

type CounterpartyDeleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deleting: boolean;
  onDelete: () => DeleteActionResult;
  trigger?: React.ComponentProps<typeof EntityDeleteDialog>["trigger"];
  disableDelete?: boolean;
};

export function CounterpartyDeleteDialog({
  open,
  onOpenChange,
  deleting,
  onDelete,
  trigger,
  disableDelete = false,
}: CounterpartyDeleteDialogProps) {
  return (
    <EntityDeleteDialog
      open={open}
      onOpenChange={onOpenChange}
      deleting={deleting}
      onDelete={onDelete}
      trigger={trigger}
      disableDelete={disableDelete}
      title="Удалить контрагента?"
      description="Контрагент будет удален без возможности восстановления."
    />
  );
}
