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

// --- Contracts ---
export {
  CreateContractInputSchema,
  UpdateContractInputSchema,
  type CreateContractInput,
  type UpdateContractInput,
} from "./contracts/application/contracts/commands";
export {
  ContractSchema,
  type Contract,
} from "./contracts/application/contracts/dto";
export {
  CONTRACTS_LIST_CONTRACT,
  ListContractsQuerySchema,
  type ListContractsQuery,
} from "./contracts/application/contracts/queries";

// --- Applications ---
export {
  CreateApplicationInputSchema,
  TakeApplicationInputSchema,
  UpdateApplicationCommentInputSchema,
  UpdateApplicationStatusInputSchema,
  type CreateApplicationInput,
  type TakeApplicationInput,
  type UpdateApplicationCommentInput,
  type UpdateApplicationStatusInput,
} from "./applications/application/contracts/commands";
export {
  ApplicationSchema,
  PaginatedApplicationsSchema,
  type Application,
  type PaginatedApplications,
} from "./applications/application/contracts/dto";
export {
  APPLICATIONS_LIST_CONTRACT,
  ListApplicationsQuerySchema,
  type ListApplicationsQuery,
} from "./applications/application/contracts/queries";
export {
  APPLICATION_STATUS_VALUES,
  type ApplicationStatus,
} from "./applications/domain/application-status";

// --- Calculations ---
export {
  CreateCalculationInputSchema,
  type CreateCalculationInput,
} from "./calculations/application/contracts/commands";
export {
  CalculationSchema,
  PaginatedCalculationsSchema,
  type Calculation,
  type PaginatedCalculations,
} from "./calculations/application/contracts/dto";
export {
  CALCULATIONS_LIST_CONTRACT,
  ListCalculationsQuerySchema,
  type ListCalculationsQuery,
} from "./calculations/application/contracts/queries";

// --- Deals ---
export {
  CreateDealInputSchema,
  SetAgentBonusInputSchema,
  UpdateDealDetailsInputSchema,
  UpdateDealStatusInputSchema,
  type CreateDealInput,
  type SetAgentBonusInput,
  type UpdateDealDetailsInput,
  type UpdateDealStatusInput,
} from "./deals/application/contracts/commands";
export {
  AgentBonusSchema,
  DealDocumentSchema,
  DealSchema,
  PaginatedDealsSchema,
  type AgentBonus,
  type Deal,
  type DealDocument,
  type DealWithDetails,
  type PaginatedDeals,
} from "./deals/application/contracts/dto";
export {
  DEALS_LIST_CONTRACT,
  ListDealsQuerySchema,
  type ListDealsQuery,
} from "./deals/application/contracts/queries";
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
