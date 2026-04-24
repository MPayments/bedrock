"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@bedrock/sdk-ui/components/dialog";
import { Input } from "@bedrock/sdk-ui/components/input";
import { Label } from "@bedrock/sdk-ui/components/label";
import { Textarea } from "@bedrock/sdk-ui/components/textarea";
import { toast } from "@bedrock/sdk-ui/components/sonner";

import type { FinanceDealPaymentStep } from "@/features/treasury/deals/lib/queries";
import { executeMutation } from "@/lib/resources/http";

function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `idem-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export interface StepSubmitDialogProps {
  step: FinanceDealPaymentStep;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function StepSubmitDialog({
  onOpenChange,
  onSuccess,
  open,
  step,
}: StepSubmitDialogProps) {
  const router = useRouter();
  const [providerRef, setProviderRef] = useState("");
  const [memo, setMemo] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function resetState() {
    setProviderRef("");
    setMemo("");
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetState();
    onOpenChange(next);
  }

  const isRetry = step.state === "failed";

  async function handleSubmit() {
    setIsSubmitting(true);
    const trimmedRef = providerRef.trim();
    const trimmedMemo = memo.trim();
    const body: Record<string, unknown> = {};
    if (trimmedRef) body.providerRef = trimmedRef;
    if (trimmedMemo) body.providerSnapshot = { memo: trimmedMemo };

    const result = await executeMutation({
      fallbackMessage: "Не удалось отправить шаг",
      request: () =>
        fetch(
          `/v1/treasury/steps/${encodeURIComponent(step.id)}/submit`,
          {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": createIdempotencyKey(),
            },
            body: JSON.stringify(body),
          },
        ),
    });

    setIsSubmitting(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success(isRetry ? "Повторная отправка" : "Шаг отправлен в банк");
    resetState();
    onOpenChange(false);
    if (onSuccess) {
      onSuccess();
    } else {
      router.refresh();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isRetry
              ? "Повторная отправка шага"
              : "Отправка шага в банк"}
          </DialogTitle>
          <DialogDescription>
            Зафиксируйте факт отправки платежа. Можно указать номер платёжки в
            банке и короткий комментарий. Подтверждение исполнения с выпиской
            добавляется отдельно после получения ответа банка.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`step-${step.id}-provider-ref`}>
              Номер в банке / провайдере
            </Label>
            <Input
              id={`step-${step.id}-provider-ref`}
              value={providerRef}
              placeholder="Необязательно"
              onChange={(event) => setProviderRef(event.target.value)}
              data-testid={`finance-step-submit-provider-ref-${step.id}`}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`step-${step.id}-memo`}>Комментарий</Label>
            <Textarea
              id={`step-${step.id}-memo`}
              value={memo}
              placeholder="Необязательный комментарий для аудита"
              onChange={(event) => setMemo(event.target.value)}
              data-testid={`finance-step-submit-memo-${step.id}`}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            Отмена
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            data-testid={`finance-step-submit-confirm-${step.id}`}
          >
            {isSubmitting
              ? "Отправляем..."
              : isRetry
                ? "Отправить повторно"
                : "Отправить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
