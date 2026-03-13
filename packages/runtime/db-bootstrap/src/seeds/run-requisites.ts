import { loadSeedEnv } from "./load-env";

loadSeedEnv();

const { db } = await import("@bedrock/db/client");
const { seedRequisites } = await import("./requisites");

await seedRequisites(db);
process.exit(0);
