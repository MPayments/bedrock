"use client";

import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@bedrock/sdk-ui/components/command";
import { DatePicker } from "@bedrock/sdk-ui/components/date-picker";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@bedrock/sdk-ui/components/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bedrock/sdk-ui/components/select";
import { Textarea } from "@bedrock/sdk-ui/components/textarea";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  type PortalCustomerContext,
  type PortalLegalEntityContext,
  resolvePortalCustomerDisplayName,
  resolvePortalCustomerId,
  resolvePortalLegalEntityInn,
  resolvePortalPrimaryCounterpartyId,
  requestCustomerContexts,
} from "@/lib/customer-contexts";
import {
  createPortalDealDraft,
  type PortalDealType,
} from "@/lib/portal-deals";
import {
  formatCustomerLegalEntityLabel,
  isDuplicateCustomerLegalEntityName,
} from "@/lib/legal-entities";
import { cn } from "@/lib/utils";

interface LegalEntityOption extends PortalLegalEntityContext {
  agentAgreementStatus: "active" | "missing";
  customerDisplayName: string;
  customerId: string;
}

interface NewDealDialogProps {
  customerContexts?: PortalCustomerContext[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const CURRENCIES = [
  { value: "USD", label: "USD ($)" },
  { value: "EUR", label: "EUR (€)" },
  { value: "CNY", label: "CNY (¥)" },
  { value: "TRY", label: "TRY (₺)" },
  { value: "AED", label: "AED (د.إ)" },
  { value: "RUB", label: "RUB (₽)" },
] as const;

const DEAL_TYPE_OPTIONS: {
  description: string;
  label: string;
  value: PortalDealType;
}[] = [
  {
    value: "payment",
    label: "Платеж",
    description: "Оплата внешнему получателю по выбранному юридическому лицу.",
  },
  {
    value: "currency_exchange",
    label: "Обмен валюты",
    description: "Конвертация средств и зачисление по реквизитам заявителя.",
  },
  {
    value: "currency_transit",
    label: "Валютный транзит",
    description: "Ожидаемое поступление с последующим транзитом и выплатой.",
  },
  {
    value: "exporter_settlement",
    label: "Экспортерское финансирование",
    description: "Выплата под ожидаемую экспортную выручку.",
  },
] as const;

const STEP_LABELS = ["Юрлицо", "Тип", "Данные"] as const;
const DEFAULT_PAYMENT_SOURCE_CURRENCY = "RUB";
const DEFAULT_EXPECTED_CURRENCY = "USD";

function formatDatePickerValue(value: Date | undefined) {
  if (!value) {
    return "";
  }

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseDatePickerValue(value: string) {
  if (!value) {
    return undefined;
  }

  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return undefined;
  }

  return new Date(year, month - 1, day);
}

export function NewDealDialog({
  customerContexts,
  open,
  onOpenChange,
  onSuccess,
}: NewDealDialogProps) {
  const router = useRouter();
  const [customers, setCustomers] = useState<PortalCustomerContext[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [clientsOpen, setClientsOpen] = useState(false);
  const [selectedCounterpartyId, setSelectedCounterpartyId] = useState<
    string | undefined
  >(undefined);
  const [dealType, setDealType] = useState<PortalDealType>("payment");
  const [sourceAmount, setSourceAmount] = useState("");
  const [sourceCurrencyId, setSourceCurrencyId] = useState(
    DEFAULT_PAYMENT_SOURCE_CURRENCY,
  );
  const [targetCurrencyId, setTargetCurrencyId] = useState<string | null>(
    DEFAULT_EXPECTED_CURRENCY,
  );
  const [purpose, setPurpose] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [requestedExecutionDate, setRequestedExecutionDate] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [contractNumber, setContractNumber] = useState("");
  const [expectedAmount, setExpectedAmount] = useState("");
  const [expectedCurrencyId, setExpectedCurrencyId] = useState(
    DEFAULT_EXPECTED_CURRENCY,
  );
  const [expectedAt, setExpectedAt] = useState("");
  const [step, setStep] = useState(1);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  const legalEntities = useMemo<LegalEntityOption[]>(
    () =>
      customers.flatMap((customer) =>
        customer.legalEntities.map((legalEntity) => ({
          agentAgreementStatus: customer.agentAgreement.status,
          ...legalEntity,
          customerDisplayName: resolvePortalCustomerDisplayName(customer),
          customerId: resolvePortalCustomerId(customer),
        })),
      ),
    [customers],
  );
  const eligibleLegalEntities = useMemo(
    () =>
      legalEntities.filter(
        (legalEntity) => legalEntity.agentAgreementStatus === "active",
      ),
    [legalEntities],
  );

  const selectedLegalEntity =
    legalEntities.find(
      (legalEntity) => legalEntity.id === selectedCounterpartyId,
    ) ?? null;
  const selectedLegalEntityEligible =
    selectedLegalEntity?.agentAgreementStatus === "active";
  const requiresIncomingReceipt =
    dealType === "currency_transit" || dealType === "exporter_settlement";
  const isPaymentDeal = dealType === "payment";
  const targetCurrencyLabel = targetCurrencyId
    ? CURRENCIES.find((item) => item.value === targetCurrencyId)?.label ??
      targetCurrencyId
    : "Без конвертации";
  const hasDraftInput =
    Boolean(selectedCounterpartyId) ||
    Boolean(sourceAmount) ||
    Boolean(purpose) ||
    Boolean(customerNote) ||
    Boolean(requestedExecutionDate) ||
    step > 1;

  useEffect(() => {
    if (customerContexts) {
      setCustomers(customerContexts);
    }
  }, [customerContexts]);

  useEffect(() => {
    if (open && !customerContexts && customers.length === 0) {
      void fetchClients();
    }
  }, [customerContexts, customers.length, open]);

  useEffect(() => {
    if (!open || selectedCounterpartyId || eligibleLegalEntities.length === 0) {
      return;
    }

    const preferredCounterparty =
      customers
        .flatMap((customer) =>
          customer.legalEntities.map((legalEntity) => ({
            counterpartyId: legalEntity.id,
            eligible: customer.agentAgreement.status === "active",
            preferred:
              resolvePortalPrimaryCounterpartyId(customer) === legalEntity.id,
          })),
        )
        .find((item) => item.preferred && item.eligible)?.counterpartyId ??
      eligibleLegalEntities[0]?.id;

    if (preferredCounterparty) {
      setSelectedCounterpartyId(preferredCounterparty);
    }
  }, [customers, eligibleLegalEntities, open, selectedCounterpartyId]);

  useEffect(() => {
    if (selectedCounterpartyId && !selectedLegalEntityEligible) {
      setSelectedCounterpartyId(undefined);
    }
  }, [selectedCounterpartyId, selectedLegalEntityEligible]);

  useEffect(() => {
    if (dealType !== "payment") {
      return;
    }

    setSourceCurrencyId(DEFAULT_PAYMENT_SOURCE_CURRENCY);
    setTargetCurrencyId((current) => current ?? DEFAULT_EXPECTED_CURRENCY);
    setExpectedCurrencyId((current) => current || DEFAULT_EXPECTED_CURRENCY);
  }, [dealType]);

  async function fetchClients() {
    try {
      setLoadingClients(true);
      const data = await requestCustomerContexts();
      setCustomers(data.data ?? []);
    } catch (fetchError) {
      console.error("Error fetching clients:", fetchError);
      setError("Не удалось загрузить организации");
    } finally {
      setLoadingClients(false);
    }
  }

  function resetState() {
    setError(null);
    setStep(1);
    setDealType("payment");
    setSourceAmount("");
    setSourceCurrencyId(DEFAULT_PAYMENT_SOURCE_CURRENCY);
    setTargetCurrencyId(DEFAULT_EXPECTED_CURRENCY);
    setPurpose("");
    setCustomerNote("");
    setRequestedExecutionDate("");
    setInvoiceNumber("");
    setContractNumber("");
    setExpectedAmount("");
    setExpectedCurrencyId(DEFAULT_EXPECTED_CURRENCY);
    setExpectedAt("");
    setSelectedCounterpartyId(undefined);
    setShowCloseConfirm(false);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && hasDraftInput) {
      setShowCloseConfirm(true);
      return;
    }

    if (!nextOpen) {
      resetState();
    }

    onOpenChange(nextOpen);
  }

  function validateCurrentStep() {
    if (step === 1) {
      if (eligibleLegalEntities.length === 0) {
        setError("Чтобы создать сделку, сначала заключите агентский договор.");
        return false;
      }

      if (!selectedCounterpartyId || !selectedLegalEntityEligible) {
        setError(
          "Чтобы продолжить, выберите организацию с действующим агентским договором.",
        );
        return false;
      }
    }

    if (step === 3) {
      if (!purpose.trim()) {
        setError("Укажите цель сделки.");
        return false;
      }

      if (isPaymentDeal) {
        if (!expectedAmount) {
          setError("Укажите сумму оплаты по инвойсу.");
          return false;
        }

        if (!targetCurrencyId) {
          setError("Укажите валюту оплаты по инвойсу.");
          return false;
        }
      } else if (!sourceAmount) {
        setError("Укажите сумму заявки.");
        return false;
      }

      if (
        dealType === "currency_exchange" &&
        (!targetCurrencyId || targetCurrencyId === sourceCurrencyId)
      ) {
        setError("Для обмена валют укажите другую целевую валюту.");
        return false;
      }

      if (requiresIncomingReceipt) {
        if (!expectedAmount || !invoiceNumber.trim() || !contractNumber.trim()) {
          setError("Для этого типа сделки заполните данные ожидаемого поступления.");
          return false;
        }
      }
    }

    setError(null);
    return true;
  }

  async function handleCreate() {
    if (!validateCurrentStep() || !selectedCounterpartyId) {
      return;
    }

    try {
      setCreating(true);
      setError(null);

      const created = await createPortalDealDraft({
        type: dealType,
        common: {
          applicantCounterpartyId: selectedCounterpartyId,
          customerNote: customerNote || null,
          requestedExecutionDate: requestedExecutionDate
            ? `${requestedExecutionDate}T00:00:00.000Z`
            : null,
        },
        moneyRequest: {
          purpose: purpose || null,
          sourceAmount: isPaymentDeal ? null : sourceAmount || null,
          sourceCurrencyId,
          targetCurrencyId: isPaymentDeal
            ? targetCurrencyId
            : targetCurrencyId && targetCurrencyId !== sourceCurrencyId
              ? targetCurrencyId
              : null,
        },
        ...((requiresIncomingReceipt || isPaymentDeal)
          ? {
              incomingReceipt: {
                contractNumber: contractNumber || null,
                expectedAmount: isPaymentDeal
                  ? expectedAmount || null
                  : expectedAmount || null,
                expectedAt: expectedAt ? `${expectedAt}T00:00:00.000Z` : null,
                expectedCurrencyId: isPaymentDeal
                  ? targetCurrencyId
                  : expectedCurrencyId,
                invoiceNumber: invoiceNumber || null,
              },
            }
          : {}),
      });

      onOpenChange(false);
      onSuccess?.();
      resetState();
      router.push(`/deals/${created.summary.id}`);
      router.refresh();
    } catch (createError) {
      console.error("Error creating deal:", createError);
      setError(
        createError instanceof Error
          ? createError.message
          : "Не удалось создать сделку",
      );
    } finally {
      setCreating(false);
    }
  }

  function handleNext() {
    if (!validateCurrentStep()) {
      return;
    }

    setStep((current) => Math.min(3, current + 1));
  }

  function renderLegalEntityStep() {
    return (
      <div className="space-y-4">
        <div className="min-w-0 space-y-2">
          <Label>Юридическое лицо</Label>
          <Popover open={clientsOpen} onOpenChange={setClientsOpen}>
            <PopoverTrigger
              render={
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full min-w-0 max-w-full justify-start overflow-hidden font-normal"
                />
              }
            >
              <span className="block min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-left">
                {selectedLegalEntity
                  ? formatCustomerLegalEntityLabel({
                      customerDisplayName:
                        selectedLegalEntity.customerDisplayName,
                      legalEntityName: selectedLegalEntity.shortName,
                    })
                  : "Выберите юридическое лицо"}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[var(--anchor-width)] p-0">
              <Command>
                <CommandInput placeholder="Поиск юридического лица..." />
                <CommandList>
                  <CommandEmpty>Юридические лица не найдены</CommandEmpty>
                  <CommandGroup>
                    {legalEntities.map((legalEntity) => (
                      <CommandItem
                        key={legalEntity.id}
                        disabled={legalEntity.agentAgreementStatus !== "active"}
                        value={formatCustomerLegalEntityLabel({
                          customerDisplayName: legalEntity.customerDisplayName,
                          legalEntityName: legalEntity.shortName,
                        })}
                        onSelect={() => {
                          if (legalEntity.agentAgreementStatus !== "active") {
                            return;
                          }
                          setSelectedCounterpartyId(legalEntity.id);
                          setClientsOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4 shrink-0",
                            selectedCounterpartyId === legalEntity.id
                              ? "opacity-100"
                              : "opacity-0",
                          )}
                        />
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="block truncate">{legalEntity.shortName}</span>
                          {!isDuplicateCustomerLegalEntityName({
                            customerDisplayName: legalEntity.customerDisplayName,
                            legalEntityName: legalEntity.shortName,
                          }) ? (
                            <span className="block truncate text-xs text-muted-foreground">
                              {legalEntity.customerDisplayName}
                            </span>
                          ) : null}
                          {resolvePortalLegalEntityInn(legalEntity) ? (
                            <span className="block truncate text-xs text-muted-foreground">
                              ИНН: {resolvePortalLegalEntityInn(legalEntity)}
                            </span>
                          ) : null}
                          {legalEntity.agentAgreementStatus !== "active" ? (
                            <span className="block truncate text-xs text-amber-600">
                              Агентский договор не заключен
                            </span>
                          ) : null}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {loadingClients ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Загрузка юридических лиц...
            </div>
          ) : null}
          {!loadingClients && eligibleLegalEntities.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Чтобы создать сделку, сначала заключите агентский договор.
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  function renderTypeStep() {
    return (
      <div className="space-y-3">
        {DEAL_TYPE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setDealType(option.value)}
            className={cn(
              "w-full rounded-lg border p-4 text-left transition-colors",
              dealType === option.value
                ? "border-primary bg-primary/5"
                : "hover:bg-muted/50",
            )}
          >
            <p className="text-sm font-medium">{option.label}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {option.description}
            </p>
          </button>
        ))}
      </div>
    );
  }

  function renderDataStep() {
    return (
      <div className="space-y-4">
        {isPaymentDeal ? (
          <>
            <div className="grid grid-cols-[minmax(0,1fr)_112px] gap-3">
              <div className="space-y-2">
                <Label htmlFor="expectedAmount">Сумма оплаты</Label>
                <Input
                  id="expectedAmount"
                  value={expectedAmount}
                  onChange={(event) => setExpectedAmount(event.target.value)}
                  placeholder="100000"
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-2">
                <Label>Валюта оплаты</Label>
                <Select
                  value={targetCurrencyId ?? DEFAULT_EXPECTED_CURRENCY}
                  onValueChange={(value) => {
                    const nextValue = value ?? DEFAULT_EXPECTED_CURRENCY;
                    setTargetCurrencyId(nextValue);
                    setExpectedCurrencyId(nextValue);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Валюта списания</Label>
              <Select
                value={sourceCurrencyId}
                onValueChange={(value) => setSourceCurrencyId(value ?? "USD")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)_112px] gap-3">
            <div className="space-y-2">
              <Label htmlFor="sourceAmount">Сумма</Label>
              <Input
                id="sourceAmount"
                value={sourceAmount}
                onChange={(event) => setSourceAmount(event.target.value)}
                placeholder="100000"
                inputMode="decimal"
              />
            </div>

            <div className="space-y-2">
              <Label>Валюта</Label>
              <Select
                value={sourceCurrencyId}
                onValueChange={(value) => setSourceCurrencyId(value ?? "USD")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {isPaymentDeal ? null : (
          <div className="space-y-2">
            <Label>Целевая валюта</Label>
            <Select
              value={targetCurrencyId ?? "__same"}
              onValueChange={(value) =>
                setTargetCurrencyId(value === "__same" ? null : value)
              }
            >
              <SelectTrigger>
                <SelectValue>{targetCurrencyLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__same">Без конвертации</SelectItem>
                {CURRENCIES.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="purpose">Цель сделки</Label>
          <Textarea
            id="purpose"
            value={purpose}
            onChange={(event) => setPurpose(event.target.value)}
            placeholder="Опишите цель сделки"
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="requestedExecutionDate">Желаемая дата исполнения</Label>
          <DatePicker
            id="requestedExecutionDate"
            className="w-full"
            value={parseDatePickerValue(requestedExecutionDate)}
            onChange={(date) =>
              setRequestedExecutionDate(formatDatePickerValue(date))
            }
          />
        </div>

        {requiresIncomingReceipt ? (
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="expectedAmount">Ожидаемая сумма поступления</Label>
              <Input
                id="expectedAmount"
                value={expectedAmount}
                onChange={(event) => setExpectedAmount(event.target.value)}
                placeholder="100000"
                inputMode="decimal"
              />
            </div>
            <div className="space-y-2">
              <Label>Валюта поступления</Label>
              <Select
                value={expectedCurrencyId}
                onValueChange={(value) => setExpectedCurrencyId(value ?? "USD")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoiceNumber">Номер инвойса</Label>
              <Input
                id="invoiceNumber"
                value={invoiceNumber}
                onChange={(event) => setInvoiceNumber(event.target.value)}
                placeholder="INV-001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contractNumber">Номер контракта</Label>
              <Input
                id="contractNumber"
                value={contractNumber}
                onChange={(event) => setContractNumber(event.target.value)}
                placeholder="CTR-001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expectedAt">Ожидаемая дата поступления</Label>
              <DatePicker
                id="expectedAt"
                className="w-full"
                value={parseDatePickerValue(expectedAt)}
                onChange={(date) => setExpectedAt(formatDatePickerValue(date))}
              />
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="customerNote">Комментарий</Label>
          <Textarea
            id="customerNote"
            value={customerNote}
            onChange={(event) => setCustomerNote(event.target.value)}
            placeholder="Дополнительные детали для команды"
            rows={3}
          />
        </div>
      </div>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="overflow-hidden sm:max-w-2xl">
          <DialogHeader className="min-w-0 pr-8">
            <DialogTitle>Новая сделка</DialogTitle>
            <DialogDescription>
              Выберите юридическое лицо, тип сделки и заполните клиентскую часть
              анкеты.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
            {STEP_LABELS.map((label, index) => (
              <div key={label} className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex h-6 w-6 items-center justify-center rounded-full border text-[11px]",
                    step >= index + 1
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border",
                  )}
                >
                  {index + 1}
                </span>
                <span>{label}</span>
              </div>
            ))}
          </div>

          <div className="min-w-0 space-y-4">
            {step === 1 ? renderLegalEntityStep() : null}
            {step === 2 ? renderTypeStep() : null}
            {step === 3 ? renderDataStep() : null}

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Отмена
              </Button>
              {step > 1 ? (
                <Button variant="outline" onClick={() => setStep(step - 1)}>
                  Назад
                </Button>
              ) : null}
            </div>

            {step < 3 ? (
              <Button onClick={handleNext} disabled={creating || loadingClients}>
                Далее
              </Button>
            ) : (
              <Button
                onClick={handleCreate}
                disabled={
                  creating ||
                  loadingClients ||
                  !selectedCounterpartyId ||
                  !selectedLegalEntityEligible
                }
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Создать сделку
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Закрыть без сохранения?</AlertDialogTitle>
            <AlertDialogDescription>
              Введенные данные будут потеряны.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Продолжить редактирование</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                resetState();
                onOpenChange(false);
              }}
            >
              Закрыть
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
