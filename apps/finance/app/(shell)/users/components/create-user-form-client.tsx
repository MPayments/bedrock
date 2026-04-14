"use client";

import { useRouter } from "next/navigation";

import { toast } from "@bedrock/sdk-ui/components/sonner";

import { CreateUserForm } from "@bedrock/sdk-users-ui/components/create-user-form";
import type {
  CreatedUser,
  MutationResult,
} from "@bedrock/sdk-users-ui/lib/contracts";
import type { CreateUserFormValues } from "@bedrock/sdk-users-ui/lib/schemas";

import { apiClient } from "@/lib/api-client";
import { executeMutation } from "@/lib/resources/http";

import {
  FINANCE_DEFAULT_USER_ROLE,
  FINANCE_USER_ROLE_OPTIONS,
} from "../lib/role-options";

export function CreateUserFormClient() {
  const router = useRouter();

  async function handleSubmit(
    values: CreateUserFormValues,
  ): Promise<MutationResult<CreatedUser>> {
    const result = await executeMutation<CreatedUser>({
      request: () =>
        apiClient.v1.users.$post({
          json: {
            name: values.name,
            email: values.email,
            password: values.password,
            role: values.role as "admin" | "finance",
          },
        }),
      fallbackMessage: "Не удалось создать пользователя",
      parseData: async (response) => (await response.json()) as CreatedUser,
    });

    if (!result.ok) {
      toast.error(result.message);
      return { ok: false, message: result.message, status: result.status };
    }

    toast.success("Пользователь создан");
    router.push(`/users/${result.data.id}`);
    return { ok: true, data: result.data };
  }

  return (
    <CreateUserForm
      roleOptions={FINANCE_USER_ROLE_OPTIONS}
      defaultRole={FINANCE_DEFAULT_USER_ROLE}
      onSubmit={handleSubmit}
    />
  );
}
