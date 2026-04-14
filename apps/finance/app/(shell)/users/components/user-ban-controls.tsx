"use client";

import { useRouter } from "next/navigation";

import { toast } from "@bedrock/sdk-ui/components/sonner";

import {
  UserBanControls as BaseUserBanControls,
  type BanSubmissionValues,
} from "@bedrock/sdk-users-ui/components/user-ban-controls";
import type {
  MutationResult,
  UserDetails as SdkUserDetails,
} from "@bedrock/sdk-users-ui/lib/contracts";

import { apiClient } from "@/lib/api-client";
import { executeMutation } from "@/lib/resources/http";

import type { UserDetails } from "../lib/queries";

type UserBanControlsProps = {
  user: UserDetails;
};

export function UserBanControls({ user }: UserBanControlsProps) {
  const router = useRouter();

  async function handleBan(
    payload: BanSubmissionValues,
  ): Promise<MutationResult<SdkUserDetails>> {
    const result = await executeMutation<UserDetails>({
      request: () =>
        apiClient.v1.users[":id"].ban.$post({
          param: { id: user.id },
          json: payload,
        }),
      fallbackMessage: "Не удалось заблокировать пользователя",
      parseData: async (response) => (await response.json()) as UserDetails,
    });

    if (!result.ok) {
      toast.error(result.message);
      return { ok: false, message: result.message, status: result.status };
    }

    toast.success("Пользователь заблокирован");
    router.refresh();
    return { ok: true, data: result.data };
  }

  async function handleUnban(): Promise<MutationResult<SdkUserDetails>> {
    const result = await executeMutation<UserDetails>({
      request: () =>
        apiClient.v1.users[":id"].unban.$post({
          param: { id: user.id },
        }),
      fallbackMessage: "Не удалось разблокировать пользователя",
      parseData: async (response) => (await response.json()) as UserDetails,
    });

    if (!result.ok) {
      toast.error(result.message);
      return { ok: false, message: result.message, status: result.status };
    }

    toast.success("Пользователь разблокирован");
    router.refresh();
    return { ok: true, data: result.data };
  }

  return (
    <BaseUserBanControls user={user} onBan={handleBan} onUnban={handleUnban} />
  );
}
