const { seedRequisites } = await import("./requisites");
const { loadSeedDatabase } = await import("./runtime");

const db = await loadSeedDatabase();

await seedRequisites(db);
process.exit(0);
