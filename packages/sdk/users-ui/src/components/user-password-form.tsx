"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound } from "lucide-react";

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
import { Button } from "@bedrock/sdk-ui/components/button";
import { Spinner } from "@bedrock/sdk-ui/components/spinner";

import type { MutationResult } from "../lib/contracts";
import {
  ChangePasswordSchema,
  type ChangePasswordValues,
} from "../lib/schemas";
import { PasswordFieldWithGenerator } from "./password-field-with-generator";

type UserPasswordFormProps = {
  onSubmit: (newPassword: string) => Promise<MutationResult>;
};

export function UserPasswordForm({ onSubmit }: UserPasswordFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<ChangePasswordValues>({
    resolver: zodResolver(ChangePasswordSchema),
    defaultValues: { newPassword: "" },
  });

  async function handleFormSubmit(values: ChangePasswordValues) {
    setError(null);
    setSubmitting(true);

    const result = await onSubmit(values.newPassword);

    setSubmitting(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    reset();
  }

  return (
    <Card className="h-full w-full rounded-sm">
      <CardHeader className="border-b">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-4" />
            Смена пароля
          </CardTitle>
          <CardDescription>
            Установите новый пароль для пользователя.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(handleFormSubmit)}>
          <FieldGroup>
            <div className="grid gap-4 md:grid-cols-2">
              <Field data-invalid={Boolean(errors.newPassword)}>
                <FieldLabel htmlFor="user-new-password">
                  Новый пароль
                </FieldLabel>
                <PasswordFieldWithGenerator
                  id="user-new-password"
                  fieldName="newPassword"
                  registration={register("newPassword")}
                  setValue={setValue}
                  invalid={Boolean(errors.newPassword)}
                />
                <FieldError errors={[errors.newPassword]} />
              </Field>
              <div className="flex items-end">
                <Button type="submit" disabled={submitting}>
                  {submitting ? (
                    <Spinner className="size-4" />
                  ) : (
                    <KeyRound className="size-4" />
                  )}
                  {submitting ? "Сохранение..." : "Сменить пароль"}
                </Button>
              </div>
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
