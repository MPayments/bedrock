import { CheckCircle2, Clock3, Wallet } from "lucide-react";

import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Button } from "@bedrock/sdk-ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@bedrock/sdk-ui/components/card";

import { DEAL_QUOTE_STATUS_LABELS } from "./constants";
import { FinancialCard } from "./financial-card";
import { formatDate } from "./format";
import type {
  ApiDealAcceptedQuote,
  ApiDealWorkflowProjection,
  CalculationHistoryView,
  CalculationView,
} from "./types";

type DealPricingTabProps = {
  acceptedQuote: ApiDealAcceptedQuote;
  activeCalculationId: string | null;
  calculation: CalculationView | null;
  calculationDisabledReason: string | null;
  calculationHistory: CalculationHistoryView[];
  isAcceptingQuoteId: string | null;
  isCreatingCalculation: boolean;
  isCreatingQuote: boolean;
  onAcceptQuote: (quoteId: string) => void;
  onCreateCalculation: () => void;
  onCreateQuote: () => void;
  quoteCreationDisabledReason: string | null;
  quotes: ApiDealWorkflowProjection["relatedResources"]["quotes"];
};

function formatQuoteStatus(status: string) {
  return DEAL_QUOTE_STATUS_LABELS[status] ?? status;
}

export function DealPricingTab({
  acceptedQuote,
  activeCalculationId,
  calculation,
  calculationDisabledReason,
  calculationHistory,
  isAcceptingQuoteId,
  isCreatingCalculation,
  isCreatingQuote,
  onAcceptQuote,
  onCreateCalculation,
  onCreateQuote,
  quoteCreationDisabledReason,
  quotes,
}: DealPricingTabProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-muted-foreground" />
            Котировка
          </CardTitle>
          <Button
            disabled={Boolean(quoteCreationDisabledReason) || isCreatingQuote}
            onClick={onCreateQuote}
            size="sm"
          >
            {isCreatingQuote ? "Запрашиваем..." : "Запросить котировку"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {quoteCreationDisabledReason ? (
            <div className="rounded-md border border-dashed border-muted-foreground/40 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              {quoteCreationDisabledReason}
            </div>
          ) : null}

          <div className="rounded-lg border p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="font-medium">Текущая принятая котировка</div>
                <div className="text-sm text-muted-foreground">
                  {acceptedQuote
                    ? `Принята ${formatDate(acceptedQuote.acceptedAt)}`
                    : "Котировка еще не принята"}
                </div>
              </div>
              {acceptedQuote ? (
                <Badge variant="outline">
                  {formatQuoteStatus(acceptedQuote.quoteStatus)}
                </Badge>
              ) : null}
            </div>

            {acceptedQuote ? (
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="rounded-md bg-muted/40 px-3 py-2">
                  <div className="text-xs text-muted-foreground">
                    Срок действия
                  </div>
                  <div className="text-sm font-medium">
                    {formatDate(acceptedQuote.expiresAt)}
                  </div>
                </div>
                <div className="rounded-md bg-muted/40 px-3 py-2">
                  <div className="text-xs text-muted-foreground">
                    Использование
                  </div>
                  <div className="text-sm font-medium">
                    {acceptedQuote.usedAt
                      ? `Исполнена ${formatDate(acceptedQuote.usedAt)}`
                      : "Еще не исполнена"}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-3">
            <div className="text-sm font-medium text-muted-foreground">
              История котировок
            </div>
            {quotes.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                По сделке еще нет котировок.
              </div>
            ) : (
              <div className="space-y-2">
                {quotes.map((quote, index) => {
                  const isAccepted = acceptedQuote?.quoteId === quote.id;
                  const canAccept =
                    quote.status === "active" && !isAccepted && !isCreatingQuote;

                  return (
                    <div
                      key={quote.id}
                      className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            Котировка {quotes.length - index}
                          </span>
                          {isAccepted ? (
                            <Badge variant="secondary">
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              Принята
                            </Badge>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                          <span>{formatQuoteStatus(quote.status)}</span>
                          <span className="inline-flex items-center gap-1">
                            <Clock3 className="h-3 w-3" />
                            {quote.expiresAt
                              ? `До ${formatDate(quote.expiresAt)}`
                              : "Без срока"}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {canAccept ? (
                          <Button
                            disabled={isAcceptingQuoteId === quote.id}
                            onClick={() => onAcceptQuote(quote.id)}
                            size="sm"
                            variant="outline"
                          >
                            {isAcceptingQuoteId === quote.id
                              ? "Принимаем..."
                              : "Принять"}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <FinancialCard
        activeCalculationId={activeCalculationId}
        calculation={calculation}
        calculationHistory={calculationHistory}
        disabledReason={calculationDisabledReason}
        isCreating={isCreatingCalculation}
        onCreate={onCreateCalculation}
      />
    </div>
  );
}
