"use client";

import { toast } from "@bedrock/sdk-ui/components/sonner";

import { UserPasswordForm as BaseUserPasswordForm } from "@bedrock/sdk-users-ui/components/user-password-form";
import type { MutationResult } from "@bedrock/sdk-users-ui/lib/contracts";

import { apiClient } from "@/lib/api-client";
import { executeMutation } from "@/lib/resources/http";

type UserPasswordFormProps = {
  userId: string;
};

export function UserPasswordForm({ userId }: UserPasswordFormProps) {
  async function handleSubmit(
    newPassword: string,
  ): Promise<MutationResult> {
    const result = await executeMutation<{ success: boolean }>({
      request: () =>
        apiClient.v1.users[":id"]["change-password"].$post({
          param: { id: userId },
          json: { newPassword },
        }),
      fallbackMessage: "Не удалось сменить пароль",
      parseData: async (response) =>
        (await response.json()) as { success: boolean },
    });

    if (!result.ok) {
      toast.error(result.message);
      return { ok: false, message: result.message, status: result.status };
    }

    toast.success("Пароль успешно изменен");
    return { ok: true, data: undefined };
  }

  return <BaseUserPasswordForm onSubmit={handleSubmit} />;
}
