import { loadSeedEnv } from "./load-env";

loadSeedEnv();

const { db } = await import("@bedrock/db/client");
const { seedRequisiteProviders } = await import("./requisite-providers");

await seedRequisiteProviders(db);
process.exit(0);
