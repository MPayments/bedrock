const { loadSeedDatabase } = await import("./runtime");
const { seedDealPayment } = await import("./deal-payment");

const db = await loadSeedDatabase();

await seedDealPayment(db);
process.exit(0);
