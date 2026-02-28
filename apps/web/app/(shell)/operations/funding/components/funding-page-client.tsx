"use client";

import Link from "next/link";
import { type FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@bedrock/ui/components/button";
import { Input } from "@bedrock/ui/components/input";
import { Label } from "@bedrock/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bedrock/ui/components/select";
import { toast } from "@bedrock/ui/components/sonner";
import { Textarea } from "@bedrock/ui/components/textarea";

import { apiClient } from "@/lib/api-client";
import { executeMutation } from "@/lib/resources/http";

import type { FundingFormOptions } from "../lib/queries";

type ExternalFundingKind =
  | "founder_equity"
  | "investor_equity"
  | "shareholder_loan"
  | "opening_balance";

interface FundingPageClientProps {
  formOptions: FundingFormOptions;
}

type ExternalFundingFormState = {
  kind: ExternalFundingKind;
  operationalAccountId: string;
  amountMajor: string;
  entryRef: string;
  occurredAt: string;
  memo: string;
  counterpartyId: string;
  customerId: string;
};

function createEntryRef() {
  const random =
    typeof crypto !== "undefined"
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `extfund-${random}`;
}

function initialOccurredAt() {
  const now = new Date();
  now.setSeconds(0, 0);
  const tzOffset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
}

function majorToMinor(
  input: string,
  precision: number,
): { ok: true; value: string } | { ok: false; error: string } {
  const normalized = input.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    return { ok: false, error: "Сумма должна быть положительным числом" };
  }

  const [intPartRaw = "0", fracPartRaw = ""] = normalized.split(".");
  if (fracPartRaw.length > precision) {
    return {
      ok: false,
      error: `Слишком много знаков после запятой. Допустимо: ${precision}`,
    };
  }

  const intPart = intPartRaw.replace(/^0+(?=\d)/, "") || "0";
  const fracPart = fracPartRaw.padEnd(precision, "0");
  const scale = 10n ** BigInt(precision);
  const value = BigInt(intPart) * scale + BigInt(fracPart || "0");

  if (value <= 0n) {
    return { ok: false, error: "Сумма должна быть больше нуля" };
  }

  return { ok: true, value: value.toString() };
}

function formatMinorAmount(amountMinor: string, precision: number) {
  const value = amountMinor.startsWith("-")
    ? amountMinor.slice(1)
    : amountMinor;
  const negative = amountMinor.startsWith("-");
  const padded = precision > 0 ? value.padStart(precision + 1, "0") : value;
  const integerPart = precision > 0 ? padded.slice(0, -precision) : padded;
  const fractionPart = precision > 0 ? padded.slice(-precision) : "";
  const major = precision > 0 ? `${integerPart}.${fractionPart}` : integerPart;
  return `${negative ? "-" : ""}${major}`;
}

function kindLabel(kind: ExternalFundingKind) {
  if (kind === "founder_equity") return "Вклад учредителя";
  if (kind === "investor_equity") return "Инвестиции в капитал";
  if (kind === "shareholder_loan") return "Займ учредителя/инвестора";
  return "Ввод начального остатка";
}

function requiresCounterparty(kind: ExternalFundingKind) {
  return (
    kind === "founder_equity" ||
    kind === "investor_equity" ||
    kind === "shareholder_loan"
  );
}

