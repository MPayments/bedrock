"use client";

import { ArrowRight, Info, Mail, Plus, SquarePen } from "lucide-react";

import { Avatar, AvatarFallback } from "@bedrock/sdk-ui/components/avatar";
import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";

import { ACTIVITY_EVENT_LABELS } from "@/lib/timeline-labels";

import {
  formatCurrency,
  minorToDecimalString,
  rationalToDecimalString,
} from "./format";
import { IntakeEditorCard } from "./intake-editor-card";
import type { IntakeEditorCardProps } from "./intake-editor-card.types";
import type {
  ApiCurrencyOption,
  ApiDealAcceptedQuote,
  ApiDealPricingQuote,
  ApiDealTimelineEvent,
  ApiDealWorkflowProjection,
  CalculationView,
} from "./types";

type PricingPaneProps = {
  acceptedQuote: ApiDealAcceptedQuote;
  acceptingQuoteId: string | null;
  calculation: CalculationView | null;
  currencyOptions: ApiCurrencyOption[];
  intake: ApiDealWorkflowProjection["intake"];
  intakeProps: IntakeEditorCardProps | null;
  onAcceptQuote: (quoteId: string) => void;
  onOpenQuoteDialog: () => void;
  onSendToCustomer?: () => void;
  quotes: ApiDealPricingQuote[];
  readOnly?: boolean;
  timeline: ApiDealTimelineEvent[];
};

export function PricingPane({
  acceptingQuoteId,
  calculation,
  currencyOptions,
  intake,
  intakeProps,
  onAcceptQuote,
  onOpenQuoteDialog,
  onSendToCustomer,
  quotes,
  readOnly,
  timeline,
}: PricingPaneProps) {
  return (
    <div className="stage-pane">
      <BeneficiaryIntakeCard intakeProps={intakeProps} readOnly={readOnly} />
      <InitialOfferCard
        acceptingQuoteId={acceptingQuoteId}
        calculation={calculation}
        currencyOptions={currencyOptions}
        intake={intake}
        onAcceptQuote={onAcceptQuote}
        onOpenQuoteDialog={onOpenQuoteDialog}
        onSendToCustomer={onSendToCustomer}
        quotes={quotes}
        readOnly={readOnly}
      />
      <ActivityCard timeline={timeline} />
    </div>
  );
}

