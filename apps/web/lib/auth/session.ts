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

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

const FeatureFlagsSchema = z.record(z.string(), z.boolean());

const SessionResponseSchema = z
  .object({
    session: z
      .object({
        id: z.string(),
        expiresAt: z.string().nullable().optional(),
      })
      .passthrough(),
    user: z
      .object({
        id: z.string(),
        name: z.string(),
        email: z.string(),
        image: z.string().nullable().optional(),
        role: z.string().optional(),
      })
      .passthrough(),
  })
  .passthrough();

function resolveRole(role: string | undefined): UserRole {
  return role === "admin" ? "admin" : "user";
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
  const response = await fetch(`${API_URL}/api/auth/get-session`, {
    headers: {
      cookie: requestHeaders.get("cookie") ?? "",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return {
      isAuthenticated: false,
      role: "user",
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
      role: "user",
      featureFlags: resolveFeatureFlags(),
      user: null,
      session: null,
    };
  }

  const role = resolveRole(parsed.data.user.role);

  return {
    isAuthenticated: true,
    role,
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
