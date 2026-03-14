import { hashPassword } from "better-auth/crypto";
import { loadSeedEnv } from "./load-env";

loadSeedEnv();

const { db } = await import("@bedrock/platform/postgres/client");

const { seedCurrencies } = await import("./currencies");
const { seedAccounting } = await import("./accounting");
const { seedCounterparties } = await import("./counterparties");
const { seedOrganizations } = await import("./organizations");
const { seedRequisiteProviders } = await import("./requisite-providers");
const { seedRequisites } = await import("./requisites");
const { seedUsers } = await import("./users");

console.log("[seed] Starting full database seed...\n");

console.log("[seed] 1/7 Currencies");
await seedCurrencies(db);

console.log("[seed] 2/7 Users");
await seedUsers(db, hashPassword);

console.log("[seed] 3/7 Accounting (CoA, policies, correspondence rules)");
await seedAccounting(db);

console.log("[seed] 4/7 Counterparties");
await seedCounterparties(db);

console.log("[seed] 5/7 Organizations");
await seedOrganizations(db);

console.log("[seed] 6/7 Requisite providers");
await seedRequisiteProviders(db);

console.log("[seed] 7/7 Requisites");
await seedRequisites(db);

console.log("\n[seed] Done.");
process.exit(0);
