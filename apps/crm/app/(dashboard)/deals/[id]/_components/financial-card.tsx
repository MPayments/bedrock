import { ChevronDown, Plus, Wallet } from "lucide-react";
import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@bedrock/sdk-ui/components/dropdown-menu";

import { formatCurrency, formatDate } from "./format";
import type { CalculationHistoryView, CalculationView } from "./types";

type FinancialCardProps = {
  calculation: CalculationView | null;
  calculationHistory: CalculationHistoryView[];
  activeCalculationId: string | null;
  disabledReason: string | null;
  isCreating: boolean;
  onCreate: () => void;
};

export function FinancialCard({
  calculation,
  calculationHistory,
  activeCalculationId,
  disabledReason,
  isCreating,
  onCreate,
}: FinancialCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-muted-foreground" />
          Расчет
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          {calculationHistory.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="outline" size="sm" />}
              >
                История
                <ChevronDown className="ml-2 h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Версии расчета</DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <div className="space-y-1">
                  {calculationHistory.map((item) => {
                    const isCurrent =
                      item.calculationId === activeCalculationId;
                    return (
                      <div
                        key={item.calculationId}
                        className="rounded-md px-1.5 py-1 text-sm"
                      >
                        <div className="flex flex-col">
                          <span>{formatDate(item.calculationTimestamp)}</span>
                          <span className="text-xs text-muted-foreground">
                            курс {item.rate}
                            {isCurrent ? " · текущая версия" : ""}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button
            data-testid="deal-create-calculation-button"
            size="sm"
            onClick={onCreate}
            disabled={Boolean(disabledReason) || isCreating}
          >
            <Plus className="mr-2 h-4 w-4" />
            {calculation ? "Новая версия" : "Создать расчет"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {disabledReason && (
          <div className="mb-3 rounded-md border border-dashed border-muted-foreground/40 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            {disabledReason}
          </div>
        )}
        {calculation ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Валюта расчета
              </div>
              <div className="text-base">{calculation.currencyCode}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Договорная комиссия
              </div>
              <div className="text-base">
                {calculation.agreementFeePercentage}% (
                {formatCurrency(
                  calculation.agreementFeeAmount,
                  calculation.currencyCode,
                )}
                )
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Надбавка к котировке
              </div>
              <div className="text-base">
                {calculation.quoteMarkupPercentage}% (
                {formatCurrency(
                  calculation.quoteMarkupAmount,
                  calculation.currencyCode,
                )}
                )
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Суммарная комиссия
              </div>
              <div className="text-base">
                {calculation.totalFeePercentage}% (
                {formatCurrency(
                  calculation.totalFeeAmount,
                  calculation.currencyCode,
                )}
                )
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Итого к списанию
              </div>
              <div className="text-base font-semibold text-primary">
                {formatCurrency(
                  calculation.totalAmount,
                  calculation.currencyCode,
                )}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Финальный курс клиента
              </div>
              <div className="text-base">{calculation.finalRate}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Доп. расходы
              </div>
              <div className="text-base">
                {formatCurrency(
                  calculation.additionalExpenses,
                  calculation.additionalExpensesCurrencyCode ??
                    calculation.baseCurrencyCode,
                )}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Фиксированная комиссия
              </div>
              <div className="text-base">
                {calculation.fixedFeeAmount && calculation.fixedFeeCurrencyCode
                  ? formatCurrency(
                      calculation.fixedFeeAmount,
                      calculation.fixedFeeCurrencyCode,
                    )
                  : "Нет"}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Комиссия в базе
              </div>
              <div className="text-base">
                {formatCurrency(
                  calculation.totalFeeAmountInBase,
                  calculation.baseCurrencyCode,
                )}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Оригинальная сумма
              </div>
              <div className="text-lg font-bold text-primary">
                {formatCurrency(
                  calculation.originalAmount,
                  calculation.currencyCode,
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            Расчет к сделке не привязан.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
