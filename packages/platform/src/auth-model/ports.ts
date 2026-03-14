import type { PaginatedList } from "@bedrock/shared/core/pagination";

import type { account, user } from "./schema";

export type AuthUserRecord = typeof user.$inferSelect;

export type AuthCredentialRecord = Pick<
  typeof account.$inferSelect,
  "id" | "userId" | "providerId" | "password"
>;

export interface AuthUserWithLastSession {
  user: AuthUserRecord;
  lastSessionAt: Date | null;
  lastSessionIp: string | null;
}

export interface AuthListUsersInput {
  limit: number;
  offset: number;
  sortBy?: "name" | "email" | "role" | "createdAt";
  sortOrder?: "asc" | "desc";
  name?: string;
  email?: string;
  roles?: string[];
  banned?: boolean;
}

export interface AuthCreateUserWithCredentialInput {
  name: string;
  email: string;
  passwordHash: string;
  role?: string | null;
  emailVerified?: boolean;
  now?: Date;
}

export interface AuthUpdateUserInput {
  id: string;
  name?: string;
  email?: string;
  role?: string | null;
}

export interface AuthBanUserInput {
  id: string;
  banReason?: string | null;
  banExpires?: Date | null;
}

export interface PasswordHasherPort {
  hash(password: string): Promise<string>;
  verify(input: { hash: string; password: string }): Promise<boolean>;
}

export interface AuthIdentityStorePort {
  listUsers(input: AuthListUsersInput): Promise<PaginatedList<AuthUserRecord>>;
  findUserById(id: string): Promise<AuthUserRecord | null>;
  findUserByEmail(email: string): Promise<AuthUserRecord | null>;
  createUserWithCredential(
    input: AuthCreateUserWithCredentialInput,
  ): Promise<AuthUserRecord>;
  updateUser(input: AuthUpdateUserInput): Promise<AuthUserRecord | null>;
  getCredentialByUserId(userId: string): Promise<AuthCredentialRecord | null>;
  updateCredentialPassword(input: {
    userId: string;
    passwordHash: string;
  }): Promise<AuthCredentialRecord | null>;
  deleteSessionsForUser(userId: string): Promise<void>;
  getUserWithLastSession(
    userId: string,
  ): Promise<AuthUserWithLastSession | null>;
  banUser(input: AuthBanUserInput): Promise<AuthUserRecord | null>;
  unbanUser(userId: string): Promise<AuthUserRecord | null>;
}
