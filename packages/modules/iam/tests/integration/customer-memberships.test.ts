import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import { createPersistenceContext } from "@bedrock/platform/persistence";

import { db, pool } from "./setup";
import { createCustomerMembershipsService } from "../../src";
import {
  DrizzleCustomerMembershipReads,
  DrizzleCustomerMembershipsUnitOfWork,
} from "../../src/adapters/drizzle";

describe("iam customer memberships integration", () => {
  it("upserts and lists memberships by user id", async () => {
    const customerId = crypto.randomUUID();
    const userId = `user-${randomUUID()}`;

    await pool.query(
      `
        INSERT INTO customers (id, display_name, external_ref)
        VALUES ($1, $2, $3)
      `,
      [customerId, "Membership Customer", `iam-test:${customerId}`],
    );
    await pool.query(
      `
        INSERT INTO "user" ("id", "name", "email")
        VALUES ($1, $2, $3)
      `,
      [userId, "Portal User", `${userId}@iam-test.example`],
    );

    const service = createCustomerMembershipsService({
      commandUow: new DrizzleCustomerMembershipsUnitOfWork({
        persistence: createPersistenceContext(db),
      }),
      reads: new DrizzleCustomerMembershipReads(db),
    });

    await service.commands.upsert({
      customerId,
      userId,
    });
    await service.commands.upsert({
      customerId,
      userId,
    });

    const memberships = await service.queries.listByUserId({
      userId,
    });
    expect(memberships).toHaveLength(1);
    expect(memberships[0]).toEqual(
      expect.objectContaining({
        customerId,
        id: expect.any(String),
        role: "owner",
        status: "active",
        userId,
      }),
    );

    await expect(
      service.queries.hasMembership({
        customerId,
        userId,
      }),
    ).resolves.toBe(true);
  });
});
