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
import { API_BASE_URL } from "@/lib/constants";
import {
  type PortalCustomerContext,
  type PortalLegalEntityContext,
  requestCustomerContexts,
} from "@/lib/customer-contexts";
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
];

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
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  const legalEntities = useMemo<LegalEntityOption[]>(
    () =>
      customers.flatMap((customer) =>
        customer.legalEntities.map((legalEntity) => ({
          agentAgreementStatus: customer.agentAgreement.status,
          ...legalEntity,
          customerDisplayName: customer.displayName,
          customerId: customer.customerId,
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
      (legalEntity) => legalEntity.counterpartyId === selectedCounterpartyId,
    ) ?? null;
  const selectedLegalEntityEligible =
    selectedLegalEntity?.agentAgreementStatus === "active";

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
            counterpartyId: legalEntity.counterpartyId,
            eligible: customer.agentAgreement.status === "active",
            preferred:
              customer.primaryCounterpartyId === legalEntity.counterpartyId,
          })),
        )
        .find((item) => item.preferred && item.eligible)?.counterpartyId ??
      eligibleLegalEntities[0]?.counterpartyId;

    if (preferredCounterparty) {
      setSelectedCounterpartyId(preferredCounterparty);
    }
  }, [customers, eligibleLegalEntities, open, selectedCounterpartyId]);

  useEffect(() => {
    if (selectedCounterpartyId && !selectedLegalEntityEligible) {
      setSelectedCounterpartyId(undefined);
    }
  }, [selectedCounterpartyId, selectedLegalEntityEligible]);

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

  async function handleCreate() {
    if (eligibleLegalEntities.length === 0) {
      setError("Чтобы создать сделку, сначала заключите агентский договор.");
      return;
    }

    if (!selectedCounterpartyId || !selectedLegalEntityEligible) {
      setError(
        "Чтобы создать сделку, выберите организацию с действующим агентским договором.",
      );
      return;
    }

    try {
      setCreating(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/customer/deals`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          counterpartyId: selectedCounterpartyId,
          requestedAmount: amount || undefined,
          requestedCurrency: currency,
        }),
      });

      if (!response.ok) {
        throw new Error("Не удалось создать сделку");
      }

      const created = await response.json();
      onOpenChange(false);
      onSuccess?.();
      router.push(`/deals/${created.id}`);
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

  function resetState() {
    setError(null);
    setAmount("");
    setCurrency("USD");
    setSelectedCounterpartyId(undefined);
    setShowCloseConfirm(false);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && (amount || selectedCounterpartyId)) {
      setShowCloseConfirm(true);
      return;
    }
    if (!nextOpen) {
      resetState();
    }
    onOpenChange(nextOpen);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="overflow-hidden sm:max-w-md">
          <DialogHeader className="min-w-0 pr-8">
            <DialogTitle>Новая сделка</DialogTitle>
            <DialogDescription>
              Создайте сделку по одному из ваших юридических лиц.
            </DialogDescription>
          </DialogHeader>

          <div className="min-w-0 space-y-4">
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
                            key={legalEntity.counterpartyId}
                            disabled={legalEntity.agentAgreementStatus !== "active"}
                            value={formatCustomerLegalEntityLabel({
                              customerDisplayName:
                                legalEntity.customerDisplayName,
                              legalEntityName: legalEntity.shortName,
                            })}
                            onSelect={() => {
                              if (legalEntity.agentAgreementStatus !== "active") {
                                return;
                              }
                              setSelectedCounterpartyId(
                                legalEntity.counterpartyId,
                              );
                              setClientsOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4 shrink-0",
                                selectedCounterpartyId ===
                                  legalEntity.counterpartyId
                                  ? "opacity-100"
                                  : "opacity-0",
                              )}
                            />
                            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                              <span className="block truncate">
                                {legalEntity.shortName}
                              </span>
                              {!isDuplicateCustomerLegalEntityName({
                                customerDisplayName:
                                  legalEntity.customerDisplayName,
                                legalEntityName: legalEntity.shortName,
                              }) ? (
                                <span className="block truncate text-xs text-muted-foreground">
                                  {legalEntity.customerDisplayName}
                                </span>
                              ) : null}
                              {legalEntity.inn ? (
                                <span className="block truncate text-xs text-muted-foreground">
                                  ИНН: {legalEntity.inn}
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

            <div className="grid grid-cols-[minmax(0,1fr)_112px] gap-3">
              <div className="space-y-2">
                <Label htmlFor="amount">Сумма</Label>
                <Input
                  id="amount"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="100000"
                  inputMode="decimal"
                />
              </div>

              <div className="space-y-2">
                <Label>Валюта</Label>
                <Select
                  value={currency}
                  onValueChange={(value) => setCurrency(value ?? "USD")}
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

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Отмена
            </Button>
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
