"use client";

import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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
import { API_BASE_URL } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface CustomerLegalEntity {
  counterpartyId: string;
  hasLegacyShell: boolean;
  inn: string | null;
  shortName: string;
}

interface CustomerContext {
  customerId: string;
  displayName: string;
  legalEntities: CustomerLegalEntity[];
  primaryCounterpartyId: string | null;
}

interface CustomerClientsResponse {
  data: CustomerContext[];
  total: number;
}

interface LegalEntityOption extends CustomerLegalEntity {
  customerDisplayName: string;
  customerId: string;
}

interface NewApplicationDialogProps {
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

export function NewApplicationDialog({
  open,
  onOpenChange,
  onSuccess,
}: NewApplicationDialogProps) {
  const router = useRouter();
  const [customers, setCustomers] = useState<CustomerContext[]>([]);
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
          ...legalEntity,
          customerDisplayName: customer.displayName,
          customerId: customer.customerId,
        })),
      ),
    [customers],
  );

  const selectedLegalEntity =
    legalEntities.find(
      (legalEntity) => legalEntity.counterpartyId === selectedCounterpartyId,
    ) ?? null;

  useEffect(() => {
    if (open && customers.length === 0) {
      void fetchClients();
    }
  }, [customers.length, open]);

  useEffect(() => {
    if (!open || selectedCounterpartyId || legalEntities.length === 0) {
      return;
    }

    const preferredCounterparty =
      customers
        .flatMap((customer) =>
          customer.legalEntities.map((legalEntity) => ({
            counterpartyId: legalEntity.counterpartyId,
            preferred:
              customer.primaryCounterpartyId === legalEntity.counterpartyId,
          })),
        )
        .find((item) => item.preferred)?.counterpartyId ??
      legalEntities[0]?.counterpartyId;

    if (preferredCounterparty) {
      setSelectedCounterpartyId(preferredCounterparty);
    }
  }, [customers, legalEntities, open, selectedCounterpartyId]);

  async function fetchClients() {
    try {
      setLoadingClients(true);
      const response = await fetch(`${API_BASE_URL}/customer/customers`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Ошибка загрузки организаций");
      }

      const data: CustomerClientsResponse = await response.json();
      setCustomers(data.data ?? []);
    } catch (fetchError) {
      console.error("Error fetching clients:", fetchError);
      setError("Не удалось загрузить организации");
    } finally {
      setLoadingClients(false);
    }
  }

  async function handleCreate() {
    if (!selectedCounterpartyId) {
      setError("Выберите юридическое лицо");
      return;
    }

    try {
      setCreating(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/customer/applications`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          counterpartyId: selectedCounterpartyId,
          requestedAmount: amount || undefined,
          requestedCurrency: currency,
        }),
      });

      if (!response.ok) {
        throw new Error("Не удалось создать заявку");
      }

      const created = await response.json();
      onOpenChange(false);
      onSuccess?.();
      router.push(`/applications/${created.id}`);
      router.refresh();
    } catch (createError) {
      console.error("Error creating application:", createError);
      setError(
        createError instanceof Error
          ? createError.message
          : "Не удалось создать заявку",
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Новая заявка</DialogTitle>
            <DialogDescription>
              Создайте заявку по одному из ваших юридических лиц.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Юридическое лицо</Label>
              <Popover open={clientsOpen} onOpenChange={setClientsOpen}>
                <PopoverTrigger
                  render={
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between"
                    />
                  }
                >
                  {selectedLegalEntity
                    ? `${selectedLegalEntity.customerDisplayName} / ${selectedLegalEntity.shortName}`
                    : "Выберите юридическое лицо"}
                  <ChevronsUpDown className="h-4 w-4 opacity-50" />
                </PopoverTrigger>
                <PopoverContent className="w-[360px] p-0">
                  <Command>
                    <CommandInput placeholder="Поиск юридического лица..." />
                    <CommandList>
                      <CommandEmpty>Юридические лица не найдены</CommandEmpty>
                      <CommandGroup>
                        {legalEntities.map((legalEntity) => (
                          <CommandItem
                            key={legalEntity.counterpartyId}
                            value={`${legalEntity.customerDisplayName} ${legalEntity.shortName}`}
                            onSelect={() => {
                              setSelectedCounterpartyId(
                                legalEntity.counterpartyId,
                              );
                              setClientsOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedCounterpartyId ===
                                  legalEntity.counterpartyId
                                  ? "opacity-100"
                                  : "opacity-0",
                              )}
                            />
                            <div className="flex flex-col gap-0.5">
                              <span>{legalEntity.shortName}</span>
                              <span className="text-xs text-muted-foreground">
                                {legalEntity.customerDisplayName}
                              </span>
                              {legalEntity.inn ? (
                                <span className="text-xs text-muted-foreground">
                                  ИНН: {legalEntity.inn}
                                </span>
                              ) : null}
                              {!legalEntity.hasLegacyShell ? (
                                <span className="text-xs text-amber-600">
                                  shell будет создан автоматически
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
              {!loadingClients && selectedLegalEntity && !selectedLegalEntity.hasLegacyShell ? (
                <p className="text-sm text-amber-600">
                  Для выбранного юридического лица execution-shell будет
                  создан автоматически при создании заявки.
                </p>
              ) : null}
            </div>

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

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Отмена
            </Button>
            <Button onClick={handleCreate} disabled={creating || loadingClients}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Создать заявку
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
