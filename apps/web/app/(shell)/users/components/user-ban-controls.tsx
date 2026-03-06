"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Ban, ShieldCheck } from "lucide-react";
import { z } from "zod";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/ui/components/card";
import {
  FieldLabel,
  FieldGroup,
  Field,
  FieldError,
} from "@bedrock/ui/components/field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@bedrock/ui/components/dialog";
import { Input } from "@bedrock/ui/components/input";
import { Textarea } from "@bedrock/ui/components/textarea";
import { Button } from "@bedrock/ui/components/button";
import { Spinner } from "@bedrock/ui/components/spinner";
import { toast } from "@bedrock/ui/components/sonner";

import { apiClient } from "@/lib/api-client";
import { executeMutation } from "@/lib/resources/http";
import { formatDate } from "@/lib/format";
import type { UserDetails } from "../lib/queries";
import { UserStatusBadge } from "./user-status-badge";

const BanFormSchema = z.object({
  banReason: z.string().optional(),
  banExpires: z.string().optional(),
});

type BanFormValues = z.infer<typeof BanFormSchema>;

type UserBanControlsProps = {
  user: UserDetails;
};

export function UserBanControls({ user }: UserBanControlsProps) {
  const router = useRouter();
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BanFormValues>({
    resolver: zodResolver(BanFormSchema),
    defaultValues: { banReason: "", banExpires: "" },
  });

  async function handleBan(values: BanFormValues) {
    setSubmitting(true);

    const json: { banReason?: string; banExpires?: string } = {};
    if (values.banReason?.trim()) {
      json.banReason = values.banReason.trim();
    }
    if (values.banExpires?.trim()) {
      json.banExpires = new Date(values.banExpires).toISOString();
    }

    const result = await executeMutation<UserDetails>({
      request: () =>
        apiClient.v1.users[":id"].ban.$post({
          param: { id: user.id },
          json,
        }),
      fallbackMessage: "Не удалось заблокировать пользователя",
      parseData: async (response) => (await response.json()) as UserDetails,
    });

    setSubmitting(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    setBanDialogOpen(false);
    reset();
    toast.success("Пользователь заблокирован");
    router.refresh();
  }

  async function handleUnban() {
    setSubmitting(true);

    const result = await executeMutation<UserDetails>({
      request: () =>
        apiClient.v1.users[":id"].unban.$post({
          param: { id: user.id },
        }),
      fallbackMessage: "Не удалось разблокировать пользователя",
      parseData: async (response) => (await response.json()) as UserDetails,
    });

    setSubmitting(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("Пользователь разблокирован");
    router.refresh();
  }

  const isBanned = user.banned === true;

  return (
    <Card className="w-full rounded-sm">
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Ban className="size-4" />
              Управление блокировкой
            </CardTitle>
            <CardDescription>
              Блокировка и разблокировка доступа пользователя.
            </CardDescription>
          </div>
          <UserStatusBadge banned={user.banned} />
        </div>
      </CardHeader>
      <CardContent>
        {isBanned ? (
          <div className="space-y-4">
            {user.banReason && (
              <div>
                <p className="text-muted-foreground text-sm font-medium">
                  Причина блокировки
                </p>
                <p className="text-sm">{user.banReason}</p>
              </div>
            )}
            {user.banExpires && (
              <div>
                <p className="text-muted-foreground text-sm font-medium">
                  Блокировка до
                </p>
                <p className="text-sm">{formatDate(user.banExpires)}</p>
              </div>
            )}
            <Dialog>
              <DialogTrigger
                render={
                  <Button variant="outline" disabled={submitting} />
                }
              >
                {submitting ? (
                  <Spinner className="size-4" />
                ) : (
                  <ShieldCheck className="size-4" />
                )}
                Разблокировать
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Разблокировать пользователя?</DialogTitle>
                  <DialogDescription>
                    Пользователь {user.name} ({user.email}) будет
                    разблокирован и получит доступ к системе.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    variant="outline"
                    disabled={submitting}
                    onClick={handleUnban}
                  >
                    {submitting ? (
                      <Spinner className="size-4" />
                    ) : (
                      <ShieldCheck className="size-4" />
                    )}
                    Разблокировать
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        ) : (
          <Dialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
            <DialogTrigger
              render={
                <Button variant="destructive" disabled={submitting} />
              }
            >
              <Ban className="size-4" />
              Заблокировать
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleSubmit(handleBan)}>
                <DialogHeader>
                  <DialogTitle>Заблокировать пользователя?</DialogTitle>
                  <DialogDescription>
                    Пользователь {user.name} ({user.email}) будет
                    заблокирован. Все активные сессии будут завершены.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <FieldGroup>
                    <Field data-invalid={Boolean(errors.banReason)}>
                      <FieldLabel htmlFor="ban-reason">
                        Причина блокировки
                      </FieldLabel>
                      <Textarea
                        {...register("banReason")}
                        id="ban-reason"
                        rows={2}
                        placeholder="Необязательно"
                      />
                      <FieldError errors={[errors.banReason]} />
                    </Field>
                    <Field data-invalid={Boolean(errors.banExpires)}>
                      <FieldLabel htmlFor="ban-expires">
                        Заблокировать до
                      </FieldLabel>
                      <Input
                        {...register("banExpires")}
                        id="ban-expires"
                        type="datetime-local"
                        placeholder="Без ограничения срока"
                      />
                      <FieldError errors={[errors.banExpires]} />
                    </Field>
                  </FieldGroup>
                </div>
                <DialogFooter>
                  <Button
                    type="submit"
                    variant="destructive"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <Spinner className="size-4" />
                    ) : (
                      <Ban className="size-4" />
                    )}
                    Заблокировать
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
}
