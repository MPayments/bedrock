import { hashPassword, verifyPassword } from "better-auth/crypto";

import type { IamPasswordHasherPort } from "../../application/shared/external-ports";

export function createBetterAuthPasswordHasher(): IamPasswordHasherPort {
  return {
    hash(password) {
      return hashPassword(password);
    },
    verify(input) {
      return verifyPassword(input);
    },
  };
}
