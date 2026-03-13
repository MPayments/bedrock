import { loadSeedEnv } from "./load-env";

loadSeedEnv();

const { db } = await import("@bedrock/db/client");
const { seedAccounting } = await import("./accounting");

await seedAccounting(db);
process.exit(0);
