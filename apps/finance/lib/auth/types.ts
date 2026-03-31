export type AppAudience = "finance" | "admin" | "shared";

export type UserRole = "finance" | "admin";

export type FeatureFlagMap = Record<string, boolean>;

export type UserSessionSnapshot = {
  isAuthenticated: boolean;
  role: UserRole;
  requiresTwoFactorSetup: boolean;
  featureFlags: FeatureFlagMap;
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  } | null;
  session: {
    id: string;
    expiresAt: string | null;
  } | null;
};
