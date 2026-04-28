const { loadSeedDatabase } = await import("./runtime");
const { createDefaultSeedOrchestrator } = await import("./orchestrator");

const db = await loadSeedDatabase();
const seeds = createDefaultSeedOrchestrator();

await seeds.seedRequired(db);
process.exit(0);
