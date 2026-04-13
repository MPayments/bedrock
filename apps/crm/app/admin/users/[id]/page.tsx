"use client";

import { use, useCallback, useEffect, useState } from "react";
import { ChevronLeft, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { Alert, AlertDescription } from "@bedrock/sdk-ui/components/alert";
import { Button } from "@bedrock/sdk-ui/components/button";
import { toast } from "@bedrock/sdk-ui/components/sonner";

import type {
  MutationResult,
  UserDetails,
} from "@bedrock/sdk-users-ui/lib/contracts";
import type { UserGeneralFormValues } from "@bedrock/sdk-users-ui/lib/schemas";
import { UserBanControls, type BanSubmissionValues } from "@bedrock/sdk-users-ui/components/user-ban-controls";
import { UserGeneralForm } from "@bedrock/sdk-users-ui/components/user-general-form";
import { UserHeader } from "@bedrock/sdk-users-ui/components/user-header";
import { UserPasswordForm } from "@bedrock/sdk-users-ui/components/user-password-form";

import { apiClient } from "@/lib/api/browser-client";
import { executeApiMutation } from "@/lib/api/mutation";

import {
  CRM_DEFAULT_USER_ROLE,
  CRM_USER_ROLE_OPTIONS,
} from "../_lib/role-options";

export default function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [user, setUser] = useState<UserDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      try {
        setLoading(true);
        setLoadError(null);
        const res = await apiClient.v1.users[":id"].$get({
          param: { id },
        });
        if (!res.ok) {
          throw new Error(`Не удалось загрузить пользователя: ${res.status}`);
        }
        const payload = (await res.json()) as UserDetails;
        if (cancelled) return;
        setUser(payload);
      } catch (err) {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Ошибка загрузки");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadUser();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleGeneralSubmit = useCallback(
    async (
      values: UserGeneralFormValues,
    ): Promise<MutationResult<UserDetails>> => {
      const result = await executeApiMutation<UserDetails>({
        request: () =>
          apiClient.v1.users[":id"].$patch({
            param: { id },
            json: {
              name: values.name,
              email: values.email,
              role: values.role as "admin" | "agent",
            },
          }),
        fallbackMessage: "Не удалось обновить пользователя",
        parseData: async (response) => (await response.json()) as UserDetails,
      });

      if (!result.ok) {
        toast.error(result.message);
        return { ok: false, message: result.message, status: result.status };
      }

      setUser(result.data);
      toast.success("Пользователь обновлен");
      return { ok: true, data: result.data };
    },
    [id],
  );

  const handlePasswordSubmit = useCallback(
    async (newPassword: string): Promise<MutationResult> => {
      const result = await executeApiMutation<{ success: boolean }>({
        request: () =>
          apiClient.v1.users[":id"]["change-password"].$post({
            param: { id },
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
    },
    [id],
  );

  const handleBan = useCallback(
    async (
      payload: BanSubmissionValues,
    ): Promise<MutationResult<UserDetails>> => {
      const result = await executeApiMutation<UserDetails>({
        request: () =>
          apiClient.v1.users[":id"].ban.$post({
            param: { id },
            json: payload,
          }),
        fallbackMessage: "Не удалось заблокировать пользователя",
        parseData: async (response) => (await response.json()) as UserDetails,
      });

      if (!result.ok) {
        toast.error(result.message);
        return { ok: false, message: result.message, status: result.status };
      }

      setUser(result.data);
      toast.success("Пользователь заблокирован");
      return { ok: true, data: result.data };
    },
    [id],
  );

  const handleUnban = useCallback(async (): Promise<
    MutationResult<UserDetails>
  > => {
    const result = await executeApiMutation<UserDetails>({
      request: () =>
        apiClient.v1.users[":id"].unban.$post({
          param: { id },
        }),
      fallbackMessage: "Не удалось разблокировать пользователя",
      parseData: async (response) => (await response.json()) as UserDetails,
    });

    if (!result.ok) {
      toast.error(result.message);
      return { ok: false, message: result.message, status: result.status };
    }

    setUser(result.data);
    toast.success("Пользователь разблокирован");
    return { ok: true, data: result.data };
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (loadError || !user) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/admin/users")}
          >
            <ChevronLeft className="mr-2 h-4 w-4" /> Назад
          </Button>
        </div>
        <Alert variant="destructive">
          <AlertDescription>
            {loadError ?? "Пользователь не найден"}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <UserHeader
        name={user.name}
        email={user.email}
        banned={user.banned}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/admin/users")}
          >
            <ChevronLeft className="mr-2 h-4 w-4" /> Назад
          </Button>
        }
      />

      <UserGeneralForm
        user={user}
        roleOptions={CRM_USER_ROLE_OPTIONS}
        fallbackRole={CRM_DEFAULT_USER_ROLE}
        onSubmit={handleGeneralSubmit}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <UserPasswordForm onSubmit={handlePasswordSubmit} />
        <UserBanControls
          user={user}
          onBan={handleBan}
          onUnban={handleUnban}
        />
      </div>
    </div>
  );
}
