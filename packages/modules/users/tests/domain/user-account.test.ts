import { describe, expect, it } from "vitest";

import type { DomainError } from "@bedrock/shared/core/domain";

import { UserAccount } from "../../src/domain/user-account";

describe("UserAccount", () => {
  it("rejects invalid required fields during reconstitution", () => {
    expect(() =>
      UserAccount.reconstitute({
        id: "user-1",
        name: "Alice",
        email: undefined as any,
        emailVerified: true,
        image: null,
        role: "admin",
        banned: false,
        banReason: null,
        banExpires: null,
        twoFactorEnabled: false,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
    ).toThrowError(
      expect.objectContaining<Partial<DomainError>>({
        code: "user.email.invalid",
      }),
    );
  });
});
