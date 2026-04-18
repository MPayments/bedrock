import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { fetchAudienceSessionSnapshot } from "@bedrock/iam/adapters/next";
import type {
  AppAudience,
  FeatureFlagMap,
  UserSessionSnapshot,
} from "./types";

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

async function readSessionSnapshot(): Promise<UserSessionSnapshot> {
  const requestHeaders = await headers();
  const authSnapshot = await fetchAudienceSessionSnapshot({
    audience: "finance",
    cookie: requestHeaders.get("cookie") ?? "",
  });

  return {
    featureFlags: resolveFeatureFlags(),
    ...authSnapshot,
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
