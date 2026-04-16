const { seedBicDirectory } = await import("./bic-directory");
const { loadSeedDatabase } = await import("./runtime");

const db = await loadSeedDatabase();

await seedBicDirectory(db);
process.exit(0);
