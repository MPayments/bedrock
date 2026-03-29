import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { CrmRole, UserSessionSnapshot } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

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
        role: z.string().optional(),
        isAdmin: z.boolean().optional(),
      })
  })

function resolveRole(user: { role?: string; isAdmin?: boolean }): CrmRole {
  if (user.role === "customer") return "customer";
  if (user.role === "admin" || user.isAdmin) return "admin";
  return "agent";
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
      role: "agent",
      user: null,
      session: null,
    };
  }

  const payload = await response.json();
  const parsed = SessionResponseSchema.safeParse(payload);

  if (!parsed.success) {
    return {
      isAuthenticated: false,
      role: "agent",
      user: null,
      session: null,
    };
  }

  const role = resolveRole(parsed.data.user);

  return {
    isAuthenticated: true,
    role,
    user: {
      id: parsed.data.user.id,
      name: parsed.data.user.name,
      email: parsed.data.user.email,
      image: parsed.data.user.image ?? null,
      isAdmin: parsed.data.user.isAdmin,
    },
    session: {
      id: parsed.data.session.id,
      expiresAt: parsed.data.session.expiresAt ?? null,
    },
  };
}

export const getServerSessionSnapshot = cache(readSessionSnapshot);

export async function requireDashboardSession() {
  const session = await getServerSessionSnapshot();
  if (!session.isAuthenticated) {
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

export async function requireCustomerSession() {
  const session = await getServerSessionSnapshot();
  if (!session.isAuthenticated) {
    redirect("/login/customer");
  }
  if (session.role !== "customer") {
    redirect("/");
  }
  return session;
}
