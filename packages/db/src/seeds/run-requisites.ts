import dotenv from "dotenv";

dotenv.config({ path: "./../../.env" });

const { db } = await import("../client");
const { seedRequisites } = await import("./requisites");

await seedRequisites(db);
process.exit(0);
