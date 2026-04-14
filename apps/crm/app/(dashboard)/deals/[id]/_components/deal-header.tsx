import { ChevronDown, ChevronLeft } from "lucide-react";

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
  STATUS_COLORS,
  STATUS_LABELS,
} from "./constants";
import type { ApiDealTransitionReadiness, DealStatus, DealType } from "./types";

type DealHeaderProps = {
  applicantDisplayName: string | null;
  isUpdatingStatus: boolean;
  onBack: () => void;
  onBlockedStatusClick: (status: DealStatus) => void;
  onStatusChange: (status: DealStatus) => void;
  status: DealStatus;
  type: DealType;
  transitionReadiness: ApiDealTransitionReadiness[];
};

export function DealHeader({
  applicantDisplayName,
  isUpdatingStatus,
  onBack,
  onBlockedStatusClick,
  onStatusChange,
  status,
  type,
  transitionReadiness,
}: DealHeaderProps) {
  const hasTransitions = transitionReadiness.length > 0;

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Назад
        </Button>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-3">
            <h1 className="truncate text-2xl font-bold">
              {DEAL_TYPE_LABELS[type]}
            </h1>
            <Badge
              className={STATUS_COLORS[status]}
              data-testid="deal-status-badge"
            >
              {STATUS_LABELS[status]}
            </Badge>
          </div>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {applicantDisplayName || "Сделка клиента"}
          </p>
        </div>
      </div>

      {hasTransitions && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                data-testid="deal-change-status-button"
                variant="default"
                size="sm"
              />
            }
          >
            Изменить статус
            <ChevronDown className="ml-2 h-4 w-4" />
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
                  {!item.allowed && item.blockers[0] && (
                    <span className="text-xs text-muted-foreground">
                      {formatDealWorkflowMessage(item.blockers[0].message)}
                    </span>
                  )}
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
