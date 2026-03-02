import dotenv from "dotenv";

dotenv.config({ path: "./../../.env" });

const { db } = await import("../client");
const { seedCounterparties } = await import("./counterparty-accounts");

await seedCounterparties(db);
process.exit(0);
