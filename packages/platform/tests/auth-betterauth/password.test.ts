import { describe, expect, it } from "vitest";

import { createBetterAuthPasswordHasher } from "@bedrock/platform/auth-betterauth";

describe("createBetterAuthPasswordHasher", () => {
  it("hashes and verifies passwords through the Better Auth adapter", async () => {
    const hasher = createBetterAuthPasswordHasher();

    const hash = await hasher.hash("secret-123");

    expect(hash).toBeTypeOf("string");
    expect(hash).not.toBe("secret-123");
    await expect(
      hasher.verify({
        hash,
        password: "secret-123",
      }),
    ).resolves.toBe(true);
    await expect(
      hasher.verify({
        hash,
        password: "wrong-password",
      }),
    ).resolves.toBe(false);
  });
});
