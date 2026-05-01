"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, Check } from "lucide-react";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@bedrock/sdk-ui/components/alert";
import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Button } from "@bedrock/sdk-ui/components/button";
import { Input } from "@bedrock/sdk-ui/components/input";
import { Label } from "@bedrock/sdk-ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bedrock/sdk-ui/components/select";
import { toast } from "@bedrock/sdk-ui/components/sonner";
import { Spinner } from "@bedrock/sdk-ui/components/spinner";
import { Textarea } from "@bedrock/sdk-ui/components/textarea";
import { formatCompactId } from "@bedrock/shared/core/uuid";
import {
  formatFractionDecimal,
  minorToAmountString,
} from "@bedrock/shared/money";

import type { FinanceDealQuoteExecution } from "@/features/treasury/deals/lib/queries";
import { listCurrencyOptions } from "@/features/treasury/steps/lib/currency-options";
import {
  listPartyOptions,
  listRequisiteOptions,
  resolvePartyOption,
  type PartyKind,
  type PartyOption,
  type RequisiteOption,
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

type QuoteExecutionParties = NonNullable<
  FinanceDealQuoteExecution["executionParties"]
>;
type QuoteExecutionPartyRef = QuoteExecutionParties["debitParty"];

const PARTY_KIND_LABELS: Record<PartyKind, string> = {
  counterparty: "Контрагент",
  customer: "Клиент",
  organization: "Организация",
};

function partiesKey(parties: QuoteExecutionParties | null): string {
  if (!parties) return "";
  return JSON.stringify({
    creditPartyId: parties.creditParty.id,
    creditRequisiteId: parties.creditParty.requisiteId,
    debitPartyId: parties.debitParty.id,
    debitRequisiteId: parties.debitParty.requisiteId,
  });
}

function cloneParties(
  parties: QuoteExecutionParties | null,
): QuoteExecutionParties | null {
  if (!parties) return null;
  return {
    creditParty: { ...parties.creditParty },
    debitParty: { ...parties.debitParty },
  };
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
  const [settlementParties, setSettlementParties] =
    useState<QuoteExecutionParties | null>(() =>
      cloneParties(execution.executionParties),
    );
  const [settlementBaselineKey, setSettlementBaselineKey] = useState(() =>
    partiesKey(execution.executionParties),
  );
  const [settlementSaveState, setSettlementSaveState] = useState<
    "idle" | "saving" | "saved"
  >("idle");

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
    setSettlementParties(cloneParties(execution.executionParties));
    setSettlementBaselineKey(partiesKey(execution.executionParties));
    setSettlementSaveState("idle");
  }, [execution.executionParties]);

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

  async function saveSettlementParties() {
    if (!settlementParties) return;
    setSettlementSaveState("saving");
    setIsMutating(true);
    const result = await executeMutation<FinanceDealQuoteExecution>({
      fallbackMessage: "Не удалось сохранить реквизиты исполнения",
      request: () =>
        fetch(
          `/v1/treasury/quote-executions/${encodeURIComponent(
            execution.id,
          )}/amend`,
          {
            body: JSON.stringify({ executionParties: settlementParties }),
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": createIdempotencyKey(),
            },
            method: "POST",
          },
        ),
    });
    setIsMutating(false);

    if (!result.ok) {
      setSettlementSaveState("idle");
      toast.error(result.message);
      return;
    }

    setSettlementSaveState("saved");
    setSettlementBaselineKey(partiesKey(result.data.executionParties));
    setSettlementParties(cloneParties(result.data.executionParties));
    toast.success("Реквизиты исполнения сохранены");
    await onChanged?.(result.data);
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
  const canAmendSettlement =
    execution.state === "draft" ||
    execution.state === "pending" ||
    execution.state === "failed";
  const executionRate = formatExecutionRate();
  const settlementHasChanges =
    partiesKey(settlementParties) !== settlementBaselineKey;
  const hasSettlementSaveAction =
    Boolean(settlementParties) && canAmendSettlement && settlementHasChanges;
  const hasFooterActions =
    canCancel ||
    canExpire ||
    canSubmit ||
    canComplete ||
    hasSettlementSaveAction;

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
      {execution.state === "expired" ? (
        <div className="border-b p-4">
          <Alert variant="warning">
            <AlertTriangle />
            <AlertTitle>Котировка истекла</AlertTitle>
            <AlertDescription>
              <p>
                Этот FX-курс больше нельзя исполнить. Дилер должен
                зафиксировать новую котировку в CRM, после чего в finance
                появится новое задание на конвертацию.
              </p>
            </AlertDescription>
          </Alert>
        </div>
      ) : null}
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
      {settlementParties ? (
        <div className="grid gap-3 border-t p-4 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
          <SettlementPartyEditor
            editable={canAmendSettlement && !disabled && !isMutating}
            expectedCurrencyId={execution.fromCurrencyId}
            executionId={execution.id}
            party={settlementParties.debitParty}
            side="debit"
            title="Списать с"
            onChange={(party) => {
              setSettlementSaveState("idle");
              setSettlementParties({
                ...settlementParties,
                debitParty: party,
              });
            }}
          />
          <ArrowRight className="text-muted-foreground mx-auto hidden size-4 sm:block" />
          <SettlementPartyEditor
            editable={canAmendSettlement && !disabled && !isMutating}
            expectedCurrencyId={execution.toCurrencyId}
            executionId={execution.id}
            party={settlementParties.creditParty}
            side="credit"
            title="Зачислить на"
            onChange={(party) => {
              setSettlementSaveState("idle");
              setSettlementParties({
                ...settlementParties,
                creditParty: party,
              });
            }}
          />
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
          {hasSettlementSaveAction ? (
            <Button
              size="sm"
              variant="secondary"
              disabled={disabled || isMutating}
              onClick={saveSettlementParties}
            >
              {settlementSaveState === "saving" ? (
                <Spinner data-icon="inline-start" />
              ) : settlementSaveState === "saved" ? (
                <Check className="size-4" />
              ) : null}
              Сохранить реквизиты
            </Button>
          ) : null}
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
              disabled={disabled || isMutating || settlementHasChanges}
              onClick={submit}
            >
              Направить в исполнение
            </Button>
          ) : null}
          {canComplete ? (
            <>
              <Button
                size="sm"
                disabled={disabled || isMutating}
                onClick={() => confirm("settled")}
              >
                Подтвердить исполнение
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

interface SettlementPartyEditorProps {
  editable: boolean;
  expectedCurrencyId: string;
  executionId: string;
  party: QuoteExecutionPartyRef;
  side: "credit" | "debit";
  title: string;
  onChange: (party: QuoteExecutionPartyRef) => void;
}

function SettlementPartyEditor({
  editable,
  expectedCurrencyId,
  executionId,
  onChange,
  party,
  side,
  title,
}: SettlementPartyEditorProps) {
  const explicitKind = isPartyKind(party.entityKind) ? party.entityKind : null;
  const [resolvedParty, setResolvedParty] = useState<{
    kind: PartyKind;
    label: string;
  } | null>(null);
  const [partyOptions, setPartyOptions] = useState<PartyOption[]>([]);
  const [requisiteOptions, setRequisiteOptions] = useState<RequisiteOption[]>(
    [],
  );

  useEffect(() => {
    let cancelled = false;
    resolvePartyOption(party.id).then((resolved) => {
      if (!cancelled) setResolvedParty(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [party.id]);

  const kind = explicitKind ?? resolvedParty?.kind ?? null;

  useEffect(() => {
    if (!kind || !editable) {
      setPartyOptions([]);
      return;
    }
    let cancelled = false;
    listPartyOptions(kind).then((options) => {
      if (!cancelled) setPartyOptions(options);
    });
    return () => {
      cancelled = true;
    };
  }, [editable, kind]);

  useEffect(() => {
    if (!kind) {
      setRequisiteOptions([]);
      return;
    }
    let cancelled = false;
    listRequisiteOptions({ ownerId: party.id, ownerType: kind }).then(
      (options) => {
        if (cancelled) return;
        setRequisiteOptions(
          options.filter((option) => option.currencyId === expectedCurrencyId),
        );
      },
    );
    return () => {
      cancelled = true;
    };
  }, [expectedCurrencyId, kind, party.id]);

  const selectedPartyLabel =
    partyOptions.find((option) => option.id === party.id)?.label ??
    party.displayName ??
    resolvedParty?.label ??
    formatQuoteRef(party.id);
  const selectedRequisiteLabel =
    requisiteOptions.find((option) => option.id === party.requisiteId)?.label ??
    (party.requisiteId ? formatQuoteRef(party.requisiteId) : undefined);

  if (!kind) {
    return (
      <div className="space-y-2">
        <Label>{title}</Label>
        <div className="text-sm font-medium">{selectedPartyLabel}</div>
        <div
          className={
            party.requisiteId
              ? "text-muted-foreground text-xs"
              : "text-destructive text-xs"
          }
        >
          {party.requisiteId ? "Реквизит привязан" : "Реквизит не задан"}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={`quote-execution-${executionId}-${side}-party`}>
        {title}
        <span className="text-muted-foreground ml-2 text-xs">
          · {PARTY_KIND_LABELS[kind]}
        </span>
      </Label>
      <Select
        value={party.id}
        disabled={!editable}
        onValueChange={(value) => {
          const selected = partyOptions.find((option) => option.id === value);
          onChange({
            ...party,
            displayName: selected?.label ?? null,
            id: value as QuoteExecutionPartyRef["id"],
            requisiteId: null,
            snapshot: null,
          });
        }}
      >
        <SelectTrigger
          id={`quote-execution-${executionId}-${side}-party`}
          className="w-full"
        >
          <SelectValue placeholder="Выберите участника">
            {selectedPartyLabel}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {partyOptions.length === 0 ? (
            <SelectItem value={party.id}>{selectedPartyLabel}</SelectItem>
          ) : null}
          {partyOptions.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={party.requisiteId ?? ""}
        disabled={!editable || requisiteOptions.length === 0}
        onValueChange={(value) => {
          onChange({
            ...party,
            requisiteId: value
              ? (value as NonNullable<QuoteExecutionPartyRef["requisiteId"]>)
              : null,
          });
        }}
      >
        <SelectTrigger
          id={`quote-execution-${executionId}-${side}-requisite`}
          className="w-full"
        >
          <SelectValue
            placeholder={
              requisiteOptions.length === 0
                ? "Нет реквизитов в валюте шага"
                : "Выберите реквизит"
            }
          >
            {selectedRequisiteLabel ?? undefined}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {requisiteOptions.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
