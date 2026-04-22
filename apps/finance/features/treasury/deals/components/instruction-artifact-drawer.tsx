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

const PURPOSE_OPTIONS = [
  { label: "Подтверждение отправки", value: "submission_confirmation" },
  { label: "Подтверждение из банка", value: "bank_confirmation" },
  { label: "Квитанция контрагента", value: "counterparty_receipt" },
  { label: "Подтверждение расчётов", value: "settlement_confirmation" },
  { label: "Заметка об исключении", value: "exception_note" },
];

type InstructionArtifactDrawerProps = {
  instructionId: string;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  open: boolean;
};

export function InstructionArtifactDrawer({
  instructionId,
  onOpenChange,
  onSuccess,
  open,
}: InstructionArtifactDrawerProps) {
  const [fileAssetId, setFileAssetId] = useState("");
  const [purpose, setPurpose] = useState(PURPOSE_OPTIONS[0]!.value);
  const [memo, setMemo] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    if (!fileAssetId.trim()) {
      toast.error("Загрузите файл и укажите file_asset_id");
      return;
    }

    setIsSubmitting(true);
    const result = await executeMutation({
      fallbackMessage: "Не удалось прикрепить подтверждение",
      request: () =>
        fetch(
          `/v1/treasury/instructions/${encodeURIComponent(instructionId)}/artifacts`,
          {
            method: "POST",
            credentials: "include",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              fileAssetId: fileAssetId.trim(),
              memo: memo.trim() || null,
              purpose,
            }),
          },
        ),
    });
    setIsSubmitting(false);

    if (result.ok) {
      toast.success("Подтверждение прикреплено");
      onOpenChange(false);
      onSuccess();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
            <Label>UUID файла (file_asset_id)</Label>
            <Input
              placeholder="000000-…"
              value={fileAssetId}
              onChange={(event) => setFileAssetId(event.target.value)}
            />
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
          </div>

          <div className="space-y-2">
            <Label>Комментарий</Label>
            <Textarea
              placeholder="Необязательный комментарий"
              value={memo}
              onChange={(event) => setMemo(event.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Отмена
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            Прикрепить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
