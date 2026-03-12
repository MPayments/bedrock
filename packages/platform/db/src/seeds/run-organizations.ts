import dotenv from "dotenv";

dotenv.config({ path: "./../../.env" });

const { db } = await import("../client");
const { seedOrganizations } = await import("./organizations");

await seedOrganizations(db);
process.exit(0);
