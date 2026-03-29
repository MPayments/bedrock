"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

type CurrencyCode = "USD" | "EUR" | "RUB" | "TRY" | "AED" | "CNY";

interface Calculation {
  id: number;
  applicationId: number;
  currencyCode: string;
  originalAmount: string;
  feePercentage: string;
  feeAmount: string;
  totalAmount: string;
  rateSource: string;
  rate: string;
  additionalExpensesCurrencyCode: string | null;
  additionalExpenses: string;
  baseCurrencyCode: string;
  feeAmountInBase: string;
  totalInBase: string;
  additionalExpensesInBase: string;
  totalWithExpensesInBase: string;
  calculationTimestamp: string;
  sentToClient: number;
  status: string;
  createdAt: string;
}

const RATE_SOURCE_LABELS: Record<string, string> = {
  investing: "Investing.com",
  cbru: "ЦБ РФ",
  manual: "Ручной ввод",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Активный",
  archived: "Архивный",
};

function formatCurrency(value: string | number, currency?: string) {
  const numValue = typeof value === "string" ? parseFloat(value) : value;
  try {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: currency || "RUB",
    }).format(numValue);
  } catch {
    return new Intl.NumberFormat("ru-RU").format(numValue);
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("ru-RU");
}

interface ViewCalculationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calculation: Calculation | null;
}

export function ViewCalculationDialog({
  open,
  onOpenChange,
  calculation,
}: ViewCalculationDialogProps) {
  if (!calculation) {
    return null;
  }

  const hasAdditionalExpenses =
    calculation.additionalExpensesCurrencyCode &&
    parseFloat(calculation.additionalExpenses) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Просмотр расчёта #{calculation.id}</DialogTitle>
          <DialogDescription>
            Информация о расчёте от {formatDate(calculation.createdAt)}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 py-4">
          {/* Левая колонка - Основная информация */}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">
                Статус
              </label>
              <div className="text-base">
                {STATUS_LABELS[calculation.status] || calculation.status}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">
                Дата создания
              </label>
              <div className="text-base">
                {formatDate(calculation.createdAt)}
              </div>
            </div>

            <Separator />

            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">
                Валюта
              </label>
              <div className="text-base">{calculation.currencyCode}</div>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">
                Источник курса
              </label>
              <div className="text-base">
                {RATE_SOURCE_LABELS[calculation.rateSource] ||
                  calculation.rateSource}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">
                Курс {calculation.currencyCode}/{calculation.baseCurrencyCode || "RUB"}
              </label>
              <div className="text-base">
                {parseFloat(calculation.rate).toFixed(4)}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">
                Сумма в {calculation.currencyCode}
              </label>
              <div className="text-base">
                {formatCurrency(
                  calculation.originalAmount,
                  calculation.currencyCode
                )}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">
                Комиссия
              </label>
              <div className="text-base">
                {calculation.feePercentage}% (
                {formatCurrency(
                  calculation.feeAmount,
                  calculation.currencyCode
                )}
                )
              </div>
            </div>

            {hasAdditionalExpenses && (
              <>
                <Separator />

                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1 block">
                    Дополнительные расходы
                  </label>
                  <div className="text-base">
                    {formatCurrency(
                      calculation.additionalExpenses,
                      calculation.additionalExpensesCurrencyCode || "RUB"
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1 block">
                    Доп. расходы в {calculation.baseCurrencyCode || "RUB"}
                  </label>
                  <div className="text-base">
                    {formatCurrency(calculation.additionalExpensesInBase, calculation.baseCurrencyCode)}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Правая колонка - Результат */}
          <div className="space-y-4">
            <div className="sticky top-0">
              <h3 className="font-semibold text-lg mb-3">Результат расчёта</h3>

              <div className="bg-blue-50 p-4 rounded-md space-y-3">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Сумма:</span>
                    <span className="font-medium">
                      {formatCurrency(
                        calculation.originalAmount,
                        calculation.currencyCode
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Курс {calculation.currencyCode}/{calculation.baseCurrencyCode || "RUB"}:
                    </span>
                    <span className="font-medium">
                      {parseFloat(calculation.rate).toFixed(4)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Комиссия ({calculation.feePercentage}%):
                    </span>
                    <span className="font-medium">
                      {formatCurrency(
                        calculation.feeAmount,
                        calculation.currencyCode
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-muted-foreground">
                      Итого в валюте:
                    </span>
                    <span className="font-medium">
                      {formatCurrency(
                        calculation.totalAmount,
                        calculation.currencyCode
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Итого в {calculation.baseCurrencyCode || "RUB"}:
                    </span>
                    <span className="font-medium">
                      {formatCurrency(calculation.totalInBase, calculation.baseCurrencyCode)}
                    </span>
                  </div>

                  {hasAdditionalExpenses && (
                    <>
                      <div className="flex justify-between border-t pt-2">
                        <span className="text-muted-foreground">
                          Доп. расходы:
                        </span>
                        <span className="font-medium">
                          {formatCurrency(
                            calculation.additionalExpenses,
                            calculation.additionalExpensesCurrencyCode || "RUB"
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Доп. расходы в {calculation.baseCurrencyCode || "RUB"}:
                        </span>
                        <span className="font-medium">
                          {formatCurrency(calculation.additionalExpensesInBase, calculation.baseCurrencyCode)}
                        </span>
                      </div>
                    </>
                  )}

                  <div className="flex justify-between border-t pt-2 text-base">
                    <span className="font-semibold">
                      Итого с расходами ({calculation.baseCurrencyCode || "RUB"}):
                    </span>
                    <span className="font-bold text-lg">
                      {formatCurrency(calculation.totalWithExpensesInBase, calculation.baseCurrencyCode)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Закрыть
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
