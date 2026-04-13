const { loadSeedDatabase } = await import("./runtime");
const { seedAgreements } = await import("./agreements");

const db = await loadSeedDatabase();

await seedAgreements(db);
process.exit(0);
