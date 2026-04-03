import { applyPatch } from "@bedrock/shared/core";
import type { ModuleRuntime } from "@bedrock/shared/core";

import {
  UpdateUserInputSchema,
  type UpdateUserInput,
  type User,
} from "../../contracts";
import {
  type UpdateUserProfileProps,
} from "../../domain/user-account";
import {
  UserEmailConflictError,
  UserNotFoundError,
} from "../../errors";
import { toUserFromAccount } from "../mappers";
import type { IamUsersCommandUnitOfWork } from "../users/ports";

export class UpdateUserCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly commandUow: IamUsersCommandUnitOfWork,
  ) {}

  async execute(id: string, input: UpdateUserInput): Promise<User> {
    const validated = UpdateUserInputSchema.parse(input);

    return this.commandUow.run(async (tx) => {
      const existing = await tx.users.findById(id);

      if (!existing) {
        throw new UserNotFoundError(id);
      }

      const current: UpdateUserProfileProps = existing.toSnapshot();
      const updatedAccount = existing.updateProfile({
        ...applyPatch(current, validated),
        now: this.runtime.now(),
      });
      const updatedSnapshot = updatedAccount.toSnapshot();

      if (updatedSnapshot.email !== existing.toSnapshot().email) {
        const conflict = await tx.users.findByEmail(updatedSnapshot.email);
        if (conflict && conflict.id !== id) {
          throw new UserEmailConflictError(updatedSnapshot.email);
        }
      }

      if (existing.sameState(updatedAccount)) {
        return toUserFromAccount(existing);
      }

      const updated = await tx.users.save(updatedAccount);

      if (updated.requiresAgentProfile()) {
        await tx.agentProfiles.ensureProvisioned({
          userId: updated.id,
          now: updated.toSnapshot().updatedAt,
        });
      }

      this.runtime.log.info("User updated", { id });
      return toUserFromAccount(updated);
    });
  }
}
