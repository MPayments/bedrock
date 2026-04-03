import { eq, sql, type SQL } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";

import { twoFactor, user } from "./schema/auth-schema";
import { userAccessStates } from "./schema/business-schema";
import type { UserAccountRepository } from "../../application/users/ports";
import { UserAccount, type UserAccountSnapshot } from "../../domain/user-account";
import { toUserRoleOrNull } from "../../domain/user-role";

function createTwoFactorUsersSubquery(db: Queryable) {
  return db
    .select({ userId: twoFactor.userId })
    .from(twoFactor)
    .groupBy(twoFactor.userId)
    .as("two_factor_users");
}

function createUserAccountSelectFields(
  twoFactorUsers: ReturnType<typeof createTwoFactorUsersSubquery>,
) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    image: user.image,
    role: user.role,
    banned: sql<boolean>`coalesce(${userAccessStates.banned}, false)`,
    banReason: userAccessStates.banReason,
    banExpires: userAccessStates.banExpires,
    twoFactorEnabled: sql<boolean>`case when ${twoFactorUsers.userId} is not null then true else false end`,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

async function findUserAccountByCondition(
  db: Queryable,
  condition: SQL,
): Promise<UserAccount | null> {
  const twoFactorUsers = createTwoFactorUsersSubquery(db);
  const [row] = await db
    .select(createUserAccountSelectFields(twoFactorUsers))
    .from(user)
    .leftJoin(userAccessStates, eq(userAccessStates.userId, user.id))
    .leftJoin(twoFactorUsers, eq(twoFactorUsers.userId, user.id))
    .where(condition)
    .limit(1);

  if (!row) {
    return null;
  }

  const snapshot: UserAccountSnapshot = {
    ...row,
    role: toUserRoleOrNull(row.role),
  };

  return UserAccount.fromSnapshot(snapshot);
}

export class DrizzleUserAccountRepository implements UserAccountRepository {
  constructor(private readonly db: Queryable) {}

  async findById(id: string): Promise<UserAccount | null> {
    return findUserAccountByCondition(this.db, eq(user.id, id));
  }

  async findByEmail(email: string): Promise<UserAccount | null> {
    return findUserAccountByCondition(this.db, eq(user.email, email));
  }

  async save(userAccount: UserAccount): Promise<UserAccount> {
    const snapshot = userAccount.toSnapshot();
    const existing = await this.findExistingRow(snapshot.id);

    if (existing) {
      await this.updateUserRow(snapshot);
    } else {
      await this.insertUserRow(snapshot);
    }

    await this.upsertAccessState(snapshot);

    return UserAccount.fromSnapshot(snapshot);
  }

  private async findExistingRow(id: string) {
    const [row] = await this.db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, id))
      .limit(1);

    return row ?? null;
  }

  private async insertUserRow(snapshot: UserAccountSnapshot) {
    await this.db.insert(user).values({
      id: snapshot.id,
      name: snapshot.name,
      email: snapshot.email,
      emailVerified: snapshot.emailVerified,
      image: snapshot.image,
      role: snapshot.role,
      createdAt: snapshot.createdAt,
      updatedAt: snapshot.updatedAt,
    });
  }

  private async updateUserRow(snapshot: UserAccountSnapshot) {
    await this.db
      .update(user)
      .set({
        name: snapshot.name,
        email: snapshot.email,
        emailVerified: snapshot.emailVerified,
        image: snapshot.image,
        role: snapshot.role,
        updatedAt: snapshot.updatedAt,
      })
      .where(eq(user.id, snapshot.id));
  }

  private async upsertAccessState(snapshot: UserAccountSnapshot) {
    await this.db
      .insert(userAccessStates)
      .values({
        userId: snapshot.id,
        banned: snapshot.banned,
        banReason: snapshot.banReason,
        banExpires: snapshot.banExpires,
        createdAt: snapshot.createdAt,
        updatedAt: snapshot.updatedAt,
      })
      .onConflictDoUpdate({
        target: userAccessStates.userId,
        set: {
          banned: snapshot.banned,
          banReason: snapshot.banReason,
          banExpires: snapshot.banExpires,
          updatedAt: snapshot.updatedAt,
        },
      });
  }
}
