import { hashPassword } from "better-auth/crypto";

const { seedAgreements } = await import("./agreements");
const { seedAccounting } = await import("./accounting");
const { seedRequisites } = await import("./requisites");
const { seedRouteTemplates } = await import("./route-templates");
const { seedUsers } = await import("./users");
const { loadSeedDatabase } = await import("./runtime");

const db = await loadSeedDatabase();

console.log("[seed] Starting managed database seed...\n");

console.log("[seed] 1/5 Accounting (CoA, policies, correspondence rules)");
await seedAccounting(db);

console.log(
  "[seed] 2/5 Internal users and auth accounts",
);
await seedUsers(db, hashPassword);

console.log(
  "[seed] 3/5 Managed parties, organizations, banks, requisites, currencies",
);
await seedRequisites(db);

console.log("[seed] 4/5 Managed route templates");
await seedRouteTemplates(db);

console.log("[seed] 5/5 Agreements and versions");
await seedAgreements(db);

console.log("\n[seed] Done.");
process.exit(0);
