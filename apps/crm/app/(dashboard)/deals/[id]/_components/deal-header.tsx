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
import { getUuidPrefix } from "@bedrock/shared/core/uuid";

import { STATUS_COLORS, STATUS_LABELS } from "./constants";
import type { ApiDealTransitionReadiness, DealStatus } from "./types";

type DealHeaderProps = {
  dealId: string;
  isUpdatingStatus: boolean;
  onBack: () => void;
  onBlockedStatusClick: (status: DealStatus) => void;
  onStatusChange: (status: DealStatus) => void;
  status: DealStatus;
  transitionReadiness: ApiDealTransitionReadiness[];
};

export function DealHeader({
  dealId,
  isUpdatingStatus,
  onBack,
  onBlockedStatusClick,
  onStatusChange,
  status,
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
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="truncate text-2xl font-bold">
            Сделка #{getUuidPrefix(dealId)}
          </h1>
          <Badge className={STATUS_COLORS[status]}>
            {STATUS_LABELS[status]}
          </Badge>
        </div>
      </div>

      {hasTransitions && (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="default" size="sm" />}>
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
                      {item.blockers[0].message}
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
