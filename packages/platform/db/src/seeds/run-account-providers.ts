import dotenv from "dotenv";

dotenv.config({ path: "./../../.env" });

const { db } = await import("../client");
const { seedAccountProviders } = await import("./operational");

await seedAccountProviders(db);
process.exit(0);
