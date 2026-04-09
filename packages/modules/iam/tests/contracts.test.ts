import { describe, expect, it } from "vitest";

import {
  BanUserInputSchema,
  CustomerPortalCustomerSummarySchema,
  UpdateProfileInputSchema,
  UpdateUserInputSchema,
} from "../src/contracts";

describe("user contracts", () => {
  it("rejects explicit undefined in update user input", () => {
    expect(UpdateUserInputSchema.safeParse({ name: undefined }).success).toBe(
      false,
    );
  });

  it("rejects explicit undefined in update profile input", () => {
    expect(
      UpdateProfileInputSchema.safeParse({ email: undefined }).success,
    ).toBe(false);
  });

  it("rejects explicit undefined in ban input", () => {
    expect(BanUserInputSchema.safeParse({ banReason: undefined }).success).toBe(
      false,
    );
  });

  it("uses name in customer portal customer summaries", () => {
    expect(
      CustomerPortalCustomerSummarySchema.safeParse({
        description: null,
        externalRef: null,
        id: "customer-1",
        name: "Acme Corp",
      }).success,
    ).toBe(true);
    expect(
      CustomerPortalCustomerSummarySchema.safeParse({
        description: null,
        displayName: "Acme Corp",
        externalRef: null,
        id: "customer-1",
      }).success,
    ).toBe(false);
  });
});
