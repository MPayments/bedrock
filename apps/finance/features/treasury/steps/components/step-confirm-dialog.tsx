"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@bedrock/sdk-ui/components/select";
import { Spinner } from "@bedrock/sdk-ui/components/spinner";
import { Textarea } from "@bedrock/sdk-ui/components/textarea";
import { toast } from "@bedrock/sdk-ui/components/sonner";

import type { FinanceDealPaymentStep } from "@/features/treasury/deals/lib/queries";
import { executeMutation } from "@/lib/resources/http";

import {
  requiresSettlementEvidence,
  type StepConfirmOutcome,
} from "../lib/step-helpers";

const OUTCOME_OPTIONS: ReadonlyArray<{
  value: StepConfirmOutcome;
  label: string;
}> = [
  {
    value: "settled",
    label: "Исполнено (с подтверждением)",
  },
  {
    value: "failed",
    label: "Ошибка / не прошло",
  },
  {
    value: "returned",
    label: "Возврат",
  },
];

function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `idem-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const EVIDENCE_PURPOSE_OPTIONS: ReadonlyArray<{
  value: string;
  label: string;
  hint: string;
}> = [
  {
    value: "settlement_confirmation",
    label: "Подтверждение расчётов",
    hint: "Подтверждает исполнение (выписка/ответ банка)",
  },
  {
    value: "bank_confirmation",
    label: "Подтверждение из банка",
    hint: "Выписка или ответ банка",
  },
  {
    value: "counterparty_receipt",
    label: "Квитанция контрагента",
    hint: "Подтверждение получения от контрагента",
  },
];

type UploadAssetResponse = { id: string };

export interface StepConfirmDialogProps {
  step: FinanceDealPaymentStep;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  uploadAssetPath?: string;
  initialOutcome?: StepConfirmOutcome;
}

export function StepConfirmDialog({
  initialOutcome = "settled",
  onOpenChange,
  onSuccess,
  open,
  step,
  uploadAssetPath: uploadAssetPathOverride,
}: StepConfirmDialogProps) {
  const uploadAssetPath =
    uploadAssetPathOverride ??
    `/v1/treasury/steps/${encodeURIComponent(step.id)}/attachments`;
  const router = useRouter();
  const [outcome, setOutcome] = useState<StepConfirmOutcome>(initialOutcome);
  const [purpose, setPurpose] = useState<string>(
    EVIDENCE_PURPOSE_OPTIONS[0]!.value,
  );
  const [file, setFile] = useState<File | null>(null);
  const [failureReason, setFailureReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const needsEvidence =
    outcome === "settled" && requiresSettlementEvidence(step);
  const needsFailureReason = outcome === "failed";
  const outcomeLabel =
    OUTCOME_OPTIONS.find((option) => option.value === outcome)?.label ??
    outcome;
  const purposeLabel =
    EVIDENCE_PURPOSE_OPTIONS.find((option) => option.value === purpose)
      ?.label ?? purpose;

  function resetState() {
    setOutcome(initialOutcome);
    setPurpose(EVIDENCE_PURPOSE_OPTIONS[0]!.value);
    setFile(null);
    setFailureReason("");
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetState();
    onOpenChange(next);
  }

  useEffect(() => {
    if (open) {
      setOutcome(initialOutcome);
    }
  }, [initialOutcome, open]);

  async function uploadEvidence(): Promise<string | null> {
    if (!file || !uploadAssetPath) return null;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("visibility", "internal");
    formData.append("purpose", "other");

    const uploadResult = await executeMutation({
      fallbackMessage: "Не удалось загрузить файл",
      request: () =>
        fetch(uploadAssetPath, {
          method: "POST",
          credentials: "include",
          body: formData,
        }),
    });

    if (!uploadResult.ok) {
      toast.error(uploadResult.message);
      return null;
    }

    const asset = uploadResult.data as UploadAssetResponse | null;
    if (!asset?.id) {
      toast.error("Сервер не вернул идентификатор файла");
      return null;
    }
    return asset.id;
  }

  async function handleConfirm() {
    if (needsEvidence && !file) {
      toast.error("Для подтверждения исполнения нужен файл-доказательство");
      return;
    }

    setIsSubmitting(true);

    let fileAssetId: string | null = null;
    if (file && uploadAssetPath) {
      fileAssetId = await uploadEvidence();
      if (!fileAssetId) {
        setIsSubmitting(false);
        return;
      }
    }

    const body: Record<string, unknown> = { outcome };
    if (fileAssetId) {
      body.artifacts = [{ fileAssetId, purpose }];
    }
    if (needsFailureReason && failureReason.trim()) {
      body.failureReason = failureReason.trim();
    }

    const result = await executeMutation({
      fallbackMessage: "Не удалось подтвердить шаг",
      request: () =>
        fetch(
          `/v1/treasury/steps/${encodeURIComponent(step.id)}/confirm`,
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

    const successMessages: Record<StepConfirmOutcome, string> = {
      settled: "Шаг подтверждён как выполненный",
      failed: "Шаг отмечен как ошибка",
      returned: "Возврат подтверждён",
    };
    toast.success(successMessages[outcome]);
    resetState();
    onOpenChange(false);
    if (onSuccess) {
      onSuccess();
    } else {
      router.refresh();
    }
  }

  const canSubmit = (!needsEvidence || Boolean(file)) && !isSubmitting;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Подтверждение шага</DialogTitle>
          <DialogDescription>
            Зафиксируйте исход после получения ответа банка или контрагента.
            Файл обязателен только для финального SWIFT/MT103 к бенефициару.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Исход</Label>
            <Select
              value={outcome}
              onValueChange={(value) => {
                if (value) setOutcome(value as StepConfirmOutcome);
              }}
            >
              <SelectTrigger data-testid={`finance-step-confirm-outcome-${step.id}`}>
                <span data-slot="select-value" className="flex flex-1 text-left">
                  {outcomeLabel}
                </span>
              </SelectTrigger>
              <SelectContent>
                {OUTCOME_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {uploadAssetPath ? (
            <>
              <div className="space-y-2">
                <Label htmlFor={`step-${step.id}-evidence-file`}>
                  Файл-доказательство
                  {needsEvidence ? (
                    <span className="text-destructive ml-1">*</span>
                  ) : (
                    <span className="text-muted-foreground ml-2 text-xs">
                      необязательно
                    </span>
                  )}
                </Label>
                <p className="text-muted-foreground text-xs">
                  Для финальной выплаты бенефициару приложите SWIFT/MT103. Для
                  остальных шагов файл можно приложить по желанию: выписку
                  банка, платёжку со статусом исполнено или подтверждение
                  контрагента.
                </p>
                <Input
                  id={`step-${step.id}-evidence-file`}
                  type="file"
                  onChange={(event) =>
                    setFile(event.target.files?.[0] ?? null)
                  }
                  data-testid={`finance-step-confirm-file-${step.id}`}
                />
              </div>

              {file ? (
                <div className="space-y-2">
                  <Label>Тип подтверждения</Label>
                  <Select
                    value={purpose}
                    onValueChange={(value) => {
                      if (value) setPurpose(value);
                    }}
                  >
                    <SelectTrigger>
                      <span data-slot="select-value" className="flex flex-1 text-left">
                        {purposeLabel}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {EVIDENCE_PURPOSE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="text-muted-foreground text-xs">
                    {
                      EVIDENCE_PURPOSE_OPTIONS.find(
                        (opt) => opt.value === purpose,
                      )?.hint
                    }
                  </div>
                </div>
              ) : null}
            </>
          ) : null}

          {needsFailureReason ? (
            <div className="space-y-2">
              <Label htmlFor={`step-${step.id}-failure-reason`}>
                Причина ошибки
              </Label>
              <Textarea
                id={`step-${step.id}-failure-reason`}
                value={failureReason}
                placeholder="Коротко опишите, что пошло не так"
                onChange={(event) => setFailureReason(event.target.value)}
                data-testid={`finance-step-confirm-failure-reason-${step.id}`}
              />
            </div>
          ) : null}
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
            onClick={handleConfirm}
            disabled={!canSubmit}
            data-testid={`finance-step-confirm-submit-${step.id}`}
          >
            {isSubmitting ? (
              <>
                <Spinner data-icon="inline-start" />
                Сохраняем...
              </>
            ) : (
              "Подтвердить исполнение"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
