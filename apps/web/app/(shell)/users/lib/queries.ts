import { cache } from "react";

import { USERS_LIST_CONTRACT } from "@bedrock/identity/validation";

import { getServerApiClient } from "@/lib/api/server-client";
import { readResourceById } from "@/lib/resources/http";
import { createResourceListQuery } from "@/lib/resources/search-params";

import type { UsersListResult } from "../components/users-table";
import type { UsersSearchParams } from "./validations";

function createUsersListQuery(search: UsersSearchParams) {
  return createResourceListQuery(USERS_LIST_CONTRACT, search);
}

export async function getUsers(
  search: UsersSearchParams,
): Promise<UsersListResult> {
  const client = await getServerApiClient();
  const res = await client.v1.users.$get(
    {
      query: createUsersListQuery(search),
    },
    {
      init: { cache: "no-store" },
    },
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch users: ${res.status}`);
  }

  return res.json() as Promise<UsersListResult>;
}

export interface UserDetails {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  role: string | null;
  banned: boolean | null;
  banReason: string | null;
  banExpires: string | null;
  twoFactorEnabled: boolean | null;
  createdAt: string;
  updatedAt: string;
  lastSessionAt: string | null;
  lastSessionIp: string | null;
}

const getUserByIdUncached = async (
  id: string,
): Promise<UserDetails | null> => {
  return readResourceById<UserDetails>({
    id,
    resourceName: "user",
    request: async (validId) => {
      const client = await getServerApiClient();
      return client.v1.users[":id"].$get(
        {
          param: { id: validId },
        },
        {
          init: { cache: "no-store" },
        },
      );
    },
  });
};

export const getUserById = cache(getUserByIdUncached);
