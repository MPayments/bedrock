import { seedPaymentRoutes } from "./payment-routes";
import { loadSeedDatabase } from "./runtime";

const db = await loadSeedDatabase();

await seedPaymentRoutes(db);
process.exit(0);
