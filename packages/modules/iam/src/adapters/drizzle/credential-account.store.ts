import { and, eq } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";

import { account } from "./schema/auth-schema";
import type { CredentialAccountStore } from "../../application/users/ports";

export class DrizzleCredentialAccountStore implements CredentialAccountStore {
  constructor(private readonly db: Queryable) {}

  async findByUserId(userId: string) {
    const [credential] = await this.db
      .select({
        id: account.id,
        userId: account.userId,
        providerId: account.providerId,
        password: account.password,
      })
      .from(account)
      .where(
        and(eq(account.userId, userId), eq(account.providerId, "credential")),
      )
      .limit(1);

    return credential ?? null;
  }

  async create(input: {
    id: string;
    userId: string;
    passwordHash: string;
    now: Date;
  }) {
    const [created] = await this.db
      .insert(account)
      .values({
        id: input.id,
        accountId: input.userId,
        providerId: "credential",
        userId: input.userId,
        password: input.passwordHash,
        createdAt: input.now,
        updatedAt: input.now,
      })
      .returning({
        id: account.id,
        userId: account.userId,
        providerId: account.providerId,
        password: account.password,
      });

    return created!;
  }

  async updatePassword(input: { userId: string; passwordHash: string }) {
    const [updated] = await this.db
      .update(account)
      .set({ password: input.passwordHash, updatedAt: new Date() })
      .where(
        and(
          eq(account.userId, input.userId),
          eq(account.providerId, "credential"),
        ),
      )
      .returning({
        id: account.id,
        userId: account.userId,
        providerId: account.providerId,
        password: account.password,
      });

    return updated ?? null;
  }
}
