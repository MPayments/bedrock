import { eq } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";

import { session } from "./schema/auth-schema";
import type { UserSessionsStore } from "../../application/users/ports";

export class DrizzleUserSessionsStore implements UserSessionsStore {
  constructor(private readonly db: Queryable) {}

  async deleteForUser(userId: string) {
    await this.db.delete(session).where(eq(session.userId, userId));
  }
}
