"use client";

import { ArrowRight, ExternalLink, Info, Lock } from "lucide-react";

import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";

import { formatCurrency, minorToDecimalString } from "./format";
import { OperationalStateCard } from "./operational-state-card";
import type {
  ApiDealOperationalState,
  ApiDealParticipantRole,
  ApiDealWorkflowLeg,
  CalculationView,
} from "./types";

type FundingPaneProps = {
  calculation: CalculationView | null;
  executionPlan: ApiDealWorkflowLeg[];
  netMarginInBase: number | null;
  onOpenTreasuryWorkbench?: () => void;
  operationalState: ApiDealOperationalState;
  readOnly?: boolean;
};

export function FundingPane({
  calculation,
  executionPlan,
  netMarginInBase,
  onOpenTreasuryWorkbench,
  operationalState,
}: FundingPaneProps) {
  return (
    <div className="stage-pane">
      <FinancialsCard
        calculation={calculation}
        netMarginInBase={netMarginInBase}
      />
      <PaymentLegsCard
        legs={executionPlan}
        onOpenTreasuryWorkbench={onOpenTreasuryWorkbench}
      />
      <OperationalStateCard operationalState={operationalState} />
    </div>
  );
}

function FinancialsCard({
  calculation,
  netMarginInBase,
}: {
  calculation: CalculationView | null;
  netMarginInBase: number | null;
}) {
  if (!calculation) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-muted-foreground" />
            Financials
          </CardTitle>
          <CardDescription>
            Final, committed — no further edits allowed
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="callout warn">
            <Info className="callout-icon h-[14px] w-[14px]" />
            <span>
              Нет зафиксированной калькуляции — параметры недоступны.
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const marginTone =
    netMarginInBase == null
      ? ""
      : netMarginInBase > 0
        ? "pos"
        : netMarginInBase < 0
          ? "neg"
          : "";
  const marginText =
    netMarginInBase == null
      ? "—"
      : `${netMarginInBase > 0 ? "+" : netMarginInBase < 0 ? "−" : ""}${formatCurrency(
          Math.abs(netMarginInBase),
          calculation.baseCurrencyCode,
        )}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-muted-foreground" />
          Financials
        </CardTitle>
        <CardDescription>
          Final, committed — no further edits allowed
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="kv-grid cols-auto">
          <div>
            <div className="kv-label">Gross amount</div>
            <div className="kv-value">
              {formatCurrency(
                calculation.originalAmount,
                calculation.currencyCode,
              )}
            </div>
          </div>
          <div>
            <div className="kv-label">Final rate</div>
            <div className="kv-value">{calculation.finalRate}</div>
          </div>
          <div>
            <div className="kv-label">Total fee</div>
            <div className="kv-value">
              {formatCurrency(
                calculation.totalFeeAmount,
                calculation.currencyCode,
              )}
            </div>
          </div>
          <div>
            <div className="kv-label">Total in base</div>
            <div className="kv-value">
              {formatCurrency(
                calculation.totalInBase,
                calculation.baseCurrencyCode,
              )}
            </div>
          </div>
          <div>
            <div className="kv-label">Expenses</div>
            <div className="kv-value">
              {formatCurrency(
                calculation.additionalExpensesInBase,
                calculation.baseCurrencyCode,
              )}
            </div>
          </div>
          <div>
            <div className="kv-label">Net margin</div>
            <div className={`kv-value ${marginTone}`}>{marginText}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const ROLE_LABELS: Partial<Record<ApiDealParticipantRole, string>> = {
  customer: "Customer",
  applicant: "Applicant",
  internal_entity: "Bedrock",
  external_payer: "Payer",
  external_beneficiary: "Beneficiary",
};

const LEG_STATE_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  done: "default",
  ready: "secondary",
  in_progress: "secondary",
  pending: "outline",
  blocked: "destructive",
  skipped: "outline",
};

const LEG_STATE_LABEL: Record<string, string> = {
  done: "Settled",
  ready: "Ready",
  in_progress: "In-flight",
  pending: "Queued",
  blocked: "Blocked",
  skipped: "Skipped",
};

function PaymentLegsCard({
  legs,
  onOpenTreasuryWorkbench,
}: {
  legs: ApiDealWorkflowLeg[];
  onOpenTreasuryWorkbench?: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment legs</CardTitle>
        <CardDescription>
          Плечи исполнения сделки — кто, кому и когда платит
        </CardDescription>
        {onOpenTreasuryWorkbench ? (
          <CardAction>
            <Button
              variant="secondary"
              size="sm"
              onClick={onOpenTreasuryWorkbench}
            >
              <ExternalLink className="h-4 w-4" />
              Treasury workbench
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>
        {legs.length === 0 ? (
          <div className="callout info">
            <Info className="callout-icon h-[14px] w-[14px]" />
            <span>План исполнения ещё не построен.</span>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {legs.map((leg) => (
              <PaymentLegRow
                key={`${leg.idx}:${leg.kind}:${leg.id ?? "draft"}`}
                leg={leg}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PaymentLegRow({ leg }: { leg: ApiDealWorkflowLeg }) {
  const variant = LEG_STATE_VARIANT[leg.state] ?? "outline";
  const stateLabel = LEG_STATE_LABEL[leg.state] ?? leg.state;
  const fromLabel = leg.fromRole
    ? (ROLE_LABELS[leg.fromRole] ?? leg.fromRole)
    : null;
  const toLabel = leg.toRole
    ? (ROLE_LABELS[leg.toRole] ?? leg.toRole)
    : null;
  const amountDisplay = leg.amountMinor
    ? formatCurrency(
        minorToDecimalString(leg.amountMinor, 2),
        leg.currencyCode,
      )
    : leg.kind.replace(/_/g, " ");

  return (
    <div className="leg-row">
      <span className="leg-row-num">LEG {String(leg.idx).padStart(2, "0")}</span>
      <div className="min-w-0 flex-1">
        <div className="leg-row-party truncate">
          {leg.fromPartyName ?? fromLabel ?? "—"}
        </div>
        <div className="leg-row-party-role">
          {fromLabel ? `${fromLabel} · sender` : "sender"}
        </div>
      </div>
      <ArrowRight className="leg-row-arrow h-3.5 w-3.5" />
      <div className="min-w-0 flex-1">
        <div className="leg-row-party truncate">
          {leg.toPartyName ?? toLabel ?? "—"}
        </div>
        <div className="leg-row-party-role">
          {toLabel ? `${toLabel} · receiver` : "receiver"}
        </div>
      </div>
      <span className="leg-row-amount font-mono">{amountDisplay}</span>
      <Badge variant={variant} className="badge-dot">
        {stateLabel}
      </Badge>
    </div>
  );
}
