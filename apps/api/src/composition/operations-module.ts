import { randomUUID } from "node:crypto";

import { DrizzleIamAgentProfileReads } from "@bedrock/iam/adapters/drizzle";
import {
  createOperationsModule,
  type OperationsModule,
  type OperationsModuleDeps,
} from "@bedrock/operations";
import {
  DrizzleActivityLogReads,
  DrizzleActivityLogStore,
  DrizzleApplicationReads,
  DrizzleClientDocumentReads,
  DrizzleClientDocumentStore,
  DrizzleClientReads,
  DrizzleDealDocumentStore,
  DrizzleDealReads,
  DrizzleOperationsUnitOfWork,
  DrizzleOrganizationReads,
  DrizzleOrganizationsUnitOfWork,
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
  objectStorage?: OperationsModuleDeps["objectStorage"];
  companyLookup?: OperationsModuleDeps["companyLookup"];
  counterparties?: OperationsModuleDeps["counterparties"];
  notification?: OperationsModuleDeps["notification"];
}): OperationsModule {
  const persistence = input.persistence ?? createPersistenceContext(input.db);

  return createOperationsModule({
    logger: input.logger,
    now: input.now ?? (() => new Date()),
    generateUuid: input.generateUuid ?? randomUUID,

    // Reads
    activityLogReads: new DrizzleActivityLogReads(input.db),
    activityLogStore: new DrizzleActivityLogStore(input.db),
    agentProfileReads: new DrizzleIamAgentProfileReads(input.db),
    applicationReads: new DrizzleApplicationReads(input.db),
    dealReads: new DrizzleDealReads(input.db),
    clientReads: new DrizzleClientReads(input.db),
    clientDocumentReads: new DrizzleClientDocumentReads(input.db),
    clientDocumentStore: new DrizzleClientDocumentStore(input.db),
    dealDocumentStore: new DrizzleDealDocumentStore(input.db),
    organizationReads: new DrizzleOrganizationReads(input.db),
    todoReads: new DrizzleTodoReads(input.db),

    // UoW
    unitOfWork: new DrizzleOperationsUnitOfWork({ persistence }),
    organizationsUow: new DrizzleOrganizationsUnitOfWork({ persistence }),
    todosUow: new DrizzleTodosUnitOfWork({ persistence }),

    // Optional ports
    objectStorage: input.objectStorage,
    companyLookup: input.companyLookup,
    counterparties: input.counterparties,
    notification: input.notification,
  });
}
