/**
 * Shared test fixtures and constants
 */

// Standard UUIDs for testing - use these consistently across all tests
export const TEST_UUIDS = {
  ORG_1: "550e8400-e29b-41d4-a716-446655440000",
  ORG_2: "550e8400-e29b-41d4-a716-446655440001",
  USER_1: "550e8400-e29b-41d4-a716-446655440002",
  USER_2: "550e8400-e29b-41d4-a716-446655440003",
  CUSTOMER_1: "550e8400-e29b-41d4-a716-446655440004",
  CUSTOMER_2: "550e8400-e29b-41d4-a716-446655440005",
  ORDER_1: "550e8400-e29b-41d4-a716-446655440006",
  ORDER_2: "550e8400-e29b-41d4-a716-446655440007",
  ENTRY_1: "550e8400-e29b-41d4-a716-446655440008",
  ENTRY_2: "550e8400-e29b-41d4-a716-446655440009",
} as const;

// Standard test dates
export const TEST_DATES = {
  NOW: new Date("2024-01-15T10:00:00Z"),
  YESTERDAY: new Date("2024-01-14T10:00:00Z"),
  TOMORROW: new Date("2024-01-16T10:00:00Z"),
} as const;

// Standard currencies for testing
export const TEST_CURRENCIES = {
  USD: "USD",
  EUR: "EUR",
  GBP: "GBP",
} as const;

/**
 * Generate a deterministic UUID based on a seed string
 * Useful for creating consistent test data
 */
export function testUuid(seed: string): string {
  // Simple hash-based UUID generation for tests
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, "0");
  return `${hex.slice(0, 8)}-${hex.slice(0, 4)}-4${hex.slice(1, 4)}-8${hex.slice(0, 3)}-${hex.padEnd(12, "0").slice(0, 12)}`;
}

/**
 * Create a unique test ID with optional prefix
 */
export function createTestId(prefix = "test"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
