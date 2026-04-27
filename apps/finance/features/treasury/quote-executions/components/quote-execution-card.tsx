"use client";

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";

import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Button } from "@bedrock/sdk-ui/components/button";
import { Input } from "@bedrock/sdk-ui/components/input";
import { Label } from "@bedrock/sdk-ui/components/label";
import { toast } from "@bedrock/sdk-ui/components/sonner";
import { Textarea } from "@bedrock/sdk-ui/components/textarea";
import { formatCompactId } from "@bedrock/shared/core/uuid";
import {
  formatFractionDecimal,
  minorToAmountString,
} from "@bedrock/shared/money";

import type { FinanceDealQuoteExecution } from "@/features/treasury/deals/lib/queries";
import { listCurrencyOptions } from "@/features/treasury/steps/lib/currency-options";
import {
  listRequisiteOptions,
  resolvePartyOption,
  type PartyKind,
} from "@/features/treasury/steps/lib/party-options";
import { executeMutation } from "@/lib/resources/http";

function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `idem-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const STATE_LABELS: Record<FinanceDealQuoteExecution["state"], string> = {
  cancelled: "Отменена",
  completed: "Исполнена",
  draft: "Черновик",
  expired: "Истекла",
  failed: "Ошибка",
  pending: "Ожидает исполнения",
  processing: "В обработке",
};

function formatQuoteRef(id: string): string {
  return `#${formatCompactId(id)}`;
}

function stateBadgeVariant(
  state: FinanceDealQuoteExecution["state"],
): "default" | "destructive" | "outline" | "secondary" {
  switch (state) {
    case "completed":
      return "default";
    case "failed":
    case "expired":
      return "destructive";
    case "cancelled":
      return "secondary";
    default:
      return "outline";
  }
}

function isPartyKind(value: string | null | undefined): value is PartyKind {
  return (
    value === "organization" ||
    value === "counterparty" ||
    value === "customer"
  );
}

