import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { fetchSessionSnapshot } from "./access";
import type { UserSessionSnapshot } from "./types";

async function readSessionSnapshot(): Promise<UserSessionSnapshot> {
  const requestHeaders = await headers();
  return fetchSessionSnapshot({
    cookie: requestHeaders.get("cookie") ?? "",
  });
}

export const getServerSessionSnapshot = cache(readSessionSnapshot);

export async function requireDashboardSession() {
  const session = await getServerSessionSnapshot();
  if (!session.isAuthenticated || !session.canAccessDashboard) {
    redirect("/login");
  }
  return session;
}

export async function requireAdminSession() {
  const session = await getServerSessionSnapshot();
  if (!session.isAuthenticated) {
    redirect("/login");
  }
  if (session.role !== "admin") {
    redirect("/");
  }
  return session;
}
