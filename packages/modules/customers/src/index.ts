// Contract (DTOs and validation)
export {
  CustomerSchema,
  type Customer,
  CreateCustomerInputSchema,
  type CreateCustomerInput,
  UpdateCustomerInputSchema,
  type UpdateCustomerInput,
  ListCustomersQuerySchema,
  type ListCustomersQuery,
  CustomerIdParamSchema,
} from "./contract.js";

// Service
export {
  createCustomersService,
  type CustomersService,
  type CustomersServiceDeps,
} from "./service.js";

// Repository (for wiring)
export { createCustomersRepo, type CustomersRepo } from "./repo.drizzle.js";
