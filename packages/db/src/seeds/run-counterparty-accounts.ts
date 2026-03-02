import dotenv from "dotenv";

dotenv.config({ path: "./../../.env" });

const { db } = await import("../client");
const { seedCounterpartyAccounts } = await import("./counterparty-accounts");

await seedCounterpartyAccounts(db);
process.exit(0);
