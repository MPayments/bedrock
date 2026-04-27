"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@bedrock/sdk-ui/components/dialog";
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

import { listCurrencyOptions } from "@/features/treasury/steps/lib/currency-options";
import { executeMutation } from "@/lib/resources/http";

const COMMERCIAL_REASONS = [
  { label: "Рынок сдвинулся", value: "market_moved" },
  { label: "Переговоры с клиентом", value: "customer_renegotiation" },
  { label: "Ошибка ценообразования", value: "pricing_error" },
  { label: "Другое", value: "other" },
];

interface RouteCandidate {
  id: string;
  name: string;
  currencyInId: string;
  currencyOutId: string;
  hopCount: number;
}

type RouteSwapDialogProps = {
  dealId: string;
  /** True when the deal already has a route attached — uses /swap with reason. */
  hasExistingRoute: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  open: boolean;
};

export function RouteSwapDialog({
  dealId,
  hasExistingRoute,
  onOpenChange,
  onSuccess,
  open,
}: RouteSwapDialogProps) {
  const [candidates, setCandidates] = useState<RouteCandidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [templateId, setTemplateId] = useState("");
  const [reasonCode, setReasonCode] = useState(COMMERCIAL_REASONS[0]!.value);
  const [memo, setMemo] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currencyCodeById, setCurrencyCodeById] = useState<
    Map<string, string>
  >(new Map());

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingCandidates(true);
    setTemplateId("");
    void Promise.all([
      fetch(`/v1/deals/${encodeURIComponent(dealId)}/pricing/routes`, {
        credentials: "include",
      }).then(async (response) => {
        if (!response.ok) return [] as RouteCandidate[];
        const payload = (await response.json()) as Array<{
          id: string;
          name: string;
          currencyInId: string;
          currencyOutId: string;
          hopCount: number;
        }>;
        return payload.map((row) => ({
          id: row.id,
          name: row.name,
          currencyInId: row.currencyInId,
          currencyOutId: row.currencyOutId,
          hopCount: row.hopCount,
        }));
      }),
      listCurrencyOptions(),
    ])
      .then(([routes, currencies]) => {
        if (cancelled) return;
        setCandidates(routes);
        setCurrencyCodeById(
          new Map(currencies.map((c) => [c.id, c.code] as const)),
        );
      })
      .finally(() => {
        if (!cancelled) setLoadingCandidates(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dealId, open]);

  const selected = useMemo(
    () => candidates.find((c) => c.id === templateId) ?? null,
    [candidates, templateId],
  );

  function formatCandidate(candidate: RouteCandidate): string {
    const fromCode = currencyCodeById.get(candidate.currencyInId) ?? "?";
    const toCode = currencyCodeById.get(candidate.currencyOutId) ?? "?";
    return `${candidate.name} · ${fromCode} → ${toCode} · ${candidate.hopCount} ${candidate.hopCount === 1 ? "хоп" : "хопа"}`;
  }

  async function handleSubmit() {
    if (!templateId) {
      toast.error("Выберите шаблон маршрута");
      return;
    }

    setIsSubmitting(true);
    const result = await executeMutation({
      fallbackMessage: hasExistingRoute
        ? "Не удалось сменить маршрут"
        : "Не удалось привязать маршрут",
      request: () =>
        hasExistingRoute
          ? fetch(
              `/v1/deals/${encodeURIComponent(dealId)}/pricing/route/swap`,
              {
                method: "POST",
                credentials: "include",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  memo: memo.trim() || undefined,
                  newRouteTemplateId: templateId,
                  reasonCode,
                }),
              },
            )
          : fetch(
              `/v1/deals/${encodeURIComponent(dealId)}/pricing/route/attach`,
              {
                method: "POST",
                credentials: "include",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ routeTemplateId: templateId }),
              },
            ),
    });
    setIsSubmitting(false);

    if (result.ok) {
      toast.success(
        hasExistingRoute
          ? "Маршрут сменён. Котировка отозвана — создайте новую в коммерческой вкладке."
          : "Маршрут привязан. Создайте котировку в коммерческой вкладке, чтобы зафиксировать суммы.",
      );
      onOpenChange(false);
      onSuccess();
    }
  }

  const title = hasExistingRoute
    ? "Сменить шаблон маршрута"
    : "Привязать маршрут";
  const description = hasExistingRoute
    ? "Операция отвяжет текущий маршрут, привяжет новый и отзовёт текущую котировку клиента. После этого нужно будет создать новую котировку."
    : "Выберите подходящий шаблон маршрута для сделки. После привязки можно создать котировку и платёжные шаги.";
  const submitLabel = hasExistingRoute ? "Сменить маршрут" : "Привязать";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {hasExistingRoute ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Смена маршрута отвяжет текущий маршрут и отзовёт активную
              котировку. Дилеру нужно будет создать и принять новую котировку
              на новом маршруте, после чего шаги будут пересозданы автоматически.
              Сменить маршрут можно только если ни один платёжный шаг не вышел
              из черновика — иначе сначала отмените или дождитесь его завершения.
            </div>
          ) : null}
          <div className="space-y-2">
            <Label>Шаблон маршрута</Label>
            <Select
              value={templateId}
              onValueChange={(value) => {
                if (value) setTemplateId(value);
              }}
              disabled={loadingCandidates || candidates.length === 0}
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={
                    loadingCandidates
                      ? "Загружаем кандидатов..."
                      : candidates.length === 0
                        ? "Нет подходящих маршрутов"
                        : "Выберите маршрут"
                  }
                >
                  {selected ? formatCandidate(selected) : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {candidates.map((candidate) => (
                  <SelectItem key={candidate.id} value={candidate.id}>
                    {formatCandidate(candidate)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {hasExistingRoute ? (
            <>
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
            </>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Отмена
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !templateId}
          >
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