export function QuoteExecutionCard({
  disabled,
  execution,
  onChanged,
  title,
}: {
  disabled?: boolean;
  execution: FinanceDealQuoteExecution;
  onChanged?: (execution: FinanceDealQuoteExecution) => Promise<void> | void;
  title: string;
}) {
  const [currencyCodeById, setCurrencyCodeById] = useState<Map<string, string>>(
    new Map(),
  );
  const [providerRef, setProviderRef] = useState("");
  const [memo, setMemo] = useState("");
  const [failureReason, setFailureReason] = useState("");
  const [isMutating, setIsMutating] = useState(false);
  const [partyLabelsById, setPartyLabelsById] = useState<Record<string, string>>(
    {},
  );
  const [requisiteLabelsById, setRequisiteLabelsById] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    let cancelled = false;
    listCurrencyOptions().then((options) => {
      if (!cancelled) {
        setCurrencyCodeById(
          new Map(options.map((item) => [item.id, item.code])),
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!execution.executionParties) {
      setPartyLabelsById({});
      setRequisiteLabelsById({});
      return () => {
        cancelled = true;
      };
    }
    const parties = [
      execution.executionParties.debitParty,
      execution.executionParties.creditParty,
    ];

    async function resolveSettlementLabels() {
      const partyEntries: Record<string, string> = {};
      const requisiteEntries: Record<string, string> = {};

      await Promise.all(
        parties.map(async (party) => {
          const explicitKind = isPartyKind(party.entityKind)
            ? party.entityKind
            : null;
          const resolved = party.displayName
            ? null
            : await resolvePartyOption(party.id);
          const kind = explicitKind ?? resolved?.kind ?? null;

          partyEntries[party.id] =
            party.displayName ?? resolved?.label ?? formatQuoteRef(party.id);

          if (!party.requisiteId) return;
          if (kind) {
            const requisiteOptions = await listRequisiteOptions({
              ownerId: party.id,
              ownerType: kind,
            });
            const requisite = requisiteOptions.find(
              (option) => option.id === party.requisiteId,
            );
            if (requisite) {
              requisiteEntries[party.requisiteId] = requisite.label;
              return;
            }
          }
          requisiteEntries[party.requisiteId] = formatQuoteRef(
            party.requisiteId,
          );
        }),
      );

      if (!cancelled) {
        setPartyLabelsById(partyEntries);
        setRequisiteLabelsById(requisiteEntries);
      }
    }

    resolveSettlementLabels();
    return () => {
      cancelled = true;
    };
  }, [
    execution.executionParties,
  ]);

  function formatAmount(amountMinor: string, currencyId: string) {
    const currency = currencyCodeById.get(currencyId);
    if (!currency) return amountMinor;
    return `${minorToAmountString(amountMinor, { currency })} ${currency}`;
  }

  function formatExecutionRate() {
    const fromCurrency = currencyCodeById.get(execution.fromCurrencyId);
    const toCurrency = currencyCodeById.get(execution.toCurrencyId);

    if (!fromCurrency || !toCurrency) {
      return {
        primary: "Загрузка курса...",
        secondary: null,
      };
    }

    const sourcePerTarget = formatFractionDecimal(
      execution.rateDen,
      execution.rateNum,
      {
        scale: 8,
        trimTrailingZeros: true,
      },
    );
    const targetPerSource = formatFractionDecimal(
      execution.rateNum,
      execution.rateDen,
      {
        scale: 8,
        trimTrailingZeros: true,
      },
    );

    return {
      primary: `1 ${toCurrency} = ${sourcePerTarget} ${fromCurrency}`,
      secondary: `1 ${fromCurrency} = ${targetPerSource} ${toCurrency}`,
    };
  }

  async function runMutation(input: {
    action: "cancel" | "expire" | "submit" | "confirm";
    body?: Record<string, unknown>;
    fallbackMessage: string;
    successMessage: string;
  }) {
    setIsMutating(true);
    const result = await executeMutation({
      fallbackMessage: input.fallbackMessage,
      request: () =>
        fetch(
          `/v1/treasury/quote-executions/${encodeURIComponent(
            execution.id,
          )}/${input.action}`,
          {
            body: input.body ? JSON.stringify(input.body) : undefined,
            credentials: "include",
            headers: {
              ...(input.body ? { "Content-Type": "application/json" } : {}),
              "Idempotency-Key": createIdempotencyKey(),
            },
            method: "POST",
          },
        ),
    });
    setIsMutating(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success(input.successMessage);
    setProviderRef("");
    setMemo("");
    setFailureReason("");
    await onChanged?.(execution);
  }

  async function submit() {
    const trimmedRef = providerRef.trim();
    const trimmedMemo = memo.trim();
    await runMutation({
      action: "submit",
      body: {
        providerRef: trimmedRef || null,
        providerSnapshot: trimmedMemo ? { memo: trimmedMemo } : null,
      },
      fallbackMessage: "Не удалось отправить конвертацию",
      successMessage: "Конвертация отправлена на исполнение",
    });
  }

  async function confirm(outcome: "failed" | "settled") {
    await runMutation({
      action: "confirm",
      body: {
        failureReason:
          outcome === "failed" && failureReason.trim()
            ? failureReason.trim()
            : null,
        outcome,
      },
      fallbackMessage: "Не удалось подтвердить конвертацию",
      successMessage:
        outcome === "settled"
          ? "Конвертация подтверждена"
          : "Конвертация отмечена как ошибка",
    });
  }

  const canSubmit =
    execution.state === "pending" || execution.state === "failed";
  const canComplete = execution.state === "processing";
  const canCancel =
    execution.state === "draft" || execution.state === "pending";
  const canExpire =
    execution.state === "draft" || execution.state === "pending";
  const executionRate = formatExecutionRate();
  const hasFooterActions = canCancel || canExpire || canSubmit || canComplete;
  const executionParties = execution.executionParties;

  function settlementPartyView(input: {
    party: NonNullable<
      FinanceDealQuoteExecution["executionParties"]
    >["debitParty"];
    title: string;
  }) {
    const label =
      input.party.displayName ??
      partyLabelsById[input.party.id] ??
      formatQuoteRef(input.party.id);
    const requisiteLabel = input.party.requisiteId
      ? requisiteLabelsById[input.party.requisiteId] ??
        formatQuoteRef(input.party.requisiteId)
      : "Реквизит не задан";

    return (
      <div className="min-w-0 rounded-md border p-3">
        <div className="text-muted-foreground text-xs">{input.title}</div>
        <div className="mt-1 truncate text-sm font-medium">{label}</div>
        <div
          className={
            input.party.requisiteId
              ? "text-muted-foreground mt-1 truncate text-xs"
              : "text-destructive mt-1 truncate text-xs"
          }
        >
          {input.party.requisiteId
            ? `Реквизит: ${requisiteLabel}`
            : requisiteLabel}
        </div>
      </div>
    );
  }

  return (
    <section className="bg-card rounded-lg border">
      <header className="flex items-start justify-between gap-3 border-b p-4">
        <div>
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-muted-foreground mt-1 flex items-center gap-2 text-xs">
            <span>Исполнение FX-котировки</span>
            <Badge variant={stateBadgeVariant(execution.state)}>
              {STATE_LABELS[execution.state]}
            </Badge>
          </div>
        </div>
      </header>
      <dl className="grid gap-3 p-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground text-xs">Списываем</dt>
          <dd className="font-medium">
            {formatAmount(execution.fromAmountMinor, execution.fromCurrencyId)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">Получаем</dt>
          <dd className="font-medium">
            {formatAmount(execution.toAmountMinor, execution.toCurrencyId)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">Котировка</dt>
          <dd className="font-medium">{formatQuoteRef(execution.quoteId)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">Курс исполнения</dt>
          <dd className="font-medium">{executionRate.primary}</dd>
          {executionRate.secondary ? (
            <dd className="text-muted-foreground mt-0.5 text-xs">
              {executionRate.secondary}
            </dd>
          ) : null}
        </div>
      </dl>
      {executionParties ? (
        <div className="grid gap-3 border-t p-4 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
          {settlementPartyView({
            party: executionParties.debitParty,
            title: "Списать с",
          })}
          <ArrowRight className="text-muted-foreground mx-auto hidden size-4 sm:block" />
          {settlementPartyView({
            party: executionParties.creditParty,
            title: "Зачислить на",
          })}
        </div>
      ) : (
        <div className="border-t p-4 text-sm">
          <div className="text-destructive font-medium">
            Участники исполнения не сохранены
          </div>
          <div className="text-muted-foreground mt-1">
            Для этой FX-задачи нет юрлиц и реквизитов в снимке исполнения.
          </div>
        </div>
      )}
      {canSubmit ? (
        <div className="grid gap-3 border-t p-4 text-sm sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`quote-execution-${execution.id}-provider-ref`}>
              Тикет сделки / референс провайдера
            </Label>
            <Input
              id={`quote-execution-${execution.id}-provider-ref`}
              value={providerRef}
              placeholder="Необязательно"
              disabled={disabled || isMutating}
              onChange={(event) => setProviderRef(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`quote-execution-${execution.id}-memo`}>
              Комментарий
            </Label>
            <Input
              id={`quote-execution-${execution.id}-memo`}
              value={memo}
              placeholder="Необязательно"
              disabled={disabled || isMutating}
              onChange={(event) => setMemo(event.target.value)}
            />
          </div>
        </div>
      ) : null}
      {canComplete ? (
        <div className="space-y-2 border-t p-4 text-sm">
          <Label htmlFor={`quote-execution-${execution.id}-failure-reason`}>
            Причина ошибки
          </Label>
          <Textarea
            id={`quote-execution-${execution.id}-failure-reason`}
            value={failureReason}
            placeholder="Заполняется при отметке Ошибка"
            disabled={disabled || isMutating}
            onChange={(event) => setFailureReason(event.target.value)}
          />
        </div>
      ) : null}
      {hasFooterActions ? (
        <footer className="flex flex-wrap justify-end gap-2 border-t p-4">
          {canCancel ? (
            <Button
              size="sm"
              variant="outline"
              disabled={disabled || isMutating}
              onClick={() =>
                runMutation({
                  action: "cancel",
                  fallbackMessage: "Не удалось отменить конвертацию",
                  successMessage: "Конвертация отменена",
                })
              }
            >
              Отменить
            </Button>
          ) : null}
          {canExpire ? (
            <Button
              size="sm"
              variant="outline"
              disabled={disabled || isMutating}
              onClick={() =>
                runMutation({
                  action: "expire",
                  fallbackMessage: "Не удалось отметить котировку истекшей",
                  successMessage: "Котировка отмечена истекшей",
                })
              }
            >
              Истекла
            </Button>
          ) : null}
          {canSubmit ? (
            <Button
              size="sm"
              disabled={disabled || isMutating}
              onClick={submit}
            >
              Отправить
            </Button>
          ) : null}
          {canComplete ? (
            <>
              <Button
                size="sm"
                disabled={disabled || isMutating}
                onClick={() => confirm("settled")}
              >
                Завершить
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={disabled || isMutating}
                onClick={() => confirm("failed")}
              >
                Ошибка
              </Button>
            </>
          ) : null}
        </footer>
      ) : null}
    </section>
  );
}
