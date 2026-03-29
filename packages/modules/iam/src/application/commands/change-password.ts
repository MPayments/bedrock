import type { ModuleRuntime } from "@bedrock/shared/core";

import {
  ChangePasswordInputSchema,
  type ChangePasswordInput,
} from "../../contracts";
import { UserNotFoundError } from "../../errors";
import type { IamPasswordHasherPort } from "../shared/external-ports";
import type {
  IamUsersCommandUnitOfWork,
} from "../users/ports";

export class ChangePasswordCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly commandUow: IamUsersCommandUnitOfWork,
    private readonly passwordHasher: IamPasswordHasherPort,
  ) {}

  async execute(userId: string, input: ChangePasswordInput): Promise<void> {
    const validated = ChangePasswordInputSchema.parse(input);
    const passwordHash = await this.passwordHasher.hash(validated.newPassword);

    await this.commandUow.run(async (tx) => {
      const existingUser = await tx.users.findById(userId);

      if (!existingUser) {
        throw new UserNotFoundError(userId);
      }

      const updated = await tx.credentials.updatePassword({
        userId,
        passwordHash,
      });

      if (!updated) {
        throw new UserNotFoundError(userId);
      }

      this.runtime.log.info("User password changed", { userId });
    });
  }
}
