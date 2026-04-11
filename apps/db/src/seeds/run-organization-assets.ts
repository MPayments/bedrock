const { seedOrganizationAssets } = await import("./organization-assets");
const { loadSeedDatabase } = await import("./runtime");

const db = await loadSeedDatabase();

await seedOrganizationAssets(db);
