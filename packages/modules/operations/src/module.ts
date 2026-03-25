import type { Logger } from "@bedrock/platform/observability/logger";
import {
  createModuleRuntime,
  type Clock,
  type UuidGenerator,
} from "@bedrock/shared/core";

import { createActivityLogService } from "./activity-log/application";
import type { ActivityLogReads } from "./activity-log/application/ports/activity-log.reads";
import type { ActivityLogStore } from "./activity-log/application/ports/activity-log.store";
import { createAgentsService } from "./agents/application";
import type { AgentProfileReads } from "./agents/application/ports/agent-profile.reads";
import type { SubAgentReads } from "./agents/application/ports/sub-agent.reads";
import type { SubAgentsCommandUnitOfWork } from "./agents/application/ports/sub-agents.uow";
import { createApplicationsService } from "./applications/application";
import type { ApplicationReads } from "./applications/application/ports/application.reads";
import type { ApplicationsCommandUnitOfWork } from "./applications/application/ports/applications.uow";
import { createCalculationsService } from "./calculations/application";
import type { CalculationReads } from "./calculations/application/ports/calculation.reads";
import type { CalculationsCommandUnitOfWork } from "./calculations/application/ports/calculations.uow";
import { createClientsService } from "./clients/application";
import type { ClientReads } from "./clients/application/ports/client.reads";
import type { ClientsCommandUnitOfWork } from "./clients/application/ports/clients.uow";
import type { CompanyLookupPort } from "./clients/application/ports/company-lookup.port";
import type { CounterpartiesPort } from "./clients/application/ports/counterparties.port";
import { createContractsService } from "./contracts/application";
import type { ContractReads } from "./contracts/application/ports/contract.reads";
import type { ContractsCommandUnitOfWork } from "./contracts/application/ports/contracts.uow";
import { createDealsService } from "./deals/application";
import type { DealReads } from "./deals/application/ports/deal.reads";
import type { DealsCommandUnitOfWork } from "./deals/application/ports/deals.uow";
import { createOrganizationsService } from "./organizations/application";
import type { BankDetailsReads } from "./organizations/application/ports/bank-details.reads";
import type { OrganizationReads } from "./organizations/application/ports/organization.reads";
import type { OrganizationsCommandUnitOfWork } from "./organizations/application/ports/organizations.uow";
import { createTodosService } from "./todos/application";
import type { TodoReads } from "./todos/application/ports/todo.reads";
import type { TodosCommandUnitOfWork } from "./todos/application/ports/todos.uow";

export type OperationsModuleUnitOfWork = ContractsCommandUnitOfWork &
  ApplicationsCommandUnitOfWork &
  CalculationsCommandUnitOfWork &
  DealsCommandUnitOfWork &
  ClientsCommandUnitOfWork;

export interface OperationsModuleDeps {
  logger: Logger;
  now: Clock;
  generateUuid: UuidGenerator;

  // Reads
  activityLogReads: ActivityLogReads;
  activityLogStore: ActivityLogStore;
  agentProfileReads: AgentProfileReads;
  applicationReads: ApplicationReads;
  calculationReads: CalculationReads;
  contractReads: ContractReads;
  dealReads: DealReads;
  clientReads: ClientReads;
  subAgentReads: SubAgentReads;
  organizationReads: OrganizationReads;
  bankDetailsReads: BankDetailsReads;
  todoReads: TodoReads;

  // UoW
  unitOfWork: OperationsModuleUnitOfWork;
  subAgentUow: SubAgentsCommandUnitOfWork;
  organizationsUow: OrganizationsCommandUnitOfWork;
  todosUow: TodosCommandUnitOfWork;

  // Optional ports
  counterparties?: CounterpartiesPort;
  companyLookup?: CompanyLookupPort;
}

export type OperationsModule = ReturnType<typeof createOperationsModule>;

export function createOperationsModule(deps: OperationsModuleDeps) {
  const createRuntime = (service: string) =>
    createModuleRuntime({
      logger: deps.logger,
      now: deps.now,
      generateUuid: deps.generateUuid,
      service,
    });

  return {
    activityLog: createActivityLogService({
      runtime: createRuntime("operations.activity-log"),
      store: deps.activityLogStore,
      reads: deps.activityLogReads,
    }),
    agents: createAgentsService({
      reads: deps.agentProfileReads,
      subAgentReads: deps.subAgentReads,
      subAgentUow: deps.subAgentUow,
      runtime: createRuntime("operations.agents"),
    }),
    contracts: createContractsService({
      runtime: createRuntime("operations.contracts"),
      commandUow: deps.unitOfWork,
      reads: deps.contractReads,
    }),
    applications: createApplicationsService({
      runtime: createRuntime("operations.applications"),
      commandUow: deps.unitOfWork,
      reads: deps.applicationReads,
    }),
    calculations: createCalculationsService({
      runtime: createRuntime("operations.calculations"),
      commandUow: deps.unitOfWork,
      reads: deps.calculationReads,
    }),
    deals: createDealsService({
      runtime: createRuntime("operations.deals"),
      commandUow: deps.unitOfWork,
      reads: deps.dealReads,
    }),
    clients: createClientsService({
      runtime: createRuntime("operations.clients"),
      commandUow: deps.unitOfWork,
      reads: deps.clientReads,
      counterparties: deps.counterparties,
      companyLookup: deps.companyLookup,
    }),
    organizations: createOrganizationsService({
      runtime: createRuntime("operations.organizations"),
      commandUow: deps.organizationsUow,
      reads: deps.organizationReads,
      bankDetailsReads: deps.bankDetailsReads,
    }),
    todos: createTodosService({
      runtime: createRuntime("operations.todos"),
      commandUow: deps.todosUow,
      reads: deps.todoReads,
    }),
  };
}
