import type { FinanceAuthSessionSnapshot } from "@bedrock/iam/contracts";

export type AppAudience = "finance" | "admin" | "shared";

export type UserRole = "finance" | "admin";

export type FeatureFlagMap = Record<string, boolean>;

export type UserSessionSnapshot = FinanceAuthSessionSnapshot & {
  featureFlags: FeatureFlagMap;
};
