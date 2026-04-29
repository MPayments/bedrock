import { AlertCircle, ShieldCheck } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";

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
  downstream_payable: "Выплата получателю",
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

  if (blockedPositions.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-muted-foreground" />
          Операционная готовность
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <AlertCircle className="h-4 w-4" />
          Что мешает продолжить
        </div>
        <div className="space-y-2">
          {blockedPositions.map((position) => (
            <div
              key={position.kind}
              className="rounded-lg border px-3 py-2 text-sm"
            >
              {formatPositionIssue(position)}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
