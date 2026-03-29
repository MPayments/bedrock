import type { PaginatedList } from "@bedrock/shared/core/pagination";

export interface IamUserRecord {
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

export interface IamCredentialRecord {
  id: string;
  userId: string;
  providerId: string;
  password: string | null;
}

export interface IamUserWithLastSessionRecord {
  user: IamUserRecord;
  lastSessionAt: Date | null;
  lastSessionIp: string | null;
}

export interface IamIdentityQueryRepository {
  listUsers(input: {
    limit: number;
    offset: number;
    sortBy?: "name" | "email" | "role" | "createdAt";
    sortOrder?: "asc" | "desc";
    name?: string;
    email?: string;
    roles?: string[];
    banned?: boolean;
  }): Promise<PaginatedList<IamUserRecord>>;
  findUserById(id: string): Promise<IamUserRecord | null>;
  findUserByEmail(email: string): Promise<IamUserRecord | null>;
  getCredentialByUserId(userId: string): Promise<IamCredentialRecord | null>;
  getUserWithLastSession(
    userId: string,
  ): Promise<IamUserWithLastSessionRecord | null>;
}

export interface IamIdentityCommandRepository {
  createUserWithCredential(input: {
    name: string;
    email: string;
    passwordHash: string;
    role?: string | null;
    emailVerified?: boolean;
    now?: Date;
  }): Promise<IamUserRecord>;
  updateUser(input: {
    id: string;
    name?: string;
    email?: string;
    role?: string | null;
  }): Promise<IamUserRecord | null>;
  updateCredentialPassword(input: {
    userId: string;
    passwordHash: string;
  }): Promise<IamCredentialRecord | null>;
  banUser(input: {
    id: string;
    banReason?: string | null;
    banExpires?: Date | null;
  }): Promise<IamUserRecord | null>;
  unbanUser(userId: string): Promise<IamUserRecord | null>;
}

export interface IamIdentityStore
  extends IamIdentityQueryRepository,
    IamIdentityCommandRepository
{
  deleteSessionsForUser(userId: string): Promise<void>;
}
