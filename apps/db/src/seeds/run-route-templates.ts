const { loadSeedDatabase } = await import("./runtime");
const { seedRouteTemplates } = await import("./route-templates");

const db = await loadSeedDatabase();

await seedRouteTemplates(db);
