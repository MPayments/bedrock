import { hashPassword } from "better-auth/crypto";

import type { Database } from "../client";
import { seedAccounting } from "./accounting";
import { seedAgreements } from "./agreements";
import { seedBicDirectory } from "./bic-directory";
import { seedCounterparties } from "./counterparties";
import { seedCurrencies } from "./currencies";
import { seedDealPayment } from "./deal-payment";
import { seedOrganizations } from "./organizations";
import { seedPaymentRoutes } from "./payment-routes";
import { seedRequisiteProviders } from "./requisite-providers";
import { seedRequisites } from "./requisites";
import { assertLocalSeedAllowed } from "./runtime";
import {
  seedBootstrapAdminFromEnv,
  seedUsers,
  type HashPasswordFn,
} from "./users";

type SeedEnv = Record<string, string | undefined>;
type SeedFn = (db: Database) => Promise<void>;
type SeedUsersFn = (
  db: Database,
  hashPassword: HashPasswordFn,
) => Promise<void>;
type SeedBootstrapAdminFn = (
  db: Database,
  hashPassword: HashPasswordFn,
  env?: SeedEnv,
) => Promise<void>;

export interface SeedOrchestratorDeps {
  hashPassword: HashPasswordFn;
  seedAccounting: SeedFn;
  seedAgreements: SeedFn;
  seedBicDirectory: SeedFn;
  seedBootstrapAdminFromEnv: SeedBootstrapAdminFn;
  seedCounterparties: SeedFn;
  seedCurrencies: SeedFn;
  seedDealPayment: SeedFn;
  seedOrganizations: SeedFn;
  seedPaymentRoutes: SeedFn;
  seedRequisiteProviders: SeedFn;
  seedRequisites: SeedFn;
  seedUsers: SeedUsersFn;
}

export interface SeedRunOptions {
  env?: SeedEnv;
}

function logStep(index: number, total: number, label: string) {
  console.log(`[seed] ${index}/${total} ${label}`);
}

export function createSeedOrchestrator(deps: SeedOrchestratorDeps) {
  async function seedRequired(
    db: Database,
    options: SeedRunOptions = {},
  ): Promise<void> {
    console.log("[seed:required] Starting required database seed...\n");

    logStep(1, 4, "Accounting reference data");
    await deps.seedAccounting(db);

    logStep(2, 4, "Currencies");
    await deps.seedCurrencies(db);

    logStep(3, 4, "CBR BIC directory");
    await deps.seedBicDirectory(db);

    logStep(4, 4, "Bootstrap admin from env");
    await deps.seedBootstrapAdminFromEnv(
      db,
      deps.hashPassword,
      options.env ?? process.env,
    );

    console.log("\n[seed:required] Done.");
  }

  async function seedLocal(
    db: Database,
    options: SeedRunOptions = {},
  ): Promise<void> {
    const env = options.env ?? process.env;
    assertLocalSeedAllowed(env);

    console.log("[seed:local] Starting local database seed...\n");

    logStep(1, 8, "Fixed local users");
    await deps.seedUsers(db, deps.hashPassword);

    logStep(2, 8, "Managed organizations");
    await deps.seedOrganizations(db);

    logStep(3, 8, "Customers and counterparties");
    await deps.seedCounterparties(db);

    logStep(4, 8, "Local requisite providers");
    await deps.seedRequisiteProviders(db);

    logStep(5, 8, "Requisites and organization ledger bindings");
    await deps.seedRequisites(db);

    logStep(6, 8, "Agreements");
    await deps.seedAgreements(db);

    logStep(7, 8, "Payment route templates");
    await deps.seedPaymentRoutes(db);

    logStep(8, 8, "Deal payment fixture");
    await deps.seedDealPayment(db);

    console.log("\n[seed:local] Done.");
  }

  async function seedAll(
    db: Database,
    options: SeedRunOptions = {},
  ): Promise<void> {
    assertLocalSeedAllowed(options.env ?? process.env);
    await seedRequired(db, options);
    await seedLocal(db, options);
  }

  return {
    seedAll,
    seedLocal,
    seedRequired,
  };
}

export function createDefaultSeedOrchestrator() {
  return createSeedOrchestrator({
    hashPassword,
    seedAccounting,
    seedAgreements,
    seedBicDirectory: async (db) => seedBicDirectory(db),
    seedBootstrapAdminFromEnv,
    seedCounterparties,
    seedCurrencies,
    seedDealPayment,
    seedOrganizations,
    seedPaymentRoutes,
    seedRequisiteProviders,
    seedRequisites,
    seedUsers,
  });
}
