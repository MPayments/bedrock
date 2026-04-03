import type { ModuleRuntime } from "@bedrock/shared/core";

import {
  CreateUserInputSchema,
  type CreateUserInput,
  type User,
} from "../../contracts";
import { UserAccount } from "../../domain/user-account";
import { UserEmailConflictError } from "../../errors";
import { toUserFromAccount } from "../mappers";
import type { IamPasswordHasherPort } from "../shared/external-ports";
import type {
  IamUsersCommandUnitOfWork,
} from "../users/ports";

export class CreateUserCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly commandUow: IamUsersCommandUnitOfWork,
    private readonly passwordHasher: IamPasswordHasherPort,
  ) {}

  async execute(input: CreateUserInput): Promise<User> {
    const validated = CreateUserInputSchema.parse(input);
    const email = UserAccount.normalizeEmail(validated.email);
    const name = UserAccount.normalizeName(validated.name);
    const passwordHash = await this.passwordHasher.hash(validated.password);

    return this.commandUow.run(async (tx) => {
      const existing = await tx.users.findByEmail(email);

      if (existing) {
        throw new UserEmailConflictError(email);
      }

      const now = this.runtime.now();
      const created = await tx.users.save(
        UserAccount.create(
          {
            id: this.runtime.generateUuid(),
            name,
            email,
            role: validated.role,
            emailVerified: true,
          },
          now,
        ),
      );

      await tx.credentials.create({
        id: this.runtime.generateUuid(),
        userId: created.id,
        passwordHash,
        now,
      });

      if (created.requiresAgentProfile()) {
        await tx.agentProfiles.ensureProvisioned({
          userId: created.id,
          now,
        });
      }

      this.runtime.log.info("User created", {
        id: created.id,
        email: created.toSnapshot().email,
      });

      return toUserFromAccount(created);
    });
  }
}
