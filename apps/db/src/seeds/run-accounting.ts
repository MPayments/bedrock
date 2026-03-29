const { seedAccounting } = await import("./accounting");
const { loadSeedDatabase } = await import("./runtime");

const db = await loadSeedDatabase();

await seedAccounting(db);
process.exit(0);
