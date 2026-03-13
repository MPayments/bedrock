// Service
export { createCounterpartiesService } from "./service";
export type { CounterpartiesService } from "./service";
export { createCustomerLifecycleSyncPort } from "./customer-lifecycle-port";

export {
  assertBooksBelongToInternalLedgerCounterparties,
  assertInternalLedgerCounterparty,
  assertInternalLedgerInvariants,
  isInternalLedgerCounterparty,
  listInternalLedgerCounterparties,
} from "./internal-ledger";

// Validation
export {
  CounterpartyKindSchema,
  CounterpartyGroupRootCodeSchema,
  CountryCodeSchema,
  CounterpartySchema,
  COUNTERPARTIES_LIST_CONTRACT,
  ListCounterpartiesQuerySchema,
  CreateCounterpartyInputSchema,
  UpdateCounterpartyInputSchema,
  CounterpartyGroupSchema,
  ListCounterpartyGroupsQuerySchema,
  CreateCounterpartyGroupInputSchema,
  UpdateCounterpartyGroupInputSchema,
} from "./validation";
export type {
  CounterpartyKind,
  CounterpartyGroupRootCode,
  Counterparty,
  ListCounterpartiesQuery,
  CreateCounterpartyInput,
  UpdateCounterpartyInput,
  CounterpartyGroup,
  ListCounterpartyGroupsQuery,
  CreateCounterpartyGroupInput,
  UpdateCounterpartyGroupInput,
} from "./validation";

// Errors
export {
  CounterpartyError,
  CounterpartyNotFoundError,
  CounterpartyGroupNotFoundError,
  CounterpartyGroupRuleError,
  CounterpartyCustomerNotFoundError,
  CounterpartySystemGroupDeleteError,
  CounterpartyNotInternalLedgerEntityError,
  InternalLedgerInvariantViolationError,
} from "./errors";

export {
  CUSTOMERS_ROOT_GROUP_CODE,
  TREASURY_INTERNAL_LEDGER_GROUP_CODE,
  TREASURY_ROOT_GROUP_CODE,
} from "./internal/group-rules";
