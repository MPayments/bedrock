"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { MAX_QUERY_LIST_LIMIT } from "@bedrock/shared/core";
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

import { ClientCombobox } from "@/components/dashboard/ClientCombobox";
import { API_BASE_URL } from "@/lib/constants";
import {
  buildDealDraftCustomerContext,
  requestCustomerWorkspace,
} from "@/lib/customer-workspaces";
import { cn } from "@/lib/utils";
import { loadApplicantRequisites as loadApplicantRequisiteOptions } from "../_lib/load-applicant-requisites";

import {
  createEmptyCrmDealIntake,
  DealIntakeForm,
  type CrmApplicantRequisiteOption,
  type CrmCurrencyOption,
  type CrmCustomerCounterpartyOption,
  type CrmDealIntakeDraft,
  type CrmDealType,
} from "./deal-intake-form";

const STEP_LABELS = ["Клиент", "Контекст", "Тип", "Анкета"] as const;

const DEAL_TYPE_OPTIONS: Array<{
  description: string;
  label: string;
  value: CrmDealType;
}> = [
  {
    description: "Оплата внешнему получателю со стороны клиента.",
    label: "Платеж",
    value: "payment",
  },
  {
    description: "Конвертация средств и возврат/выплата по заявке клиента.",
    label: "Обмен валюты",
    value: "currency_exchange",
  },
  {
    description: "Ожидаемое поступление, транзит и последующая выплата.",
    label: "Валютный транзит",
    value: "currency_transit",
  },
  {
    description: "Авансовая выплата под ожидаемую экспортную выручку.",
    label: "Экспортерское финансирование",
    value: "exporter_settlement",
  },
];

const DEFAULT_PAYMENT_SOURCE_CURRENCY_CODE = "RUB";

function formatAgreementLabel(agreement: AgreementOption) {
  return `${agreement.currentVersion.contractNumber || "Договор без номера"} · версия ${
    agreement.currentVersion.versionNumber
  }${agreement.isActive ? "" : " · не активен"}`;
}

type CustomerDetail = {
  id: string;
  counterparties: CrmCustomerCounterpartyOption[];
  primaryCounterpartyId: string | null;
};

type AgreementOption = {
  currentVersion: {
    contractNumber: string | null;
    versionNumber: number;
  };
  id: string;
  isActive: boolean;
};

type NewDealDialogProps = {
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  open: boolean;
};

function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `idem-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    credentials: "include",
    ...init,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Ошибка запроса: ${response.status}`);
  }

  return (await response.json()) as T;
}

