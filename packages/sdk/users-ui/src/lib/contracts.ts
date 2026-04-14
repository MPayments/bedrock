export type RoleOption = Readonly<{ value: string; label: string }>;

export interface UserDetails {
  id: string;
  name: string;
  email: string;
  role: string | null;
  banned: boolean | null;
  banReason: string | null;
  banExpires: string | null;
  createdAt: string;
  updatedAt: string;
  emailVerified?: boolean;
  image?: string | null;
  twoFactorEnabled?: boolean | null;
  lastSessionAt?: string | null;
  lastSessionIp?: string | null;
}

export type MutationResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; message: string; status?: number };

export type CreatedUser = {
  id: string;
};
