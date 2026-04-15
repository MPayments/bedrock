const { seedAccounting } = await import("./accounting");
const { seedRequisites } = await import("./requisites");
const { seedRouteTemplates } = await import("./route-templates");
const { loadSeedDatabase } = await import("./runtime");

const db = await loadSeedDatabase();

console.log("[seed] Starting managed database seed...\n");

console.log("[seed] 1/3 Accounting (CoA, policies, correspondence rules)");
await seedAccounting(db);

console.log(
  "[seed] 2/3 Managed parties, organizations, banks, requisites, currencies",
);
await seedRequisites(db);

console.log("[seed] 3/3 Managed route templates");
await seedRouteTemplates(db);

console.log("\n[seed] Done.");
process.exit(0);
