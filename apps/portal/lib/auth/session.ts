import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { CRM_BASE_URL } from "@/lib/constants";

import { fetchSessionSnapshot } from "./access";
import type { UserSessionSnapshot } from "./types";

async function readSessionSnapshot(): Promise<UserSessionSnapshot> {
  const requestHeaders = await headers();
  return fetchSessionSnapshot({
    cookie: requestHeaders.get("cookie") ?? "",
  });
}

export const getServerSessionSnapshot = cache(readSessionSnapshot);

export async function requirePortalSession() {
  const session = await getServerSessionSnapshot();
  if (!session.isAuthenticated) {
    redirect("/login");
  }
  if (!session.hasCustomerPortalAccess) {
    redirect(session.canAccessDashboard ? CRM_BASE_URL : "/login");
  }
  return session;
}
