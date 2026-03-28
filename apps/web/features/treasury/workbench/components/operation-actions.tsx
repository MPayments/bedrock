"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "@bedrock/sdk-ui/components/button";
import { toast } from "@bedrock/sdk-ui/components/sonner";

import { apiClient } from "@/lib/api-client";
import { executeMutation } from "@/lib/resources/http";

import type {
  CounterpartyEndpointListItem,
  TreasuryAccountListItem,
  TreasuryEndpointListItem,
  TreasuryOperationTimeline,
} from "../lib/queries";
import { canRecordOperatorExecutionEvent } from "../lib/flows";
import { CreateExecutionInstructionDialog } from "./create-execution-instruction-dialog";
import { RecordExecutionEventDialog } from "./record-execution-event-dialog";

type InstructionOption = {
  id: string;
  label: string;
};

export function TreasuryOperationActions({
  accounts,
  assetLabels,
  counterpartyEndpoints,
  counterpartyLabels,
  instructions,
  operationTimeline,
  operationStatus,
  treasuryEndpoints,
}: {
  accounts: TreasuryAccountListItem[];
  assetLabels: Record<string, string>;
  counterpartyEndpoints: CounterpartyEndpointListItem[];
  counterpartyLabels: Record<string, string>;
  instructions: InstructionOption[];
  operationTimeline: TreasuryOperationTimeline;
  operationStatus: string;
  treasuryEndpoints: TreasuryEndpointListItem[];
}) {
  const router = useRouter();
  const operationId = operationTimeline.operation.id;
  const [pendingAction, setPendingAction] = React.useState<"approve" | "reserve" | null>(null);
  const recordableInstructionIds = React.useMemo(
    () =>
      new Set(
        operationTimeline.instructionItems
          .filter((instruction) =>
            canRecordOperatorExecutionEvent(instruction.instructionStatus),
          )
          .map((instruction) => instruction.id),
      ),
    [operationTimeline.instructionItems],
  );
  const recordableInstructions = React.useMemo(
    () =>
      instructions.filter((instruction) =>
        recordableInstructionIds.has(instruction.id),
      ),
    [instructions, recordableInstructionIds],
  );

  function submitAction(action: "approve" | "reserve") {
    setPendingAction(action);

    React.startTransition(async () => {
      const result = await executeMutation({
        request: () =>
          action === "approve"
            ? apiClient.v1.treasury.operations[":operationId"].approve.$post({
                param: { operationId },
              })
            : apiClient.v1.treasury.operations[":operationId"].reserve.$post({
                param: { operationId },
              }),
        fallbackMessage:
          action === "approve"
            ? "Не удалось одобрить операцию"
            : "Не удалось зарезервировать средства",
      });

      setPendingAction(null);

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(
        action === "approve"
          ? "Операция одобрена"
          : "Средства зарезервированы",
      );
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {operationStatus === "draft" ? (
        <Button
          onClick={() => submitAction("approve")}
          disabled={pendingAction !== null}
        >
          {pendingAction === "approve" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : null}
          Одобрить
        </Button>
      ) : null}
      {operationStatus === "approved" ? (
        <Button
          onClick={() => submitAction("reserve")}
          disabled={pendingAction !== null}
        >
          {pendingAction === "reserve" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : null}
          Зарезервировать
        </Button>
      ) : null}
      {operationStatus === "approved" || operationStatus === "reserved" ? (
        <CreateExecutionInstructionDialog
          accounts={accounts}
          assetLabels={assetLabels}
          counterpartyEndpoints={counterpartyEndpoints}
          counterpartyLabels={counterpartyLabels}
          operationTimeline={operationTimeline}
          treasuryEndpoints={treasuryEndpoints}
          triggerVariant="outline"
        >
          Создать инструкцию
        </CreateExecutionInstructionDialog>
      ) : null}
      {recordableInstructions.length > 0 ? (
        <RecordExecutionEventDialog
          instructions={recordableInstructions}
          triggerVariant="outline"
        >
          Зафиксировать событие
        </RecordExecutionEventDialog>
      ) : null}
    </div>
  );
}
