import { hashPassword } from "better-auth/crypto";
import { loadSeedEnv } from "./load-env";

loadSeedEnv();

const { db } = await import("@bedrock/db/client");

const { seedUsers } = await import("./users");

await seedUsers(db, hashPassword);
process.exit(0);