export function FundingPageClient({ formOptions }: FundingPageClientProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [lastEntryId, setLastEntryId] = useState<string | null>(null);
  const [form, setForm] = useState<ExternalFundingFormState>({
    kind: "founder_equity",
    operationalAccountId: formOptions.accounts[0]?.id ?? "",
    amountMajor: "",
    entryRef: createEntryRef(),
    occurredAt: initialOccurredAt(),
    memo: "",
    counterpartyId: "",
    customerId: "",
  });

  const selectedAccount = useMemo(
    () =>
      formOptions.accounts.find(
        (account) => account.id === form.operationalAccountId,
      ) ?? null,
    [form.operationalAccountId, formOptions.accounts],
  );

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();

    if (!selectedAccount) {
      toast.error("Выберите операционный счет");
      return;
    }

    if (!form.entryRef.trim()) {
      toast.error("Заполните внешний reference");
      return;
    }

    const convertedAmount = majorToMinor(
      form.amountMajor,
      selectedAccount.precision,
    );
    if (!convertedAmount.ok) {
      toast.error(convertedAmount.error);
      return;
    }

    if (requiresCounterparty(form.kind) && !form.counterpartyId) {
      toast.error("Выберите контрагента");
      return;
    }

    const occurredAt = new Date(form.occurredAt);
    if (Number.isNaN(occurredAt.getTime())) {
      toast.error("Некорректная дата операции");
      return;
    }

    setSubmitting(true);

    const result = await executeMutation<{ entryId: string }>({
      request: () =>
        apiClient.v1.treasury.funding.external.$post({
          json: {
            kind: form.kind,
            operationalAccountId: selectedAccount.id,
            currency: selectedAccount.currencyCode,
            amountMinor: convertedAmount.value,
            entryRef: form.entryRef.trim(),
            occurredAt: occurredAt.toISOString(),
            memo: form.memo.trim() || undefined,
            counterpartyId: requiresCounterparty(form.kind)
              ? form.counterpartyId
              : undefined,
          },
        }),
      fallbackMessage: "Не удалось выполнить внешнее пополнение",
    });

    setSubmitting(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    setLastEntryId(result.data.entryId);
    toast.success("Операция внешнего пополнения создана");
    setForm((prev) => ({
      ...prev,
      amountMajor: "",
      memo: "",
      entryRef: createEntryRef(),
      counterpartyId: requiresCounterparty(prev.kind)
        ? prev.counterpartyId
        : "",
    }));
    router.refresh();
  }

  const accountBalance = selectedAccount
    ? formatMinorAmount(
        selectedAccount.postedBalanceMinor,
        selectedAccount.precision,
      )
    : null;

  return (
    <div className="space-y-4">
      <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
        <div className="grid gap-2">
          <Label htmlFor="funding-kind">Тип пополнения</Label>
          <Select
            value={form.kind}
            onValueChange={(value) =>
              setForm((prev) => ({
                ...prev,
                kind: value as ExternalFundingKind,
                counterpartyId: requiresCounterparty(
                  value as ExternalFundingKind,
                )
                  ? prev.counterpartyId
                  : "",
              }))
            }
          >
            <SelectTrigger id="funding-kind">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="founder_equity">
                {kindLabel("founder_equity")}
              </SelectItem>
              <SelectItem value="investor_equity">
                {kindLabel("investor_equity")}
              </SelectItem>
              <SelectItem value="shareholder_loan">
                {kindLabel("shareholder_loan")}
              </SelectItem>
              <SelectItem value="opening_balance">
                {kindLabel("opening_balance")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="funding-account">Операционный счет</Label>
          <Select
            value={form.operationalAccountId}
            onValueChange={(value) =>
              setForm((prev) => ({
                ...prev,
                operationalAccountId: value ?? "",
              }))
            }
          >
            <SelectTrigger id="funding-account">
              <SelectValue placeholder="Выберите счет" />
            </SelectTrigger>
            <SelectContent>
              {formOptions.accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.label} ({account.currencyCode})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedAccount ? (
            <p className="text-muted-foreground text-xs">
              Контрагент: {selectedAccount.counterpartyName ?? "—"}. Текущий
              posted баланс: {accountBalance} {selectedAccount.currencyCode}
            </p>
          ) : null}
        </div>

        {requiresCounterparty(form.kind) ? (
          <div className="grid gap-2">
            <Label htmlFor="funding-counterparty">Контрагент</Label>
            <Select
              value={form.counterpartyId}
              onValueChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  counterpartyId: value ?? "",
                }))
              }
            >
              <SelectTrigger id="funding-counterparty">
                <SelectValue placeholder="Выберите контрагента" />
              </SelectTrigger>
              <SelectContent>
                {formOptions.counterparties.map((counterparty) => (
                  <SelectItem key={counterparty.id} value={counterparty.id}>
                    {counterparty.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <div className="grid gap-2">
          <Label htmlFor="funding-amount">Сумма</Label>
          <Input
            id="funding-amount"
            placeholder="0.00"
            value={form.amountMajor}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, amountMajor: event.target.value }))
            }
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="funding-entry-ref">External Ref</Label>
          <Input
            id="funding-entry-ref"
            value={form.entryRef}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, entryRef: event.target.value }))
            }
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="funding-occurred-at">Дата операции</Label>
          <Input
            id="funding-occurred-at"
            type="datetime-local"
            value={form.occurredAt}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, occurredAt: event.target.value }))
            }
          />
        </div>

        <div className="grid gap-2 md:col-span-2">
          <Label htmlFor="funding-memo">Комментарий</Label>
          <Textarea
            id="funding-memo"
            rows={3}
            value={form.memo}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, memo: event.target.value }))
            }
          />
        </div>

        <div className="md:col-span-2 flex items-center gap-3">
          <Button type="submit" disabled={submitting || !selectedAccount}>
            {submitting ? "Сохраняю..." : "Создать операцию"}
          </Button>
          {lastEntryId ? (
            <p className="text-sm">
              Создано:{" "}
              <Link
                className="underline"
                href={`/operations/journal/${lastEntryId}`}
              >
                {lastEntryId}
              </Link>
            </p>
          ) : null}
        </div>
      </form>
    </div>
  );
}
