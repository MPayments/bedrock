"use client";

import { Badge } from "@bedrock/sdk-ui/components/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@bedrock/sdk-ui/components/sheet";

import type {
  FinanceDealPaymentStep,
  FinanceDealPaymentStepAttempt,
} from "@/features/treasury/deals/lib/queries";

const OUTCOME_LABELS: Record<
  FinanceDealPaymentStepAttempt["outcome"],
  string
> = {
  pending: "В процессе",
  settled: "Исполнено",
  failed: "Ошибка",
  voided: "Отменено",
  returned: "Возврат",
};

const OUTCOME_VARIANTS: Record<
  FinanceDealPaymentStepAttempt["outcome"],
  "default" | "destructive" | "outline" | "secondary"
> = {
  pending: "outline",
  settled: "default",
  failed: "destructive",
  voided: "secondary",
  returned: "destructive",
};

export interface StepAttemptsDrawerProps {
  step: FinanceDealPaymentStep;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StepAttemptsDrawer({
  onOpenChange,
  open,
  step,
}: StepAttemptsDrawerProps) {
  const attempts = [...step.attempts].sort(
    (left, right) => right.attemptNo - left.attemptNo,
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md"
        data-testid={`finance-step-attempts-drawer-${step.id}`}
      >
        <SheetHeader>
          <SheetTitle>История попыток</SheetTitle>
          <SheetDescription>
            Все отправки и исходы по этому шагу. Попытки добавляются при
            каждом вызове «Отправить» и никогда не удаляются.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4">
          {attempts.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Ещё не было ни одной отправки.
            </p>
          ) : (
            <ol className="space-y-4">
              {attempts.map((attempt) => (
                <li
                  key={attempt.id}
                  className="border-muted space-y-2 rounded-md border p-3"
                  data-testid={`finance-step-attempts-drawer-item-${attempt.id}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="font-medium">
                        Попытка #{attempt.attemptNo}
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {new Date(attempt.submittedAt).toLocaleString()}
                      </div>
                    </div>
                    <Badge variant={OUTCOME_VARIANTS[attempt.outcome]}>
                      {OUTCOME_LABELS[attempt.outcome]}
                    </Badge>
                  </div>

                  {attempt.providerRef ? (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Банк/провайдер:&nbsp;</span>
                      <code className="text-xs">{attempt.providerRef}</code>
                    </div>
                  ) : null}

                  {attempt.outcomeAt ? (
                    <div className="text-muted-foreground text-xs">
                      Итог зафиксирован:{" "}
                      {new Date(attempt.outcomeAt).toLocaleString()}
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
