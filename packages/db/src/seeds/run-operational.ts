import dotenv from "dotenv";

dotenv.config({ path: "./../../.env" });

const { db } = await import("../client");
const { seedOperational } = await import("./operational");

await seedOperational(db);
process.exit(0);
