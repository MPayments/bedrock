"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type PendingRequisiteSwitchDialogProps = {
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function PendingRequisiteSwitchDialog({
  onConfirm,
  onOpenChange,
  open,
}: PendingRequisiteSwitchDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Переключить реквизит?</AlertDialogTitle>
          <AlertDialogDescription>
            Несохранённые изменения реквизита будут потеряны. Вы можете остаться
            в текущем редакторе и сначала сохранить правки.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Остаться</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            Перейти без сохранения
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
