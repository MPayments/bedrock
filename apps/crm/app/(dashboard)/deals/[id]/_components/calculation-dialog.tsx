import { Button } from "@bedrock/sdk-ui/components/button";
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
import { Checkbox } from "@bedrock/sdk-ui/components/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bedrock/sdk-ui/components/select";

import type { ApiCurrency, ApiCurrencyOption } from "./types";

type CalculationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestedCurrency: ApiCurrency | null;
  currencyOptions: ApiCurrencyOption[];
  amount: string;
  overrideAmount: boolean;
  toCurrency: string;
  asOf: string;
  disabledReason: string | null;
  isCreating: boolean;
  onToggleOverride: (next: boolean) => void;
  onAmountChange: (value: string) => void;
  onToCurrencyChange: (value: string) => void;
  onAsOfChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
};

export function CalculationDialog({
  open,
  onOpenChange,
  requestedCurrency,
  currencyOptions,
  amount,
  overrideAmount,
  toCurrency,
  asOf,
  disabledReason,
  isCreating,
  onToggleOverride,
  onAmountChange,
  onToCurrencyChange,
  onAsOfChange,
  onSubmit,
  onCancel,
}: CalculationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Создать расчет</DialogTitle>
          <DialogDescription>
            Создайте котировку и сохраните расчет для этой сделки.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Валюта сделки</Label>
            <Input disabled value={requestedCurrency?.code ?? "—"} />
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="deal-calculation-amount">Сумма</Label>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox
                  id="deal-calculation-amount-override"
                  checked={overrideAmount}
                  onCheckedChange={(checked) =>
                    onToggleOverride(Boolean(checked))
                  }
                />
                <Label
                  htmlFor="deal-calculation-amount-override"
                  className="text-xs text-muted-foreground"
                >
                  Изменить сумму
                </Label>
              </div>
            </div>
            <Input
              id="deal-calculation-amount"
              disabled={!overrideAmount}
              placeholder="Например 1000.00"
              value={amount}
              onChange={(event) => onAmountChange(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>Валюта назначения</Label>
            <Select
              value={toCurrency}
              onValueChange={(value) => onToCurrencyChange(value ?? "")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Выберите валюту" />
              </SelectTrigger>
              <SelectContent>
                {currencyOptions
                  .filter((option) => option.code !== requestedCurrency?.code)
                  .map((option) => (
                    <SelectItem key={option.code} value={option.code}>
                      {option.label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="deal-calculation-asof">Дата расчета</Label>
            <Input
              id="deal-calculation-asof"
              type="datetime-local"
              value={asOf}
              onChange={(event) => onAsOfChange(event.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Отмена
          </Button>
          <Button onClick={onSubmit} disabled={isCreating || Boolean(disabledReason)}>
            {isCreating ? "Создание..." : "Создать расчет"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
