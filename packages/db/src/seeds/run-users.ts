import dotenv from "dotenv";
import { hashPassword } from "better-auth/crypto";

dotenv.config({ path: "./../../.env" });

const { db } = await import("../client");

const { seedUsers } = await import("./users");

await seedUsers(db, hashPassword);
process.exit(0);
