import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@bedrock/sdk-ui/components/dialog";

type CreateCalculationDialogProps = {
  agreementFeePercentage: string;
  finalRate: string;
  fixedFeeAmount: string;
  fixedFeeCurrencyCode: string | null;
  isCreating: boolean;
  onCancel: () => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
  open: boolean;
  quotePairLabel: string | null;
  quoteMarkupPercentage: string;
  totalFeePercentage: string;
};

export function CreateCalculationDialog({
  agreementFeePercentage,
  finalRate,
  fixedFeeAmount,
  fixedFeeCurrencyCode,
  isCreating,
  onCancel,
  onOpenChange,
  onSubmit,
  open,
  quotePairLabel,
  quoteMarkupPercentage,
  totalFeePercentage,
}: CreateCalculationDialogProps) {
  const summaryItems = [
    {
      label: "Договорная комиссия",
      value: `${agreementFeePercentage || "0"}%`,
    },
    {
      label: "Надбавка к котировке",
      value: `${quoteMarkupPercentage || "0"}%`,
    },
    {
      label: "Суммарная комиссия",
      value: `${totalFeePercentage || "0"}%`,
    },
    {
      label: "Финальный курс клиента",
      value: finalRate || "—",
    },
    {
      label: "Фиксированная комиссия",
      value:
        fixedFeeAmount && fixedFeeCurrencyCode
          ? `${fixedFeeAmount} ${fixedFeeCurrencyCode}`
          : "Нет фиксированной комиссии",
    },
  ];

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
            Расчет будет зафиксирован по уже принятой котировке. Коммерческие
            условия ниже попадут в снимок расчета без дополнительного
            редактирования на этом шаге.
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {summaryItems.map((item) => (
              <div
                key={item.label}
                className="rounded-md border bg-muted/20 p-3"
              >
                <div className="text-xs text-muted-foreground">
                  {item.label}
                </div>
                <div className="mt-1 wrap-break-word text-sm font-medium text-foreground">
                  {item.value}
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
            Изменить надбавку или фиксированную комиссию после принятия
            котировки нельзя. Для этого нужно запросить и принять новую
            котировку.
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Отмена
          </Button>
          <Button
            data-testid="deal-create-calculation-confirm"
            onClick={onSubmit}
            disabled={isCreating}
          >
            {isCreating ? "Создаем..." : "Создать расчет"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
