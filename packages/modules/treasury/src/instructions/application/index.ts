import type { ModuleRuntime } from "@bedrock/shared/core";

import { AttachTreasuryInstructionArtifactCommand } from "./commands/attach-artifact";
import { PrepareTreasuryInstructionCommand } from "./commands/prepare-instruction";
import { RecordTreasuryInstructionOutcomeCommand } from "./commands/record-outcome";
import { RequestTreasuryReturnCommand } from "./commands/request-return";
import { RetryTreasuryInstructionCommand } from "./commands/retry-instruction";
import { SubmitTreasuryInstructionCommand } from "./commands/submit-instruction";
import { VoidTreasuryInstructionCommand } from "./commands/void-instruction";
import type { TreasuryInstructionArtifactsRepository } from "./ports/artifacts.repository";
import type { TreasuryInstructionsRepository } from "./ports/instructions.repository";
import { GetTreasuryInstructionByIdQuery } from "./queries/get-instruction-by-id";
import { GetLatestTreasuryInstructionByOperationIdQuery } from "./queries/get-latest-instruction-by-operation-id";
import { ListTreasuryInstructionArtifactsQuery } from "./queries/list-artifacts";
import { ListLatestTreasuryInstructionsByOperationIdsQuery } from "./queries/list-latest-instructions-by-operation-ids";
import type { TreasuryOperationsRepository } from "../../operations/application/ports/operations.repository";

export interface TreasuryInstructionsServiceDeps {
  artifactsRepository: TreasuryInstructionArtifactsRepository;
  instructionsRepository: TreasuryInstructionsRepository;
  operationsRepository: TreasuryOperationsRepository;
  runtime: ModuleRuntime;
}

export function createTreasuryInstructionsService(
  deps: TreasuryInstructionsServiceDeps,
) {
  const prepareInstruction = new PrepareTreasuryInstructionCommand(
    deps.instructionsRepository,
    deps.operationsRepository,
  );
  const retryInstruction = new RetryTreasuryInstructionCommand(
    deps.instructionsRepository,
    deps.operationsRepository,
  );
  const submitInstruction = new SubmitTreasuryInstructionCommand(
    deps.instructionsRepository,
    deps.runtime,
  );
  const voidInstruction = new VoidTreasuryInstructionCommand(
    deps.instructionsRepository,
    deps.runtime,
  );
  const requestReturn = new RequestTreasuryReturnCommand(
    deps.instructionsRepository,
    deps.runtime,
  );
  const recordOutcome = new RecordTreasuryInstructionOutcomeCommand(
    deps.instructionsRepository,
    deps.runtime,
    deps.artifactsRepository,
  );
  const attachArtifact = new AttachTreasuryInstructionArtifactCommand(
    deps.instructionsRepository,
    deps.artifactsRepository,
    deps.runtime,
  );
  const getInstructionById = new GetTreasuryInstructionByIdQuery(
    deps.instructionsRepository,
  );
  const getLatestByOperationId = new GetLatestTreasuryInstructionByOperationIdQuery(
    deps.instructionsRepository,
  );
  const listLatestByOperationIds =
    new ListLatestTreasuryInstructionsByOperationIdsQuery(
      deps.instructionsRepository,
    );
  const listArtifacts = new ListTreasuryInstructionArtifactsQuery(
    deps.artifactsRepository,
  );

  return {
    commands: {
      attachArtifact: attachArtifact.execute.bind(attachArtifact),
      prepare: prepareInstruction.execute.bind(prepareInstruction),
      recordOutcome: recordOutcome.execute.bind(recordOutcome),
      requestReturn: requestReturn.execute.bind(requestReturn),
      retry: retryInstruction.execute.bind(retryInstruction),
      submit: submitInstruction.execute.bind(submitInstruction),
      void: voidInstruction.execute.bind(voidInstruction),
    },
    queries: {
      findById: getInstructionById.execute.bind(getInstructionById),
      findLatestByOperationId:
        getLatestByOperationId.execute.bind(getLatestByOperationId),
      listArtifacts: listArtifacts.execute.bind(listArtifacts),
      listLatestByOperationIds:
        listLatestByOperationIds.execute.bind(listLatestByOperationIds),
    },
  };
}

export type TreasuryInstructionsService = ReturnType<
  typeof createTreasuryInstructionsService
>;
