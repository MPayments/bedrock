"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

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
import { toast } from "@bedrock/sdk-ui/components/sonner";
import { toMinorAmountString } from "@bedrock/shared/money";

import { executeMutation } from "@/lib/resources/http";

import {
  listCurrencyOptions,
  type CurrencyOption,
} from "@/features/treasury/steps/lib/currency-options";
import {
  listPartyOptions,
  listRequisiteOptions,
  type PartyKind,
  type PartyOption,
  type RequisiteOption,
} from "@/features/treasury/steps/lib/party-options";

type TreasuryOrderType =
  | "single_payment"
  | "fx_exchange"
  | "rebalance"
  | "liquidity_purchase";

type TreasuryOrderStepKind =
  | "payout"
  | "quote_execution"
  | "internal_transfer";

type SideId = "from" | "to";

interface SideState {
  amount: string;
  currencyId: string;
  partyId: string;
  partyKind: PartyKind;
  requisiteId: string;
}

interface QuoteOption {
  fromAmount: string;
  fromAmountMinor: string;
  fromCurrency: string;
  fromCurrencyId: string;
  id: string;
  label: string;
  rateDen: string;
  rateNum: string;
  toAmount: string;
  toAmountMinor: string;
  toCurrency: string;
  toCurrencyId: string;
}

const ORDER_TYPE_OPTIONS: ReadonlyArray<{
  description: string;
  label: string;
  value: TreasuryOrderType;
}> = [
  {
    description: "Купить валюту и поставить её на склад ликвидности.",
    label: "Покупка ликвидности",
    value: "liquidity_purchase",
  },
  {
    description: "Исполнить standalone FX без создания inventory.",
    label: "Конверсия",
    value: "fx_exchange",
  },
  {
    description: "Переложить средства между собственными реквизитами.",
    label: "Ребалансировка",
    value: "rebalance",
  },
  {
    description: "Разовый платёж без клиентской сделки.",
    label: "Платёж",
    value: "single_payment",
  },
];

const PARTY_KIND_OPTIONS: ReadonlyArray<{ value: PartyKind; label: string }> = [
  { value: "organization", label: "Организация" },
  { value: "counterparty", label: "Контрагент" },
  { value: "customer", label: "Клиент" },
];

const INITIAL_SIDE: SideState = {
  amount: "",
  currencyId: "",
  partyId: "",
  partyKind: "organization",
  requisiteId: "",
};

