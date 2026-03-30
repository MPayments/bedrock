// --- Activity Log ---
export {
  ACTIVITY_ACTION_VALUES,
  ACTIVITY_ENTITY_VALUES,
  ACTIVITY_SOURCE_VALUES,
  LogActivityInputSchema,
  type ActivityAction,
  type ActivityEntity,
  type ActivitySource,
  type LogActivityInput,
} from "./activity-log/application/contracts/commands";
export {
  ActivityLogEntrySchema,
  PaginatedActivityLogSchema,
  type ActivityLogEntry,
  type PaginatedActivityLog,
} from "./activity-log/application/contracts/dto";
export {
  ACTIVITY_LOG_LIST_CONTRACT,
  ListActivitiesQuerySchema,
  type ListActivitiesQuery,
} from "./activity-log/application/contracts/queries";

// --- Agents ---
export {
  AgentProfileSchema,
  PaginatedAgentsSchema,
  type AgentProfile,
  type PaginatedAgents,
} from "./agents/application/contracts/dto";
export {
  AGENTS_LIST_CONTRACT,
  ListAgentsQuerySchema,
  type ListAgentsQuery,
} from "./agents/application/contracts/queries";

// --- Sub-Agents ---
export {
  CreateSubAgentInputSchema,
  UpdateSubAgentInputSchema,
  type CreateSubAgentInput,
  type UpdateSubAgentInput,
} from "./agents/application/contracts/sub-agent-commands";
export {
  PaginatedSubAgentsSchema,
  SubAgentSchema,
  type PaginatedSubAgents,
  type SubAgent,
} from "./agents/application/contracts/sub-agent-dto";
export {
  ListSubAgentsQuerySchema,
  SUB_AGENTS_LIST_CONTRACT,
  type ListSubAgentsQuery,
} from "./agents/application/contracts/sub-agent-queries";

// --- Deals ---
export {
  SetAgentBonusInputSchema,
  type SetAgentBonusInput,
} from "./deals/application/contracts/commands";
export {
  AgentBonusSchema,
  DealSchema,
  PaginatedDealsSchema,
  type AgentBonus,
  type Deal,
  type PaginatedDeals,
} from "./deals/application/contracts/dto";
export {
  DEAL_STATUS_VALUES,
  type DealStatus,
} from "./deals/domain/deal-status";

// --- Clients ---
export {
  CreateClientInputSchema,
  UpdateClientInputSchema,
  type CreateClientInput,
  type UpdateClientInput,
} from "./clients/application/contracts/commands";
export {
  CompanyLookupResultSchema,
  type CompanyLookupResult,
} from "./clients/application/contracts/company-lookup-dto";
export {
  ClientSchema,
  PaginatedClientsSchema,
  type Client,
  type PaginatedClients,
} from "./clients/application/contracts/dto";
export {
  CLIENTS_LIST_CONTRACT,
  ListClientsQuerySchema,
  type ListClientsQuery,
} from "./clients/application/contracts/queries";

// --- Organizations ---
export {
  CreateOrganizationInputSchema,
  UpdateOrganizationInputSchema,
  type CreateOrganizationInput,
  type UpdateOrganizationInput,
} from "./organizations/application/contracts/commands";
export {
  OrganizationSchema,
  PaginatedOrganizationsSchema,
  type Organization,
  type PaginatedOrganizations,
} from "./organizations/application/contracts/dto";
export {
  ORGANIZATIONS_LIST_CONTRACT,
  ListOrganizationsQuerySchema,
  type ListOrganizationsQuery,
} from "./organizations/application/contracts/queries";

// --- TODOs ---
export {
  CreateTodoInputSchema,
  ToggleTodoInputSchema,
  UpdateTodoInputSchema,
  type CreateTodoInput,
  type ToggleTodoInput,
  type UpdateTodoInput,
} from "./todos/application/contracts/commands";
export {
  PaginatedTodosSchema,
  TodoSchema,
  type PaginatedTodos,
  type Todo,
} from "./todos/application/contracts/dto";
export {
  ListTodosQuerySchema,
  TODOS_LIST_CONTRACT,
  type ListTodosQuery,
} from "./todos/application/contracts/queries";
