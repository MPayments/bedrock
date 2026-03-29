import type { ModuleRuntime } from "@bedrock/shared/core";

import {
  ChangeOwnPasswordInputSchema,
  type ChangeOwnPasswordInput,
} from "../../contracts";
import {
  InvalidPasswordError,
  UserNotFoundError,
} from "../../errors";
import type { IamPasswordHasherPort } from "../shared/external-ports";
import type {
  IamUsersCommandUnitOfWork,
} from "../users/ports";

export class ChangeOwnPasswordCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly commandUow: IamUsersCommandUnitOfWork,
    private readonly passwordHasher: IamPasswordHasherPort,
  ) {}

  async execute(userId: string, input: ChangeOwnPasswordInput): Promise<void> {
    const validated = ChangeOwnPasswordInputSchema.parse(input);
    await this.commandUow.run(async (tx) => {
      const credentialAccount = await tx.credentials.findByUserId(userId);

      if (!credentialAccount || !credentialAccount.password) {
        throw new UserNotFoundError(userId);
      }

      const valid = await this.passwordHasher.verify({
        hash: credentialAccount.password,
        password: validated.currentPassword,
      });

      if (!valid) {
        throw new InvalidPasswordError();
      }

      const passwordHash = await this.passwordHasher.hash(validated.newPassword);
      await tx.credentials.updatePassword({ userId, passwordHash });

      this.runtime.log.info("User changed own password", { userId });
    });
  }
}
