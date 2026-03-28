"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
import { Loader2, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Client {
  id: number;
  orgName: string;
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
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [clientsOpen, setClientsOpen] = useState(false);

  const [selectedClientId, setSelectedClientId] = useState<number | undefined>(
    undefined
  );
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  // Fetch clients when dialog opens
  useEffect(() => {
    if (open && clients.length === 0) {
      fetchClients();
    }
  }, [open]);

  const fetchClients = async () => {
    try {
      setLoadingClients(true);
      const response = await fetch(`${API_BASE_URL}/customer/clients`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Ошибка загрузки организаций");
      }

      const data = await response.json();
      setClients(data);

      // Auto-select if only one client
      if (data.length === 1) {
        setSelectedClientId(data[0].id);
      }
    } catch (err) {
      console.error("Error fetching clients:", err);
      setError("Не удалось загрузить список организаций");
    } finally {
      setLoadingClients(false);
    }
  };

  // Check if form is dirty
  const isFormDirty = () => {
    return selectedClientId !== undefined || amount.length > 0;
  };

  // Handle close with confirmation
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && isFormDirty() && !creating) {
      setShowCloseConfirm(true);
      return;
    }
    onOpenChange(newOpen);
    if (!newOpen) {
      resetForm();
    }
  };

  const resetForm = () => {
    setSelectedClientId(undefined);
    setAmount("");
    setCurrency("USD");
    setError(null);
  };

  const confirmClose = () => {
    setShowCloseConfirm(false);
    onOpenChange(false);
    resetForm();
  };

  const handleCreate = async () => {
    if (!selectedClientId) {
      setError("Пожалуйста, выберите организацию");
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError("Пожалуйста, укажите сумму");
      return;
    }

    try {
      setCreating(true);
      setError(null);

      const res = await fetch(`${API_BASE_URL}/customer/applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          clientId: selectedClientId,
          amount: amount,
          currency: currency,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Ошибка создания заявки");
      }

      const data = await res.json();
      const applicationId = data.id;

      // Success - close and navigate
      onOpenChange(false);
      if (onSuccess) onSuccess();

      // Navigate to application page
      router.push(`/customer/applications/${applicationId}`);

      // Reset form
      resetForm();
    } catch (err) {
      console.error("Create application error:", err);
      setError(err instanceof Error ? err.message : "Ошибка создания заявки");
    } finally {
      setCreating(false);
    }
  };

  const canCreate = () => {
    return (
      selectedClientId !== undefined &&
      amount.length > 0 &&
      parseFloat(amount) > 0 &&
      !creating
    );
  };

  const selectedClient = clients.find((c) => c.id === selectedClientId);

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[500px]" showCloseButton={!creating}>
          <DialogHeader>
            <DialogTitle>Новая заявка</DialogTitle>
            <DialogDescription>
              Укажите сумму и валюту для создания заявки. Агент подготовит
              расчёт для вас.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {/* Client selection */}
            <div className="space-y-2">
              <Label>
                Организация <span className="text-red-500">*</span>
              </Label>
              {loadingClients ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Загрузка организаций...
                </div>
              ) : clients.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Нет доступных организаций. Сначала добавьте организацию.
                </p>
              ) : (
                <Popover open={clientsOpen} onOpenChange={setClientsOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={clientsOpen}
                      className="w-full justify-between"
                      disabled={creating}
                    >
                      {selectedClient
                        ? selectedClient.orgName
                        : "Выберите организацию..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Поиск организации..." />
                      <CommandList>
                        <CommandEmpty>Организации не найдены</CommandEmpty>
                        <CommandGroup>
                          {clients.map((client) => (
                            <CommandItem
                              key={client.id}
                              value={client.orgName}
                              onSelect={() => {
                                setSelectedClientId(client.id);
                                setClientsOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedClientId === client.id
                                    ? "opacity-100"
                                    : "opacity-0"
                                )}
                              />
                              {client.orgName}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              )}
            </div>

            {/* Amount input */}
            <div className="space-y-2">
              <Label htmlFor="amount">
                Сумма <span className="text-red-500">*</span>
              </Label>
              <div className="flex gap-2">
                <Input
                  id="amount"
                  type="number"
                  placeholder="10000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={creating}
                  className="flex-1"
                  min="0"
                  step="0.01"
                />
                <Select
                  value={currency}
                  onValueChange={setCurrency}
                  disabled={creating}
                >
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((cur) => (
                      <SelectItem key={cur.value} value={cur.value}>
                        {cur.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                Укажите сумму, которую хотите оплатить
              </p>
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 dark:bg-red-950/50 p-3 rounded-md">
                {error}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={creating}
            >
              Отмена
            </Button>
            <Button
              type="button"
              onClick={handleCreate}
              disabled={!canCreate()}
            >
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Создать заявку
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close confirmation dialog */}
      <AlertDialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Закрыть форму?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите закрыть форму? Введённые данные не будут
              сохранены.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Продолжить редактирование</AlertDialogCancel>
            <AlertDialogAction onClick={confirmClose}>
              Закрыть форму
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
