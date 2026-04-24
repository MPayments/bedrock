"use client";
import { useRouter } from "next/navigation";

import { toast } from "@bedrock/sdk-ui/components/sonner";

import { CreateUserForm } from "@bedrock/sdk-users-ui/components/create-user-form";
import type {
  CreatedUser,
  MutationResult,
} from "@bedrock/sdk-users-ui/lib/contracts";
import type { CreateUserFormValues } from "@bedrock/sdk-users-ui/lib/schemas";

import { apiClient } from "@/lib/api/browser-client";
import { executeApiMutation } from "@/lib/api/mutation";

import {
  CRM_DEFAULT_USER_ROLE,
  CRM_USER_ROLE_OPTIONS,
} from "../_lib/role-options";

export default function NewUserPage() {
  const router = useRouter();

  async function handleSubmit(
    values: CreateUserFormValues,
  ): Promise<MutationResult<CreatedUser>> {
    const result = await executeApiMutation<CreatedUser>({
      request: () =>
        apiClient.v1.users.$post({
          json: {
            name: values.name,
            email: values.email,
            password: values.password,
            role: values.role as "admin" | "agent",
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
    router.push(`/admin/users/${result.data.id}`);
    return { ok: true, data: result.data };
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Новый пользователь</h1>
      </div>

      <CreateUserForm
        roleOptions={CRM_USER_ROLE_OPTIONS}
        defaultRole={CRM_DEFAULT_USER_ROLE}
        onSubmit={handleSubmit}
        onCancel={() => router.push("/admin/users")}
      />
    </div>
  );
}
