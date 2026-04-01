import { ShieldCheck, WalletCards } from "lucide-react";

import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@bedrock/sdk-ui/components/card";

import {
  DEAL_CAPABILITY_LABELS,
  DEAL_CAPABILITY_STATUS_COLORS,
  DEAL_CAPABILITY_STATUS_LABELS,
  DEAL_OPERATIONAL_POSITION_LABELS,
  DEAL_OPERATIONAL_POSITION_STATE_COLORS,
  DEAL_OPERATIONAL_POSITION_STATE_LABELS,
} from "./constants";
import type { ApiDealOperationalState } from "./types";

type OperationalStateCardProps = {
  operationalState: ApiDealOperationalState;
};

export function OperationalStateCard({
  operationalState,
}: OperationalStateCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-muted-foreground" />
          Операционное состояние
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <div className="text-sm font-medium text-muted-foreground">
            Capability gate
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {operationalState.capabilities.map((capability) => (
              <div key={capability.kind} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium">
                    {DEAL_CAPABILITY_LABELS[capability.kind]}
                  </div>
                  <Badge className={DEAL_CAPABILITY_STATUS_COLORS[capability.status]}>
                    {DEAL_CAPABILITY_STATUS_LABELS[capability.status]}
                  </Badge>
                </div>
                {(capability.reasonCode || capability.note) && (
                  <div className="mt-2 text-sm text-muted-foreground">
                    {[capability.reasonCode, capability.note]
                      .filter(Boolean)
                      .join(" • ")}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <WalletCards className="h-4 w-4" />
            Позиции
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {operationalState.positions.map((position) => (
              <div key={position.kind} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium">
                    {DEAL_OPERATIONAL_POSITION_LABELS[position.kind]}
                  </div>
                  <Badge className={DEAL_OPERATIONAL_POSITION_STATE_COLORS[position.state]}>
                    {DEAL_OPERATIONAL_POSITION_STATE_LABELS[position.state]}
                  </Badge>
                </div>
                {(position.reasonCode || position.amountMinor) && (
                  <div className="mt-2 text-sm text-muted-foreground">
                    {[position.reasonCode, position.amountMinor]
                      .filter(Boolean)
                      .join(" • ")}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
