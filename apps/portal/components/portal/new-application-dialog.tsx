"use client";

import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@bedrock/sdk-ui/components/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bedrock/sdk-ui/components/select";
import { API_BASE_URL } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface CustomerContext {
  customerId: string;
  displayName: string;
  legacyClientId: number | null;
  legacyProfileStatus: "linked" | "missing";
}

interface CustomerClientsResponse {
  data: CustomerContext[];
  total: number;
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
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | undefined>();
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  useEffect(() => {
    if (open && customers.length === 0) {
      void fetchClients();
    }
  }, [customers.length, open]);

  useEffect(() => {
    if (!open || selectedCustomerId || customers.length === 0) {
      return;
    }

    const firstLinkedCustomer = customers.find(
      (customer) => customer.legacyClientId != null,
    );
    if (firstLinkedCustomer) {
      setSelectedCustomerId(firstLinkedCustomer.customerId);
    }
  }, [customers, open, selectedCustomerId]);

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

      const firstLinkedCustomer = data.data.find(
        (customer) => customer.legacyClientId != null,
      );
      if (data.total === 1 && data.data[0]?.legacyClientId != null) {
        setSelectedCustomerId(data.data[0].customerId);
      } else if (firstLinkedCustomer) {
        setSelectedCustomerId(firstLinkedCustomer.customerId);
      }
    } catch (fetchError) {
      console.error("Error fetching clients:", fetchError);
      setError("Не удалось загрузить организации");
    } finally {
      setLoadingClients(false);
    }
  }

  async function handleCreate() {
    const selectedCustomer = customers.find(
      (customer) => customer.customerId === selectedCustomerId,
    );
    const selectedClientId = selectedCustomer?.legacyClientId ?? null;

    if (!selectedCustomerId) {
      setError("Выберите организацию");
      return;
    }
    if (!selectedClientId) {
      setError(
        "Для выбранной организации legacy-профиль ещё не создан. Создание заявок пока недоступно.",
      );
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
          clientId: selectedClientId,
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
      setSelectedCustomerId(undefined);
      setShowCloseConfirm(false);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && (amount || selectedCustomerId)) {
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
              Создайте заявку по одной из ваших организаций.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Организация</Label>
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
                  {selectedCustomerId
                    ? customers.find(
                        (customer) => customer.customerId === selectedCustomerId,
                      )?.displayName
                    : "Выберите организацию"}
                  <ChevronsUpDown className="h-4 w-4 opacity-50" />
                </PopoverTrigger>
                <PopoverContent className="w-[320px] p-0">
                  <Command>
                    <CommandInput placeholder="Поиск организации..." />
                    <CommandList>
                      <CommandEmpty>Организации не найдены</CommandEmpty>
                      <CommandGroup>
                        {customers.map((customer) => (
                          <CommandItem
                            key={customer.customerId}
                            value={customer.displayName}
                            onSelect={() => {
                              setSelectedCustomerId(customer.customerId);
                              setClientsOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedCustomerId === customer.customerId
                                  ? "opacity-100"
                                  : "opacity-0",
                              )}
                            />
                            <div className="flex flex-col gap-0.5">
                              <span>{customer.displayName}</span>
                              {customer.legacyProfileStatus === "missing" ? (
                                <span className="text-xs text-amber-600">
                                  legacy-профиль ещё не создан
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
                  Загрузка организаций...
                </div>
              ) : null}
              {!loadingClients &&
              selectedCustomerId &&
              customers.find(
                (customer) => customer.customerId === selectedCustomerId,
              )?.legacyClientId == null ? (
                <p className="text-sm text-amber-600">
                  Для выбранной организации legacy-профиль ещё не создан.
                  Создание заявок пока недоступно.
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

            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}
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
