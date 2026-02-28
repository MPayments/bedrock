import dotenv from "dotenv";

dotenv.config({ path: "./../../.env" });

const { db } = await import("../client");
const { seedAccounting } = await import("./accounting");

await seedAccounting(db);
process.exit(0);
