import { loadSeedEnv } from "./load-env";

loadSeedEnv();

const { db } = await import("@bedrock/adapter-db-drizzle/client");
const { seedOrganizations } = await import("./organizations");

await seedOrganizations(db);
process.exit(0);
