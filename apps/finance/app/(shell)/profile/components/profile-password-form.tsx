"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound } from "lucide-react";
import { z } from "zod";

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
import { Input } from "@bedrock/sdk-ui/components/input";
import { Button } from "@bedrock/sdk-ui/components/button";
import { Spinner } from "@bedrock/sdk-ui/components/spinner";
import { toast } from "@bedrock/sdk-ui/components/sonner";

import { apiClient } from "@/lib/api-client";
import { executeMutation } from "@/lib/resources/http";

const ChangeOwnPasswordSchema = z.object({
    currentPassword: z.string().min(1, "Текущий пароль обязателен"),
    newPassword: z
        .string()
        .min(6, "Новый пароль должен содержать минимум 6 символов"),
});

type ChangeOwnPasswordValues = z.infer<typeof ChangeOwnPasswordSchema>;

export function ProfilePasswordForm() {
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<ChangeOwnPasswordValues>({
        resolver: zodResolver(ChangeOwnPasswordSchema),
        defaultValues: { currentPassword: "", newPassword: "" },
    });

    async function onSubmit(values: ChangeOwnPasswordValues) {
        setError(null);
        setSubmitting(true);

        const result = await executeMutation<{ success: boolean }>({
            request: () =>
                apiClient.v1.me["change-password"].$post({
                    json: {
                        currentPassword: values.currentPassword,
                        newPassword: values.newPassword,
                    },
                }),
            fallbackMessage: "Не удалось сменить пароль",
            parseData: async (response) =>
                (await response.json()) as { success: boolean },
        });

        setSubmitting(false);

        if (!result.ok) {
            setError(result.message);
            toast.error(result.message);
            return;
        }

        reset();
        toast.success("Пароль успешно изменен");
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
                        Введите текущий пароль и укажите новый.
                    </CardDescription>
                </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col">
                <form
                    onSubmit={handleSubmit(onSubmit)}
                    className="flex h-full flex-col"
                >
                    <FieldGroup className="flex h-full flex-col">
                        <div className="grid gap-4 md:grid-cols-2">
                            <Field
                                data-invalid={Boolean(errors.currentPassword)}
                            >
                                <FieldLabel htmlFor="profile-current-password">
                                    Текущий пароль
                                </FieldLabel>
                                <Input
                                    {...register("currentPassword")}
                                    id="profile-current-password"
                                    type="password"
                                    aria-invalid={Boolean(
                                        errors.currentPassword,
                                    )}
                                    placeholder="Ваш текущий пароль"
                                />
                                <FieldError
                                    errors={[errors.currentPassword]}
                                />
                            </Field>
                            <Field
                                data-invalid={Boolean(errors.newPassword)}
                            >
                                <FieldLabel htmlFor="profile-new-password">
                                    Новый пароль
                                </FieldLabel>
                                <Input
                                    {...register("newPassword")}
                                    id="profile-new-password"
                                    type="password"
                                    aria-invalid={Boolean(errors.newPassword)}
                                    placeholder="Минимум 6 символов"
                                />
                                <FieldError errors={[errors.newPassword]} />
                            </Field>
                        </div>
                        {error && (
                            <p className="text-destructive text-sm">{error}</p>
                        )}
                        <div className="mt-auto flex items-end">
                            <Button type="submit" disabled={submitting}>
                                {submitting ? (
                                    <Spinner className="size-4" />
                                ) : (
                                    <KeyRound className="size-4" />
                                )}
                                {submitting
                                    ? "Сохранение..."
                                    : "Сменить пароль"}
                            </Button>
                        </div>
                    </FieldGroup>
                </form>
            </CardContent>
        </Card>
    );
}
