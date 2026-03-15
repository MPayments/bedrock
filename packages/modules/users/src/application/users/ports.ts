import type { PaginatedList } from "@bedrock/shared/core/pagination";

export interface UsersUserRecord {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  role: string | null;
  banned: boolean | null;
  banReason: string | null;
  banExpires: Date | null;
  twoFactorEnabled: boolean | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UsersCredentialRecord {
  id: string;
  userId: string;
  providerId: string;
  password: string | null;
}

export interface UsersUserWithLastSessionRecord {
  user: UsersUserRecord;
  lastSessionAt: Date | null;
  lastSessionIp: string | null;
}

export interface UsersIdentityQueryRepository {
  listUsers(input: {
    limit: number;
    offset: number;
    sortBy?: "name" | "email" | "role" | "createdAt";
    sortOrder?: "asc" | "desc";
    name?: string;
    email?: string;
    roles?: string[];
    banned?: boolean;
  }): Promise<PaginatedList<UsersUserRecord>>;
  findUserById(id: string): Promise<UsersUserRecord | null>;
  findUserByEmail(email: string): Promise<UsersUserRecord | null>;
  getCredentialByUserId(userId: string): Promise<UsersCredentialRecord | null>;
  getUserWithLastSession(
    userId: string,
  ): Promise<UsersUserWithLastSessionRecord | null>;
}

export interface UsersIdentityCommandRepository {
  createUserWithCredential(input: {
    name: string;
    email: string;
    passwordHash: string;
    role?: string | null;
    emailVerified?: boolean;
    now?: Date;
  }): Promise<UsersUserRecord>;
  updateUser(input: {
    id: string;
    name?: string;
    email?: string;
    role?: string | null;
  }): Promise<UsersUserRecord | null>;
  updateCredentialPassword(input: {
    userId: string;
    passwordHash: string;
  }): Promise<UsersCredentialRecord | null>;
  banUser(input: {
    id: string;
    banReason?: string | null;
    banExpires?: Date | null;
  }): Promise<UsersUserRecord | null>;
  unbanUser(userId: string): Promise<UsersUserRecord | null>;
}
