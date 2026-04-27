"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
} from "../lib/currency-options";
import {
  listPartyOptions,
  listRequisiteOptions,
  type PartyKind,
  type PartyOption,
  type RequisiteOption,
} from "../lib/party-options";

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
    if (trimmed === "0") return null;
    return trimmed.replace(/^0+/, "") || "0";
  }
  try {
    const minor = toMinorAmountString(trimmed, currencyCode, {
      requirePositive: true,
    });
    return minor.replace(/^0+/, "") || "0";
  } catch {
    return null;
  }
}

type StepKind =
  | "payin"
  | "quote_execution"
  | "payout"
  | "intracompany_transfer"
  | "intercompany_funding"
  | "internal_transfer";

const STEP_KIND_OPTIONS: ReadonlyArray<{ value: StepKind; label: string }> = [
  { value: "internal_transfer", label: "Собственный перевод" },
  { value: "quote_execution", label: "Конверсия" },
  { value: "payin", label: "Входящий платёж" },
  { value: "payout", label: "Выплата" },
  { value: "intracompany_transfer", label: "Внутренний перевод" },
  { value: "intercompany_funding", label: "Межкомпанейское фондирование" },
];

function resolveOrderType(kind: StepKind) {
  if (kind === "quote_execution") return "fx_exchange";
  if (
    kind === "internal_transfer" ||
    kind === "intracompany_transfer" ||
    kind === "intercompany_funding"
  ) {
    return "rebalance";
  }
  return "single_payment";
}

const PARTY_KIND_OPTIONS: ReadonlyArray<{ value: PartyKind; label: string }> = [
  { value: "organization", label: "Организация" },
  { value: "counterparty", label: "Контрагент" },
  { value: "customer", label: "Клиент" },
];

interface SideState {
  amount: string;
  currencyId: string;
  partyId: string;
  partyKind: PartyKind;
  requisiteId: string;
}

interface QuoteOption {
  id: string;
  label: string;
}

const INITIAL_SIDE: SideState = {
  amount: "",
  currencyId: "",
  partyId: "",
  partyKind: "organization",
  requisiteId: "",
};

export interface CreateStepDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (createdStepId: string) => void;
}

