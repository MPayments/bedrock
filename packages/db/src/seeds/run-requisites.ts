import dotenv from "dotenv";

dotenv.config({ path: "./../../.env" });

const { db } = await import("../client");
const { seedRequisitesFromLegacy } = await import("./requisites");

await seedRequisitesFromLegacy(db);
process.exit(0);
