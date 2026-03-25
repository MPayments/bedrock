import type { ModuleRuntime } from "@bedrock/shared/core";

import { CreateContractCommand } from "./commands/create-contract";
import { RestoreContractCommand } from "./commands/restore-contract";
import { SoftDeleteContractCommand } from "./commands/soft-delete-contract";
import { UpdateContractCommand } from "./commands/update-contract";
import type { ContractReads } from "./ports/contract.reads";
import type { ContractsCommandUnitOfWork } from "./ports/contracts.uow";
import { FindContractByIdQuery } from "./queries/find-contract-by-id";
import { FindContractsByClientQuery } from "./queries/find-contracts-by-client";
import { ListContractsQuery } from "./queries/list-contracts";

export interface ContractsServiceDeps {
  runtime: ModuleRuntime;
  commandUow: ContractsCommandUnitOfWork;
  reads: ContractReads;
}

export function createContractsService(deps: ContractsServiceDeps) {
  const createContract = new CreateContractCommand(deps.runtime, deps.commandUow);
  const updateContract = new UpdateContractCommand(deps.runtime, deps.commandUow);
  const softDeleteContract = new SoftDeleteContractCommand(deps.runtime, deps.commandUow);
  const restoreContract = new RestoreContractCommand(deps.runtime, deps.commandUow);
  const findById = new FindContractByIdQuery(deps.reads);
  const findByClient = new FindContractsByClientQuery(deps.reads);
  const listContracts = new ListContractsQuery(deps.reads);

  return {
    commands: {
      create: createContract.execute.bind(createContract),
      update: updateContract.execute.bind(updateContract),
      softDelete: softDeleteContract.execute.bind(softDeleteContract),
      restore: restoreContract.execute.bind(restoreContract),
    },
    queries: {
      findById: findById.execute.bind(findById),
      findByClient: findByClient.execute.bind(findByClient),
      list: listContracts.execute.bind(listContracts),
    },
  };
}

export type ContractsService = ReturnType<typeof createContractsService>;
