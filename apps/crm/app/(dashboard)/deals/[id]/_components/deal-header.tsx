import { Calculator, Check, ChevronDown, ChevronLeft, FileText } from "lucide-react";
import { Fragment } from "react";

import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Button } from "@bedrock/sdk-ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@bedrock/sdk-ui/components/dropdown-menu";

import {
  DEAL_TYPE_LABELS,
  formatDealWorkflowMessage,
  STATUS_LABELS,
} from "./constants";
import type { ApiDealTransitionReadiness, DealStatus, DealType } from "./types";

type DealHeaderProps = {
  applicantDisplayName: string | null;
  beneficiaryDisplayName?: string | null;
  corridorLabel?: string | null;
  currencyPairLabel?: string | null;
  dealCompactId: string;
  dueDateLabel?: string | null;
  isUpdatingStatus: boolean;
  onApproveFunding?: () => void;
  onBack: () => void;
  onBlockedStatusClick: (status: DealStatus) => void;
  onOpenCalculation?: () => void;
  onOpenContract?: () => void;
  onStatusChange: (status: DealStatus) => void;
  readOnly?: boolean;
  routeTemplateLabel?: string | null;
  status: DealStatus;
  type: DealType;
  transitionReadiness: ApiDealTransitionReadiness[];
};

const STATUS_BADGE_VARIANT: Record<
  DealStatus,
  "default" | "secondary" | "outline" | "success" | "warning" | "destructive"
> = {
  draft: "secondary",
  submitted: "outline",
  rejected: "destructive",
  preparing_documents: "secondary",
  awaiting_funds: "warning",
  awaiting_payment: "warning",
  closing_documents: "secondary",
  done: "success",
  cancelled: "destructive",
};

export function DealHeader({
  applicantDisplayName,
  beneficiaryDisplayName,
  corridorLabel,
  currencyPairLabel,
  dealCompactId,
  dueDateLabel,
  isUpdatingStatus,
  onApproveFunding,
  onBack,
  onBlockedStatusClick,
  onOpenCalculation,
  onOpenContract,
  onStatusChange,
  readOnly,
  routeTemplateLabel,
  status,
  type,
  transitionReadiness,
}: DealHeaderProps) {
  const hasTransitions = transitionReadiness.length > 0;
  const badgeVariant = STATUS_BADGE_VARIANT[status];

  const title = beneficiaryDisplayName
    ? `${applicantDisplayName ?? "Сделка"} → ${beneficiaryDisplayName}`
    : applicantDisplayName || "Сделка клиента";

  const metaParts: Array<{ key: string; label: string }> = [
    { key: "id", label: `#${dealCompactId}` },
    { key: "type", label: DEAL_TYPE_LABELS[type] },
  ];
  if (corridorLabel) metaParts.push({ key: "corridor", label: corridorLabel });
  if (currencyPairLabel)
    metaParts.push({ key: "ccy", label: currencyPairLabel });
  if (routeTemplateLabel)
    metaParts.push({ key: "route", label: routeTemplateLabel });
  if (dueDateLabel) metaParts.push({ key: "due", label: dueDateLabel });

  const showActions = !readOnly;
  const approveAllowed = transitionReadiness.some(
    (item) => item.targetStatus === "awaiting_funds" && item.allowed,
  );

  return (
    <div className="detail-header">
      <div className="flex min-w-0 items-start gap-3">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onBack}
          aria-label="Назад"
          className="mt-1"
        >
          <ChevronLeft />
        </Button>
        <div className="min-w-0">
          <h1 className="detail-title truncate">
            <span className="truncate">{title}</span>
            <Badge
              variant={badgeVariant}
              className="badge-dot"
              data-testid="deal-status-badge"
            >
              {STATUS_LABELS[status]}
            </Badge>
          </h1>
          <div className="detail-id">
            {metaParts.map((part, index) => (
              <Fragment key={part.key}>
                {index > 0 ? <span className="sep">·</span> : null}
                <span>{part.label}</span>
              </Fragment>
            ))}
          </div>
        </div>
      </div>

      {showActions ? (
        <div className="detail-header-actions">
          {onOpenContract ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenContract}
              data-testid="deal-action-contract"
            >
              <FileText className="h-4 w-4" />
              Договор
            </Button>
          ) : null}
          {onOpenCalculation ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenCalculation}
              data-testid="deal-action-open-calculation"
            >
              <Calculator className="h-4 w-4" />
              Открыть расчёт
            </Button>
          ) : null}
          {onApproveFunding ? (
            <Button
              variant="default"
              size="sm"
              onClick={onApproveFunding}
              disabled={!approveAllowed}
              data-testid="deal-action-approve-funding"
            >
              <Check className="h-4 w-4" />
              К фондированию
            </Button>
          ) : null}
          {hasTransitions ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    data-testid="deal-change-status-button"
                    variant="secondary"
                    size="sm"
                  />
                }
              >
                Изменить статус
                <ChevronDown className="ml-1 h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Доступные переходы</DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                {transitionReadiness.map((item) => (
                  <DropdownMenuItem
                    key={item.targetStatus}
                    data-testid={`deal-change-status-option-${item.targetStatus}`}
                    disabled={isUpdatingStatus}
                    onClick={() =>
                      item.allowed
                        ? onStatusChange(item.targetStatus)
                        : onBlockedStatusClick(item.targetStatus)
                    }
                  >
                    <div className="flex flex-col">
                      <span>{STATUS_LABELS[item.targetStatus]}</span>
                      {!item.allowed && item.blockers[0] ? (
                        <span className="text-xs text-muted-foreground">
                          {formatDealWorkflowMessage(item.blockers[0].message)}
                        </span>
                      ) : null}
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
