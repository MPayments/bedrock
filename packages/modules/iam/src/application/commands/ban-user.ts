import type { ModuleRuntime } from "@bedrock/shared/core";

import {
  BanUserInputSchema,
  type BanUserInput,
  type User,
} from "../../contracts";
import { type BanUserProps } from "../../domain/user-account";
import { UserNotFoundError } from "../../errors";
import { toUserFromAccount } from "../mappers";
import type { IamUsersCommandUnitOfWork } from "../users/ports";

export class BanUserCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly commandUow: IamUsersCommandUnitOfWork,
  ) {}

  async execute(id: string, input: BanUserInput): Promise<User> {
    const validated = BanUserInputSchema.parse(input);

    return this.commandUow.run(async (tx) => {
      const existing = await tx.users.findById(id);

      if (!existing) {
        throw new UserNotFoundError(id);
      }

      const banInput: BanUserProps = {
        banReason: validated.banReason ?? null,
        banExpires: validated.banExpires ?? null,
      };
      const updated = await tx.users.save(
        existing.ban({
          ...banInput,
          now: this.runtime.now(),
        }),
      );

      await tx.sessions.deleteForUser(id);

      this.runtime.log.info("User banned", { id, reason: validated.banReason });
      return toUserFromAccount(updated);
    });
  }
}
