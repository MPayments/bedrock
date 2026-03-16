import { describe, expect, it } from "vitest";

import { toUser, toUserWithLastSession } from "../../src/application/mappers";

describe("user mappers", () => {
  it("maps raw identity-store rows to contract users", () => {
    const now = new Date("2026-03-01T00:00:00.000Z");

    expect(
      toUser({
        id: "user-1",
        name: "Alice",
        email: "alice@example.com",
        emailVerified: true,
        image: null,
        role: "unexpected-role",
        banned: null,
        banReason: null,
        banExpires: null,
        twoFactorEnabled: null,
        createdAt: now,
        updatedAt: now,
      }),
    ).toEqual({
      id: "user-1",
      name: "Alice",
      email: "alice@example.com",
      emailVerified: true,
      image: null,
      role: null,
      banned: false,
      banReason: null,
      banExpires: null,
      twoFactorEnabled: null,
      createdAt: now,
      updatedAt: now,
    });
  });

  it("maps last session metadata onto the user contract", () => {
    const now = new Date("2026-03-01T00:00:00.000Z");

    expect(
      toUserWithLastSession({
        user: {
          id: "user-1",
          name: "Alice",
          email: "alice@example.com",
          emailVerified: true,
          image: null,
          role: "admin",
          banned: false,
          banReason: null,
          banExpires: null,
          twoFactorEnabled: null,
          createdAt: now,
          updatedAt: now,
        },
        lastSessionAt: now,
        lastSessionIp: "127.0.0.1",
      }),
    ).toEqual({
      id: "user-1",
      name: "Alice",
      email: "alice@example.com",
      emailVerified: true,
      image: null,
      role: "admin",
      banned: false,
      banReason: null,
      banExpires: null,
      twoFactorEnabled: null,
      createdAt: now,
      updatedAt: now,
      lastSessionAt: now,
      lastSessionIp: "127.0.0.1",
    });
  });
});