function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `idem-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeMajorToMinor(
  raw: string,
  currencyCode: string | null,
): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!currencyCode) {
    if (!/^\d+$/.test(trimmed)) return null;
    return trimmed === "0" ? null : trimmed.replace(/^0+/, "") || "0";
  }
  try {
    return toMinorAmountString(trimmed, currencyCode, {
      requirePositive: true,
    }).replace(/^0+/, "") || "0";
  } catch {
    return null;
  }
}

function resolveStepKind(type: TreasuryOrderType): TreasuryOrderStepKind {
  if (type === "single_payment") return "payout";
  if (type === "rebalance") return "internal_transfer";
  return "quote_execution";
}

function isQuoteBacked(type: TreasuryOrderType) {
  return type === "fx_exchange" || type === "liquidity_purchase";
}

export interface CreateTreasuryOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateTreasuryOrderDialog({
  onOpenChange,
  open,
}: CreateTreasuryOrderDialogProps) {
  const router = useRouter();
  const [type, setType] = useState<TreasuryOrderType>("liquidity_purchase");
  const [from, setFrom] = useState<SideState>(INITIAL_SIDE);
  const [to, setTo] = useState<SideState>(INITIAL_SIDE);
  const [quoteId, setQuoteId] = useState("");
  const [quoteOptions, setQuoteOptions] = useState<QuoteOption[]>([]);
  const [currencyOptions, setCurrencyOptions] = useState<CurrencyOption[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedQuote = useMemo(
    () => quoteOptions.find((quote) => quote.id === quoteId) ?? null,
    [quoteId, quoteOptions],
  );
  const organizationOnly = isQuoteBacked(type) || type === "rebalance";

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    listCurrencyOptions().then((options) => {
      if (!cancelled) setCurrencyOptions(options);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !isQuoteBacked(type)) return;
    let cancelled = false;
    async function loadQuotes() {
      const response = await fetch(
        "/v1/treasury/quotes?status=active&limit=50&offset=0",
        { credentials: "include" },
      );
      if (!response.ok) return;
      const payload = (await response.json()) as {
        data?: QuoteOption[];
      };
      if (cancelled) return;
      setQuoteOptions(
        (payload.data ?? []).map((quote) => ({
          ...quote,
          label: `${quote.fromAmount} ${quote.fromCurrency} → ${quote.toAmount} ${quote.toCurrency}`,
        })),
      );
    }
    void loadQuotes();
    return () => {
      cancelled = true;
    };
  }, [open, type]);

  useEffect(() => {
    if (!selectedQuote) return;
    setFrom((current) => ({
      ...current,
      amount: selectedQuote.fromAmount,
      currencyId: selectedQuote.fromCurrencyId,
      partyKind: "organization",
    }));
    setTo((current) => ({
      ...current,
      amount: selectedQuote.toAmount,
      currencyId: selectedQuote.toCurrencyId,
      partyKind: "organization",
    }));
  }, [selectedQuote]);

  function reset() {
    setType("liquidity_purchase");
    setFrom(INITIAL_SIDE);
    setTo(INITIAL_SIDE);
    setQuoteId("");
    setQuoteOptions([]);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  async function handleSubmit() {
    if (!from.partyId || !to.partyId) {
      toast.error("Выберите отправителя и получателя");
      return;
    }
    if (!from.currencyId || !to.currencyId) {
      toast.error("Выберите валюты");
      return;
    }
    if (isQuoteBacked(type) && !selectedQuote) {
      toast.error("Выберите активную котировку");
      return;
    }

    const fromCurrencyCode =
      currencyOptions.find((option) => option.id === from.currencyId)?.code ??
      null;
    const toCurrencyCode =
      currencyOptions.find((option) => option.id === to.currencyId)?.code ??
      null;
    const fromAmount = selectedQuote
      ? selectedQuote.fromAmountMinor
      : normalizeMajorToMinor(from.amount, fromCurrencyCode);
    const toAmount = selectedQuote
      ? selectedQuote.toAmountMinor
      : normalizeMajorToMinor(to.amount, toCurrencyCode);
    if (!fromAmount || !toAmount) {
      toast.error("Укажите положительные суммы");
      return;
    }

    setIsSubmitting(true);
    const createResult = await executeMutation({
      fallbackMessage: "Не удалось создать казначейский ордер",
      request: () =>
        fetch("/v1/treasury/orders", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": createIdempotencyKey(),
          },
          body: JSON.stringify({
            description: ORDER_TYPE_OPTIONS.find((option) => option.value === type)
              ?.label,
            steps: [
              {
                fromAmountMinor: fromAmount,
                fromCurrencyId: from.currencyId,
                fromParty: {
                  displayName: null,
                  entityKind: from.partyKind,
                  id: from.partyId,
                  requisiteId: from.requisiteId || null,
                },
                kind: resolveStepKind(type),
                quoteId: selectedQuote?.id ?? null,
                rate: selectedQuote
                  ? {
                      lockedSide: "out",
                      value: `${selectedQuote.rateNum}/${selectedQuote.rateDen}`,
                    }
                  : null,
                toAmountMinor: toAmount,
                toCurrencyId: to.currencyId,
                toParty: {
                  displayName: null,
                  entityKind: to.partyKind,
                  id: to.partyId,
                  requisiteId: to.requisiteId || null,
                },
              },
            ],
            type,
          }),
        }),
    });

    if (!createResult.ok) {
      setIsSubmitting(false);
      toast.error(createResult.message);
      return;
    }

    const createdOrder = createResult.data as { id?: string } | null;
    const activateResult = createdOrder?.id
      ? await executeMutation({
          fallbackMessage: "Не удалось активировать казначейский ордер",
          request: () =>
            fetch(
              `/v1/treasury/orders/${encodeURIComponent(createdOrder.id!)}/activate`,
              {
                method: "POST",
                credentials: "include",
                headers: {
                  "Idempotency-Key": createIdempotencyKey(),
                },
              },
            ),
        })
      : createResult;
    setIsSubmitting(false);

    if (!activateResult.ok) {
      toast.error(activateResult.message);
      return;
    }

    const order = activateResult.data as { id?: string } | null;
    toast.success("Казначейский ордер создан");
    reset();
    onOpenChange(false);
    if (order?.id) {
      router.push(`/treasury/operations/orders/${order.id}`);
    } else {
      router.refresh();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Создать казначейский ордер</DialogTitle>
          <DialogDescription>
            Ордер описывает собственную операцию казначейства. Runtime-шаги
            создаются при активации.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="create-order-type">Тип ордера</Label>
            <Select
              value={type}
              onValueChange={(value) => {
                if (!value) return;
                setType(value as TreasuryOrderType);
                setQuoteId("");
              }}
              disabled={isSubmitting}
            >
              <SelectTrigger id="create-order-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ORDER_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              {ORDER_TYPE_OPTIONS.find((option) => option.value === type)
                ?.description}
            </p>
          </div>

          {isQuoteBacked(type) ? (
            <div className="space-y-2">
              <Label htmlFor="create-order-quote">Активная котировка</Label>
              <Select
                value={quoteId || "__none"}
                onValueChange={(value) =>
                  setQuoteId(value && value !== "__none" ? value : "")
                }
                disabled={isSubmitting}
              >
                <SelectTrigger id="create-order-quote">
                  <SelectValue placeholder="Выберите котировку" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Не выбрана</SelectItem>
                  {quoteOptions.map((quote) => (
                    <SelectItem key={quote.id} value={quote.id}>
                      {quote.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-3">
            <SideEditor
              amountReadOnly={Boolean(selectedQuote)}
              currencyOptions={currencyOptions}
              disabled={isSubmitting}
              label="Списать с"
              lockPartyKind={organizationOnly ? "organization" : null}
              onChange={setFrom}
              sideId="from"
              state={from}
            />
            <ArrowRight className="text-muted-foreground mt-8 size-4 shrink-0" />
            <SideEditor
              amountReadOnly={Boolean(selectedQuote)}
              currencyOptions={currencyOptions}
              disabled={isSubmitting}
              label={
                type === "liquidity_purchase"
                  ? "Зачислить в inventory"
                  : "Получатель"
              }
              lockPartyKind={organizationOnly ? "organization" : null}
              onChange={setTo}
              sideId="to"
              state={to}
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
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Создаём..." : "Создать и активировать"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface SideEditorProps {
  amountReadOnly: boolean;
  currencyOptions: CurrencyOption[];
  disabled: boolean;
  label: string;
  lockPartyKind: PartyKind | null;
  onChange: (state: SideState) => void;
  sideId: SideId;
  state: SideState;
}

function SideEditor({
  amountReadOnly,
  currencyOptions,
  disabled,
  label,
  lockPartyKind,
  onChange,
  sideId,
  state,
}: SideEditorProps) {
  const [partyOptions, setPartyOptions] = useState<PartyOption[]>([]);
  const [requisiteOptions, setRequisiteOptions] = useState<RequisiteOption[]>(
    [],
  );
  const partyKind = lockPartyKind ?? state.partyKind;

  useEffect(() => {
    if (lockPartyKind && state.partyKind !== lockPartyKind) {
      onChange({
        ...state,
        partyId: "",
        partyKind: lockPartyKind,
        requisiteId: "",
      });
    }
  }, [lockPartyKind, onChange, state]);

  useEffect(() => {
    let cancelled = false;
    listPartyOptions(partyKind).then((options) => {
      if (!cancelled) setPartyOptions(options);
    });
    return () => {
      cancelled = true;
    };
  }, [partyKind]);

  useEffect(() => {
    if (!state.partyId) {
      setRequisiteOptions([]);
      return;
    }
    let cancelled = false;
    listRequisiteOptions({
      ownerId: state.partyId,
      ownerType: partyKind,
    }).then((options) => {
      if (!cancelled) setRequisiteOptions(options);
    });
    return () => {
      cancelled = true;
    };
  }, [partyKind, state.partyId]);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {lockPartyKind ? (
        <div className="border-input bg-muted text-muted-foreground rounded-md border px-3 py-2 text-sm">
          Организация
        </div>
      ) : (
        <Select
          value={state.partyKind}
          onValueChange={(value) => {
            if (!value) return;
            onChange({
              ...state,
              partyId: "",
              partyKind: value as PartyKind,
              requisiteId: "",
            });
          }}
          disabled={disabled}
        >
          <SelectTrigger data-testid={`finance-create-order-${sideId}-kind`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PARTY_KIND_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Select
        value={state.partyId}
        onValueChange={(value) => {
          if (!value) return;
          onChange({
            ...state,
            partyId: value,
            partyKind,
            requisiteId: "",
          });
        }}
        disabled={disabled || partyOptions.length === 0}
      >
        <SelectTrigger data-testid={`finance-create-order-${sideId}-party`}>
          <SelectValue
            placeholder={
              partyOptions.length === 0 ? "Нет записей" : "Выберите сторону"
            }
          />
        </SelectTrigger>
        <SelectContent>
          {partyOptions.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={state.requisiteId || "__none"}
        onValueChange={(value) =>
          onChange({
            ...state,
            requisiteId: value && value !== "__none" ? value : "",
          })
        }
        disabled={disabled || !state.partyId || requisiteOptions.length === 0}
      >
        <SelectTrigger data-testid={`finance-create-order-${sideId}-requisite`}>
          <SelectValue
            placeholder={
              !state.partyId
                ? "Сначала выберите сторону"
                : requisiteOptions.length === 0
                  ? "Нет подходящих реквизитов"
                  : "Реквизит"
            }
          />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none">Без реквизита</SelectItem>
          {requisiteOptions.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={state.currencyId || "__none"}
        onValueChange={(value) => {
          if (value && value !== "__none") {
            onChange({ ...state, currencyId: value });
          }
        }}
        disabled={disabled || amountReadOnly || currencyOptions.length === 0}
      >
        <SelectTrigger data-testid={`finance-create-order-${sideId}-currency`}>
          <SelectValue placeholder="Валюта" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none">Не выбрана</SelectItem>
          {currencyOptions.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.code}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        inputMode="decimal"
        placeholder="Сумма"
        value={state.amount}
        disabled={disabled || amountReadOnly}
        onChange={(event) => onChange({ ...state, amount: event.target.value })}
        data-testid={`finance-create-order-${sideId}-amount`}
      />
    </div>
  );
}
