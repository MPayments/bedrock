import type { Logger } from "@repo/kernel";
import { AppError } from "@repo/kernel";
import type { LedgerService } from "@repo/ledger";
import type { CustomersRepo } from "./repo.drizzle.js";
import type { Customer, CreateCustomerInput, UpdateCustomerInput, ListCustomersQuery } from "./contract.js";

export interface CustomersServiceDeps {
  repo: CustomersRepo;
  ledger: LedgerService;
  logger: Logger;
}

export type CustomersService = ReturnType<typeof createCustomersService>;

/**
 * Creates the customers service.
 * Handles business logic for customer management, including ledger account creation.
 */
export function createCustomersService(deps: CustomersServiceDeps) {
  const log = deps.logger.child({ module: "customers" });

  const create = async (input: CreateCustomerInput): Promise<Customer> => {
    // Create customer in database (Postgres generates the ID)
    const customer = await deps.repo.insert({
      name: input.name,
      organizationId: input.organizationId,
    });

    // Ensure ledger account exists for this customer
    await deps.ledger.ensureAccount({
      kind: "customer",
      customerId: customer.id,
      currency: input.currency ?? "USD",
    });

    log.info("Created customer with ledger account", {
      id: customer.id,
      name: input.name,
      organizationId: input.organizationId,
      currency: input.currency ?? "USD",
    });

    return customer;
  };

  const getById = async (id: string): Promise<Customer> => {
    const customer = await deps.repo.getById(id);
    if (!customer) {
      throw new AppError("CUSTOMER_NOT_FOUND", `Customer ${id} not found`);
    }
    return customer;
  };

  const findById = async (id: string): Promise<Customer | null> => {
    return deps.repo.getById(id);
  };

  const list = async (query?: ListCustomersQuery): Promise<Customer[]> => {
    return deps.repo.list(query);
  };

  const update = async (id: string, input: UpdateCustomerInput): Promise<Customer> => {
    const customer = await deps.repo.update(id, input);
    if (!customer) {
      throw new AppError("CUSTOMER_NOT_FOUND", `Customer ${id} not found`);
    }
    log.info("Updated customer", { id, ...input });
    return customer;
  };

  const del = async (id: string): Promise<void> => {
    const deleted = await deps.repo.delete(id);
    if (!deleted) {
      throw new AppError("CUSTOMER_NOT_FOUND", `Customer ${id} not found`);
    }
    log.info("Deleted customer", { id });
  };

  return {
    create,
    getById,
    findById,
    list,
    update,
    delete: del,
  };
}
