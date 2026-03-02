import { describe, expect, it } from "vitest";

import { ValidationError } from "../../src/counterparty-accounts/errors";
import {
  CreateProviderInputSchema,
  UpdateProviderInputSchema,
  CreateAccountInputSchema,
  UpdateAccountInputSchema,
  ListProvidersQuerySchema,
  ListAccountsQuerySchema,
} from "../../src/counterparty-accounts/validation";
import {
  validateMergedProviderState,
  validateAccountFieldsForProvider,
} from "../../src/counterparty-accounts/validation";

// ---------------------------------------------------------------------------
// CreateProviderInputSchema — BIC/SWIFT business rules
// ---------------------------------------------------------------------------

describe("CreateProviderInputSchema", () => {
  it("parses valid Russian bank with BIC", () => {
    const parsed = CreateProviderInputSchema.parse({
      type: "bank",
      name: "Sberbank",
      country: "ru",
      bic: "044525225",
    });

    expect(parsed.type).toBe("bank");
    expect(parsed.country).toBe("RU");
    expect(parsed.bic).toBe("044525225");
    expect(parsed.swift).toBeUndefined();
  });

  it("parses valid non-Russian bank with SWIFT", () => {
    const parsed = CreateProviderInputSchema.parse({
      type: "bank",
      name: "Deutsche Bank",
      country: "DE",
      swift: "DEUTDEFF",
    });

    expect(parsed.type).toBe("bank");
    expect(parsed.country).toBe("DE");
    expect(parsed.swift).toBe("DEUTDEFF");
  });

  it("parses valid blockchain provider without BIC/SWIFT", () => {
    const parsed = CreateProviderInputSchema.parse({
      type: "blockchain",
      name: "Ethereum Mainnet",
      country: "US",
    });

    expect(parsed.type).toBe("blockchain");
    expect(parsed.bic).toBeUndefined();
    expect(parsed.swift).toBeUndefined();
  });

  it("parses valid exchange provider", () => {
    const parsed = CreateProviderInputSchema.parse({
      type: "exchange",
      name: "Binance",
      country: "KY",
      description: "Main exchange account",
    });

    expect(parsed.type).toBe("exchange");
    expect(parsed.description).toBe("Main exchange account");
  });

  it("rejects Russian bank without BIC", () => {
    expect(() =>
      CreateProviderInputSchema.parse({
        type: "bank",
        name: "Sberbank",
        country: "RU",
      }),
    ).toThrow();
  });

  it("rejects non-Russian bank without SWIFT", () => {
    expect(() =>
      CreateProviderInputSchema.parse({
        type: "bank",
        name: "Deutsche Bank",
        country: "DE",
      }),
    ).toThrow();
  });

  it("rejects non-Russian bank with BIC", () => {
    expect(() =>
      CreateProviderInputSchema.parse({
        type: "bank",
        name: "Deutsche Bank",
        country: "DE",
        bic: "044525225",
        swift: "DEUTDEFF",
      }),
    ).toThrow();
  });

  it("rejects non-bank provider with BIC", () => {
    expect(() =>
      CreateProviderInputSchema.parse({
        type: "blockchain",
        name: "Tron",
        country: "US",
        bic: "044525225",
      }),
    ).toThrow();
  });

  it("rejects non-bank provider with SWIFT", () => {
    expect(() =>
      CreateProviderInputSchema.parse({
        type: "exchange",
        name: "Binance",
        country: "KY",
        swift: "DEUTDEFF",
      }),
    ).toThrow();
  });

  it("normalizes country to uppercase", () => {
    const parsed = CreateProviderInputSchema.parse({
      type: "blockchain",
      name: "Ethereum",
      country: "us",
    });

    expect(parsed.country).toBe("US");
  });

  it("rejects invalid country code", () => {
    expect(() =>
      CreateProviderInputSchema.parse({
        type: "bank",
        name: "Test",
        country: "ZZ",
        bic: "test",
      }),
    ).toThrow();
  });

  it("rejects empty name", () => {
    expect(() =>
      CreateProviderInputSchema.parse({
        type: "bank",
        name: "",
        country: "RU",
        bic: "044525225",
      }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// UpdateProviderInputSchema
// ---------------------------------------------------------------------------

describe("UpdateProviderInputSchema", () => {
  it("parses partial update with name only", () => {
    const parsed = UpdateProviderInputSchema.parse({ name: "New Name" });
    expect(parsed.name).toBe("New Name");
    expect(parsed.country).toBeUndefined();
  });

  it("parses empty object (no-op update)", () => {
    const parsed = UpdateProviderInputSchema.parse({});
    expect(parsed.name).toBeUndefined();
    expect(parsed.bic).toBeUndefined();
    expect(parsed.swift).toBeUndefined();
  });

  it("allows nullable BIC and SWIFT", () => {
    const parsed = UpdateProviderInputSchema.parse({
      description: null,
      bic: null,
      swift: null,
    });

    expect(parsed.description).toBeNull();
    expect(parsed.bic).toBeNull();
    expect(parsed.swift).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// validateMergedProviderState
// ---------------------------------------------------------------------------

describe("validateMergedProviderState", () => {
  it("passes for valid Russian bank with BIC", () => {
    expect(() =>
      validateMergedProviderState({
        type: "bank",
        country: "RU",
        bic: "044525225",
      }),
    ).not.toThrow();
  });

  it("passes for valid non-Russian bank with SWIFT", () => {
    expect(() =>
      validateMergedProviderState({
        type: "bank",
        country: "DE",
        swift: "DEUTDEFF",
      }),
    ).not.toThrow();
  });

  it("passes for non-bank without BIC/SWIFT", () => {
    expect(() =>
      validateMergedProviderState({ type: "blockchain", country: "US" }),
    ).not.toThrow();
  });

  it("throws for Russian bank without BIC", () => {
    expect(() =>
      validateMergedProviderState({ type: "bank", country: "RU" }),
    ).toThrow(ValidationError);
  });

  it("throws for non-Russian bank without SWIFT", () => {
    expect(() =>
      validateMergedProviderState({ type: "bank", country: "DE" }),
    ).toThrow(ValidationError);
  });

  it("throws for non-Russian bank with BIC", () => {
    expect(() =>
      validateMergedProviderState({
        type: "bank",
        country: "DE",
        bic: "044525225",
        swift: "DEUTDEFF",
      }),
    ).toThrow(ValidationError);
  });

  it("throws for non-bank with BIC", () => {
    expect(() =>
      validateMergedProviderState({
        type: "exchange",
        country: "US",
        bic: "044525225",
      }),
    ).toThrow(ValidationError);
  });

  it("throws for non-bank with SWIFT", () => {
    expect(() =>
      validateMergedProviderState({
        type: "custodian",
        country: "US",
        swift: "DEUTDEFF",
      }),
    ).toThrow(ValidationError);
  });
});

// ---------------------------------------------------------------------------
// validateAccountFieldsForProvider
// ---------------------------------------------------------------------------

describe("validateAccountFieldsForProvider", () => {
  it("passes for bank account with accountNo", () => {
    expect(() =>
      validateAccountFieldsForProvider(
        { accountNo: "40817810099910004312" },
        { type: "bank", country: "US" },
      ),
    ).not.toThrow();
  });

  it("passes for Russian bank account with accountNo and corrAccount", () => {
    expect(() =>
      validateAccountFieldsForProvider(
        { accountNo: "40817810099910004312", corrAccount: "30101810400000000225" },
        { type: "bank", country: "RU" },
      ),
    ).not.toThrow();
  });

  it("passes for blockchain account with address", () => {
    expect(() =>
      validateAccountFieldsForProvider(
        { address: "0xAbCdEf1234567890" },
        { type: "blockchain", country: "US" },
      ),
    ).not.toThrow();
  });

  it("passes for exchange account with all fields optional", () => {
    expect(() =>
      validateAccountFieldsForProvider(
        {},
        { type: "exchange", country: "KY" },
      ),
    ).not.toThrow();
  });

  it("throws for bank account without accountNo", () => {
    expect(() =>
      validateAccountFieldsForProvider(
        {},
        { type: "bank", country: "US" },
      ),
    ).toThrow(ValidationError);
  });

  it("throws for Russian bank account without corrAccount", () => {
    expect(() =>
      validateAccountFieldsForProvider(
        { accountNo: "40817810099910004312" },
        { type: "bank", country: "RU" },
      ),
    ).toThrow(ValidationError);
  });

  it("throws for blockchain account without address", () => {
    expect(() =>
      validateAccountFieldsForProvider(
        {},
        { type: "blockchain", country: "US" },
      ),
    ).toThrow(ValidationError);
  });

  it("includes both errors for Russian bank without accountNo and corrAccount", () => {
    expect(() =>
      validateAccountFieldsForProvider(
        {},
        { type: "bank", country: "RU" },
      ),
    ).toThrow(/accountNo.*corrAccount|corrAccount.*accountNo/);
  });
});

// ---------------------------------------------------------------------------
// CreateAccountInputSchema
// ---------------------------------------------------------------------------

describe("CreateAccountInputSchema", () => {
  it("parses valid account input", () => {
    const parsed = CreateAccountInputSchema.parse({
      counterpartyId: "550e8400-e29b-41d4-a716-446655440001",
      currencyId: "550e8400-e29b-41d4-a716-446655440002",
      accountProviderId: "550e8400-e29b-41d4-a716-446655440003",
      label: "Main Account",
      description: "Primary account",
      stableKey: "main-usd",
      accountNo: "40817810099910004312",
    });

    expect(parsed.label).toBe("Main Account");
    expect(parsed.description).toBe("Primary account");
    expect(parsed.stableKey).toBe("main-usd");
    expect(parsed.accountNo).toBe("40817810099910004312");
  });

  it("rejects missing label", () => {
    expect(() =>
      CreateAccountInputSchema.parse({
        counterpartyId: "550e8400-e29b-41d4-a716-446655440001",
        currencyId: "550e8400-e29b-41d4-a716-446655440002",
        accountProviderId: "550e8400-e29b-41d4-a716-446655440003",
        label: "",
        stableKey: "main-usd",
      }),
    ).toThrow();
  });

  it("rejects missing stableKey", () => {
    expect(() =>
      CreateAccountInputSchema.parse({
        counterpartyId: "550e8400-e29b-41d4-a716-446655440001",
        currencyId: "550e8400-e29b-41d4-a716-446655440002",
        accountProviderId: "550e8400-e29b-41d4-a716-446655440003",
        label: "Main Account",
        stableKey: "",
      }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// UpdateAccountInputSchema
// ---------------------------------------------------------------------------

describe("UpdateAccountInputSchema", () => {
  it("parses partial update with label", () => {
    const parsed = UpdateAccountInputSchema.parse({ label: "New Label" });
    expect(parsed.label).toBe("New Label");
  });

  it("parses empty object", () => {
    const parsed = UpdateAccountInputSchema.parse({});
    expect(parsed.label).toBeUndefined();
  });

  it("allows nullable optional fields", () => {
    const parsed = UpdateAccountInputSchema.parse({
      description: null,
      accountNo: null,
      corrAccount: null,
      address: null,
      iban: null,
    });

    expect(parsed.description).toBeNull();
    expect(parsed.accountNo).toBeNull();
    expect(parsed.corrAccount).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// ListProvidersQuerySchema
// ---------------------------------------------------------------------------

describe("ListProvidersQuerySchema", () => {
  it("applies defaults", () => {
    const parsed = ListProvidersQuerySchema.parse({});

    expect(parsed.limit).toBe(20);
    expect(parsed.offset).toBe(0);
    expect(parsed.sortBy).toBe("createdAt");
    expect(parsed.sortOrder).toBe("desc");
  });

  it("parses multi-value type filter", () => {
    const parsed = ListProvidersQuerySchema.parse({
      type: "bank, exchange",
    });

    expect(parsed.type).toEqual(["bank", "exchange"]);
  });

  it("parses multi-value country filter", () => {
    const parsed = ListProvidersQuerySchema.parse({
      country: "US, DE",
    });

    expect(parsed.country).toEqual(["US", "DE"]);
  });

  it("parses single name filter", () => {
    const parsed = ListProvidersQuerySchema.parse({
      name: "sber",
    });

    expect(parsed.name).toBe("sber");
  });
});

// ---------------------------------------------------------------------------
// ListAccountsQuerySchema
// ---------------------------------------------------------------------------

describe("ListAccountsQuerySchema", () => {
  it("applies defaults", () => {
    const parsed = ListAccountsQuerySchema.parse({});

    expect(parsed.limit).toBe(20);
    expect(parsed.offset).toBe(0);
    expect(parsed.sortBy).toBe("createdAt");
    expect(parsed.sortOrder).toBe("desc");
  });

  it("parses filter by counterpartyId", () => {
    const parsed = ListAccountsQuerySchema.parse({
      counterpartyId: "550e8400-e29b-41d4-a716-446655440001",
    });

    expect(parsed.counterpartyId).toBe("550e8400-e29b-41d4-a716-446655440001");
  });

  it("parses filter by label", () => {
    const parsed = ListAccountsQuerySchema.parse({
      label: "main account",
    });

    expect(parsed.label).toBe("main account");
  });

  it("parses multi-value currency filter", () => {
    const parsed = ListAccountsQuerySchema.parse({
      currencyId:
        "550e8400-e29b-41d4-a716-446655440001,550e8400-e29b-41d4-a716-446655440002",
    });

    expect(parsed.currencyId).toEqual([
      "550e8400-e29b-41d4-a716-446655440001",
      "550e8400-e29b-41d4-a716-446655440002",
    ]);
  });
});
