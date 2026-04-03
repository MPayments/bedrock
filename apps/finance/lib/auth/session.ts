import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { FinanceAuthSessionSnapshotSchema } from "@bedrock/iam/contracts";
import type {
  AppAudience,
  FeatureFlagMap,
  UserSessionSnapshot,
} from "./types";

const API_URL = process.env.API_INTERNAL_URL ?? "http://localhost:3000";

const FeatureFlagsSchema = z.record(z.string(), z.boolean());

function resolveFeatureFlags(): FeatureFlagMap {
  const raw = process.env.NEXT_PUBLIC_FEATURE_FLAGS;
  if (!raw) {
    return {};
  }

  try {
    return FeatureFlagsSchema.parse(JSON.parse(raw));
  } catch {
    return {};
  }
}

function createAnonymousSessionSnapshot(): UserSessionSnapshot {
  return {
    audience: "finance",
    featureFlags: resolveFeatureFlags(),
    isAuthenticated: false,
    requiresTwoFactorSetup: false,
    role: "finance",
    user: null,
    session: null,
  };
}

async function readSessionSnapshot(): Promise<UserSessionSnapshot> {
  const requestHeaders = await headers();
  const authHeaders = {
    cookie: requestHeaders.get("cookie") ?? "",
    "x-bedrock-app-audience": "finance",
  };
  const response = await fetch(`${API_URL}/api/auth/finance/session-snapshot`, {
    headers: {
      ...authHeaders,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return createAnonymousSessionSnapshot();
  }

  const payload = await response.json();
  const parsed = FinanceAuthSessionSnapshotSchema.safeParse(payload);

  if (!parsed.success) {
    return createAnonymousSessionSnapshot();
  }

  return {
    featureFlags: resolveFeatureFlags(),
    ...parsed.data,
  };
}

export const getServerSessionSnapshot = cache(readSessionSnapshot);

export async function requirePageAudience(audience: AppAudience) {
  const session = await getServerSessionSnapshot();

  if (!session.isAuthenticated) {
    redirect("/login");
  }

  if (audience === "admin" && session.role !== "admin") {
    redirect("/");
  }

  return session;
}
