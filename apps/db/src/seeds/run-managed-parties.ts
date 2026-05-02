const { loadSeedDatabase } = await import("./runtime");
const { seedRequiredManagedParties } = await import("./managed-parties");

const db = await loadSeedDatabase();

await seedRequiredManagedParties(db);
process.exit(0);
