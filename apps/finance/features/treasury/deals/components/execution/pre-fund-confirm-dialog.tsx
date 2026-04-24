"use client";

import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@bedrock/sdk-ui/components/dialog";

export interface PreFundConfirmDialogProps {
  legIdx: number;
  legLabel: string;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  pending: boolean;
}

export function PreFundConfirmDialog({
  legIdx,
  legLabel,
  onConfirm,
  onOpenChange,
  open,
  pending,
}: PreFundConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Выполнить шаг до поступления от клиента?</DialogTitle>
          <DialogDescription>
            Дебиторская задолженность клиента ещё не закрыта. При выполнении
            этого шага банк авансирует собственные средства; расчёт с клиентом
            останется открытой позицией до поступления оплаты.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
          <div className="text-muted-foreground">Шаг</div>
          <div className="mt-1 font-medium">
            #{legIdx} · {legLabel}
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={pending}
            onClick={() => onOpenChange(false)}
            variant="outline"
          >
            Отмена
          </Button>
          <Button disabled={pending} onClick={onConfirm}>
            {pending ? "Создаём..." : "Продолжить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
