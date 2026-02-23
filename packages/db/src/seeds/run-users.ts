import dotenv from "dotenv";

dotenv.config({ path: "./../../.env" });

const { db } = await import("../client");
const { hashPassword } = await import("@bedrock/auth/crypto");
const { seedUsers } = await import("./users");

await seedUsers(db, hashPassword);
process.exit(0);
