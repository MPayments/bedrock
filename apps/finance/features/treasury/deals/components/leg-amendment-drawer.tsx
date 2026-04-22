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

const EXECUTION_REASONS = [
  { label: "Контрагент недоступен", value: "counterparty_unavailable" },
  { label: "Недействительный реквизит", value: "requisite_invalid" },
  { label: "Смена посредника", value: "intermediary_swap" },
  { label: "Корректировка комиссии", value: "fee_correction" },
  { label: "Опечатка", value: "typo_correction" },
  { label: "Другое", value: "other" },
];

const COMMERCIAL_REASONS = [
  { label: "Рынок сдвинулся", value: "market_moved" },
  { label: "Переговоры с клиентом", value: "customer_renegotiation" },
  { label: "Ошибка ценообразования", value: "pricing_error" },
  { label: "Другое", value: "other" },
];

type LegAmendmentDrawerProps = {
  dealId: string;
  legIdx: number;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  open: boolean;
};

export function LegAmendmentDrawer({
  dealId,
  legIdx,
  onOpenChange,
  onSuccess,
  open,
}: LegAmendmentDrawerProps) {
  const [amendmentKind, setAmendmentKind] = useState<"execution" | "commercial">(
    "execution",
  );
  const [reasonCode, setReasonCode] = useState(EXECUTION_REASONS[0]!.value);
  const [requisiteId, setRequisiteId] = useState("");
  const [counterpartyId, setCounterpartyId] = useState("");
  const [memo, setMemo] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reasonOptions =
    amendmentKind === "execution" ? EXECUTION_REASONS : COMMERCIAL_REASONS;

  async function handleSubmit() {
    const changes: {
      executionCounterpartyId?: string;
      requisiteId?: string;
    } = {};
    if (counterpartyId.trim()) {
      changes.executionCounterpartyId = counterpartyId.trim();
    }
    if (requisiteId.trim()) {
      changes.requisiteId = requisiteId.trim();
    }

    if (Object.keys(changes).length === 0) {
      toast.error("Укажите хотя бы одно изменение");
      return;
    }

    setIsSubmitting(true);
    const result = await executeMutation({
      fallbackMessage: "Не удалось применить правку",
      request: () =>
        fetch(
          `/v1/deals/${encodeURIComponent(dealId)}/legs/${legIdx}/amend`,
          {
            method: "POST",
            credentials: "include",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              amendmentKind,
              changes,
              memo: memo.trim() || undefined,
              reasonCode,
            }),
          },
        ),
    });
    setIsSubmitting(false);

    if (result.ok) {
      toast.success("Нога обновлена");
      onOpenChange(false);
      onSuccess();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Правка ноги #{legIdx}</DialogTitle>
          <DialogDescription>
            Поменяйте контрагента, реквизит или комиссии. Коммерческая правка
            отзывает текущую котировку клиента.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Тип правки</Label>
            <Select
              value={amendmentKind}
              onValueChange={(value) => {
                if (!value) return;
                const next = value as "execution" | "commercial";
                setAmendmentKind(next);
                setReasonCode(
                  next === "execution"
                    ? EXECUTION_REASONS[0]!.value
                    : COMMERCIAL_REASONS[0]!.value,
                );
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="execution">Исполнительная</SelectItem>
                <SelectItem value="commercial">Коммерческая</SelectItem>
              </SelectContent>
            </Select>
            {amendmentKind === "commercial" ? (
              <p className="text-sm text-amber-600">
                Это заменит текущую котировку клиента.
              </p>
            ) : null}
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
                {reasonOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Новый контрагент (UUID)</Label>
            <Input
              placeholder="000000…"
              value={counterpartyId}
              onChange={(event) => setCounterpartyId(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Новый реквизит (UUID)</Label>
            <Input
              placeholder="000000…"
              value={requisiteId}
              onChange={(event) => setRequisiteId(event.target.value)}
            />
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
            Подтвердить правку
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
