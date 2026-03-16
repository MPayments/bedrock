import { loadSeedEnv } from "./load-env";

loadSeedEnv();

const { db } = await import("../client");
const { seedCounterparties } = await import("./counterparties");

await seedCounterparties(db);
process.exit(0);
