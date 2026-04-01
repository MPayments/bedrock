import { ChevronDown, Plus, Wallet } from "lucide-react";
import { Button } from "@bedrock/sdk-ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@bedrock/sdk-ui/components/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@bedrock/sdk-ui/components/dropdown-menu";
import { getUuidPrefix } from "@bedrock/shared/core/uuid";

import { formatCurrency, formatDate } from "./format";
import type { CalculationHistoryView, CalculationView } from "./types";

type FinancialCardProps = {
  calculation: CalculationView | null;
  calculationHistory: CalculationHistoryView[];
  activeCalculationId: string | null;
  disabledReason: string | null;
  isCreating: boolean;
  isSwitching: boolean;
  onCreate: () => void;
  onSwitch: (calculationId: string) => void;
};

export function FinancialCard({
  calculation,
  calculationHistory,
  activeCalculationId,
  disabledReason,
  isCreating,
  isSwitching,
  onCreate,
  onSwitch,
}: FinancialCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-muted-foreground" />
          Финансовая информация
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          {calculationHistory.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={isSwitching}>
                  История
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel>Версии расчета</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  {calculationHistory.map((item) => {
                    const isCurrent = item.calculationId === activeCalculationId;
                    return (
                      <DropdownMenuItem
                        key={item.calculationId}
                        disabled={isSwitching || isCurrent}
                        onClick={() => onSwitch(item.calculationId)}
                      >
                        <div className="flex flex-col">
                          <span className="text-sm">
                            {formatDate(item.calculationTimestamp)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            курс {item.rate} · {getUuidPrefix(item.calculationId)}
                            {isCurrent ? " · активный" : ""}
                          </span>
                        </div>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button
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
                Сумма
              </div>
              <div className="text-base font-medium">
                {formatCurrency(
                  calculation.originalAmount,
                  calculation.currencyCode,
                )}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Комиссия
              </div>
              <div className="text-base">
                {calculation.feePercentage}% (
                {formatCurrency(
                  calculation.feeAmount,
                  calculation.currencyCode,
                )}
                )
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Курс
              </div>
              <div className="text-base">{calculation.rate}</div>
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
                Итого в базе
              </div>
              <div className="text-lg font-bold text-primary">
                {formatCurrency(
                  calculation.totalWithExpensesInBase,
                  calculation.baseCurrencyCode,
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
