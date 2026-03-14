import { loadSeedEnv } from "./load-env";

loadSeedEnv();

const { db } = await import("@bedrock/platform/postgres/client");
const { seedCounterparties } = await import("./counterparties");

await seedCounterparties(db);
process.exit(0);
