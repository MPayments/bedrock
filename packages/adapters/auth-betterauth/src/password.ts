import { hashPassword, verifyPassword } from "better-auth/crypto";

import type { PasswordHasherPort } from "@bedrock/identity";

export function createBetterAuthPasswordHasher(): PasswordHasherPort {
  return {
    hash(password) {
      return hashPassword(password);
    },
    verify(input) {
      return verifyPassword(input);
    },
  };
}
