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
  SelectValue,
} from "@bedrock/sdk-ui/components/select";
import { Textarea } from "@bedrock/sdk-ui/components/textarea";
import { toast } from "@bedrock/sdk-ui/components/sonner";

import type { FinanceDealPaymentStep } from "@/features/treasury/deals/lib/queries";
import { executeMutation } from "@/lib/resources/http";

import type { StepConfirmOutcome } from "../lib/step-helpers";

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
  /**
   * Path to POST a multipart `file` to in order to materialize an evidence
   * file asset. Expected response: `{ id: string }`. Omit to disable the
   * file-upload control (e.g. for standalone steps without a deal).
   */
  uploadAssetPath?: string;
  /**
   * Outcome to preselect when the dialog opens. Used by the "mark returned"
   * flow from completed steps to skip straight to the returned branch.
   * Defaults to `"settled"`.
   */
  initialOutcome?: StepConfirmOutcome;
}

export function StepConfirmDialog({
  initialOutcome = "settled",
  onOpenChange,
  onSuccess,
  open,
  step,
  uploadAssetPath,
}: StepConfirmDialogProps) {
  const router = useRouter();
  const [outcome, setOutcome] = useState<StepConfirmOutcome>(initialOutcome);
  const [purpose, setPurpose] = useState<string>(
    EVIDENCE_PURPOSE_OPTIONS[0]!.value,
  );
  const [file, setFile] = useState<File | null>(null);
  const [failureReason, setFailureReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const needsEvidence = outcome === "settled";
  const needsFailureReason = outcome === "failed";

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

  // Re-seed the outcome each time the dialog opens so callers can change
  // `initialOutcome` between opens (e.g. from "settled" to "returned").
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

  const canSubmit =
    (outcome !== "settled" || Boolean(file)) && !isSubmitting;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Подтверждение шага</DialogTitle>
          <DialogDescription>
            Зафиксируйте исход после получения ответа банка или контрагента.
            Для статуса «Выполнен» требуется подтверждающий файл.
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
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="settled">
                  Исполнен (с подтверждением)
                </SelectItem>
                <SelectItem value="failed">Ошибка / не прошло</SelectItem>
                <SelectItem value="returned">Возврат</SelectItem>
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
                      <SelectValue />
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
            {isSubmitting ? "Сохраняем..." : "Подтвердить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
