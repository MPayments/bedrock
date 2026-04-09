import { hashPassword } from "better-auth/crypto";

const { seedCurrencies } = await import("./currencies");
const { seedAccounting } = await import("./accounting");
const { seedAgreements } = await import("./agreements");
const { seedCounterparties } = await import("./counterparties");
const { seedOrganizations } = await import("./organizations");
const { seedRequisiteProviders } = await import("./requisite-providers");
const { seedRequisites } = await import("./requisites");
const { loadSeedDatabase } = await import("./runtime");
const { seedUsers } = await import("./users");

const db = await loadSeedDatabase();

console.log("[seed] Starting full database seed...\n");

console.log("[seed] 1/8 Currencies");
await seedCurrencies(db);

console.log("[seed] 2/8 Users");
await seedUsers(db, hashPassword);

console.log("[seed] 3/8 Accounting (CoA, policies, correspondence rules)");
await seedAccounting(db);

console.log("[seed] 4/8 Counterparties");
await seedCounterparties(db);

console.log("[seed] 5/8 Organizations");
await seedOrganizations(db);

console.log("[seed] 6/8 Requisite providers");
await seedRequisiteProviders(db);

console.log("[seed] 7/8 Requisites");
await seedRequisites(db);

console.log("[seed] 8/8 Agreements");
await seedAgreements(db);

console.log("\n[seed] Done.");
process.exit(0);
