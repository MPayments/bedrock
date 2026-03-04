import { hashPassword } from "better-auth/crypto";
import dotenv from "dotenv";

dotenv.config({ path: "./../../.env" });

const { db } = await import("../client");

const { seedCurrencies } = await import("./currencies");
const { seedAccounting } = await import("./accounting");
const { seedUsers } = await import("./users");
const { seedCounterpartyDomain } = await import("./counterparty-accounts");

console.log("[seed] Starting full database seed...\n");

console.log("[seed] 1/4 Currencies");
await seedCurrencies(db);

console.log("[seed] 2/4 Users");
await seedUsers(db, hashPassword);

console.log("[seed] 3/4 Accounting (CoA, policies, correspondence rules)");
await seedAccounting(db);

console.log(
  "[seed] 4/4 Counterparty domain (customers, counterparties, providers, counterparty accounts)",
);
await seedCounterpartyDomain(db);

console.log("\n[seed] Done.");
process.exit(0);