export function NewDealDialog({
  onOpenChange,
  onSuccess,
  open,
}: NewDealDialogProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [selectedCustomerId, setSelectedCustomerId] = useState<
    string | undefined
  >();
  const [selectedAgreementId, setSelectedAgreementId] = useState<
    string | undefined
  >();
  const [selectedApplicantId, setSelectedApplicantId] = useState<
    string | undefined
  >();
  const [dealType, setDealType] = useState<CrmDealType>("payment");
  const [customerDetail, setCustomerDetail] = useState<CustomerDetail | null>(
    null,
  );
  const [agreements, setAgreements] = useState<AgreementOption[]>([]);
  const [applicantRequisites, setApplicantRequisites] = useState<
    CrmApplicantRequisiteOption[]
  >([]);
  const [currencyOptions, setCurrencyOptions] = useState<CrmCurrencyOption[]>(
    [],
  );
  const [intake, setIntake] = useState<CrmDealIntakeDraft>(
    createEmptyCrmDealIntake({
      applicantCounterpartyId: null,
      type: "payment",
    }),
  );
  const [loadingContext, setLoadingContext] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const counterparties = customerDetail?.counterparties ?? [];
  const agreementOptions = useMemo(
    () => agreements.filter((agreement) => agreement.isActive),
    [agreements],
  );
  const defaultPaymentSourceCurrencyId =
    currencyOptions.find(
      (currency) => currency.code === DEFAULT_PAYMENT_SOURCE_CURRENCY_CODE,
    )?.id ?? null;
  const selectedApplicant =
    counterparties.find(
      (partyProfile) => partyProfile.counterpartyId === selectedApplicantId,
    ) ?? null;
  const selectedAgreement =
    agreementOptions.find(
      (agreement) => agreement.id === selectedAgreementId,
    ) ?? null;

  useEffect(() => {
    if (!open) {
      setStep(1);
      setSelectedCustomerId(undefined);
      setSelectedAgreementId(undefined);
      setSelectedApplicantId(undefined);
      setDealType("payment");
      setCustomerDetail(null);
      setAgreements([]);
      setApplicantRequisites([]);
      setIntake(
        createEmptyCrmDealIntake({
          applicantCounterpartyId: null,
          type: "payment",
        }),
      );
      setError(null);
      return;
    }

    void fetchJson<{ data: CrmCurrencyOption[] }>(
      `${API_BASE_URL}/currencies/options`,
    )
      .then((payload) => setCurrencyOptions(payload.data))
      .catch((fetchError) => {
        console.error("Failed to load currency options", fetchError);
      });
  }, [open]);

  useEffect(() => {
    if (!selectedCustomerId) {
      setCustomerDetail(null);
      setAgreements([]);
      setSelectedAgreementId(undefined);
      setSelectedApplicantId(undefined);
      return;
    }

    const currentSelectedCustomerId = selectedCustomerId;

    let cancelled = false;

    async function loadCustomerContext() {
      try {
        setLoadingContext(true);
        setError(null);

        const [customer, agreementsPayload] = await Promise.all([
          requestCustomerWorkspace(currentSelectedCustomerId).then(
            (workspace) =>
              buildDealDraftCustomerContext(workspace) satisfies CustomerDetail,
          ),
          fetchJson<{ data: AgreementOption[] }>(
            `${API_BASE_URL}/agreements?customerId=${currentSelectedCustomerId}&limit=${MAX_QUERY_LIST_LIMIT}&offset=0`,
          ),
        ]);

        if (cancelled) {
          return;
        }

        setCustomerDetail(customer);
        setAgreements(agreementsPayload.data);

        const defaultApplicantId =
          customer.primaryCounterpartyId ??
          customer.counterparties[0]?.counterpartyId ??
          undefined;
        const defaultAgreementId = agreementsPayload.data.find(
          (item) => item.isActive,
        )?.id;

        setSelectedApplicantId(defaultApplicantId);
        setSelectedAgreementId(defaultAgreementId);
        setIntake(
          createEmptyCrmDealIntake({
            applicantCounterpartyId: defaultApplicantId ?? null,
            type: dealType,
          }),
        );
      } catch (fetchError) {
        if (!cancelled) {
          console.error("Failed to load CRM deal context", fetchError);
          setError(
            fetchError instanceof Error
              ? fetchError.message
              : "Не удалось загрузить контекст сделки",
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingContext(false);
        }
      }
    }

    void loadCustomerContext();

    return () => {
      cancelled = true;
    };
  }, [dealType, selectedCustomerId]);

  useEffect(() => {
    if (!selectedApplicantId) {
      setApplicantRequisites([]);
      setIntake((current) => ({
        ...current,
        common: {
          ...current.common,
          applicantCounterpartyId: null,
        },
      }));
      return;
    }

    const currentSelectedApplicantId = selectedApplicantId;

    setIntake((current) => ({
      ...current,
      common: {
        ...current.common,
        applicantCounterpartyId: selectedApplicantId,
      },
    }));

    let cancelled = false;

    async function loadApplicantRequisites() {
      try {
        if (cancelled) {
          return;
        }

        setApplicantRequisites(
          await loadApplicantRequisiteOptions(currentSelectedApplicantId),
        );
      } catch (fetchError) {
        if (!cancelled) {
          console.error("Failed to load applicant requisites", fetchError);
          setApplicantRequisites([]);
        }
      }
    }

    void loadApplicantRequisites();

    return () => {
      cancelled = true;
    };
  }, [selectedApplicantId]);

  useEffect(() => {
    setIntake((current) => ({
      ...current,
      moneyRequest:
        dealType === "payment"
          ? {
              ...current.moneyRequest,
              sourceCurrencyId:
                current.type !== "payment"
                  ? defaultPaymentSourceCurrencyId
                  : (current.moneyRequest.sourceCurrencyId ??
                    defaultPaymentSourceCurrencyId),
            }
          : current.moneyRequest,
      type: dealType,
    }));
  }, [dealType, defaultPaymentSourceCurrencyId]);

  function validateCurrentStep() {
    if (step === 1 && !selectedCustomerId) {
      setError("Выберите клиента.");
      return false;
    }

    if (step === 2) {
      if (!selectedAgreementId) {
        setError("Выберите действующий агентский договор.");
        return false;
      }

      if (!selectedApplicantId) {
        setError("Выберите контрагента заявителя.");
        return false;
      }
    }

    setError(null);
    return true;
  }

  async function handleCreate() {
    if (!selectedCustomerId || !selectedAgreementId || !selectedApplicantId) {
      setError("Заполните клиентский контекст сделки.");
      return;
    }

    try {
      setCreating(true);
      setError(null);

      const created = await fetchJson<{ summary: { id: string } }>(
        `${API_BASE_URL}/deals/drafts`,
        {
          body: JSON.stringify({
            agreementId: selectedAgreementId,
            customerId: selectedCustomerId,
            intake: {
              ...intake,
              common: {
                ...intake.common,
                applicantCounterpartyId: selectedApplicantId,
              },
            },
          }),
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": createIdempotencyKey(),
          },
          method: "POST",
        },
      );

      onOpenChange(false);
      onSuccess?.();
      router.push(`/deals/${created.summary.id}`);
      router.refresh();
    } catch (createError) {
      console.error("Failed to create CRM deal draft", createError);
      setError(
        createError instanceof Error
          ? createError.message
          : "Не удалось создать черновик сделки",
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"
        data-testid="deal-create-dialog"
      >
        <DialogHeader>
          <DialogTitle>Новая сделка</DialogTitle>
          <DialogDescription>
            Агент может создать черновик сделки полностью из CRM и затем
            продолжить работу в рабочем столе сделки.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
          {STEP_LABELS.map((label, index) => (
            <div key={label} className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex h-6 w-6 items-center justify-center rounded-full border",
                  index + 1 === step
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border",
                )}
              >
                {index + 1}
              </span>
              <span>{label}</span>
            </div>
          ))}
        </div>

        <div className="min-w-0 space-y-6">
          {step === 1 ? (
            <div className="space-y-2">
              <Label>Клиент</Label>
              <ClientCombobox
                value={selectedCustomerId}
                onValueChange={setSelectedCustomerId}
                placeholder="Выберите клиента"
                className="w-full"
                searchInputTestId="deal-customer-search"
                triggerTestId="deal-customer-select"
              />
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              <div className="min-w-0 space-y-2">
                <Label>Контрагент заявителя</Label>
                <Select
                  disabled={loadingContext}
                  value={selectedApplicantId ?? "__none"}
                  onValueChange={(value) => {
                    setSelectedApplicantId(
                      !value || value === "__none" ? undefined : value,
                    );
                  }}
                >
                  <SelectTrigger
                    className="w-full min-w-0"
                    data-testid="deal-applicant-select"
                  >
                    <SelectValue placeholder="Выберите контрагента">
                      <span className="truncate">
                        {selectedApplicant
                          ? `${selectedApplicant.shortName}${
                              selectedApplicant.inn
                                ? ` · ИНН ${selectedApplicant.inn}`
                                : ""
                            }`
                          : selectedApplicantId
                            ? "Выбранное юрлицо недоступно"
                            : "Не выбрано"}
                      </span>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Не выбрано</SelectItem>
                    {counterparties.map((partyProfile) => (
                      <SelectItem
                        key={partyProfile.counterpartyId}
                        value={partyProfile.counterpartyId}
                      >
                        {partyProfile.shortName}
                        {partyProfile.inn ? ` · ИНН ${partyProfile.inn}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-0 space-y-2">
                <Label>Агентский договор</Label>
                <Select
                  disabled={loadingContext}
                  value={selectedAgreementId ?? "__none"}
                  onValueChange={(value) => {
                    setSelectedAgreementId(
                      !value || value === "__none" ? undefined : value,
                    );
                  }}
                >
                  <SelectTrigger
                    className="w-full min-w-0"
                    data-testid="deal-agreement-select"
                  >
                    <SelectValue
                      className="min-w-0 truncate"
                      placeholder="Выберите договор"
                    >
                      {selectedAgreement
                        ? formatAgreementLabel(selectedAgreement)
                        : selectedAgreementId
                          ? "Выбранный договор недоступен"
                          : "Не выбрано"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Не выбрано</SelectItem>
                    {agreementOptions.map((agreement) => (
                      <SelectItem key={agreement.id} value={agreement.id}>
                        {formatAgreementLabel(agreement)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-3">
              {DEAL_TYPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  data-testid={`deal-type-${option.value}`}
                  onClick={() => {
                    setDealType(option.value);
                    setIntake((current) => ({
                      ...current,
                      type: option.value,
                    }));
                  }}
                  className={`w-full rounded-lg border p-4 text-left transition-colors ${
                    dealType === option.value
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <div className="text-sm font-medium">{option.label}</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {option.description}
                  </div>
                </button>
              ))}
            </div>
          ) : null}

          {step === 4 ? (
            <DealIntakeForm
              applicantRequisites={applicantRequisites}
              currencyOptions={currencyOptions}
              intake={intake}
              counterparties={counterparties}
              moneyRequestLayout="inline"
              onChange={setIntake}
            />
          ) : null}

          {loadingContext ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Загружаем контекст клиента...
            </div>
          ) : null}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <div className="flex gap-2">
            <Button
              data-testid="deal-dialog-cancel"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Отмена
            </Button>
            {step > 1 ? (
              <Button
                data-testid="deal-dialog-back"
                variant="outline"
                onClick={() => setStep((current) => current - 1)}
              >
                Назад
              </Button>
            ) : null}
          </div>

          {step < 4 ? (
            <Button
              data-testid="deal-dialog-next"
              onClick={() =>
                validateCurrentStep() && setStep((current) => current + 1)
              }
            >
              Далее
            </Button>
          ) : (
            <Button
              data-testid="deal-create-draft"
              disabled={creating}
              onClick={handleCreate}
            >
              {creating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Создать черновик
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
