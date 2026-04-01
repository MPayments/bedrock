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

type PendingCreateLeaveDialogProps = {
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function PendingCreateLeaveDialog({
  onConfirm,
  onOpenChange,
  open,
}: PendingCreateLeaveDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Покинуть страницу создания клиента?</AlertDialogTitle>
          <AlertDialogDescription>
            Несохраненные изменения будут потеряны. Вы можете остаться на
            странице и завершить создание позже.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Остаться</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            Выйти без сохранения
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
