// Activity Log
export { DrizzleActivityLogReads } from "../activity-log/adapters/drizzle/activity-log.reads";
export { DrizzleActivityLogStore } from "../activity-log/adapters/drizzle/activity-log.store";

// Applications
export { DrizzleApplicationReads } from "../applications/adapters/drizzle/application.reads";
export { DrizzleApplicationStore } from "../applications/adapters/drizzle/application.store";

// Deals
export { DrizzleDealReads } from "../deals/adapters/drizzle/deal.reads";
export { DrizzleDealStore } from "../deals/adapters/drizzle/deal.store";
export { DrizzleDealDocumentStore } from "../deals/adapters/drizzle/deal-document.store";

// Clients
export { DrizzleCustomerBridge } from "../clients/adapters/drizzle/customer-bridge";
export { DrizzleClientReads } from "../clients/adapters/drizzle/client.reads";
export { DrizzleClientStore } from "../clients/adapters/drizzle/client.store";
export { DrizzleClientDocumentReads } from "../clients/adapters/drizzle/client-document.reads";
export { DrizzleClientDocumentStore } from "../clients/adapters/drizzle/client-document.store";
export { PartiesCounterpartiesAdapter } from "../clients/adapters/parties-counterparties.adapter";

// Organizations
export { DrizzleOrganizationReads } from "../organizations/adapters/drizzle/organization.reads";
export { DrizzleOrganizationStore } from "../organizations/adapters/drizzle/organization.store";
export { DrizzleHoldingOrganizationBridge } from "../organizations/adapters/drizzle/holding-organization-bridge";
export { DrizzleOrganizationsUnitOfWork } from "../organizations/adapters/drizzle/organizations.uow";

// TODOs
export { DrizzleTodoReads } from "../todos/adapters/drizzle/todo.reads";
export { DrizzleTodoStore } from "../todos/adapters/drizzle/todo.store";
export { DrizzleTodosUnitOfWork } from "../todos/adapters/drizzle/todos.uow";

// UoW
export { DrizzleOperationsUnitOfWork } from "../shared/adapters/drizzle/operations.uow";

// Notification
export { ConsoleNotificationAdapter } from "../shared/adapters/console-notification.adapter";
