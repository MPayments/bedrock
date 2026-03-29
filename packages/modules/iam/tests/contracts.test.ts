import { describe, expect, it } from "vitest";

import {
  BanUserInputSchema,
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
});
