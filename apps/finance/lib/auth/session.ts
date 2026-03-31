import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import type {
  AppAudience,
  FeatureFlagMap,
  UserRole,
  UserSessionSnapshot,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

const FeatureFlagsSchema = z.record(z.string(), z.boolean());

const SessionResponseSchema = z
  .looseObject({
    session: z
      .looseObject({
        id: z.string(),
        expiresAt: z.string().nullable().optional(),
      })
      ,
    user: z
      .looseObject({
        id: z.string(),
        name: z.string(),
        email: z.string(),
        image: z.string().nullable().optional(),
      })
      ,
  })
  ;

const ProfileResponseSchema = z.object({
  id: z.string(),
  role: z.string().nullable(),
  twoFactorEnabled: z.boolean().nullable(),
});

function resolveRole(role: string | undefined): UserRole {
  return role === "admin" ? "admin" : "finance";
}

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

async function readSessionSnapshot(): Promise<UserSessionSnapshot> {
  const requestHeaders = await headers();
  const authHeaders = {
    cookie: requestHeaders.get("cookie") ?? "",
    "x-bedrock-app-audience": "finance",
  };
  const response = await fetch(`${API_URL}/api/auth/finance/get-session`, {
    headers: {
      ...authHeaders,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return {
      isAuthenticated: false,
      role: "finance",
      requiresTwoFactorSetup: false,
      featureFlags: resolveFeatureFlags(),
      user: null,
      session: null,
    };
  }

  const payload = await response.json();
  const parsed = SessionResponseSchema.safeParse(payload);

  if (!parsed.success) {
    return {
      isAuthenticated: false,
      role: "finance",
      requiresTwoFactorSetup: false,
      featureFlags: resolveFeatureFlags(),
      user: null,
      session: null,
    };
  }

  const profileResponse = await fetch(`${API_URL}/v1/me`, {
    cache: "no-store",
    headers: authHeaders,
  });

  const profilePayload = profileResponse.ok ? await profileResponse.json() : null;
  const parsedProfile = ProfileResponseSchema.safeParse(profilePayload);
  const role = resolveRole(
    parsedProfile.success ? parsedProfile.data.role ?? undefined : undefined,
  );
  const requiresTwoFactorSetup =
    parsedProfile.success &&
    parsedProfile.data.role !== null &&
    !parsedProfile.data.twoFactorEnabled;

  return {
    isAuthenticated: true,
    role,
    requiresTwoFactorSetup,
    featureFlags: resolveFeatureFlags(),
    user: {
      id: parsed.data.user.id,
      name: parsed.data.user.name,
      email: parsed.data.user.email,
      image: parsed.data.user.image ?? null,
    },
    session: {
      id: parsed.data.session.id,
      expiresAt: parsed.data.session.expiresAt ?? null,
    },
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
