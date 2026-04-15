"use client";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";

import { CurrencySchema, type CurrencyOption } from "@bedrock/currencies/contracts";
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
import { Textarea } from "@bedrock/sdk-ui/components/textarea";

import type { FinanceDealWorkbench } from "@/features/treasury/deals/lib/queries";
import { getDealLegKindLabel } from "@/features/treasury/deals/labels";
import {
  buildCashMovementPayload,
  buildExecutionFeePayload,
  buildExecutionFillPayload,
  findExecutionActualOperationContext,
  normalizeOptionalText,
  parseMetadataInput,
  parseOptionalPositiveInteger,
} from "@/features/treasury/deals/lib/execution-actual-entry";
import { decimalToMinorString } from "@/features/treasury/deals/components/quote-request-utils";
import { getTreasuryOperationKindLabel } from "@/features/treasury/operations/lib/labels";
import { executeMutation, isUuid } from "@/lib/resources/http";

import { refreshPage } from "./workbench";

type ExecutionActualEntryActionsProps = {
  currencies: CurrencyOption[];
  deal: FinanceDealWorkbench;
};

function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `idem-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatDateTimeInput(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  const hours = `${value.getHours()}`.padStart(2, "0");
  const minutes = `${value.getMinutes()}`.padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function parseOptionalDateTimeInput(value: string): string | null {
  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  const parsed = new Date(normalized);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function formatCompactId(value: string) {
  return value.slice(0, 8);
}

function resolveOperationLabel(
  deal: FinanceDealWorkbench,
  operationId: string,
) {
  const operation = deal.relatedResources.operations.find((item) => item.id === operationId);

  if (!operation) {
    return "—";
  }

  return `${getTreasuryOperationKindLabel(operation.kind)} · ${formatCompactId(operation.id)}`;
}

function resolveLegLabel(deal: FinanceDealWorkbench, operationId: string) {
  const leg = deal.executionPlan.find((item) =>
    item.operationRefs.some((operationRef) => operationRef.operationId === operationId),
  );

  if (!leg) {
    return "—";
  }

  return `${leg.idx}. ${getDealLegKindLabel(leg.kind)}`;
}

async function readCurrencyPrecision(currencyId: string) {
  const response = await fetch(`/v1/currencies/${encodeURIComponent(currencyId)}`, {
    cache: "no-store",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Не удалось загрузить точность валюты");
  }

  const currency = CurrencySchema.parse(await response.json());
  return currency.precision;
}

async function readCurrencyPrecisions(currencyIds: string[]) {
  const uniqueCurrencyIds = [...new Set(currencyIds)];
  const entries = await Promise.all(
    uniqueCurrencyIds.map(async (currencyId) => {
      const precision = await readCurrencyPrecision(currencyId);
      return [currencyId, precision] as const;
    }),
  );

  return new Map(entries);
}

function AmountField(props: {
  amountId: string;
  amountLabel: string;
  amountValue: string;
  currencyId: string;
  currencyLabel: string;
  currencies: CurrencyOption[];
  disabled: boolean;
  onAmountChange: (value: string) => void;
  onCurrencyChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
      <div className="space-y-2">
        <Label htmlFor={props.amountId}>{props.amountLabel}</Label>
        <Input
          id={props.amountId}
          value={props.amountValue}
          onChange={(event) => props.onAmountChange(event.target.value)}
          disabled={props.disabled}
          inputMode="decimal"
          placeholder="1000.00"
        />
      </div>
      <div className="space-y-2">
        <Label>{props.currencyLabel}</Label>
        <Select
          value={props.currencyId}
          onValueChange={(value) => props.onCurrencyChange(value ?? "")}
        >
          <SelectTrigger disabled={props.disabled}>
            <SelectValue placeholder="Выберите валюту" />
          </SelectTrigger>
          <SelectContent>
            {props.currencies.map((currency) => (
              <SelectItem key={currency.id} value={currency.id}>
                {currency.code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function FillEntryDialog({
  currencies,
  deal,
}: ExecutionActualEntryActionsProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, startTransition] = useTransition();
  const defaultOperationId = deal.relatedResources.operations[0]?.id ?? "";

  const [operationId, setOperationId] = useState(defaultOperationId);
  const [executedAt, setExecutedAt] = useState(formatDateTimeInput(new Date()));
  const [soldAmount, setSoldAmount] = useState("");
  const [soldCurrencyId, setSoldCurrencyId] = useState("");
  const [boughtAmount, setBoughtAmount] = useState("");
  const [boughtCurrencyId, setBoughtCurrencyId] = useState("");
  const [providerRef, setProviderRef] = useState("");
  const [externalRecordId, setExternalRecordId] = useState("");
  const [fillSequence, setFillSequence] = useState("");
  const [notes, setNotes] = useState("");
  const [metadataJson, setMetadataJson] = useState("");

  function resetState() {
    setOperationId(defaultOperationId);
    setExecutedAt(formatDateTimeInput(new Date()));
    setSoldAmount("");
    setSoldCurrencyId("");
    setBoughtAmount("");
    setBoughtCurrencyId("");
    setProviderRef("");
    setExternalRecordId("");
    setFillSequence("");
    setNotes("");
    setMetadataJson("");
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      resetState();
    }

    setOpen(nextOpen);
  }

  function handleSubmit() {
    if (!operationId) {
      toast.error("Выберите операцию");
      return;
    }

    if (!executedAt.trim() || !soldAmount.trim() || !soldCurrencyId || !boughtAmount.trim() || !boughtCurrencyId) {
      toast.error("Заполните обязательные поля fill");
      return;
    }

    const context = findExecutionActualOperationContext(deal, operationId);

    if (!context || !context.routeLegId || !context.calculationSnapshotId) {
      toast.error("Сначала нужен принятый расчет и операция, привязанная к этапу маршрута");
      return;
    }

    const executedAtIso = parseOptionalDateTimeInput(executedAt);

    if (!executedAtIso) {
      toast.error("Укажите корректную дату и время исполнения");
      return;
    }

    const parsedMetadata = parseMetadataInput(metadataJson);

    if (!parsedMetadata.ok) {
      toast.error(parsedMetadata.message ?? "Некорректная metadata");
      return;
    }

    const parsedFillSequence = parseOptionalPositiveInteger(fillSequence);

    if (fillSequence.trim() && parsedFillSequence === null) {
      toast.error("Fill sequence должен быть положительным числом");
      return;
    }

    startTransition(async () => {
      try {
        const precisions = await readCurrencyPrecisions([soldCurrencyId, boughtCurrencyId]);
        const soldAmountMinor = decimalToMinorString(
          soldAmount,
          precisions.get(soldCurrencyId) ?? 2,
        );
        const boughtAmountMinor = decimalToMinorString(
          boughtAmount,
          precisions.get(boughtCurrencyId) ?? 2,
        );

        if (!soldAmountMinor || !boughtAmountMinor) {
          toast.error("Введите корректные суммы fill");
          return;
        }

        const payload = buildExecutionFillPayload(context, {
          boughtAmountMinor,
          boughtCurrencyId,
          executedAt: executedAtIso,
          externalRecordId: normalizeOptionalText(externalRecordId),
          fillSequence: parsedFillSequence,
          metadata: parsedMetadata.value,
          notes: normalizeOptionalText(notes),
          providerRef: normalizeOptionalText(providerRef),
          soldAmountMinor,
          soldCurrencyId,
        });

        const result = await executeMutation({
          fallbackMessage: "Не удалось записать fill",
          request: () =>
            fetch(`/v1/treasury/operations/${encodeURIComponent(operationId)}/fills`, {
              method: "POST",
              credentials: "include",
              headers: {
                "Content-Type": "application/json",
                "Idempotency-Key": createIdempotencyKey(),
              },
              body: JSON.stringify(payload),
            }),
        });

        if (!result.ok) {
          toast.error(result.message);
          return;
        }

        toast.success("Fill записан");
        resetState();
        setOpen(false);
        refreshPage(router);
      } catch (error) {
        toast.error(
          error instanceof Error && error.message
            ? error.message
            : "Не удалось загрузить валютный контекст",
        );
      }
    });
  }

  return (
    <>
      <Button
        variant="outline"
        disabled={!deal.actions.canRecordExecutionFill}
        onClick={() => setOpen(true)}
      >
        Add fill
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Добавить execution fill</DialogTitle>
            <DialogDescription>
              Manual fill будет привязан к принятому расчету, операции и этапу маршрута.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Операция</Label>
              <Select
                value={operationId}
                onValueChange={(value) => setOperationId(value ?? "")}
              >
                <SelectTrigger disabled={submitting}>
                  <SelectValue placeholder="Выберите операцию" />
                </SelectTrigger>
                <SelectContent>
                  {deal.relatedResources.operations.map((operation) => (
                    <SelectItem key={operation.id} value={operation.id}>
                      {resolveOperationLabel(deal, operation.id)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Leg: {resolveLegLabel(deal, operationId)}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="execution-fill-executed-at">Исполнено в</Label>
              <Input
                id="execution-fill-executed-at"
                type="datetime-local"
                value={executedAt}
                onChange={(event) => setExecutedAt(event.target.value)}
                disabled={submitting}
              />
            </div>

            <AmountField
              amountId="execution-fill-sold-amount"
              amountLabel="Sold amount"
              amountValue={soldAmount}
              currencyId={soldCurrencyId}
              currencyLabel="Sold currency"
              currencies={currencies}
              disabled={submitting}
              onAmountChange={setSoldAmount}
              onCurrencyChange={setSoldCurrencyId}
            />

            <AmountField
              amountId="execution-fill-bought-amount"
              amountLabel="Bought amount"
              amountValue={boughtAmount}
              currencyId={boughtCurrencyId}
              currencyLabel="Bought currency"
              currencies={currencies}
              disabled={submitting}
              onAmountChange={setBoughtAmount}
              onCurrencyChange={setBoughtCurrencyId}
            />

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="execution-fill-provider-ref">Provider ref</Label>
                <Input
                  id="execution-fill-provider-ref"
                  value={providerRef}
                  onChange={(event) => setProviderRef(event.target.value)}
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="execution-fill-external-record-id">External record id</Label>
                <Input
                  id="execution-fill-external-record-id"
                  value={externalRecordId}
                  onChange={(event) => setExternalRecordId(event.target.value)}
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="execution-fill-sequence">Fill sequence</Label>
              <Input
                id="execution-fill-sequence"
                value={fillSequence}
                onChange={(event) => setFillSequence(event.target.value)}
                disabled={submitting}
                inputMode="numeric"
                placeholder="1"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="execution-fill-notes">Notes</Label>
              <Textarea
                id="execution-fill-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                disabled={submitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="execution-fill-metadata">Metadata JSON</Label>
              <Textarea
                id="execution-fill-metadata"
                value={metadataJson}
                onChange={(event) => setMetadataJson(event.target.value)}
                disabled={submitting}
                placeholder='{"sourceFile":"statement.csv"}'
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" disabled={submitting} onClick={() => handleOpenChange(false)}>
              Отмена
            </Button>
            <Button type="button" disabled={submitting} onClick={handleSubmit}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Сохранить fill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function FeeEntryDialog({
  currencies,
  deal,
}: ExecutionActualEntryActionsProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, startTransition] = useTransition();
  const defaultOperationId = deal.relatedResources.operations[0]?.id ?? "";

  const [operationId, setOperationId] = useState(defaultOperationId);
  const [chargedAt, setChargedAt] = useState(formatDateTimeInput(new Date()));
  const [feeFamily, setFeeFamily] = useState("provider_fee");
  const [amount, setAmount] = useState("");
  const [currencyId, setCurrencyId] = useState("");
  const [componentCode, setComponentCode] = useState("");
  const [fillId, setFillId] = useState("");
  const [providerRef, setProviderRef] = useState("");
  const [externalRecordId, setExternalRecordId] = useState("");
  const [notes, setNotes] = useState("");

  function resetState() {
    setOperationId(defaultOperationId);
    setChargedAt(formatDateTimeInput(new Date()));
    setFeeFamily("provider_fee");
    setAmount("");
    setCurrencyId("");
    setComponentCode("");
    setFillId("");
    setProviderRef("");
    setExternalRecordId("");
    setNotes("");
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      resetState();
    }

    setOpen(nextOpen);
  }

  function handleSubmit() {
    if (!operationId || !chargedAt.trim() || !feeFamily.trim() || !amount.trim() || !currencyId) {
      toast.error("Заполните обязательные поля fee");
      return;
    }

    if (fillId.trim() && !isUuid(fillId.trim())) {
      toast.error("Fill id должен быть UUID");
      return;
    }

    const context = findExecutionActualOperationContext(deal, operationId);

    if (!context || !context.routeLegId || !context.calculationSnapshotId) {
      toast.error("Сначала нужен принятый расчет и операция, привязанная к этапу маршрута");
      return;
    }

    const chargedAtIso = parseOptionalDateTimeInput(chargedAt);

    if (!chargedAtIso) {
      toast.error("Укажите корректную дату списания fee");
      return;
    }

    startTransition(async () => {
      try {
        const precisions = await readCurrencyPrecisions([currencyId]);
        const amountMinor = decimalToMinorString(amount, precisions.get(currencyId) ?? 2);

        if (!amountMinor) {
          toast.error("Введите корректную сумму fee");
          return;
        }

        const payload = buildExecutionFeePayload(context, {
          amountMinor,
          chargedAt: chargedAtIso,
          componentCode: normalizeOptionalText(componentCode),
          currencyId,
          externalRecordId: normalizeOptionalText(externalRecordId),
          feeFamily: feeFamily.trim(),
          fillId: normalizeOptionalText(fillId),
          notes: normalizeOptionalText(notes),
          providerRef: normalizeOptionalText(providerRef),
        });

        const result = await executeMutation({
          fallbackMessage: "Не удалось записать fee",
          request: () =>
            fetch(`/v1/treasury/operations/${encodeURIComponent(operationId)}/fees`, {
              method: "POST",
              credentials: "include",
              headers: {
                "Content-Type": "application/json",
                "Idempotency-Key": createIdempotencyKey(),
              },
              body: JSON.stringify(payload),
            }),
        });

        if (!result.ok) {
          toast.error(result.message);
          return;
        }

        toast.success("Fee записан");
        resetState();
        setOpen(false);
        refreshPage(router);
      } catch (error) {
        toast.error(
          error instanceof Error && error.message
            ? error.message
            : "Не удалось загрузить валютный контекст",
        );
      }
    });
  }

  return (
    <>
      <Button
        variant="outline"
        disabled={!deal.actions.canRecordExecutionFee}
        onClick={() => setOpen(true)}
      >
        Add fee
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Добавить execution fee</DialogTitle>
            <DialogDescription>
              Manual fee сохраняется как нормализованный fact по операции и этапу маршрута.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Операция</Label>
              <Select
                value={operationId}
                onValueChange={(value) => setOperationId(value ?? "")}
              >
                <SelectTrigger disabled={submitting}>
                  <SelectValue placeholder="Выберите операцию" />
                </SelectTrigger>
                <SelectContent>
                  {deal.relatedResources.operations.map((operation) => (
                    <SelectItem key={operation.id} value={operation.id}>
                      {resolveOperationLabel(deal, operation.id)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Leg: {resolveLegLabel(deal, operationId)}
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="execution-fee-charged-at">Charged at</Label>
                <Input
                  id="execution-fee-charged-at"
                  type="datetime-local"
                  value={chargedAt}
                  onChange={(event) => setChargedAt(event.target.value)}
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="execution-fee-family">Fee family</Label>
                <Input
                  id="execution-fee-family"
                  value={feeFamily}
                  onChange={(event) => setFeeFamily(event.target.value)}
                  disabled={submitting}
                  placeholder="provider_fee"
                />
              </div>
            </div>

            <AmountField
              amountId="execution-fee-amount"
              amountLabel="Amount"
              amountValue={amount}
              currencyId={currencyId}
              currencyLabel="Currency"
              currencies={currencies}
              disabled={submitting}
              onAmountChange={setAmount}
              onCurrencyChange={setCurrencyId}
            />

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="execution-fee-component-code">Component code</Label>
                <Input
                  id="execution-fee-component-code"
                  value={componentCode}
                  onChange={(event) => setComponentCode(event.target.value)}
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="execution-fee-fill-id">Fill id</Label>
                <Input
                  id="execution-fee-fill-id"
                  value={fillId}
                  onChange={(event) => setFillId(event.target.value)}
                  disabled={submitting}
                  placeholder="UUID"
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="execution-fee-provider-ref">Provider ref</Label>
                <Input
                  id="execution-fee-provider-ref"
                  value={providerRef}
                  onChange={(event) => setProviderRef(event.target.value)}
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="execution-fee-external-record-id">External record id</Label>
                <Input
                  id="execution-fee-external-record-id"
                  value={externalRecordId}
                  onChange={(event) => setExternalRecordId(event.target.value)}
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="execution-fee-notes">Notes</Label>
              <Textarea
                id="execution-fee-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                disabled={submitting}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" disabled={submitting} onClick={() => handleOpenChange(false)}>
              Отмена
            </Button>
            <Button type="button" disabled={submitting} onClick={handleSubmit}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Сохранить fee
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CashMovementEntryDialog({
  currencies,
  deal,
}: ExecutionActualEntryActionsProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, startTransition] = useTransition();
  const defaultOperationId = deal.relatedResources.operations[0]?.id ?? "";

  const [operationId, setOperationId] = useState(defaultOperationId);
  const [bookedAt, setBookedAt] = useState(formatDateTimeInput(new Date()));
  const [direction, setDirection] = useState<"credit" | "debit">("debit");
  const [amount, setAmount] = useState("");
  const [currencyId, setCurrencyId] = useState("");
  const [valueDate, setValueDate] = useState("");
  const [accountRef, setAccountRef] = useState("");
  const [requisiteId, setRequisiteId] = useState("");
  const [statementRef, setStatementRef] = useState("");
  const [providerRef, setProviderRef] = useState("");
  const [externalRecordId, setExternalRecordId] = useState("");
  const [notes, setNotes] = useState("");

  function resetState() {
    setOperationId(defaultOperationId);
    setBookedAt(formatDateTimeInput(new Date()));
    setDirection("debit");
    setAmount("");
    setCurrencyId("");
    setValueDate("");
    setAccountRef("");
    setRequisiteId("");
    setStatementRef("");
    setProviderRef("");
    setExternalRecordId("");
    setNotes("");
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      resetState();
    }

    setOpen(nextOpen);
  }

  function handleSubmit() {
    if (!operationId || !bookedAt.trim() || !amount.trim() || !currencyId) {
      toast.error("Заполните обязательные поля cash movement");
      return;
    }

    if (requisiteId.trim() && !isUuid(requisiteId.trim())) {
      toast.error("Requisite id должен быть UUID");
      return;
    }

    const context = findExecutionActualOperationContext(deal, operationId);

    if (!context || !context.routeLegId || !context.calculationSnapshotId) {
      toast.error("Сначала нужен принятый расчет и операция, привязанная к этапу маршрута");
      return;
    }

    const bookedAtIso = parseOptionalDateTimeInput(bookedAt);
    const valueDateIso = parseOptionalDateTimeInput(valueDate);

    if (!bookedAtIso) {
      toast.error("Укажите корректную дату проводки");
      return;
    }

    if (valueDate.trim() && !valueDateIso) {
      toast.error("Укажите корректный value date");
      return;
    }

    startTransition(async () => {
      try {
        const precisions = await readCurrencyPrecisions([currencyId]);
        const amountMinor = decimalToMinorString(amount, precisions.get(currencyId) ?? 2);

        if (!amountMinor) {
          toast.error("Введите корректную сумму cash movement");
          return;
        }

        const payload = buildCashMovementPayload(context, {
          accountRef: normalizeOptionalText(accountRef),
          amountMinor,
          bookedAt: bookedAtIso,
          currencyId,
          direction,
          externalRecordId: normalizeOptionalText(externalRecordId),
          notes: normalizeOptionalText(notes),
          providerRef: normalizeOptionalText(providerRef),
          requisiteId: normalizeOptionalText(requisiteId),
          statementRef: normalizeOptionalText(statementRef),
          valueDate: valueDateIso,
        });

        const result = await executeMutation({
          fallbackMessage: "Не удалось записать cash movement",
          request: () =>
            fetch(
              `/v1/treasury/operations/${encodeURIComponent(operationId)}/cash-movements`,
              {
                method: "POST",
                credentials: "include",
                headers: {
                  "Content-Type": "application/json",
                  "Idempotency-Key": createIdempotencyKey(),
                },
                body: JSON.stringify(payload),
              },
            ),
        });

        if (!result.ok) {
          toast.error(result.message);
          return;
        }

        toast.success("Cash movement записан");
        resetState();
        setOpen(false);
        refreshPage(router);
      } catch (error) {
        toast.error(
          error instanceof Error && error.message
            ? error.message
            : "Не удалось загрузить валютный контекст",
        );
      }
    });
  }

  return (
    <>
      <Button
        variant="outline"
        disabled={!deal.actions.canRecordCashMovement}
        onClick={() => setOpen(true)}
      >
        Add cash movement
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Добавить cash movement</DialogTitle>
            <DialogDescription>
              Manual cash movement попадет в realized profitability и сверку по сделке.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Операция</Label>
              <Select
                value={operationId}
                onValueChange={(value) => setOperationId(value ?? "")}
              >
                <SelectTrigger disabled={submitting}>
                  <SelectValue placeholder="Выберите операцию" />
                </SelectTrigger>
                <SelectContent>
                  {deal.relatedResources.operations.map((operation) => (
                    <SelectItem key={operation.id} value={operation.id}>
                      {resolveOperationLabel(deal, operation.id)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Leg: {resolveLegLabel(deal, operationId)}
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="execution-cash-booked-at">Booked at</Label>
                <Input
                  id="execution-cash-booked-at"
                  type="datetime-local"
                  value={bookedAt}
                  onChange={(event) => setBookedAt(event.target.value)}
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <Label>Direction</Label>
                <Select
                  value={direction}
                  onValueChange={(value) => setDirection(value as "credit" | "debit")}
                >
                  <SelectTrigger disabled={submitting}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="debit">Debit</SelectItem>
                    <SelectItem value="credit">Credit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <AmountField
              amountId="execution-cash-amount"
              amountLabel="Amount"
              amountValue={amount}
              currencyId={currencyId}
              currencyLabel="Currency"
              currencies={currencies}
              disabled={submitting}
              onAmountChange={setAmount}
              onCurrencyChange={setCurrencyId}
            />

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="execution-cash-value-date">Value date</Label>
                <Input
                  id="execution-cash-value-date"
                  type="datetime-local"
                  value={valueDate}
                  onChange={(event) => setValueDate(event.target.value)}
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="execution-cash-account-ref">Account ref</Label>
                <Input
                  id="execution-cash-account-ref"
                  value={accountRef}
                  onChange={(event) => setAccountRef(event.target.value)}
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="execution-cash-requisite-id">Requisite id</Label>
                <Input
                  id="execution-cash-requisite-id"
                  value={requisiteId}
                  onChange={(event) => setRequisiteId(event.target.value)}
                  disabled={submitting}
                  placeholder="UUID"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="execution-cash-statement-ref">Statement ref</Label>
                <Input
                  id="execution-cash-statement-ref"
                  value={statementRef}
                  onChange={(event) => setStatementRef(event.target.value)}
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="execution-cash-provider-ref">Provider ref</Label>
                <Input
                  id="execution-cash-provider-ref"
                  value={providerRef}
                  onChange={(event) => setProviderRef(event.target.value)}
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="execution-cash-external-record-id">External record id</Label>
                <Input
                  id="execution-cash-external-record-id"
                  value={externalRecordId}
                  onChange={(event) => setExternalRecordId(event.target.value)}
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="execution-cash-notes">Notes</Label>
              <Textarea
                id="execution-cash-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                disabled={submitting}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" disabled={submitting} onClick={() => handleOpenChange(false)}>
              Отмена
            </Button>
            <Button type="button" disabled={submitting} onClick={handleSubmit}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Сохранить cash movement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ExecutionActualEntryActions(
  props: ExecutionActualEntryActionsProps,
) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <FillEntryDialog {...props} />
      <FeeEntryDialog {...props} />
      <CashMovementEntryDialog {...props} />
    </div>
  );
}
