export type AppAudience = "user" | "admin" | "shared";

export type UserRole = "user" | "admin";

export type FeatureFlagMap = Record<string, boolean>;

export type UserSessionSnapshot = {
  isAuthenticated: boolean;
  role: UserRole;
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
