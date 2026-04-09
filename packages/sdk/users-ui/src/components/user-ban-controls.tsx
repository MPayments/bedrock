"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Ban, ShieldCheck } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";
import {
  FieldLabel,
  FieldGroup,
  Field,
  FieldError,
} from "@bedrock/sdk-ui/components/field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@bedrock/sdk-ui/components/dialog";
import { Input } from "@bedrock/sdk-ui/components/input";
import { Textarea } from "@bedrock/sdk-ui/components/textarea";
import { Button } from "@bedrock/sdk-ui/components/button";
import { Spinner } from "@bedrock/sdk-ui/components/spinner";

import type { MutationResult, UserDetails } from "../lib/contracts";
import { BanUserFormSchema, type BanUserFormValues } from "../lib/schemas";
import { formatDateRu } from "../lib/format-date";
import { UserStatusBadge } from "./user-status-badge";

export type BanSubmissionValues = {
  banReason?: string;
  banExpires?: string;
};

type UserBanControlsProps = {
  user: UserDetails;
  onBan: (values: BanSubmissionValues) => Promise<MutationResult<UserDetails>>;
  onUnban: () => Promise<MutationResult<UserDetails>>;
};

export function UserBanControls({
  user,
  onBan,
  onUnban,
}: UserBanControlsProps) {
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BanUserFormValues>({
    resolver: zodResolver(BanUserFormSchema),
    defaultValues: { banReason: "", banExpires: "" },
  });

  async function handleBan(values: BanUserFormValues) {
    setError(null);
    setSubmitting(true);

    const payload: BanSubmissionValues = {};
    if (values.banReason?.trim()) {
      payload.banReason = values.banReason.trim();
    }
    if (values.banExpires?.trim()) {
      payload.banExpires = new Date(values.banExpires).toISOString();
    }

    const result = await onBan(payload);

    setSubmitting(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setBanDialogOpen(false);
    reset();
  }

  async function handleUnban() {
    setError(null);
    setSubmitting(true);

    const result = await onUnban();

    setSubmitting(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }
  }

  const isBanned = user.banned === true;

  return (
    <Card className="h-full w-full rounded-sm">
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
      <CardContent className="flex flex-1 flex-col">
        {isBanned ? (
          <div className="flex h-full flex-col gap-4">
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
                <p className="text-sm">{formatDateRu(user.banExpires)}</p>
              </div>
            )}
            {error && <p className="text-destructive text-sm">{error}</p>}
            <div className="mt-auto flex items-end">
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
          </div>
        ) : (
          <div className="flex h-full flex-col">
            {error && <p className="text-destructive text-sm">{error}</p>}
            <div className="mt-auto flex items-end">
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
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
