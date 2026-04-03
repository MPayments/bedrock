import type { ModuleRuntime } from "@bedrock/shared/core";

import type { User } from "../../contracts";
import { UserNotFoundError } from "../../errors";
import { toUserFromAccount } from "../mappers";
import type { IamUsersCommandUnitOfWork } from "../users/ports";

export class UnbanUserCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly commandUow: IamUsersCommandUnitOfWork,
  ) {}

  async execute(id: string): Promise<User> {
    return this.commandUow.run(async (tx) => {
      const existing = await tx.users.findById(id);

      if (!existing) {
        throw new UserNotFoundError(id);
      }

      const updated = await tx.users.save(existing.unban(this.runtime.now()));

      this.runtime.log.info("User unbanned", { id });

      return toUserFromAccount(updated);
    });
  }
}
