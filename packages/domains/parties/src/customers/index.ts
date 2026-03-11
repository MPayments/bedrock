// Service
export { customersController } from "./controller";
export { customersModule } from "./module";
export { customersService } from "./service";
export type { CustomersService } from "./runtime";

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
