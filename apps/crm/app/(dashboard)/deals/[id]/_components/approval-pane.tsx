"use client";

import { ArrowRight, Bell, Info, Lock } from "lucide-react";

import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";

import { formatCurrency } from "./format";
import type {
  ApiCrmDealWorkbenchProjection,
  ApiDealTransitionReadiness,
  CalculationView,
  DealStatus,
} from "./types";

type ApprovalPaneProps = {
  approvals: ApiCrmDealWorkbenchProjection["approvals"];
  calculation: CalculationView | null;
  documentRequirements: ApiCrmDealWorkbenchProjection["documentRequirements"];
  isUpdatingStatus: boolean;
  netMarginInBase: number | null;
  onNudgeApprover?: () => void;
  onStatusChange: (status: DealStatus) => void;
  readOnly?: boolean;
  transitionReadiness: ApiDealTransitionReadiness[];
};

export function ApprovalPane({
  approvals,
  calculation,
  documentRequirements,
  isUpdatingStatus,
  netMarginInBase,
  onNudgeApprover,
  onStatusChange,
  readOnly,
  transitionReadiness,
}: ApprovalPaneProps) {
  return (
    <div className="stage-pane">
      <CalculationLockedCard
        calculation={calculation}
        netMarginInBase={netMarginInBase}
      />
      <ApproversCard
        approvals={approvals}
        isUpdatingStatus={isUpdatingStatus}
        onNudgeApprover={onNudgeApprover}
        onStatusChange={onStatusChange}
        readOnly={readOnly}
        transitionReadiness={transitionReadiness}
      />
      <DocumentRequirementsHintCard requirements={documentRequirements} />
    </div>
  );
}

function CalculationLockedCard({
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
            Calculation · locked
          </CardTitle>
          <CardDescription>
            Зафиксируйте калькуляцию перед согласованием.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="callout info">
            <Info className="callout-icon h-[14px] w-[14px]" />
            <span>Калькуляция ещё не зафиксирована.</span>
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
          Calculation · locked
        </CardTitle>
        <CardDescription>
          Commercial promise frozen — approvers must sign before funding
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="approval-summary">
          <div>
            <div className="kv-label">Customer pays</div>
            <div className="kv-value-lg">
              {formatCurrency(
                calculation.originalAmount,
                calculation.currencyCode,
              )}
            </div>
          </div>
          <div>
            <div className="kv-label">Beneficiary receives</div>
            <div className="kv-value-lg">
              {formatCurrency(
                calculation.totalAmount,
                calculation.baseCurrencyCode,
              )}
            </div>
          </div>
          <div>
            <div className="kv-label">Net margin</div>
            <div className={`kv-value-lg ${marginTone}`}>{marginText}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const APPROVAL_STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  approved: "default",
  pending: "secondary",
  rejected: "destructive",
  cancelled: "outline",
};

const APPROVAL_STATUS_LABEL: Record<string, string> = {
  approved: "Approved",
  pending: "Pending",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

function ApproversCard({
  approvals,
  isUpdatingStatus,
  onNudgeApprover,
  onStatusChange,
  readOnly,
  transitionReadiness,
}: {
  approvals: ApiCrmDealWorkbenchProjection["approvals"];
  isUpdatingStatus: boolean;
  onNudgeApprover?: () => void;
  onStatusChange: (status: DealStatus) => void;
  readOnly?: boolean;
  transitionReadiness: ApiDealTransitionReadiness[];
}) {
  const fundingReadiness = transitionReadiness.find(
    (r) => r.targetStatus === "awaiting_funds",
  );
  const canMoveToFunding = fundingReadiness?.allowed === true;
  const blockerMessage = fundingReadiness?.blockers[0]?.message ?? null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Approvers</CardTitle>
        <CardDescription>
          Gated by deal size and customer risk tier
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {approvals.length === 0 ? (
          <div className="callout info">
            <Info className="callout-icon h-[14px] w-[14px]" />
            <span>
              Для этого типа сделки не настроены апруверы — согласование
              пропускается.
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {approvals.map((approval) => {
              const label = approval.approvalRoleLabel;
              const variant =
                APPROVAL_STATUS_VARIANT[approval.status] ?? "outline";
              const statusLabel =
                APPROVAL_STATUS_LABEL[approval.status] ?? approval.status;
              const displayName =
                approval.decidedByDisplayName ??
                approval.requestedByDisplayName ??
                approval.decidedBy ??
                approval.requestedBy ??
                "—";
              return (
                <div key={approval.id} className="approval-row">
                  <div className="kv-label !m-0">{label}</div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium">
                      {displayName}
                    </div>
                    <div className="text-[12px] text-muted-foreground">
                      {approval.comment ??
                        (approval.status === "pending"
                          ? "Ожидает решения"
                          : "Без комментария")}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <Badge variant={variant} className="badge-dot">
                      {statusLabel}
                    </Badge>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {approval.decidedAt
                        ? formatDecisionDate(approval.decidedAt)
                        : "—"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!readOnly ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {onNudgeApprover ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={onNudgeApprover}
              >
                <Bell className="h-4 w-4" />
                Напомнить
              </Button>
            ) : null}
            <div className="flex flex-col items-end gap-1">
              <Button
                variant="default"
                size="sm"
                disabled={!canMoveToFunding || isUpdatingStatus}
                onClick={() => onStatusChange("awaiting_funds")}
              >
                <ArrowRight className="h-4 w-4" />
                К фондированию
              </Button>
              {!canMoveToFunding && blockerMessage ? (
                <span className="text-[11px] text-muted-foreground">
                  {blockerMessage}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

const DOC_STATE_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  ready: "default",
  in_progress: "secondary",
  missing: "destructive",
  not_required: "outline",
};

const DOC_STATE_LABEL: Record<string, string> = {
  ready: "готов",
  in_progress: "в работе",
  missing: "нужен",
  not_required: "не требуется",
};

function DocumentRequirementsHintCard({
  requirements,
}: {
  requirements: ApiCrmDealWorkbenchProjection["documentRequirements"];
}) {
  if (requirements.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Document requirements</CardTitle>
        <CardDescription>
          Документы, которые сопровождают эту сделку
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          {requirements.map((req) => {
            const variant = DOC_STATE_VARIANT[req.state] ?? "outline";
            const stateLabel = DOC_STATE_LABEL[req.state] ?? req.state;
            return (
              <Badge
                key={`${req.stage}-${req.docType}`}
                variant={variant}
                className="gap-1"
              >
                <span className="uppercase">{req.docType.replace(/_/g, " ")}</span>
                <span className="text-[10px] opacity-80">· {stateLabel}</span>
              </Badge>
            );
          })}
        </div>
        {requirements.some((req) => req.blockingReasons.length > 0) ? (
          <ul className="flex flex-col gap-1 pl-1 text-[12px] text-muted-foreground">
            {requirements
              .filter((req) => req.blockingReasons.length > 0)
              .flatMap((req) =>
                req.blockingReasons.map((reason, i) => (
                  <li key={`${req.docType}-${i}`}>
                    <span className="font-mono text-[10.5px] uppercase">
                      {req.docType}
                    </span>{" "}
                    — {reason}
                  </li>
                )),
              )}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
});

function formatDecisionDate(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  if (!Number.isFinite(d.getTime())) return "—";
  return dateFormatter.format(d);
}
