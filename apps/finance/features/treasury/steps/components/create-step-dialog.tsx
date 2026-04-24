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

function normalizePositiveAmount(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) return null;
  if (trimmed === "0") return null;
  return trimmed.replace(/^0+/, "") || "0";
}

type StepKind =
  | "payin"
  | "fx_conversion"
  | "payout"
  | "intracompany_transfer"
  | "intercompany_funding"
  | "internal_transfer";

const STEP_KIND_OPTIONS: ReadonlyArray<{ value: StepKind; label: string }> = [
  { value: "internal_transfer", label: "Собственный перевод" },
  { value: "fx_conversion", label: "Конверсия" },
  { value: "payin", label: "Входящий платёж" },
  { value: "payout", label: "Выплата" },
  { value: "intracompany_transfer", label: "Внутренний перевод" },
  { value: "intercompany_funding", label: "Межкомпанейское фондирование" },
];

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
  /** Called after a successful creation — defaults to `router.refresh()`. */
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

  function reset() {
    setKind("internal_transfer");
    setFrom(INITIAL_SIDE);
    setTo(INITIAL_SIDE);
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
    const fromAmount = normalizePositiveAmount(from.amount);
    const toAmount = normalizePositiveAmount(to.amount);
    if (!fromAmount || !toAmount) {
      toast.error("Укажите положительные суммы отправителя и получателя");
      return;
    }

    setIsSubmitting(true);
    const result = await executeMutation({
      fallbackMessage: "Не удалось создать операцию",
      request: () =>
        fetch("/v1/treasury/steps", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": createIdempotencyKey(),
          },
          body: JSON.stringify({
            fromAmountMinor: fromAmount,
            fromCurrencyId: from.currencyId,
            fromParty: {
              id: from.partyId,
              requisiteId: from.requisiteId || null,
            },
            initialState: "pending",
            kind,
            toAmountMinor: toAmount,
            toCurrencyId: to.currencyId,
            toParty: {
              id: to.partyId,
              requisiteId: to.requisiteId || null,
            },
          }),
        }),
    });
    setIsSubmitting(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    const created = result.data as { id?: string } | null;
    toast.success("Операция создана");
    reset();
    onOpenChange(false);
    if (onSuccess && created?.id) {
      onSuccess(created.id);
    } else {
      router.refresh();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Создать операцию</DialogTitle>
          <DialogDescription>
            Казначейская операция, не привязанная к конкретной сделке. Она
            появится в общем списке операций и проходит тот же жизненный
            цикл, что и шаг сделки.
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
        inputMode="numeric"
        placeholder="Сумма (minor)"
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
