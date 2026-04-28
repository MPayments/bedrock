"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardList } from "lucide-react";

import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";
import { formatCompactId } from "@bedrock/shared/core/uuid";

import { EntityWorkspaceLayout } from "@/components/entities/workspace-layout";
import { QuoteExecutionCard } from "@/features/treasury/quote-executions/components/quote-execution-card";
import { StepCard } from "@/features/treasury/steps/components/step-card";

import type { TreasuryOrderDetails } from "../lib/queries";

import {
  TREASURY_ORDER_STATE_LABELS,
  TREASURY_ORDER_TYPE_LABELS,
} from "./order-columns";

type TreasuryOrderDetailsViewProps = {
  order: TreasuryOrderDetails;
};

export function TreasuryOrderDetailsView({
  order,
}: TreasuryOrderDetailsViewProps) {
  const router = useRouter();

  return (
    <EntityWorkspaceLayout
      icon={ClipboardList}
      title={`Ордер #${formatCompactId(order.id)}`}
      subtitle={`${TREASURY_ORDER_TYPE_LABELS[order.type]} · ${
        TREASURY_ORDER_STATE_LABELS[order.state]
      }`}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div className="space-y-4">
          {order.childOperations.length > 0 ? (
            order.childOperations.map((operation) =>
              operation.runtimeType === "quote_execution" ? (
                <QuoteExecutionCard
                  key={operation.id}
                  execution={operation}
                  title="Исполнение FX"
                  onChanged={() => router.refresh()}
                />
              ) : (
                <StepCard
                  key={operation.id}
                  step={operation}
                  title="Платёжный шаг"
                  uploadAssetPath={`/v1/treasury/steps/${operation.id}/attachments`}
                  onChanged={() => router.refresh()}
                />
              ),
            )
          ) : (
            <Card>
              <CardContent className="text-muted-foreground py-6 text-sm">
                Runtime-шаги ещё не созданы. Активируйте ордер или проверьте
                статус активации.
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Сводка</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <InfoLine label="Тип" value={TREASURY_ORDER_TYPE_LABELS[order.type]} />
              <InfoLine
                label="Статус"
                value={TREASURY_ORDER_STATE_LABELS[order.state]}
              />
              <InfoLine label="Шагов" value={String(order.steps.length)} />
              <InfoLine
                label="Описание"
                value={order.description ?? "Не указано"}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Инвентарь</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {order.inventoryPositions.length > 0 ? (
                order.inventoryPositions.map((position) => (
                  <Button
                    key={position.id}
                    variant="outline"
                    className="w-full justify-start"
                    nativeButton={false}
                    render={
                      <Link href={`/treasury/operations/inventory/${position.id}`} />
                    }
                  >
                    Позиция #{formatCompactId(position.id)}
                  </Button>
                ))
              ) : (
                <div className="text-muted-foreground">
                  Связанные inventory positions ещё не созданы.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </EntityWorkspaceLayout>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
