import type { ModuleRuntime } from "@bedrock/shared/core";

import { RecordTreasuryCashMovementCommand } from "./commands/record-cash-movement";
import { RecordTreasuryExecutionFeeCommand } from "./commands/record-execution-fee";
import { RecordTreasuryExecutionFillCommand } from "./commands/record-execution-fill";
import { CreateOrGetPlannedTreasuryOperationCommand } from "./commands/create-or-get-planned-operation";
import type {
  TreasuryCashMovementsRepository,
  TreasuryExecutionFeesRepository,
  TreasuryExecutionFillsRepository,
  TreasuryOperationsRepository,
} from "./ports/operations.repository";
import { GetTreasuryOperationByIdQuery } from "./queries/get-operation-by-id";
import { ListTreasuryCashMovementsQuery } from "./queries/list-cash-movements";
import { ListTreasuryExecutionFeesQuery } from "./queries/list-execution-fees";
import { ListTreasuryExecutionFillsQuery } from "./queries/list-execution-fills";
import { ListTreasuryOperationsQuery } from "./queries/list-operations";

export interface TreasuryOperationsServiceDeps {
  cashMovementsRepository: TreasuryCashMovementsRepository;
  executionFeesRepository: TreasuryExecutionFeesRepository;
  executionFillsRepository: TreasuryExecutionFillsRepository;
  operationsRepository: TreasuryOperationsRepository;
  runtime: ModuleRuntime;
}

export function createTreasuryOperationsService(
  deps: TreasuryOperationsServiceDeps,
) {
  const createOrGetPlannedOperation =
    new CreateOrGetPlannedTreasuryOperationCommand(deps.operationsRepository);
  const recordExecutionFill = new RecordTreasuryExecutionFillCommand(
    deps.executionFillsRepository,
    deps.operationsRepository,
    deps.runtime.generateUuid,
    deps.runtime.now,
  );
  const recordExecutionFee = new RecordTreasuryExecutionFeeCommand(
    deps.executionFeesRepository,
    deps.operationsRepository,
    deps.runtime.generateUuid,
    deps.runtime.now,
  );
  const recordCashMovement = new RecordTreasuryCashMovementCommand(
    deps.cashMovementsRepository,
    deps.operationsRepository,
    deps.runtime.generateUuid,
    deps.runtime.now,
  );
  const getOperationById = new GetTreasuryOperationByIdQuery(
    deps.operationsRepository,
  );
  const listOperations = new ListTreasuryOperationsQuery(
    deps.operationsRepository,
  );
  const listExecutionFills = new ListTreasuryExecutionFillsQuery(
    deps.executionFillsRepository,
  );
  const listExecutionFees = new ListTreasuryExecutionFeesQuery(
    deps.executionFeesRepository,
  );
  const listCashMovements = new ListTreasuryCashMovementsQuery(
    deps.cashMovementsRepository,
  );

  return {
    commands: {
      createOrGetPlanned:
        createOrGetPlannedOperation.execute.bind(createOrGetPlannedOperation),
      recordCashMovement:
        recordCashMovement.execute.bind(recordCashMovement),
      recordExecutionFee:
        recordExecutionFee.execute.bind(recordExecutionFee),
      recordExecutionFill:
        recordExecutionFill.execute.bind(recordExecutionFill),
    },
    queries: {
      listCashMovements:
        listCashMovements.execute.bind(listCashMovements),
      listExecutionFees:
        listExecutionFees.execute.bind(listExecutionFees),
      listExecutionFills:
        listExecutionFills.execute.bind(listExecutionFills),
      findById: getOperationById.execute.bind(getOperationById),
      list: listOperations.execute.bind(listOperations),
    },
  };
}

export type TreasuryOperationsService = ReturnType<
  typeof createTreasuryOperationsService
>;
