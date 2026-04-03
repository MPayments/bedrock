const { seedOrganizations } = await import("./organizations");
const { loadSeedDatabase } = await import("./runtime");

const db = await loadSeedDatabase();

await seedOrganizations(db);
process.exit(0);
