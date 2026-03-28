"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { API_BASE_URL } from "@/lib/constants";
import { Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
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
import { formatCurrency as formatCurrencyUtil } from "@/lib/utils/currency";

type CurrencyCode = "USD" | "EUR" | "RUB" | "TRY" | "AED" | "CNY";
type RateSource = "investing" | "cbru" | "manual";

interface CalculationFormData {
  currency?: CurrencyCode;
  baseCurrencyCode?: CurrencyCode;
  rateSource?: RateSource;
  manualRate?: number;
  amount?: number;
  fee?: number;
  additionalExpensesCurrency?: CurrencyCode | "none";
  additionalExpenses?: number;
  additionalExpensesRate?: number;
}

interface CalculationResult {
  originalAmount: number;
  currencyCode: string;
  rate: number;
  feePercentage: number;
  feeAmount: number;
  totalAmount: number;
  baseCurrencyCode: string;
  feeAmountInBase: number;
  totalInBase: number;
  additionalExpensesInBase: number;
  totalWithExpensesInBase: number;
  additionalExpenses: number;
  additionalExpensesCurrency: string;
  timestamp: string;
  rateSource: string;
}

const BASE_CURRENCIES: { code: CurrencyCode; label: string }[] = [
  { code: "RUB", label: "RUB - Российский рубль" },
  { code: "USD", label: "USD - Доллар США" },
];

const CURRENCIES: { code: CurrencyCode; flag: string; label: string }[] = [
  { code: "USD", flag: "🇺🇸", label: "USD - Доллар США" },
  { code: "EUR", flag: "🇪🇺", label: "EUR - Евро" },
  { code: "RUB", flag: "🇷🇺", label: "RUB - Российский рубль" },
  { code: "TRY", flag: "🇹🇷", label: "TRY - Турецкая лира" },
  { code: "AED", flag: "🇦🇪", label: "AED - Дирхам ОАЭ" },
  { code: "CNY", flag: "🇨🇳", label: "CNY - Китайский юань" },
];

const RATE_SOURCES = [
  { value: "investing" as const, label: "Investing.com" },
  { value: "cbru" as const, label: "ЦБ РФ" },
  { value: "manual" as const, label: "Ручной ввод" },
];

function formatCurrencyLocal(value: number, currency?: string) {
  return formatCurrencyUtil(value, currency || "RUB");
}

interface NewCalculationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: number;
  onSuccess?: () => void;
}

