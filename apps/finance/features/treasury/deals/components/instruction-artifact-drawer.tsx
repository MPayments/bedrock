"use client";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bedrock/sdk-ui/components/select";
import { Textarea } from "@bedrock/sdk-ui/components/textarea";
import { toast } from "@bedrock/sdk-ui/components/sonner";

import { executeMutation } from "@/lib/resources/http";

import { formatFileSize } from "./file-utils";

// Settlement-evidence purposes (those accepted by the backend for marking
// an instruction as `settled`) come first so the default upload satisfies the
// evidence check. `submission_confirmation` is *not* valid evidence and is
// kept mainly for pre-settlement progress notes; `exception_note` is for
// failure/return scenarios.
const PURPOSE_OPTIONS = [
  {
    label: "Подтверждение расчётов",
    value: "settlement_confirmation",
    hint: "Подтверждает исполнение — позволяет перевести в «Исполнена»",
  },
  {
    label: "Подтверждение из банка",
    value: "bank_confirmation",
    hint: "Выписка/ответ банка — засчитывается как доказательство расчёта",
  },
  {
    label: "Квитанция контрагента",
    value: "counterparty_receipt",
    hint: "Подтверждение получения от контрагента — засчитывается как доказательство",
  },
  {
    label: "Подтверждение отправки",
    value: "submission_confirmation",
    hint: "Квитанция о передаче — НЕ засчитывается для статуса «Исполнена»",
  },
  {
    label: "Заметка об исключении",
    value: "exception_note",
    hint: "Используется при ошибке или возврате",
  },
];

type InstructionArtifactDrawerProps = {
  dealId: string;
  instructionId: string;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  open: boolean;
};

type UploadAssetResponse = {
  id: string;
};

export function InstructionArtifactDrawer({
  dealId,
  instructionId,
  onOpenChange,
  onSuccess,
  open,
}: InstructionArtifactDrawerProps) {
  const [file, setFile] = useState<File | null>(null);
  const [purpose, setPurpose] = useState(PURPOSE_OPTIONS[0]!.value);
  const [memo, setMemo] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function resetState() {
    setFile(null);
    setMemo("");
    setPurpose(PURPOSE_OPTIONS[0]!.value);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) resetState();
    onOpenChange(nextOpen);
  }

  async function handleSubmit() {
    if (!file) {
      toast.error("Выберите файл для загрузки");
      return;
    }

    setIsSubmitting(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("visibility", "internal");
    formData.append("purpose", "other");
    if (memo.trim()) {
      formData.append("description", memo.trim());
    }

    const uploadResult = await executeMutation({
      fallbackMessage: "Не удалось загрузить файл",
      request: () =>
        fetch(`/v1/deals/${encodeURIComponent(dealId)}/attachments`, {
          method: "POST",
          credentials: "include",
          body: formData,
        }),
    });

    if (!uploadResult.ok) {
      setIsSubmitting(false);
      toast.error(uploadResult.message);
      return;
    }

    const attachment = uploadResult.data as UploadAssetResponse | null;
    const fileAssetId = attachment?.id;

    if (!fileAssetId) {
      setIsSubmitting(false);
      toast.error("Сервер не вернул идентификатор файла");
      return;
    }

    const attachResult = await executeMutation({
      fallbackMessage: "Не удалось прикрепить подтверждение",
      request: () =>
        fetch(
          `/v1/treasury/instructions/${encodeURIComponent(instructionId)}/artifacts`,
          {
            method: "POST",
            credentials: "include",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              fileAssetId,
              memo: memo.trim() || null,
              purpose,
            }),
          },
        ),
    });

    setIsSubmitting(false);

    if (attachResult.ok) {
      toast.success("Подтверждение прикреплено");
      resetState();
      onOpenChange(false);
      onSuccess();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Подтверждение операции</DialogTitle>
          <DialogDescription>
            Прикрепите подтверждение банка, квитанцию или заметку к инструкции.
            Для перевода в статус «settled» нужен минимум один подтверждающий
            артефакт.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="instruction-artifact-file">Файл</Label>
            <Input
              id="instruction-artifact-file"
              type="file"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
              }}
            />
            {file ? (
              <div className="text-muted-foreground text-sm">
                {file.name} · {formatFileSize(file.size)}
              </div>
            ) : null}
          </div>

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
                {PURPOSE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-muted-foreground text-xs">
              {PURPOSE_OPTIONS.find((opt) => opt.value === purpose)?.hint}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="instruction-artifact-memo">Комментарий</Label>
            <Textarea
              id="instruction-artifact-memo"
              placeholder="Необязательный комментарий"
              value={memo}
              onChange={(event) => setMemo(event.target.value)}
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
          <Button onClick={handleSubmit} disabled={!file || isSubmitting}>
            {isSubmitting ? "Загрузка..." : "Прикрепить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
