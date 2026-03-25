import { randomUUID } from "node:crypto";

import {
  createOperationsModule,
  type OperationsModule,
  type OperationsModuleDeps,
} from "@bedrock/operations";
import {
  DrizzleActivityLogReads,
  DrizzleActivityLogStore,
  DrizzleAgentProfileReads,
  DrizzleApplicationReads,
  DrizzleBankDetailsReads,
  DrizzleCalculationReads,
  DrizzleClientReads,
  DrizzleContractReads,
  DrizzleDealReads,
  DrizzleOperationsUnitOfWork,
  DrizzleOrganizationReads,
  DrizzleOrganizationsUnitOfWork,
  DrizzleSubAgentReads,
  DrizzleSubAgentsUnitOfWork,
  DrizzleTodoReads,
  DrizzleTodosUnitOfWork,
} from "@bedrock/operations/adapters/drizzle";
import type { Logger } from "@bedrock/platform/observability/logger";
import {
  createPersistenceContext,
  type Database,
  type PersistenceContext,
} from "@bedrock/platform/persistence";

export function createApiOperationsModule(input: {
  db: Database;
  logger: Logger;
  now?: OperationsModuleDeps["now"];
  generateUuid?: OperationsModuleDeps["generateUuid"];
  persistence?: PersistenceContext;
}): OperationsModule {
  const persistence = input.persistence ?? createPersistenceContext(input.db);

  return createOperationsModule({
    logger: input.logger,
    now: input.now ?? (() => new Date()),
    generateUuid: input.generateUuid ?? randomUUID,

    // Reads
    activityLogReads: new DrizzleActivityLogReads(input.db),
    activityLogStore: new DrizzleActivityLogStore(input.db),
    agentProfileReads: new DrizzleAgentProfileReads(input.db),
    applicationReads: new DrizzleApplicationReads(input.db),
    calculationReads: new DrizzleCalculationReads(input.db),
    contractReads: new DrizzleContractReads(input.db),
    dealReads: new DrizzleDealReads(input.db),
    clientReads: new DrizzleClientReads(input.db),
    subAgentReads: new DrizzleSubAgentReads(input.db),
    organizationReads: new DrizzleOrganizationReads(input.db),
    bankDetailsReads: new DrizzleBankDetailsReads(input.db),
    todoReads: new DrizzleTodoReads(input.db),

    // UoW
    unitOfWork: new DrizzleOperationsUnitOfWork({ persistence }),
    subAgentUow: new DrizzleSubAgentsUnitOfWork({ persistence }),
    organizationsUow: new DrizzleOrganizationsUnitOfWork({ persistence }),
    todosUow: new DrizzleTodosUnitOfWork({ persistence }),
  });
}
