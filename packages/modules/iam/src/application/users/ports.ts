import type { PaginatedList } from "@bedrock/shared/core/pagination";

import type { UserAccount } from "../../domain/user-account";

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

export interface ListIamUsersInput {
  limit: number;
  offset: number;
  sortBy?: "name" | "email" | "role" | "createdAt";
  sortOrder?: "asc" | "desc";
  name?: string;
  email?: string;
  roles?: string[];
  banned?: boolean;
}

export interface CreateIamUserWithCredentialInput {
  name: string;
  email: string;
  passwordHash: string;
  role?: string | null;
  emailVerified?: boolean;
  now?: Date;
  provisionAgentProfile?: boolean;
}

export interface UpdateIamUserInput {
  id: string;
  name?: string;
  email?: string;
  role?: string | null;
  provisionAgentProfile?: boolean;
}

export interface UpdateIamCredentialPasswordInput {
  userId: string;
  passwordHash: string;
}

export interface BanIamUserInput {
  id: string;
  banReason?: string | null;
  banExpires?: Date | null;
}

export interface IamUsersReads {
  listUsers(input: ListIamUsersInput): Promise<PaginatedList<IamUserRecord>>;
  getUserWithLastSession(
    userId: string,
  ): Promise<IamUserWithLastSessionRecord | null>;
}

export interface UserAccountRepository {
  findById(id: string): Promise<UserAccount | null>;
  findByEmail(email: string): Promise<UserAccount | null>;
  save(userAccount: UserAccount): Promise<UserAccount>;
}

export interface CredentialAccountStore {
  findByUserId(userId: string): Promise<IamCredentialRecord | null>;
  create(input: {
    id: string;
    userId: string;
    passwordHash: string;
    now: Date;
  }): Promise<IamCredentialRecord>;
  updatePassword(
    input: UpdateIamCredentialPasswordInput,
  ): Promise<IamCredentialRecord | null>;
}

export interface UserSessionsStore {
  deleteForUser(userId: string): Promise<void>;
}

export interface AgentProfileStore {
  ensureProvisioned(input: { userId: string; now: Date }): Promise<void>;
}

export interface IamUsersCommandTx {
  users: UserAccountRepository;
  credentials: CredentialAccountStore;
  sessions: UserSessionsStore;
  agentProfiles: AgentProfileStore;
}

export interface IamUsersCommandUnitOfWork {
  run<T>(work: (tx: IamUsersCommandTx) => Promise<T>): Promise<T>;
}
