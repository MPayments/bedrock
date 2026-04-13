import { AlertCircle, ShieldCheck, WalletCards } from "lucide-react";

import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@bedrock/sdk-ui/components/card";

import {
  DEAL_OPERATIONAL_POSITION_STATE_COLORS,
  DEAL_OPERATIONAL_POSITION_STATE_LABELS,
} from "./constants";
import type { ApiDealOperationalState } from "./types";

type OperationalStateCardProps = {
  operationalState: ApiDealOperationalState;
};

const CRM_POSITION_LABELS: Partial<
  Record<ApiDealOperationalState["positions"][number]["kind"], string>
> = {
  customer_receivable: "Поступление от клиента",
  exporter_expected_receivable: "Ожидаемая экспортная выручка",
  in_transit: "Средства в транзите",
  provider_payable: "Выплата получателю",
};

const HIDDEN_POSITION_KINDS = new Set<
  ApiDealOperationalState["positions"][number]["kind"]
>([
  "intercompany_due_from",
  "intercompany_due_to",
  "suspense",
  "fee_revenue",
  "spread_revenue",
]);

function getCrmPositionLabel(
  kind: ApiDealOperationalState["positions"][number]["kind"],
) {
  return CRM_POSITION_LABELS[kind] ?? kind;
}

function formatPositionIssue(
  position: ApiDealOperationalState["positions"][number],
) {
  const label = getCrmPositionLabel(position.kind);

  return `Этап заблокирован: ${label.toLowerCase()}.`;
}

export function OperationalStateCard({
  operationalState,
}: OperationalStateCardProps) {
  const visiblePositions = operationalState.positions.filter(
    (position) =>
      !HIDDEN_POSITION_KINDS.has(position.kind) &&
      position.state !== "not_applicable",
  );
  const blockedPositions = visiblePositions.filter(
    (position) => position.state === "blocked",
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-muted-foreground" />
          Операционная готовность
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {blockedPositions.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              Что мешает продолжить
            </div>
            <div className="space-y-2">
              {blockedPositions.map((position) => (
                <div key={position.kind} className="rounded-lg border px-3 py-2 text-sm">
                  {formatPositionIssue(position)}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-lg bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            Критичных операционных блокеров сейчас нет.
          </div>
        )}

        {visiblePositions.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <WalletCards className="h-4 w-4" />
              Ключевые этапы движения средств
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {visiblePositions.map((position) => (
                <div key={position.kind} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium">
                      {getCrmPositionLabel(position.kind)}
                    </div>
                    <Badge className={DEAL_OPERATIONAL_POSITION_STATE_COLORS[position.state]}>
                      {DEAL_OPERATIONAL_POSITION_STATE_LABELS[position.state]}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
