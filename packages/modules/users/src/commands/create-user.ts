import { UserEmailConflictError } from "../errors";
import type { UsersServiceContext } from "../internal/context";
import { toUser } from "../internal/auth-users";
import {
  CreateUserInputSchema,
  type CreateUserInput,
  type User,
} from "../validation";

export function createCreateUserHandler(context: UsersServiceContext) {
  const { authStore, passwordHasher, log } = context;

  return async function createUser(input: CreateUserInput): Promise<User> {
    const validated = CreateUserInputSchema.parse(input);
    const existing = await authStore.findUserByEmail(validated.email);

    if (existing) {
      throw new UserEmailConflictError(validated.email);
    }

    const passwordHash = await passwordHasher.hash(validated.password);
    const created = await authStore.createUserWithCredential({
      name: validated.name,
      email: validated.email,
      role: validated.role,
      passwordHash,
      emailVerified: true,
    });

    log.info("User created", { id: created.id, email: created.email });

    return toUser(created);
  };
}
