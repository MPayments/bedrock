import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { createCustomerMembershipsService } from "../../src";
import {
  DrizzleCustomerMembershipReads,
  DrizzleCustomerMembershipsUnitOfWork,
} from "../../src/adapters/drizzle";
import { db, pool } from "./setup";
import { createPersistenceContext } from "@bedrock/platform/persistence";

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
