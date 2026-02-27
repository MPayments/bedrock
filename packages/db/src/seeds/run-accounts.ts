import dotenv from "dotenv";

dotenv.config({ path: "./../../.env" });

const { db } = await import("../client");
const { seedAccounts } = await import("./operational");

await seedAccounts(db);
process.exit(0);
