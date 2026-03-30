"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@bedrock/sdk-ui/components/dialog";
import { Button } from "@bedrock/sdk-ui/components/button";
import { Label } from "@bedrock/sdk-ui/components/label";
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
  id: string;
  label: string;
  institutionName: string | null;
  accountNo: string | null;
  bic: string | null;
  swift: string | null;
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
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
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
      // Загружаем реквизиты организации по активному контракту клиента
      setLoadingBanks(true);
      setError(null);
      try {
        const applicationRes = await fetch(`${API_BASE_URL}/applications/${applicationId}`, {
          credentials: "include",
        });

        if (!applicationRes.ok) {
          const errorData = await applicationRes.json().catch(() => ({}));
          throw new Error(errorData.message || "Ошибка загрузки заявки");
        }

        const application = await applicationRes.json();
        const clientId = application.clientId as number | undefined;
        if (!clientId) {
          throw new Error("У заявки не найден клиент");
        }

        const contractRes = await fetch(
          `${API_BASE_URL}/contracts?clientId=${clientId}&isActive=true&limit=1&offset=0`,
          { credentials: "include" },
        );

        if (!contractRes.ok) {
          const errorData = await contractRes.json().catch(() => ({}));
          throw new Error(errorData.message || "Ошибка загрузки договора");
        }

        const contractPayload = await contractRes.json();
        const contracts = Array.isArray(contractPayload)
          ? contractPayload
          : contractPayload.data ?? [];
        const contract = contracts[0];

        if (!contract?.organizationId) {
          throw new Error("У клиента нет активного договора с организацией");
        }

        const requisitesRes = await fetch(
          `${API_BASE_URL}/requisites?ownerType=organization&ownerId=${contract.organizationId}&kind=bank&limit=100&offset=0`,
          { credentials: "include" },
        );

        if (!requisitesRes.ok) {
          const errorData = await requisitesRes.json().catch(() => ({}));
          throw new Error(
            errorData.message || "Ошибка загрузки реквизитов организации",
          );
        }

        const requisitesPayload = await requisitesRes.json();
        const banksData: Bank[] = Array.isArray(requisitesPayload)
          ? requisitesPayload
          : requisitesPayload.data ?? [];
        setBanks(banksData);
        setStep("bank");
      } catch (err) {
        console.error("Banks fetch error:", err);
        setError(
        err instanceof Error ? err.message : "Не удалось загрузить реквизиты"
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
      setError("Не выбран расчёт или реквизит");
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
          organizationRequisiteId: selectedBankId,
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
              : "Шаг 2 из 2: Выберите банковский реквизит организации"}
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
                  onValueChange={(value) => setSelectedBankId(value)}
                >
                  <div className="space-y-3">
                    {banks.map((bank) => {
                      const label = bank.label || bank.institutionName || "Реквизит";
                      const details = [
                        bank.institutionName,
                        bank.accountNo ? `Счёт: ${bank.accountNo}` : null,
                        bank.bic ? `BIC: ${bank.bic}` : null,
                        bank.swift ? `SWIFT: ${bank.swift}` : null,
                      ]
                        .filter(Boolean)
                        .join(" • ");

                      return (
                        <div
                          key={bank.id}
                          className="flex items-center space-x-3 rounded-lg border p-4 transition-colors hover:bg-accent"
                        >
                          <RadioGroupItem
                            value={bank.id.toString()}
                            id={`bank-${bank.id}`}
                          />
                          <Label
                            htmlFor={`bank-${bank.id}`}
                            className="flex-1 cursor-pointer font-normal"
                          >
                            <div className="font-medium">{label}</div>
                            {details && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {details}
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
                  Для организации по договору нет доступных банковских реквизитов
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
