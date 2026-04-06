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

type CreateCalculationDialogProps = {
  agentFeePercent: string;
  fixedFeeAmount: string;
  fixedFeeCurrencyCode: string | null;
  isCreating: boolean;
  onAgentFeePercentChange: (value: string) => void;
  onCancel: () => void;
  onFixedFeeAmountChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
  open: boolean;
  quotePairLabel: string | null;
};

export function CreateCalculationDialog({
  agentFeePercent,
  fixedFeeAmount,
  fixedFeeCurrencyCode,
  isCreating,
  onAgentFeePercentChange,
  onCancel,
  onFixedFeeAmountChange,
  onOpenChange,
  onSubmit,
  open,
  quotePairLabel,
}: CreateCalculationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Создать расчет</DialogTitle>
          <DialogDescription>
            {quotePairLabel
              ? `Расчет будет создан по принятой котировке ${quotePairLabel}.`
              : "Расчет будет создан по принятой котировке."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            Комиссии и дополнительные расходы необязательны. Если в договоре уже
            есть условия, они подставлены в форму и их можно изменить или
            очистить перед созданием расчета.
          </div>
          <div className="grid gap-2">
            <Label htmlFor="deal-create-calculation-agent-fee">
              Агентская комиссия (%)
            </Label>
            <Input
              id="deal-create-calculation-agent-fee"
              inputMode="decimal"
              placeholder="Например 1"
              value={agentFeePercent}
              onChange={(event) => onAgentFeePercentChange(event.target.value)}
            />
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_8rem] gap-3">
            <div className="grid gap-2">
              <Label htmlFor="deal-create-calculation-fixed-fee">
                Фиксированная комиссия
              </Label>
              <Input
                id="deal-create-calculation-fixed-fee"
                inputMode="decimal"
                placeholder="Например 150"
                value={fixedFeeAmount}
                onChange={(event) => onFixedFeeAmountChange(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Валюта</Label>
              <Input disabled value={fixedFeeCurrencyCode ?? "—"} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Отмена
          </Button>
          <Button onClick={onSubmit} disabled={isCreating}>
            {isCreating ? "Создаем..." : "Создать расчет"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
