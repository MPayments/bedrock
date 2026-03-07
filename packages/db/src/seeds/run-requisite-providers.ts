import dotenv from "dotenv";

dotenv.config({ path: "./../../.env" });

const { db } = await import("../client");
const { seedRequisiteProviders } = await import("./requisite-providers");

await seedRequisiteProviders(db);
process.exit(0);
