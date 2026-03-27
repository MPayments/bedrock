"use client";

import type {
  ExecutionInstructionListItem,
  TreasuryOperationListItem,
  UnmatchedExternalRecordListItem,
} from "../lib/queries";
import {
  buildInstructionSelectOption,
  buildMatchExternalRecordFacts,
} from "../lib/dialogs";
import { getTreasuryFlowDescriptor } from "../lib/flows";
import { RecordExecutionEventDialog } from "./record-execution-event-dialog";

export function MatchExternalRecordDialog({
  assetLabels,
  instructions,
  operations,
  record,
}: {
  assetLabels: Record<string, string>;
  instructions: ExecutionInstructionListItem[];
  operations: TreasuryOperationListItem[];
  record: UnmatchedExternalRecordListItem;
}) {
  const operationsById = new Map(
    operations.map((operation) => [operation.id, operation]),
  );

  return (
    <RecordExecutionEventDialog
      contextFacts={buildMatchExternalRecordFacts({
        externalRecordId: record.externalRecordId,
        reasonCode: record.reasonCode,
        recordKind: record.recordKind,
        source: record.source,
      })}
      contextHint={{
        title: "Что нужно сделать",
        description:
          "Найдите инструкцию, к которой реально относится внешняя запись, и сразу зафиксируйте итоговый факт исполнения. Не создавайте новую операцию поверх уже существующей.",
      }}
      defaultEventKind="settled"
      defaultExternalRecordId={record.externalRecordId}
      description="Сопоставьте внешнюю запись с уже существующей инструкцией и зафиксируйте итоговый факт исполнения."
      instructions={instructions.map((instruction) => {
        const operationKind = operationsById.get(instruction.operationId)?.operationKind;

        return {
          ...buildInstructionSelectOption({
            amountMinor: instruction.amountMinor,
            assetCode: assetLabels[instruction.assetId] ?? instruction.assetId,
            id: instruction.id,
            routeLabel: null,
            scenarioLabel: getTreasuryFlowDescriptor(
              operationKind === "fx_conversion"
                ? "fx_execute"
                : operationKind ?? "payout",
            ).title,
            status: instruction.instructionStatus,
          }),
          id: instruction.id,
        };
      })}
      submitLabel="Сопоставить"
      title="Сопоставить внешнюю запись"
      triggerSize="sm"
      triggerVariant="outline"
    >
      Сопоставить
    </RecordExecutionEventDialog>
  );
}
