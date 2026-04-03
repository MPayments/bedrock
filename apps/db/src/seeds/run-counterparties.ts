const { seedCounterparties } = await import("./counterparties");
const { loadSeedDatabase } = await import("./runtime");

const db = await loadSeedDatabase();

await seedCounterparties(db);
process.exit(0);
