import { hashPassword } from "better-auth/crypto";
import dotenv from "dotenv";

dotenv.config({ path: "./../../.env" });

const { db } = await import("../client");

const { seedUsers } = await import("./users");

await seedUsers(db, hashPassword);
process.exit(0);
