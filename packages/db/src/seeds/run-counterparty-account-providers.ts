import dotenv from "dotenv";

dotenv.config({ path: "./../../.env" });

const { db } = await import("../client");
const { seedCounterpartyAccountProviders } = await import(
  "./counterparty-accounts"
);

await seedCounterpartyAccountProviders(db);
process.exit(0);
