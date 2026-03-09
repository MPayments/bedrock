"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@multihansa/ui/components/card";
import {
    FieldLabel,
    FieldGroup,
    FieldSet,
    Field,
    FieldError,
    FieldSeparator,
} from "@multihansa/ui/components/field";
import { Input } from "@multihansa/ui/components/input";
import { Badge } from "@multihansa/ui/components/badge";
import { Button } from "@multihansa/ui/components/button";
import { Spinner } from "@multihansa/ui/components/spinner";
import { toast } from "@multihansa/ui/components/sonner";

import { apiClient } from "@/lib/api-client";
import { executeMutation } from "@/lib/resources/http";
import { formatDate } from "@/lib/format";
import type { ProfileDetails } from "../lib/queries";

const ROLE_LABELS: Record<string, string> = {
    admin: "Админ",
    user: "Пользователь",
};

type ProfileGeneralFormValues = {
    name: string;
    email: string;
};

const ProfileGeneralFormSchema = z.object({
    name: z.string().trim().min(1, "Имя обязательно"),
    email: z.email("Некорректный email"),
});

type ProfileGeneralFormProps = {
    profile: ProfileDetails;
};

function toFormValues(profile: ProfileDetails): ProfileGeneralFormValues {
    return {
        name: profile.name,
        email: profile.email,
    };
}

export function ProfileGeneralForm({ profile }: ProfileGeneralFormProps) {
    const router = useRouter();
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const initial = useMemo(() => toFormValues(profile), [profile]);

    const {
        handleSubmit,
        register,
        reset,
        formState: { errors, isDirty },
    } = useForm<ProfileGeneralFormValues>({
        resolver: zodResolver(ProfileGeneralFormSchema),
        defaultValues: initial,
        mode: "onChange",
    });

    useEffect(() => {
        reset(initial);
    }, [initial, reset]);

    async function onSubmit(values: ProfileGeneralFormValues) {
        setError(null);
        setSubmitting(true);

        const result = await executeMutation<ProfileDetails>({
            request: () =>
                apiClient.v1.me.$patch({
                    json: {
                        name: values.name.trim(),
                        email: values.email.trim(),
                    },
                }),
            fallbackMessage: "Не удалось обновить профиль",
            parseData: async (response) =>
                (await response.json()) as ProfileDetails,
        });

        setSubmitting(false);

        if (!result.ok) {
            setError(result.message);
            toast.error(result.message);
            return;
        }

        reset(toFormValues(result.data));
        toast.success("Профиль обновлен");
        router.refresh();
    }

    function handleReset() {
        reset(initial);
    }

    const roleLabel = ROLE_LABELS[profile.role ?? ""] ?? profile.role ?? "—";

    return (
        <Card className="w-full rounded-sm">
            <CardHeader className="border-b">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                        <CardTitle>Общая информация</CardTitle>
                        <CardDescription>
                            Просмотр и редактирование данных профиля.
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            type="submit"
                            form="profile-general-form"
                            disabled={submitting || !isDirty}
                        >
                            {submitting ? (
                                <Spinner className="size-4" />
                            ) : (
                                <Save className="size-4" />
                            )}
                            {submitting ? "Сохранение..." : "Сохранить"}
                        </Button>
                        <Button
                            variant="outline"
                            type="button"
                            disabled={submitting || !isDirty}
                            onClick={handleReset}
                        >
                            <X className="size-4" />
                            Отменить
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <form
                    id="profile-general-form"
                    onSubmit={handleSubmit(onSubmit)}
                >
                    <FieldGroup>
                        <FieldSet>
                            <FieldGroup>
                                <div className="grid gap-4 md:grid-cols-2">
                                    <Field
                                        data-invalid={Boolean(errors.name)}
                                    >
                                        <FieldLabel htmlFor="profile-name">
                                            Имя
                                        </FieldLabel>
                                        <Input
                                            {...register("name")}
                                            id="profile-name"
                                            aria-invalid={Boolean(errors.name)}
                                            placeholder="Иван Иванов"
                                        />
                                        <FieldError
                                            errors={[errors.name]}
                                        />
                                    </Field>
                                    <Field
                                        data-invalid={Boolean(errors.email)}
                                    >
                                        <FieldLabel htmlFor="profile-email">
                                            Email
                                        </FieldLabel>
                                        <Input
                                            {...register("email")}
                                            id="profile-email"
                                            aria-invalid={Boolean(
                                                errors.email,
                                            )}
                                            placeholder="user@example.com"
                                        />
                                        <FieldError
                                            errors={[errors.email]}
                                        />
                                    </Field>
                                </div>
                                <div className="grid gap-4 md:grid-cols-2">
                                    <Field>
                                        <FieldLabel>Роль</FieldLabel>
                                        <div className="flex h-9 items-center">
                                            <Badge variant="secondary">
                                                {roleLabel}
                                            </Badge>
                                        </div>
                                    </Field>
                                </div>
                            </FieldGroup>
                        </FieldSet>
                        <FieldSeparator />
                        <div className="grid grid-cols-2 gap-4">
                            <Field>
                                <FieldLabel>Дата создания</FieldLabel>
                                <Input
                                    readOnly
                                    disabled
                                    value={formatDate(profile.createdAt)}
                                />
                            </Field>
                            <Field>
                                <FieldLabel>Дата обновления</FieldLabel>
                                <Input
                                    readOnly
                                    disabled
                                    value={formatDate(profile.updatedAt)}
                                />
                            </Field>
                        </div>
                        {error && (
                            <p className="text-destructive text-sm">{error}</p>
                        )}
                    </FieldGroup>
                </form>
            </CardContent>
        </Card>
    );
}
