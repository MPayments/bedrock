import { createConsoleLogger } from "@repo/kernel";
import { db } from "@repo/db";
import {
  createLedgerService,
  createTbAdapter,
  createPgAccountStore,
} from "@repo/ledger";
import {
  createOrganizationsService,
  createOrganizationsRepo,
} from "@repo/organizations";
import {
  createCustomersService,
  createCustomersRepo,
} from "@repo/customers";

/**
 * Environment configuration for the API.
 */
export interface Env {
  DATABASE_URL: string;
  TB_ADDRESS: string;
  TB_CLUSTER_ID?: string;
}

/**
 * Application context - contains all wired services.
 * This is the single place where all dependencies are assembled.
 */
export type AppContext = ReturnType<typeof createAppContext>;

/**
 * Creates the application context with all services wired together.
 * This is the composition root - the only place that knows about all dependencies.
 */
export function createAppContext(env: Env) {
  const logger = createConsoleLogger({ app: "api" });

  // Ledger (TigerBeetle)
  const tb = createTbAdapter(
    {
      address: env.TB_ADDRESS,
      clusterId: BigInt(env.TB_CLUSTER_ID ?? "0"),
    },
    logger
  );
  const accountStore = createPgAccountStore(db);
  const ledger = createLedgerService({
    tb,
    accountStore,
    logger,
    defaultLedger: 1,
    defaultAccountCode: 1,
  });

  // Organizations module
  const organizationsRepo = createOrganizationsRepo(db);
  const organizations = createOrganizationsService({
    repo: organizationsRepo,
    logger,
  });

  // Customers module
  const customersRepo = createCustomersRepo(db);
  const customers = createCustomersService({
    repo: customersRepo,
    ledger,
    logger,
  });

  logger.info("Application context created", {
    tbAddress: env.TB_ADDRESS,
  });

  return {
    logger,
    ledger,
    organizations,
    customers,
  };
}