export function CreateStepDialog({
  onOpenChange,
  onSuccess,
  open,
}: CreateStepDialogProps) {
  const router = useRouter();
  const [kind, setKind] = useState<StepKind>("internal_transfer");
  const [from, setFrom] = useState<SideState>(INITIAL_SIDE);
  const [to, setTo] = useState<SideState>(INITIAL_SIDE);
  const [quoteId, setQuoteId] = useState("");
  const [quoteOptions, setQuoteOptions] = useState<QuoteOption[]>([]);
  const [currencyOptions, setCurrencyOptions] = useState<CurrencyOption[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    if (!open || kind !== "quote_execution") return;
    let cancelled = false;
    async function loadQuotes() {
      const response = await fetch(
        "/v1/treasury/quotes?status=active&limit=50&offset=0",
        {
          credentials: "include",
        },
      );
      if (!response.ok) return;
      const payload = (await response.json()) as {
        data?: Array<{
          fromAmount?: string;
          fromCurrency?: string;
          id: string;
          toAmount?: string;
          toCurrency?: string;
        }>;
      };
      if (cancelled) return;
      setQuoteOptions(
        (payload.data ?? []).map((quote) => ({
          id: quote.id,
          label: `${quote.fromAmount ?? ""} ${quote.fromCurrency ?? ""} → ${
            quote.toAmount ?? ""
          } ${quote.toCurrency ?? ""}`.trim(),
        })),
      );
    }
    void loadQuotes();
    return () => {
      cancelled = true;
    };
  }, [kind, open]);

  function reset() {
    setKind("internal_transfer");
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
      toast.error("Выберите валюты отправителя и получателя");
      return;
    }
    if (kind === "quote_execution" && !quoteId.trim()) {
      toast.error("Укажите котировку для конверсии");
      return;
    }
    const fromCurrencyCode =
      currencyOptions.find((opt) => opt.id === from.currencyId)?.code ?? null;
    const toCurrencyCode =
      currencyOptions.find((opt) => opt.id === to.currencyId)?.code ?? null;
    const fromAmount = normalizeMajorToMinor(from.amount, fromCurrencyCode);
    const toAmount = normalizeMajorToMinor(to.amount, toCurrencyCode);
    if (!fromAmount || !toAmount) {
      toast.error("Укажите положительные суммы отправителя и получателя");
      return;
    }

    setIsSubmitting(true);
    const createResult = await executeMutation({
      fallbackMessage: "Не удалось создать операцию",
      request: () =>
        fetch("/v1/treasury/orders", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": createIdempotencyKey(),
          },
          body: JSON.stringify({
            description: null,
            steps: [
              {
                fromAmountMinor: fromAmount,
                fromCurrencyId: from.currencyId,
                fromParty: {
                  id: from.partyId,
                  requisiteId: from.requisiteId || null,
                },
                kind,
                quoteId: kind === "quote_execution" ? quoteId.trim() : null,
                toAmountMinor: toAmount,
                toCurrencyId: to.currencyId,
                toParty: {
                  id: to.partyId,
                  requisiteId: to.requisiteId || null,
                },
              },
            ],
            type: resolveOrderType(kind),
          }),
        }),
    });

    if (!createResult.ok) {
      setIsSubmitting(false);
      toast.error(createResult.message);
      return;
    }

    const createdOrder = createResult.data as { id?: string } | null;
    const result = createdOrder?.id
      ? await executeMutation({
          fallbackMessage: "Не удалось активировать операцию",
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

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    const created = result.data as
      | {
          id?: string;
          steps?: Array<{
            paymentStepId?: string | null;
            quoteExecutionId?: string | null;
          }>;
        }
      | null;
    toast.success("Операция создана");
    reset();
    onOpenChange(false);
    const createdStepId =
      created?.steps?.[0]?.paymentStepId ??
      created?.steps?.[0]?.quoteExecutionId ??
      created?.id;
    if (onSuccess && createdStepId) {
      onSuccess(createdStepId);
    } else {
      router.refresh();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Создать казначейский ордер</DialogTitle>
          <DialogDescription>
            Казначейская операция, не привязанная к конкретной сделке. Она
            появится в общем списке исполнения; платёжные шаги и FX-исполнения
            создаются после активации ордера.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="create-step-kind">Тип операции</Label>
            <Select
              value={kind}
              onValueChange={(value) => {
                if (value) setKind(value as StepKind);
              }}
              disabled={isSubmitting}
            >
              <SelectTrigger
                id="create-step-kind"
                data-testid="finance-create-step-kind"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STEP_KIND_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {kind === "quote_execution" ? (
            <div className="space-y-2">
              <Label htmlFor="create-step-quote">Активная котировка</Label>
              <Select
                value={quoteId || "__none"}
                onValueChange={(value) =>
                  setQuoteId(value && value !== "__none" ? value : "")
                }
                disabled={isSubmitting}
              >
                <SelectTrigger
                  id="create-step-quote"
                  data-testid="finance-create-step-quote-id"
                >
                  <SelectValue placeholder="Выберите котировку" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Не выбрана</SelectItem>
                  {quoteOptions.map((quote) => (
                    <SelectItem key={quote.id} value={quote.id}>
                      {quote.label || quote.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-3">
            <SideEditor
              currencyOptions={currencyOptions}
              disabled={isSubmitting}
              label="Отправитель"
              onChange={setFrom}
              sideId="from"
              state={from}
            />
            <ArrowRight className="text-muted-foreground mt-8 size-4 shrink-0" />
            <SideEditor
              currencyOptions={currencyOptions}
              disabled={isSubmitting}
              label="Получатель"
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
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            data-testid="finance-create-step-submit"
          >
            {isSubmitting ? "Создаём..." : "Создать"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface SideEditorProps {
  currencyOptions: CurrencyOption[];
  disabled: boolean;
  label: string;
  onChange: (state: SideState) => void;
  sideId: "from" | "to";
  state: SideState;
}

function SideEditor({
  currencyOptions,
  disabled,
  label,
  onChange,
  sideId,
  state,
}: SideEditorProps) {
  const [partyOptions, setPartyOptions] = useState<PartyOption[]>([]);
  const [requisiteOptions, setRequisiteOptions] = useState<RequisiteOption[]>(
    [],
  );

  useEffect(() => {
    let cancelled = false;
    listPartyOptions(state.partyKind).then((options) => {
      if (!cancelled) setPartyOptions(options);
    });
    return () => {
      cancelled = true;
    };
  }, [state.partyKind]);

  useEffect(() => {
    if (!state.partyId) {
      setRequisiteOptions([]);
      return;
    }
    let cancelled = false;
    listRequisiteOptions({
      ownerType: state.partyKind,
      ownerId: state.partyId,
    }).then((options) => {
      if (!cancelled) setRequisiteOptions(options);
    });
    return () => {
      cancelled = true;
    };
  }, [state.partyId, state.partyKind]);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
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
        <SelectTrigger data-testid={`finance-create-step-${sideId}-kind`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PARTY_KIND_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={state.partyId}
        onValueChange={(value) => {
          if (!value) return;
          onChange({ ...state, partyId: value, requisiteId: "" });
        }}
        disabled={disabled || partyOptions.length === 0}
      >
        <SelectTrigger data-testid={`finance-create-step-${sideId}-party`}>
          <SelectValue
            placeholder={
              partyOptions.length === 0 ? "Нет записей" : "Выберите стороннюю сторону"
            }
          />
        </SelectTrigger>
        <SelectContent>
          {partyOptions.map((opt) => (
            <SelectItem key={opt.id} value={opt.id}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={state.requisiteId}
        onValueChange={(value) =>
          onChange({ ...state, requisiteId: value ?? "" })
        }
        disabled={
          disabled || !state.partyId || requisiteOptions.length === 0
        }
      >
        <SelectTrigger data-testid={`finance-create-step-${sideId}-requisite`}>
          <SelectValue
            placeholder={
              !state.partyId
                ? "Сначала выберите сторону"
                : requisiteOptions.length === 0
                  ? "Нет подходящих реквизитов"
                  : "Реквизит (опционально)"
            }
          />
        </SelectTrigger>
        <SelectContent>
          {requisiteOptions.map((opt) => (
            <SelectItem key={opt.id} value={opt.id}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={state.currencyId}
        onValueChange={(value) => {
          if (value) onChange({ ...state, currencyId: value });
        }}
        disabled={disabled || currencyOptions.length === 0}
      >
        <SelectTrigger data-testid={`finance-create-step-${sideId}-currency`}>
          <SelectValue placeholder="Валюта" />
        </SelectTrigger>
        <SelectContent>
          {currencyOptions.map((opt) => (
            <SelectItem key={opt.id} value={opt.id}>
              {opt.code}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        inputMode="decimal"
        placeholder={
          state.currencyId
            ? `Сумма (${
                currencyOptions.find((opt) => opt.id === state.currencyId)
                  ?.code ?? ""
              })`
            : "Сумма"
        }
        value={state.amount}
        disabled={disabled}
        onChange={(event) =>
          onChange({ ...state, amount: event.target.value })
        }
        data-testid={`finance-create-step-${sideId}-amount`}
      />
    </div>
  );
}