function BeneficiaryIntakeCard({
  intakeProps,
  readOnly,
}: {
  intakeProps: IntakeEditorCardProps | null;
  readOnly?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>1 · Beneficiary intake</CardTitle>
        <CardDescription>
          Captured on deal creation — complete missing fields before pricing
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {intakeProps ? (
          <IntakeEditorCard
            {...intakeProps}
            readOnly={readOnly ?? intakeProps.readOnly}
          />
        ) : (
          <div className="callout info">
            <Info className="callout-icon h-[14px] w-[14px]" />
            <span>Данные бенефициара ещё не подгружены.</span>
          </div>
        )}
        <div className="callout info">
          <Info className="callout-icon h-[14px] w-[14px]" />
          <span>
            Проверка SWIFT/BIC и санкционный скрининг подключатся в следующей
            итерации.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function InitialOfferCard({
  acceptingQuoteId,
  calculation,
  currencyOptions,
  intake,
  onAcceptQuote,
  onOpenQuoteDialog,
  onSendToCustomer,
  quotes,
  readOnly,
}: {
  acceptingQuoteId: string | null;
  calculation: CalculationView | null;
  currencyOptions: ApiCurrencyOption[];
  intake: ApiDealWorkflowProjection["intake"];
  onAcceptQuote: (quoteId: string) => void;
  onOpenQuoteDialog: () => void;
  onSendToCustomer?: () => void;
  quotes: ApiDealPricingQuote[];
  readOnly?: boolean;
}) {
  const activeQuote = quotes.find((q) => q.status === "active") ?? quotes[0];
  const sourceCurrency = currencyOptions.find(
    (option) => option.id === intake.moneyRequest.sourceCurrencyId,
  );
  const sourceAmountValue = intake.moneyRequest.sourceAmount;

  return (
    <Card>
      <CardHeader>
        <CardTitle>2 · Initial offer to customer</CardTitle>
        <CardDescription>
          Indicative rate and fee — customer must accept before we calculate
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {activeQuote ? (
          <div className="kv-grid cols-3">
            <div>
              <div className="kv-label">Gross in</div>
              <div className="kv-value">
                {formatCurrency(
                  sourceAmountValue ?? null,
                  sourceCurrency?.code ?? null,
                )}
              </div>
            </div>
            <div>
              <div className="kv-label">Proposed all-in rate</div>
              <div className="kv-value">
                {rationalToDecimalString(
                  activeQuote.rateNum,
                  activeQuote.rateDen,
                )}
              </div>
            </div>
            <div>
              <div className="kv-label">Beneficiary receives</div>
              <div className="kv-value">
                {activeQuote.toAmountMinor
                  ? formatCurrency(
                      minorToDecimalString(activeQuote.toAmountMinor, 2),
                      activeQuote.toCurrency,
                    )
                  : "—"}
              </div>
            </div>
            <div>
              <div className="kv-label">Proposed fee</div>
              <div className="kv-value">
                {activeQuote.commercialTerms?.fixedFeeAmountMinor
                  ? formatCurrency(
                      minorToDecimalString(
                        activeQuote.commercialTerms.fixedFeeAmountMinor,
                        2,
                      ),
                      activeQuote.commercialTerms.fixedFeeCurrency,
                    )
                  : "—"}
              </div>
            </div>
            <div>
              <div className="kv-label">Bedrock margin (est.)</div>
              <div className="kv-value pos">
                {calculation?.quoteMarkupAmount
                  ? `+${formatCurrency(calculation.quoteMarkupAmount, calculation.currencyCode)}`
                  : "—"}
              </div>
            </div>
            <div>
              <div className="kv-label">Rate valid until</div>
              <div className="kv-value">
                {formatExpiresAt(activeQuote.expiresAt)}
              </div>
            </div>
          </div>
        ) : (
          <div className="callout warn">
            <Info className="callout-icon h-[14px] w-[14px]" />
            <span>
              Первоначальное предложение не сформировано — создайте котировку,
              чтобы предложить курс клиенту.
            </span>
          </div>
        )}

        {!readOnly ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {activeQuote ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={onOpenQuoteDialog}
              >
                <SquarePen className="h-4 w-4" />
                Редактировать
              </Button>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={onOpenQuoteDialog}
              >
                <Plus className="h-4 w-4" />
                Создать котировку
              </Button>
            )}
            {activeQuote ? (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onSendToCustomer}
                  disabled={!onSendToCustomer}
                >
                  <Mail className="h-4 w-4" />
                  Отправить клиенту
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => onAcceptQuote(activeQuote.id)}
                  disabled={
                    acceptingQuoteId !== null ||
                    activeQuote.status !== "active"
                  }
                >
                  <ArrowRight className="h-4 w-4" />
                  Клиент принял — к расчёту
                </Button>
              </>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ActivityCard({ timeline }: { timeline: ApiDealTimelineEvent[] }) {
  const events = [...timeline].sort(
    (a, b) =>
      new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            События пока не зафиксированы.
          </div>
        ) : (
          <ol className="flex flex-col gap-3">
            {events.map((event) => (
              <li
                key={event.id}
                className="flex items-start gap-3 text-[12.5px]"
              >
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-[10px]">
                    {getInitials(event.actor?.label ?? "SYS")}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">
                    {event.actor?.label ?? "Система"}
                  </div>
                  <div className="text-muted-foreground">
                    {ACTIVITY_EVENT_LABELS[event.type] ?? event.type}
                  </div>
                </div>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {formatActivityDate(event.occurredAt)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function getInitials(source: string): string {
  const parts = source.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) {
    const first = parts[0] ?? "";
    return first.slice(0, 2).toUpperCase() || "??";
  }
  const first = parts[0]?.[0] ?? "";
  const last = parts[parts.length - 1]?.[0] ?? "";
  return `${first}${last}`.toUpperCase() || "??";
}

const activityDateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
});

function formatActivityDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (!Number.isFinite(d.getTime())) return "—";
  return activityDateFormatter.format(d);
}

function formatExpiresAt(value: string | Date | null): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (!Number.isFinite(d.getTime())) return "—";
  return activityDateFormatter.format(d);
}
