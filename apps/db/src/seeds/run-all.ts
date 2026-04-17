const { seedAccounting } = await import("./accounting");
const { seedBicDirectory } = await import("./bic-directory");
const { seedRequisites } = await import("./requisites");
const { loadSeedDatabase } = await import("./runtime");

const db = await loadSeedDatabase();

console.log("[seed] Starting managed database seed...\n");

console.log("[seed] 1/3 Accounting (CoA, policies, correspondence rules)");
await seedAccounting(db);

console.log(
  "[seed] 2/3 CBR BIC directory (Russian bank reference data)",
);
await seedBicDirectory(db);

console.log(
  "[seed] 3/3 Managed parties, organizations, banks, requisites, currencies",
);
await seedRequisites(db);

console.log("\n[seed] Done.");
process.exit(0);
