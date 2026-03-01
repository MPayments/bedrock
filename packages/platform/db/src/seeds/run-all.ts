import { hashPassword } from "better-auth/crypto";
import dotenv from "dotenv";

dotenv.config({ path: "./../../.env" });

const { db } = await import("../client");

const { seedCurrencies } = await import("./currencies");
const { seedAccounting } = await import("./accounting");
const { seedOrchestration } = await import("./orchestration");
const { seedUsers } = await import("./users");
const { seedOperational } = await import("./operational");

console.log("[seed] Starting full database seed...\n");

console.log("[seed] 1/4 Currencies");
await seedCurrencies(db);

console.log("[seed] 2/4 Users");
await seedUsers(db, hashPassword);

console.log("[seed] 3/4 Accounting (CoA, policies, correspondence rules)");
await seedAccounting(db);

console.log(
  "[seed] 4/5 Operational (customers, counterparties, providers, OAs)",
);
await seedOperational(db);

console.log("[seed] 5/5 Orchestration/connectors defaults");
await seedOrchestration(db);

console.log("\n[seed] Done.");
process.exit(0);