export function NewCalculationDialog({
  open,
  onOpenChange,
  applicationId,
  onSuccess,
}: NewCalculationDialogProps) {
  const [formData, setFormData] = useState<CalculationFormData>({
    additionalExpensesCurrency: "none",
    fee: 2.5, // Значение по умолчанию
  });
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [pendingClose, setPendingClose] = useState(false);

  // Проверка, заполнена ли форма
  const isFormDirty = () => {
    return Object.keys(formData).length > 2; // > 2 потому что additionalExpensesCurrency и fee установлены по умолчанию
  };

  // Обработка закрытия с предупреждением
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && isFormDirty()) {
      setPendingClose(true);
      setShowCloseConfirm(true);
      return;
    }
    onOpenChange(newOpen);
    // Сброс состояния при закрытии
    if (!newOpen) {
      setFormData({
        additionalExpensesCurrency: "none",
        fee: 2.5,
      });
      setResult(null);
      setError(null);
    }
  };

  const confirmClose = () => {
    setShowCloseConfirm(false);
    setPendingClose(false);
    onOpenChange(false);
    setFormData({
      additionalExpensesCurrency: "none",
      fee: 2.5,
    });
    setResult(null);
    setError(null);
  };

  const updateFormData = (data: Partial<CalculationFormData>) => {
    setFormData((prev) => ({ ...prev, ...data }));
  };

  // Автоматический расчёт при изменении данных
  const handleCalculate = useCallback(async () => {
    // Проверяем, все ли необходимые поля заполнены
    if (
      !formData.currency ||
      !formData.rateSource ||
      !formData.amount ||
      formData.fee === undefined
    ) {
      setResult(null);
      return;
    }

    // Если ручной ввод, проверяем наличие курса
    if (formData.rateSource === "manual" && !formData.manualRate) {
      setResult(null);
      return;
    }

    // Если есть доп. расходы, проверяем их заполненность
    if (
      formData.additionalExpensesCurrency &&
      formData.additionalExpensesCurrency !== "none"
    ) {
      if (formData.additionalExpenses === undefined) {
        setResult(null);
        return;
      }
      // Если ручной ввод и валюта не RUB, нужен курс
      if (
        formData.rateSource === "manual" &&
        formData.additionalExpensesCurrency !== "RUB" &&
        !formData.additionalExpensesRate
      ) {
        setResult(null);
        return;
      }
    }

    try {
      setCalculating(true);
      setError(null);

      const requestBody = {
        currencyCode: formData.currency,
        originalAmount: formData.amount,
        feePercentage: formData.fee,
        rateSource: formData.rateSource,
        manualRate: formData.manualRate,
        additionalExpenses:
          formData.additionalExpensesCurrency === "none"
            ? 0
            : formData.additionalExpenses || 0,
        additionalExpensesCurrency:
          formData.additionalExpensesCurrency === "none"
            ? "RUB"
            : formData.additionalExpensesCurrency || "RUB",
        additionalExpensesManualRate: formData.additionalExpensesRate,
        baseCurrencyCode: formData.baseCurrencyCode || "RUB",
      };

      const res = await fetch(`${API_BASE_URL}/calculations/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Ошибка расчёта");
      }

      const data = await res.json();
      setResult(data);
    } catch (err) {
      console.error("Calculation error:", err);
      setError(err instanceof Error ? err.message : "Ошибка расчёта");
      setResult(null);
    } finally {
      setCalculating(false);
    }
  }, [formData]);

  // Автоматический пересчёт при изменении формы с debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      handleCalculate();
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [handleCalculate]);

  const handleSave = async () => {
    if (!result) return;

    try {
      setSaving(true);
      setError(null);

      const requestBody = {
        currencyCode: formData.currency!,
        originalAmount: formData.amount!,
        feePercentage: formData.fee!,
        rateSource: formData.rateSource!,
        manualRate: formData.manualRate,
        additionalExpenses:
          formData.additionalExpensesCurrency === "none"
            ? 0
            : formData.additionalExpenses || 0,
        additionalExpensesCurrency:
          formData.additionalExpensesCurrency === "none"
            ? "RUB"
            : formData.additionalExpensesCurrency || "RUB",
        additionalExpensesManualRate: formData.additionalExpensesRate,
        baseCurrencyCode: formData.baseCurrencyCode || "RUB",
      };

      const res = await fetch(
        `${API_BASE_URL}/calculations/application/${applicationId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(requestBody),
        }
      );

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Ошибка сохранения расчёта");
      }

      // Успешное сохранение
      onOpenChange(false);
      if (onSuccess) onSuccess();

      // Сброс формы
      setFormData({
        additionalExpensesCurrency: "none",
        fee: 2.5,
      });
      setResult(null);
    } catch (err) {
      console.error("Save error:", err);
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const canSave = () => {
    return !!result && !calculating && !saving;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="max-w-4xl sm:max-w-4xl max-h-[90vh] overflow-y-auto"
          showCloseButton={!saving}
        >
          <DialogHeader>
            <DialogTitle>Новый расчёт</DialogTitle>
            <DialogDescription>
              Заполните данные для расчёта. Результат обновляется автоматически.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 py-4">
            {/* Левая колонка - Форма */}
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Валюта <span className="text-red-500">*</span>
                </label>
                <Select
                  value={formData.currency}
                  onValueChange={(value: CurrencyCode) =>
                    updateFormData({ currency: value })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Выберите валюту" />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((curr) => (
                      <SelectItem key={curr.code} value={curr.code}>
                        {curr.flag} {curr.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Базовая валюта
                </label>
                <Select
                  value={formData.baseCurrencyCode || "RUB"}
                  onValueChange={(value: CurrencyCode) =>
                    updateFormData({ baseCurrencyCode: value })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Выберите базовую валюту" />
                  </SelectTrigger>
                  <SelectContent>
                    {BASE_CURRENCIES.map((curr) => (
                      <SelectItem key={curr.code} value={curr.code}>
                        {curr.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Валюта для итоговых сумм и документов
                </p>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Источник курса <span className="text-red-500">*</span>
                </label>
                <Select
                  value={formData.rateSource}
                  onValueChange={(value: RateSource) =>
                    updateFormData({ rateSource: value })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Выберите источник" />
                  </SelectTrigger>
                  <SelectContent>
                    {RATE_SOURCES.map((source) => (
                      <SelectItem key={source.value} value={source.value}>
                        {source.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.rateSource === "manual" && (
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Курс {formData.currency}/{formData.baseCurrencyCode || "RUB"} вручную{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="number"
                    step="0.0001"
                    placeholder="Например: 95.5000"
                    value={formData.manualRate || ""}
                    onChange={(e) =>
                      updateFormData({
                        manualRate: e.target.value
                          ? parseFloat(e.target.value)
                          : undefined,
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Введите курс с точностью до 4 знаков после запятой
                  </p>
                </div>
              )}

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Сумма в {formData.currency || "валюте"}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Например: 1000.00"
                  value={formData.amount || ""}
                  onChange={(e) =>
                    updateFormData({
                      amount: e.target.value
                        ? parseFloat(e.target.value)
                        : undefined,
                    })
                  }
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Комиссия (%) <span className="text-red-500">*</span>
                </label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Например: 2.5"
                  value={formData.fee ?? ""}
                  onChange={(e) =>
                    updateFormData({
                      fee: e.target.value
                        ? parseFloat(e.target.value)
                        : undefined,
                    })
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Процент комиссии от суммы
                </p>
              </div>

              <Separator />

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Дополнительные расходы
                </label>
                <Select
                  value={formData.additionalExpensesCurrency || "none"}
                  onValueChange={(value: CurrencyCode | "none") => {
                    updateFormData({ additionalExpensesCurrency: value });
                    if (value === "none") {
                      updateFormData({
                        additionalExpenses: undefined,
                        additionalExpensesRate: undefined,
                      });
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Выберите валюту" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Без доп. расходов</SelectItem>
                    {CURRENCIES.map((curr) => (
                      <SelectItem key={curr.code} value={curr.code}>
                        {curr.flag} {curr.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.additionalExpensesCurrency &&
                formData.additionalExpensesCurrency !== "none" && (
                  <>
                    {formData.rateSource === "manual" &&
                      formData.additionalExpensesCurrency !== "RUB" && (
                        <div>
                          <label className="text-sm font-medium mb-2 block">
                            Курс {formData.additionalExpensesCurrency}/RUB{" "}
                            <span className="text-red-500">*</span>
                          </label>
                          <Input
                            type="number"
                            step="0.0001"
                            placeholder="Например: 95.5000"
                            value={formData.additionalExpensesRate || ""}
                            onChange={(e) =>
                              updateFormData({
                                additionalExpensesRate: e.target.value
                                  ? parseFloat(e.target.value)
                                  : undefined,
                              })
                            }
                          />
                        </div>
                      )}

                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Сумма доп. расходов в{" "}
                        {formData.additionalExpensesCurrency}{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Например: 100.00"
                        value={formData.additionalExpenses || ""}
                        onChange={(e) =>
                          updateFormData({
                            additionalExpenses: e.target.value
                              ? parseFloat(e.target.value)
                              : undefined,
                          })
                        }
                      />
                    </div>
                  </>
                )}
            </div>

            {/* Правая колонка - Результат */}
            <div className="space-y-4">
              <div className="sticky top-0">
                <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                  Результат расчёта
                  {calculating && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </h3>

                {result ? (
                  <div className="bg-blue-50 p-4 rounded-md space-y-3">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Сумма:</span>
                        <span className="font-medium">
                          {formatCurrencyLocal(
                            result.originalAmount,
                            result.currencyCode
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Курс {result.currencyCode}/{result.baseCurrencyCode || "RUB"}:
                        </span>
                        <span className="font-medium">
                          {parseFloat(result.rate).toFixed(4)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Комиссия ({result.feePercentage}%):
                        </span>
                        <span className="font-medium">
                          {formatCurrencyLocal(
                            result.feeAmount,
                            result.currencyCode
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span className="text-muted-foreground">
                          Итого в валюте:
                        </span>
                        <span className="font-medium">
                          {formatCurrencyLocal(
                            result.totalAmount,
                            result.currencyCode
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Итого в {result.baseCurrencyCode || "RUB"}:
                        </span>
                        <span className="font-medium">
                          {formatCurrencyLocal(result.totalInBase, result.baseCurrencyCode || "RUB")}
                        </span>
                      </div>

                      {result.additionalExpenses > 0 && (
                        <>
                          <div className="flex justify-between border-t pt-2">
                            <span className="text-muted-foreground">
                              Доп. расходы:
                            </span>
                            <span className="font-medium">
                              {formatCurrencyLocal(
                                result.additionalExpenses,
                                result.additionalExpensesCurrency
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              Доп. расходы в {result.baseCurrencyCode || "RUB"}:
                            </span>
                            <span className="font-medium">
                              {formatCurrencyLocal(result.additionalExpensesInBase, result.baseCurrencyCode || "RUB")}
                            </span>
                          </div>
                        </>
                      )}

                      <div className="flex justify-between border-t pt-2 text-base">
                        <span className="font-semibold">
                          Итого с расходами:
                        </span>
                        <span className="font-bold text-lg">
                          {formatCurrencyLocal(result.totalWithExpensesInBase, result.baseCurrencyCode || "RUB")}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-muted/30 p-4 rounded-md text-center text-sm text-muted-foreground">
                    {calculating
                      ? "Выполняется расчёт..."
                      : "Заполните все обязательные поля для расчёта"}
                  </div>
                )}
              </div>
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
              {error}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={saving}
            >
              Отмена
            </Button>
            <Button type="button" onClick={handleSave} disabled={!canSave()}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Сохранить расчёт
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Диалог подтверждения закрытия */}
      <AlertDialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Закрыть форму?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите закрыть форму? Все несохранённые данные
              будут потеряны.
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
