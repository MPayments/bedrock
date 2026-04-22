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

const COMMERCIAL_REASONS = [
  { label: "Рынок сдвинулся", value: "market_moved" },
  { label: "Переговоры с клиентом", value: "customer_renegotiation" },
  { label: "Ошибка ценообразования", value: "pricing_error" },
  { label: "Другое", value: "other" },
];

type RouteSwapDialogProps = {
  dealId: string;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  open: boolean;
};

export function RouteSwapDialog({
  dealId,
  onOpenChange,
  onSuccess,
  open,
}: RouteSwapDialogProps) {
  const [templateId, setTemplateId] = useState("");
  const [reasonCode, setReasonCode] = useState(COMMERCIAL_REASONS[0]!.value);
  const [memo, setMemo] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    if (!templateId.trim()) {
      toast.error("Укажите UUID нового шаблона маршрута");
      return;
    }

    setIsSubmitting(true);
    const result = await executeMutation({
      fallbackMessage: "Не удалось сменить маршрут",
      request: () =>
        fetch(`/v1/deals/${encodeURIComponent(dealId)}/pricing/route/swap`, {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            memo: memo.trim() || undefined,
            newRouteTemplateId: templateId.trim(),
            reasonCode,
          }),
        }),
    });
    setIsSubmitting(false);

    if (result.ok) {
      toast.success("Маршрут сменён");
      onOpenChange(false);
      onSuccess();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Сменить шаблон маршрута</DialogTitle>
          <DialogDescription>
            Операция отвяжет текущий маршрут, привяжет новый и отзовёт текущую
            котировку клиента.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>UUID нового шаблона</Label>
            <Input
              placeholder="000000-…"
              value={templateId}
              onChange={(event) => setTemplateId(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Причина</Label>
            <Select
              value={reasonCode}
              onValueChange={(value) => {
                if (value) setReasonCode(value);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMMERCIAL_REASONS.map((opt) => (
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
            Сменить маршрут
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
