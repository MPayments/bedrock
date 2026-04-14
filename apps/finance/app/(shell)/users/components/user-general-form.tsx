"use client";

import { useRouter } from "next/navigation";

import { toast } from "@bedrock/sdk-ui/components/sonner";

import { UserGeneralForm as BaseUserGeneralForm } from "@bedrock/sdk-users-ui/components/user-general-form";
import type {
  MutationResult,
  UserDetails as SdkUserDetails,
} from "@bedrock/sdk-users-ui/lib/contracts";
import type { UserGeneralFormValues } from "@bedrock/sdk-users-ui/lib/schemas";

import { apiClient } from "@/lib/api-client";
import { executeMutation } from "@/lib/resources/http";

import type { UserDetails } from "../lib/queries";
import {
  FINANCE_DEFAULT_USER_ROLE,
  FINANCE_USER_ROLE_OPTIONS,
} from "../lib/role-options";

type UserGeneralFormProps = {
  user: UserDetails;
};

export function UserGeneralForm({ user }: UserGeneralFormProps) {
  const router = useRouter();

  async function handleSubmit(
    values: UserGeneralFormValues,
  ): Promise<MutationResult<SdkUserDetails>> {
    const result = await executeMutation<UserDetails>({
      request: () =>
        apiClient.v1.users[":id"].$patch({
          param: { id: user.id },
          json: {
            name: values.name,
            email: values.email,
            role: values.role as "admin" | "finance",
          },
        }),
      fallbackMessage: "Не удалось обновить пользователя",
      parseData: async (response) => (await response.json()) as UserDetails,
    });

    if (!result.ok) {
      toast.error(result.message);
      return { ok: false, message: result.message, status: result.status };
    }

    toast.success("Пользователь обновлен");
    router.refresh();
    return { ok: true, data: result.data };
  }

  return (
    <BaseUserGeneralForm
      user={user}
      roleOptions={FINANCE_USER_ROLE_OPTIONS}
      fallbackRole={FINANCE_DEFAULT_USER_ROLE}
      onSubmit={handleSubmit}
    />
  );
}
