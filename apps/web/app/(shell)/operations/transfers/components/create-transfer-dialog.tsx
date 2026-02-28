"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { Button } from "@bedrock/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@bedrock/ui/components/dialog";
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

import { apiClient } from "@/lib/api-client";
import { executeMutation } from "@/lib/resources/http";
import type { TransferFormOptions } from "../lib/queries";

type SettlementMode = "immediate" | "pending";

type CreateTransferFormState = {
  sourceCounterpartyId: string;
  sourceOperationalAccountId: string;
  destinationCounterpartyId: string;
  destinationOperationalAccountId: string;
  amountMajor: string;
  memo: string;
  settlementMode: SettlementMode;
  timeoutSeconds: string;
};

const INITIAL_CREATE_FORM: CreateTransferFormState = {
  sourceCounterpartyId: "",
  sourceOperationalAccountId: "",
  destinationCounterpartyId: "",
  destinationOperationalAccountId: "",
  amountMajor: "",
  memo: "",
  settlementMode: "immediate",
  timeoutSeconds: "86400",
};

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

function createIdempotencyKey(prefix: string) {
  const random =
    typeof crypto !== "undefined"
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `${prefix}:${random}`;
}

interface CreateTransferDialogProps {
  formOptions: TransferFormOptions;
}

export function CreateTransferDialog({
  formOptions,
}: CreateTransferDialogProps) {
  const router = useRouter();
  const [createForm, setCreateForm] =
    useState<CreateTransferFormState>(INITIAL_CREATE_FORM);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const currencyById = useMemo(
    () =>
      new Map(
        formOptions.currencies.map((item) => [
          item.id,
          { code: item.code, precision: item.precision },
        ]),
      ),
    [formOptions.currencies],
  );
  const accountById = useMemo(
    () => new Map(formOptions.accounts.map((account) => [account.id, account])),
    [formOptions.accounts],
  );
  const counterpartyById = useMemo(
    () =>
      new Map(
        formOptions.counterparties.map((counterparty) => [
          counterparty.id,
          counterparty,
        ]),
      ),
    [formOptions.counterparties],
  );
  const accountsByCounterpartyId = useMemo(() => {
    const map = new Map<string, TransferFormOptions["accounts"]>();
    for (const account of formOptions.accounts) {
      const list = map.get(account.counterpartyId) ?? [];
      list.push(account);
      map.set(account.counterpartyId, list);
    }
    return map;
  }, [formOptions.accounts]);

  const sourceAccounts = createForm.sourceCounterpartyId
    ? (accountsByCounterpartyId.get(createForm.sourceCounterpartyId) ?? [])
    : [];
  const destinationAccounts = createForm.destinationCounterpartyId
    ? (accountsByCounterpartyId.get(createForm.destinationCounterpartyId) ?? [])
    : [];

  const selectedSourceAccount = createForm.sourceOperationalAccountId
    ? (accountById.get(createForm.sourceOperationalAccountId) ?? null)
    : null;
  const selectedDestinationAccount = createForm.destinationOperationalAccountId
    ? (accountById.get(createForm.destinationOperationalAccountId) ?? null)
    : null;
  const selectedSourceCounterparty = createForm.sourceCounterpartyId
    ? (counterpartyById.get(createForm.sourceCounterpartyId) ?? null)
    : null;
  const selectedDestinationCounterparty = createForm.destinationCounterpartyId
    ? (counterpartyById.get(createForm.destinationCounterpartyId) ?? null)
    : null;
  const selectedCurrency = selectedSourceAccount
    ? (currencyById.get(selectedSourceAccount.currencyId) ?? null)
    : null;

  async function handleCreateTransfer() {
    if (
      !createForm.sourceCounterpartyId ||
      !createForm.destinationCounterpartyId
    ) {
      toast.error("Выберите контрагентов источника и назначения");
      return;
    }

    if (!selectedSourceAccount || !selectedDestinationAccount) {
      toast.error("Выберите счета списания и зачисления");
      return;
    }

    if (selectedSourceAccount.id === selectedDestinationAccount.id) {
      toast.error("Счета источника и назначения должны отличаться");
      return;
    }

    if (
      selectedSourceAccount.currencyId !== selectedDestinationAccount.currencyId
    ) {
      toast.error("Счета должны быть в одной валюте");
      return;
    }

    const currency = currencyById.get(selectedSourceAccount.currencyId);
    if (!currency) {
      toast.error("Не найдена валюта выбранного счета");
      return;
    }

    const converted = majorToMinor(createForm.amountMajor, currency.precision);
    if (!converted.ok) {
      toast.error(converted.error);
      return;
    }

    setSubmitting(true);

    const timeoutSeconds =
      createForm.settlementMode === "pending"
        ? Number(createForm.timeoutSeconds)
        : undefined;

    const result = await executeMutation<{ transferId: string }>({
      request: () =>
        apiClient.v1.transfers.drafts.$post({
          json: {
            sourceOperationalAccountId: selectedSourceAccount.id,
            destinationOperationalAccountId: selectedDestinationAccount.id,
            idempotencyKey: createIdempotencyKey("ui:transfer:create"),
            amountMinor: converted.value,
            memo: createForm.memo.trim() || undefined,
            settlementMode: createForm.settlementMode,
            timeoutSeconds:
              createForm.settlementMode === "pending" &&
              Number.isFinite(timeoutSeconds) &&
              timeoutSeconds &&
              timeoutSeconds > 0
                ? timeoutSeconds
                : undefined,
          },
        }),
      fallbackMessage: "Не удалось создать черновик перевода",
      parseData: async (response) =>
        (await response.json()) as { transferId: string },
    });

    setSubmitting(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    setOpen(false);
    setCreateForm(INITIAL_CREATE_FORM);
    toast.success("Черновик перевода создан");
    router.push(`/operations/transfers/${result.data.transferId}`);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="lg" />}>
        <Plus className="h-4 w-4" />
        <span className="hidden md:block">Создать перевод</span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Новый перевод</DialogTitle>
          <DialogDescription>
            Перевод будет создан как черновик и потребует подтверждения
            checker-ом.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Откуда</Label>
              <Select
                value={createForm.sourceCounterpartyId}
                onValueChange={(value) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    sourceCounterpartyId: value ?? "",
                    sourceOperationalAccountId: "",
                  }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Выберите контрагента">
                    {selectedSourceCounterparty?.displayName}
                  </SelectValue>
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

            <div className="grid gap-1.5">
              <Label>С какого счета</Label>
              <Select
                value={createForm.sourceOperationalAccountId}
                onValueChange={(value) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    sourceOperationalAccountId: value ?? "",
                  }))
                }
                disabled={!createForm.sourceCounterpartyId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Выберите счет источника">
                    {selectedSourceAccount?.label}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {sourceAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Куда</Label>
              <Select
                value={createForm.destinationCounterpartyId}
                onValueChange={(value) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    destinationCounterpartyId: value ?? "",
                    destinationOperationalAccountId: "",
                  }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Выберите контрагента">
                    {selectedDestinationCounterparty?.displayName}
                  </SelectValue>
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

            <div className="grid gap-1.5">
              <Label>На какой счет</Label>
              <Select
                value={createForm.destinationOperationalAccountId}
                onValueChange={(value) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    destinationOperationalAccountId: value ?? "",
                  }))
                }
                disabled={!createForm.destinationCounterpartyId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Выберите счет назначения">
                    {selectedDestinationAccount?.label}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {destinationAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Сумма ({selectedCurrency?.code ?? "валюта"})</Label>
            <Input
              value={createForm.amountMajor}
              onChange={(event) =>
                setCreateForm((prev) => ({
                  ...prev,
                  amountMajor: event.target.value,
                }))
              }
              placeholder="Например 1000.25"
            />
          </div>

          <div className="grid gap-1.5">
            <Label>Settlement mode</Label>
            <Select
              value={createForm.settlementMode}
              onValueChange={(value) =>
                setCreateForm((prev) => ({
                  ...prev,
                  settlementMode: value as SettlementMode,
                }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="immediate">Immediate</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {createForm.settlementMode === "pending" ? (
            <div className="grid gap-1.5">
              <Label>Timeout (секунды)</Label>
              <Input
                type="number"
                value={createForm.timeoutSeconds}
                onChange={(event) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    timeoutSeconds: event.target.value,
                  }))
                }
                min={1}
                max={604800}
              />
            </div>
          ) : null}

          <div className="grid gap-1.5">
            <Label>Мемо</Label>
            <Input
              value={createForm.memo}
              onChange={(event) =>
                setCreateForm((prev) => ({
                  ...prev,
                  memo: event.target.value,
                }))
              }
              placeholder="Комментарий (опционально)"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={submitting}
          >
            Отмена
          </Button>
          <Button onClick={handleCreateTransfer} disabled={submitting}>
            {submitting ? "Создание..." : "Создать черновик"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
