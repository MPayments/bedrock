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
  amount: string;
  amountSide?: "source" | "target";
  asOf: string;
  currencyOptions: ApiCurrencyOption[];
  description?: string;
  disabledReason: string | null;
  isCreating: boolean;
  loadingLabel?: string;
  onAmountChange: (value: string) => void;
  onAsOfChange: (value: string) => void;
  onCancel: () => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
  onToCurrencyChange: (value: string) => void;
  onToggleOverride: (next: boolean) => void;
  open: boolean;
  overrideAmount: boolean;
  sourceCurrency: ApiCurrency | null;
  submitLabel?: string;
  title?: string;
  toCurrency: string;
};

export function CalculationDialog({
  open,
  onOpenChange,
  amount,
  amountSide = "source",
  asOf,
  currencyOptions,
  disabledReason,
  isCreating,
  onAmountChange,
  onAsOfChange,
  onCancel,
  onSubmit,
  onToCurrencyChange,
  onToggleOverride,
  overrideAmount,
  sourceCurrency,
  submitLabel = "Сохранить",
  title = "Создать расчет",
  toCurrency,
  description = "Создайте котировку и сохраните расчет для этой сделки.",
  loadingLabel = "Сохраняем...",
}: CalculationDialogProps) {
  const amountLabel =
    amountSide === "target" ? "Сумма оплаты" : "Сумма списания";
  const toCurrencyLabel =
    amountSide === "target" ? "Валюта оплаты" : "Валюта назначения";

  const amountField = (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="deal-calculation-amount">{amountLabel}</Label>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Checkbox
            id="deal-calculation-amount-override"
            checked={overrideAmount}
            onCheckedChange={(checked) => onToggleOverride(Boolean(checked))}
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
        inputMode="decimal"
        placeholder="Например 1000.00"
        value={amount}
        onChange={(event) => onAmountChange(event.target.value)}
      />
    </div>
  );

  const toCurrencyField = (
    <div className="grid gap-2">
      <Label>{toCurrencyLabel}</Label>
      <Select
        value={toCurrency}
        onValueChange={(value) => onToCurrencyChange(value ?? "")}
      >
        <SelectTrigger disabled={amountSide === "target"}>
          <SelectValue placeholder="Выберите валюту" />
        </SelectTrigger>
        <SelectContent>
          {currencyOptions
            .filter((option) => option.code !== sourceCurrency?.code)
            .map((option) => (
              <SelectItem key={option.code} value={option.code}>
                {option.label}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Валюта списания</Label>
            <Input disabled value={sourceCurrency?.code ?? "—"} />
          </div>
          <div
            className={
              amountSide === "target"
                ? "grid grid-cols-[minmax(0,1fr)_11rem] gap-3"
                : "grid gap-4"
            }
          >
            {amountField}
            {amountSide === "target" ? toCurrencyField : null}
          </div>
          {amountSide === "target" ? null : toCurrencyField}
          <div className="grid gap-2">
            <Label htmlFor="deal-calculation-asof">Дата котировки</Label>
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
            {isCreating ? loadingLabel : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
