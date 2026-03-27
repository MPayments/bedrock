import type { TreasuryCoreServiceDeps } from "../../shared/application/core-context";
import { createTreasuryCoreServiceContext } from "../../shared/application/core-context";
import { CreateExecutionInstructionCommand } from "./commands/create-execution-instruction";
import { RecordExecutionEventCommand } from "./commands/record-execution-event";
import { ListExecutionInstructionsQuery } from "./queries/list-execution-instructions";
import { ListUnmatchedExternalRecordsQuery } from "./queries/list-unmatched-external-records";

export function createTreasuryExecutionsService(
  deps: TreasuryCoreServiceDeps,
) {
  const context = createTreasuryCoreServiceContext(deps);
  const createExecutionInstruction = new CreateExecutionInstructionCommand(
    context,
  );
  const recordExecutionEvent = new RecordExecutionEventCommand(context);
  const listExecutionInstructions = new ListExecutionInstructionsQuery(context);
  const listUnmatchedExternalRecords = new ListUnmatchedExternalRecordsQuery(
    context,
  );

  return {
    commands: {
      createExecutionInstruction:
        createExecutionInstruction.execute.bind(createExecutionInstruction),
      recordExecutionEvent:
        recordExecutionEvent.execute.bind(recordExecutionEvent),
    },
    queries: {
      listExecutionInstructions:
        listExecutionInstructions.execute.bind(listExecutionInstructions),
      listUnmatchedExternalRecords:
        listUnmatchedExternalRecords.execute.bind(
          listUnmatchedExternalRecords,
        ),
    },
  };
}

export type TreasuryExecutionsService = ReturnType<
  typeof createTreasuryExecutionsService
>;
