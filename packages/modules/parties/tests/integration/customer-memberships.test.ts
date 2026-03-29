import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import { createIntegrationRuntime } from "./runtime";
import { pool } from "./setup";

function uniqueLabel(prefix: string) {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

describe("parties customer memberships integration", () => {
  it("upserts and lists memberships by user id", async () => {
    const { module } = createIntegrationRuntime();
    const customer = await module.customers.commands.create({
      displayName: uniqueLabel("Membership"),
      externalRef: uniqueLabel("crm"),
    });
    const userId = `user-${randomUUID()}`;

    await pool.query(
      `
        INSERT INTO "user" ("id", "name", "email")
        VALUES ($1, $2, $3)
      `,
      [userId, "Portal User", `${userId}@example.com`],
    );

    await module.customerMemberships.commands.upsert({
      customerId: customer.id,
      userId,
    });
    await module.customerMemberships.commands.upsert({
      customerId: customer.id,
      userId,
    });

    const memberships = await module.customerMemberships.queries.listByUserId({
      userId,
    });
    expect(memberships).toHaveLength(1);
    expect(memberships[0]).toEqual(
      expect.objectContaining({
        customerId: customer.id,
        userId,
      }),
    );

    await expect(
      module.customerMemberships.queries.hasMembership({
        customerId: customer.id,
        userId,
      }),
    ).resolves.toBe(true);
  });
});
