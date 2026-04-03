const { seedRequisiteProviders } = await import("./requisite-providers");
const { loadSeedDatabase } = await import("./runtime");

const db = await loadSeedDatabase();

await seedRequisiteProviders(db);
process.exit(0);
