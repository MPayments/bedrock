"use client";

import { Suspense, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { cn } from "@bedrock/ui/lib/utils";
import { Button } from "@bedrock/ui/components/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@bedrock/ui/components/card";
import {
    Field,
    FieldGroup,
    FieldLabel,
} from "@bedrock/ui/components/field";
import { Input } from "@bedrock/ui/components/input";

import { authClient } from "@/lib/auth-client";

export default function TwoFactorPage() {
    return (
        <Suspense>
            <TwoFactorForm />
        </Suspense>
    );
}

function TwoFactorForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirectTo = searchParams.get("redirect") ?? "/";

    const [code, setCode] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    const [useBackupCode, setUseBackupCode] = useState(false);

    function handleSubmit(e: React.SubmitEvent) {
        e.preventDefault();
        setError(null);

        startTransition(async () => {
            const result = useBackupCode
                ? await authClient.twoFactor.verifyBackupCode({ code })
                : await authClient.twoFactor.verifyTotp({ code });

            if (result.error) {
                setError(result.error.message ?? "Неверный код");
                return;
            }

            router.push(redirectTo);
            router.refresh();
        });
    }

    return (
        <div className={cn("flex flex-col gap-6")}>
            <Card>
                <CardHeader className="text-center">
                    <CardTitle className="text-xl">
                        Двухфакторная аутентификация
                    </CardTitle>
                    <CardDescription>
                        {useBackupCode
                            ? "Введите один из ваших резервных кодов"
                            : "Введите 6-значный код из приложения-аутентификатора"}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit}>
                        <FieldGroup>
                            <Field>
                                <FieldLabel htmlFor="otp-code">
                                    {useBackupCode ? "Резервный код" : "Код подтверждения"}
                                </FieldLabel>
                                <Input
                                    id="otp-code"
                                    type="text"
                                    inputMode={useBackupCode ? "text" : "numeric"}
                                    autoComplete="one-time-code"
                                    pattern={useBackupCode ? undefined : "[0-9]*"}
                                    maxLength={useBackupCode ? 20 : 6}
                                    placeholder={useBackupCode ? "XXXX-XXXX" : "000000"}
                                    required
                                    value={code}
                                    onChange={(e) => setCode(e.target.value)}
                                    disabled={isPending}
                                    autoFocus
                                />
                            </Field>
                            {error ? (
                                <p className="text-destructive text-center text-sm">
                                    {error}
                                </p>
                            ) : null}
                            <Field>
                                <Button type="submit" disabled={isPending}>
                                    {isPending ? "Проверка..." : "Подтвердить"}
                                </Button>
                            </Field>
                            <div className="text-center">
                                <button
                                    type="button"
                                    className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
                                    onClick={() => {
                                        setUseBackupCode(!useBackupCode);
                                        setCode("");
                                        setError(null);
                                    }}
                                    disabled={isPending}
                                >
                                    {useBackupCode
                                        ? "Использовать код из аутентификатора"
                                        : "Использовать резервный код"}
                                </button>
                            </div>
                        </FieldGroup>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
