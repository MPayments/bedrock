import { hashPassword } from "better-auth/crypto";

const { loadSeedDatabase } = await import("./runtime");
const { seedUsers } = await import("./users");

const db = await loadSeedDatabase();

await seedUsers(db, hashPassword);
process.exit(0);
