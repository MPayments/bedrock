"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { API_BASE_URL } from "@/lib/constants";
import { Loader2 } from "lucide-react";

interface Calculation {
  id: number;
  currencyCode: string;
  originalAmount: string;
  totalWithExpensesInBase: string;
  baseCurrencyCode: string;
  createdAt: string;
}

interface Bank {
  id: number;
  name: string;
  organizationId: number;
  currencyCode?: string;
}

interface CreateDealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: number;
  calculations: Calculation[];
  onSuccess: () => void;
}

type Step = "calculation" | "bank";

export function CreateDealDialog({
  open,
  onOpenChange,
  applicationId,
  calculations,
  onSuccess,
}: CreateDealDialogProps) {
  const [step, setStep] = useState<Step>("calculation");
  const [selectedCalculationId, setSelectedCalculationId] = useState<
    number | null
  >(null);
  const [selectedBankId, setSelectedBankId] = useState<number | null>(null);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      // Сброс состояния при открытии
      setStep("calculation");
      setSelectedCalculationId(null);
      setSelectedBankId(null);
      setBanks([]);
      setError(null);
    }
  }, [open]);

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !creating && !loadingBanks) {
      onOpenChange(newOpen);
    }
  };

  const handleNextStep = async () => {
    if (step === "calculation" && selectedCalculationId) {
      // Загружаем банки
      setLoadingBanks(true);
      setError(null);
      try {
        const url = `${API_BASE_URL}/applications/${applicationId}/banks`;
        const res = await fetch(url, {
          credentials: "include",
        });

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.message || "Ошибка загрузки списка банков");
        }

        const banksData: Bank[] = await res.json();
        setBanks(banksData);
        setStep("bank");
      } catch (err) {
        console.error("Banks fetch error:", err);
        setError(
          err instanceof Error ? err.message : "Не удалось загрузить банки"
        );
      } finally {
        setLoadingBanks(false);
      }
    }
  };

  const handleBack = () => {
    setStep("calculation");
    setSelectedBankId(null);
    setError(null);
  };

  const handleCreate = async () => {
    if (!selectedCalculationId || !selectedBankId) {
      setError("Не выбран расчёт или банк");
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const url = `${API_BASE_URL}/applications/${applicationId}/deal`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          calculationId: selectedCalculationId,
          bankId: selectedBankId,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Ошибка создания сделки");
      }

      // Успешно создано
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      console.error("Create deal error:", err);
      setError(
        err instanceof Error ? err.message : "Не удалось создать сделку"
      );
    } finally {
      setCreating(false);
    }
  };

  const fmtCurrency = (value: string, currency?: string) => {
    const numValue = parseFloat(value);
    const code = currency || "RUB";
    try {
      return new Intl.NumberFormat("ru-RU", {
        style: "currency",
        currency: code,
      }).format(numValue);
    } catch {
      return new Intl.NumberFormat("ru-RU").format(numValue);
    }
  };

  const formatDate = (value: string) => {
    return new Date(value).toLocaleString("ru-RU");
  };

  // Get selected calculation's base currency
  const selectedCalc = selectedCalculationId
    ? calculations.find((c) => c.id === selectedCalculationId)
    : null;
  const selectedBaseCurrency = selectedCalc?.baseCurrencyCode || "RUB";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-[600px]"
        showCloseButton={!creating && !loadingBanks}
      >
        <DialogHeader>
          <DialogTitle>Создать сделку</DialogTitle>
          <DialogDescription>
            {step === "calculation"
              ? "Шаг 1 из 2: Выберите расчёт для создания сделки"
              : "Шаг 2 из 2: Выберите банк для сделки"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {step === "calculation" && (
            <>
              <RadioGroup
                value={selectedCalculationId?.toString() || ""}
                onValueChange={(value) =>
                  setSelectedCalculationId(parseInt(value))
                }
              >
                <div className="space-y-3">
                  {calculations.map((calc) => (
                    <div
                      key={calc.id}
                      className="flex items-start space-x-3 rounded-lg border p-4 hover:bg-accent transition-colors"
                    >
                      <RadioGroupItem
                        value={calc.id.toString()}
                        id={`calc-${calc.id}`}
                      />
                      <Label
                        htmlFor={`calc-${calc.id}`}
                        className="flex-1 cursor-pointer font-normal"
                      >
                        <div className="space-y-1">
                          <div className="font-semibold">Расчёт #{calc.id}</div>
                          <div className="text-sm text-muted-foreground">
                            {fmtCurrency(
                              calc.originalAmount,
                              calc.currencyCode
                            )}{" "}
                            → {fmtCurrency(
                              calc.totalWithExpensesInBase,
                              calc.baseCurrencyCode || "RUB"
                            )}
                          </div>
                          {calc.baseCurrencyCode && calc.baseCurrencyCode !== "RUB" && (
                            <div className="text-xs text-blue-600 font-medium">
                              Базовая: {calc.baseCurrencyCode}
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground">
                            {formatDate(calc.createdAt)}
                          </div>
                        </div>
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>

              {calculations.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Нет доступных расчётов
                </div>
              )}
            </>
          )}

          {step === "bank" && (
            <>
              {loadingBanks ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <RadioGroup
                  value={selectedBankId?.toString() || ""}
                  onValueChange={(value) => setSelectedBankId(parseInt(value))}
                >
                  <div className="space-y-3">
                    {banks.map((bank) => {
                      const bankCurrency = bank.currencyCode || "RUB";
                      const isMatch = bankCurrency === selectedBaseCurrency;
                      return (
                        <div
                          key={bank.id}
                          className={`flex items-center space-x-3 rounded-lg border p-4 transition-colors ${
                            isMatch
                              ? "hover:bg-accent"
                              : "opacity-50 cursor-not-allowed"
                          }`}
                        >
                          <RadioGroupItem
                            value={bank.id.toString()}
                            id={`bank-${bank.id}`}
                            disabled={!isMatch}
                          />
                          <Label
                            htmlFor={`bank-${bank.id}`}
                            className={`flex-1 font-normal ${isMatch ? "cursor-pointer" : "cursor-not-allowed"}`}
                          >
                            <div className="flex items-center gap-2">
                              <span>{bank.name}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded ${
                                isMatch
                                  ? "bg-green-100 text-green-800"
                                  : "bg-gray-100 text-gray-500"
                              }`}>
                                {bankCurrency}
                              </span>
                            </div>
                            {!isMatch && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Не совпадает с базовой валютой расчёта ({selectedBaseCurrency})
                              </p>
                            )}
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                </RadioGroup>
              )}

              {banks.length === 0 && !loadingBanks && (
                <div className="text-center py-8 text-muted-foreground">
                  У клиента нет доступных банков
                </div>
              )}
            </>
          )}
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <DialogFooter>
          {step === "bank" && (
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              disabled={creating || loadingBanks}
            >
              Назад
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={creating || loadingBanks}
          >
            Отмена
          </Button>
          {step === "calculation" ? (
            <Button
              type="button"
              onClick={handleNextStep}
              disabled={!selectedCalculationId || loadingBanks}
            >
              {loadingBanks && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Далее
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleCreate}
              disabled={!selectedBankId || creating}
              className="bg-green-600 hover:bg-green-700"
            >
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Создать сделку
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
