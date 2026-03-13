// Service
export { createCustomersService } from "./service";
export type { CustomersService } from "./service";
export type { CustomerLifecycleSyncPort } from "./customer-lifecycle-port";

// Validation
export {
  CustomerSchema,
  CUSTOMERS_LIST_CONTRACT,
  ListCustomersQuerySchema,
  CreateCustomerInputSchema,
  UpdateCustomerInputSchema,
} from "./validation";
export type {
  Customer,
  ListCustomersQuery,
  CreateCustomerInput,
  UpdateCustomerInput,
} from "./validation";

// Errors
export {
  CustomerError,
  CustomerNotFoundError,
  CustomerDeleteConflictError,
  CustomerInvariantError,
} from "./errors";
