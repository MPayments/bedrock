"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Shield, ShieldCheck, ShieldOff, Copy, RefreshCw } from "lucide-react";

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@bedrock/ui/components/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@bedrock/ui/components/dialog";
import {
    Field,
    FieldGroup,
    FieldLabel,
} from "@bedrock/ui/components/field";
import { Input } from "@bedrock/ui/components/input";
import { Badge } from "@bedrock/ui/components/badge";
import { Button } from "@bedrock/ui/components/button";
import { Spinner } from "@bedrock/ui/components/spinner";
import { toast } from "@bedrock/ui/components/sonner";

import { authClient } from "@/lib/auth-client";

const QRCodeSVG = dynamic(
    () => import("qrcode.react").then((m) => m.QRCodeSVG),
    { ssr: false },
);

type TwoFactorSectionProps = {
    twoFactorEnabled: boolean | null;
};

type SetupData = {
    totpURI: string;
    backupCodes: string[];
};

function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(
        () => toast.success("Скопировано в буфер обмена"),
        () => toast.error("Не удалось скопировать"),
    );
}

// --- Subcomponents ---

function TwoFactorSetup({
    setupData,
    submitting,
    error,
    verifyCode,
    onVerifyCodeChange,
    onVerify,
}: {
    setupData: SetupData;
    submitting: boolean;
    error: string | null;
    verifyCode: string;
    onVerifyCodeChange: (code: string) => void;
    onVerify: (e: React.FormEvent) => void;
}) {
    return (
        <Card className="w-full rounded-sm">
            <CardHeader className="border-b">
                <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                        <Shield className="size-4" />
                        Настройка 2FA
                    </CardTitle>
                    <CardDescription>
                        Отсканируйте QR-код приложением-аутентификатором и
                        введите код подтверждения.
                    </CardDescription>
                </div>
            </CardHeader>
            <CardContent>
                <FieldGroup>
                    <div className="flex flex-col items-center gap-4">
                        <div className="rounded-lg border bg-white p-4">
                            <QRCodeSVG
                                value={setupData.totpURI}
                                size={200}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <FieldLabel>Резервные коды</FieldLabel>
                        <p className="text-muted-foreground text-sm">
                            Сохраните эти коды в безопасном месте. Каждый код
                            можно использовать только один раз.
                        </p>
                        <div className="bg-muted rounded-md p-3">
                            <div className="grid grid-cols-2 gap-1 font-mono text-sm">
                                {setupData.backupCodes.map((code) => (
                                    <span key={code}>{code}</span>
                                ))}
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            type="button"
                            onClick={() =>
                                copyToClipboard(
                                    setupData.backupCodes.join("\n"),
                                )
                            }
                        >
                            <Copy className="size-4" />
                            Копировать коды
                        </Button>
                    </div>

                    <form onSubmit={onVerify}>
                        <FieldGroup>
                            <Field>
                                <FieldLabel htmlFor="verify-totp-code">
                                    Код из аутентификатора
                                </FieldLabel>
                                <Input
                                    id="verify-totp-code"
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="one-time-code"
                                    pattern="[0-9]*"
                                    maxLength={6}
                                    placeholder="000000"
                                    required
                                    value={verifyCode}
                                    onChange={(e) =>
                                        onVerifyCodeChange(e.target.value)
                                    }
                                    disabled={submitting}
                                    autoFocus
                                />
                            </Field>
                            {error ? (
                                <p className="text-destructive text-sm">
                                    {error}
                                </p>
                            ) : null}
                            <div>
                                <Button
                                    type="submit"
                                    disabled={submitting}
                                >
                                    {submitting ? (
                                        <Spinner className="size-4" />
                                    ) : (
                                        <ShieldCheck className="size-4" />
                                    )}
                                    {submitting
                                        ? "Проверка..."
                                        : "Подтвердить"}
                                </Button>
                            </div>
                        </FieldGroup>
                    </form>
                </FieldGroup>
            </CardContent>
        </Card>
    );
}

function TwoFactorEnabled({
    submitting,
    error,
    disableDialogOpen,
    onDisableDialogChange,
    disablePassword,
    onDisablePasswordChange,
    onDisable,
    backupDialogOpen,
    onBackupDialogChange,
    backupPassword,
    onBackupPasswordChange,
    onRegenerateBackupCodes,
    newBackupCodes,
}: {
    submitting: boolean;
    error: string | null;
    disableDialogOpen: boolean;
    onDisableDialogChange: (open: boolean) => void;
    disablePassword: string;
    onDisablePasswordChange: (pw: string) => void;
    onDisable: (e: React.FormEvent) => void;
    backupDialogOpen: boolean;
    onBackupDialogChange: (open: boolean) => void;
    backupPassword: string;
    onBackupPasswordChange: (pw: string) => void;
    onRegenerateBackupCodes: (e: React.FormEvent) => void;
    newBackupCodes: string[] | null;
}) {
    return (
        <Card className="w-full rounded-sm">
            <CardHeader className="border-b">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2">
                            <Shield className="size-4" />
                            Двухфакторная аутентификация
                        </CardTitle>
                        <CardDescription>
                            Дополнительная защита аккаунта через
                            приложение-аутентификатор.
                        </CardDescription>
                    </div>
                    <Badge variant="default">2FA активна</Badge>
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex flex-wrap gap-2">
                    <Dialog
                        open={disableDialogOpen}
                        onOpenChange={onDisableDialogChange}
                    >
                        <DialogTrigger
                            render={
                                <Button
                                    variant="destructive"
                                    disabled={submitting}
                                />
                            }
                        >
                            <ShieldOff className="size-4" />
                            Отключить 2FA
                        </DialogTrigger>
                        <DialogContent>
                            <form onSubmit={onDisable}>
                                <DialogHeader>
                                    <DialogTitle>
                                        Отключить двухфакторную
                                        аутентификацию?
                                    </DialogTitle>
                                    <DialogDescription>
                                        Ваш аккаунт будет менее защищён.
                                        Введите пароль для подтверждения.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="py-4">
                                    <Field>
                                        <FieldLabel htmlFor="disable-2fa-password">
                                            Пароль
                                        </FieldLabel>
                                        <Input
                                            id="disable-2fa-password"
                                            type="password"
                                            required
                                            value={disablePassword}
                                            onChange={(e) =>
                                                onDisablePasswordChange(
                                                    e.target.value,
                                                )
                                            }
                                            disabled={submitting}
                                            autoFocus
                                        />
                                    </Field>
                                    {error ? (
                                        <p className="text-destructive mt-2 text-sm">
                                            {error}
                                        </p>
                                    ) : null}
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
                                            <ShieldOff className="size-4" />
                                        )}
                                        {submitting
                                            ? "Отключение..."
                                            : "Отключить"}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>

                    <Dialog
                        open={backupDialogOpen}
                        onOpenChange={onBackupDialogChange}
                    >
                        <DialogTrigger
                            render={
                                <Button
                                    variant="outline"
                                    disabled={submitting}
                                />
                            }
                        >
                            <RefreshCw className="size-4" />
                            Перегенерировать резервные коды
                        </DialogTrigger>
                        <DialogContent>
                            {newBackupCodes ? (
                                <>
                                    <DialogHeader>
                                        <DialogTitle>
                                            Новые резервные коды
                                        </DialogTitle>
                                        <DialogDescription>
                                            Сохраните эти коды в безопасном
                                            месте. Старые коды больше не
                                            действуют.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="py-4">
                                        <div className="bg-muted rounded-md p-3">
                                            <div className="grid grid-cols-2 gap-1 font-mono text-sm">
                                                {newBackupCodes.map(
                                                    (code) => (
                                                        <span key={code}>
                                                            {code}
                                                        </span>
                                                    ),
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button
                                            variant="outline"
                                            type="button"
                                            onClick={() =>
                                                copyToClipboard(
                                                    newBackupCodes.join(
                                                        "\n",
                                                    ),
                                                )
                                            }
                                        >
                                            <Copy className="size-4" />
                                            Копировать коды
                                        </Button>
                                    </DialogFooter>
                                </>
                            ) : (
                                <form
                                    onSubmit={onRegenerateBackupCodes}
                                >
                                    <DialogHeader>
                                        <DialogTitle>
                                            Перегенерировать резервные коды
                                        </DialogTitle>
                                        <DialogDescription>
                                            Все текущие резервные коды будут
                                            заменены новыми. Введите пароль
                                            для подтверждения.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="py-4">
                                        <Field>
                                            <FieldLabel htmlFor="backup-codes-password">
                                                Пароль
                                            </FieldLabel>
                                            <Input
                                                id="backup-codes-password"
                                                type="password"
                                                required
                                                value={backupPassword}
                                                onChange={(e) =>
                                                    onBackupPasswordChange(
                                                        e.target.value,
                                                    )
                                                }
                                                disabled={submitting}
                                                autoFocus
                                            />
                                        </Field>
                                        {error ? (
                                            <p className="text-destructive mt-2 text-sm">
                                                {error}
                                            </p>
                                        ) : null}
                                    </div>
                                    <DialogFooter>
                                        <Button
                                            type="submit"
                                            disabled={submitting}
                                        >
                                            {submitting ? (
                                                <Spinner className="size-4" />
                                            ) : (
                                                <RefreshCw className="size-4" />
                                            )}
                                            {submitting
                                                ? "Генерация..."
                                                : "Сгенерировать"}
                                        </Button>
                                    </DialogFooter>
                                </form>
                            )}
                        </DialogContent>
                    </Dialog>
                </div>
            </CardContent>
        </Card>
    );
}

function TwoFactorDisabled({
    submitting,
    error,
    enableDialogOpen,
    onEnableDialogChange,
    enablePassword,
    onEnablePasswordChange,
    onEnable,
}: {
    submitting: boolean;
    error: string | null;
    enableDialogOpen: boolean;
    onEnableDialogChange: (open: boolean) => void;
    enablePassword: string;
    onEnablePasswordChange: (pw: string) => void;
    onEnable: (e: React.FormEvent) => void;
}) {
    return (
        <Card className="w-full rounded-sm">
            <CardHeader className="border-b">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2">
                            <Shield className="size-4" />
                            Двухфакторная аутентификация
                        </CardTitle>
                        <CardDescription>
                            Дополнительная защита аккаунта через
                            приложение-аутентификатор.
                        </CardDescription>
                    </div>
                    <Badge variant="secondary">Не активна</Badge>
                </div>
            </CardHeader>
            <CardContent>
                <FieldGroup>
                    <p className="text-muted-foreground text-sm">
                        Двухфакторная аутентификация добавляет дополнительный
                        уровень безопасности. При входе в систему помимо пароля
                        потребуется ввести одноразовый код из
                        приложения-аутентификатора (Google Authenticator, Authy и
                        др.).
                    </p>
                    <div>
                        <Dialog
                            open={enableDialogOpen}
                            onOpenChange={onEnableDialogChange}
                        >
                            <DialogTrigger
                                render={
                                    <Button disabled={submitting} />
                                }
                            >
                                <ShieldCheck className="size-4" />
                                Включить 2FA
                            </DialogTrigger>
                            <DialogContent>
                                <form onSubmit={onEnable}>
                                    <DialogHeader>
                                        <DialogTitle>
                                            Включить двухфакторную
                                            аутентификацию
                                        </DialogTitle>
                                        <DialogDescription>
                                            Введите пароль для подтверждения.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="py-4">
                                        <Field>
                                            <FieldLabel htmlFor="enable-2fa-password">
                                                Пароль
                                            </FieldLabel>
                                            <Input
                                                id="enable-2fa-password"
                                                type="password"
                                                required
                                                value={enablePassword}
                                                onChange={(e) =>
                                                    onEnablePasswordChange(
                                                        e.target.value,
                                                    )
                                                }
                                                disabled={submitting}
                                                autoFocus
                                            />
                                        </Field>
                                        {error ? (
                                            <p className="text-destructive mt-2 text-sm">
                                                {error}
                                            </p>
                                        ) : null}
                                    </div>
                                    <DialogFooter>
                                        <Button
                                            type="submit"
                                            disabled={submitting}
                                        >
                                            {submitting ? (
                                                <Spinner className="size-4" />
                                            ) : (
                                                <ShieldCheck className="size-4" />
                                            )}
                                            {submitting
                                                ? "Подключение..."
                                                : "Включить"}
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </DialogContent>
                        </Dialog>
                    </div>
                </FieldGroup>
            </CardContent>
        </Card>
    );
}

// --- Main component ---

export function ProfileTwoFactorSection({
    twoFactorEnabled,
}: TwoFactorSectionProps) {
    const isEnabled = twoFactorEnabled === true;

    const [setupData, setSetupData] = useState<SetupData | null>(null);
    const [verifyCode, setVerifyCode] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [enableDialogOpen, setEnableDialogOpen] = useState(false);
    const [enablePassword, setEnablePassword] = useState("");

    const [disableDialogOpen, setDisableDialogOpen] = useState(false);
    const [disablePassword, setDisablePassword] = useState("");

    const [backupDialogOpen, setBackupDialogOpen] = useState(false);
    const [backupPassword, setBackupPassword] = useState("");
    const [newBackupCodes, setNewBackupCodes] = useState<string[] | null>(null);

    async function handleEnable(e: React.FormEvent) {
        e.preventDefault();
        setSubmitting(true);
        setError(null);

        const result = await authClient.twoFactor.enable({
            password: enablePassword,
        });

        setSubmitting(false);

        if (result.error) {
            setError(result.error.message ?? "Не удалось включить 2FA");
            return;
        }

        setSetupData({
            totpURI: result.data?.totpURI ?? "",
            backupCodes: result.data?.backupCodes ?? [],
        });
        setEnableDialogOpen(false);
        setEnablePassword("");
        setError(null);
    }

    async function handleVerify(e: React.FormEvent) {
        e.preventDefault();
        setSubmitting(true);
        setError(null);

        const result = await authClient.twoFactor.verifyTotp({
            code: verifyCode,
        });

        setSubmitting(false);

        if (result.error) {
            setError(result.error.message ?? "Неверный код");
            return;
        }

        setSetupData(null);
        setVerifyCode("");
        toast.success("Двухфакторная аутентификация включена");
        window.location.reload();
    }

    async function handleDisable(e: React.FormEvent) {
        e.preventDefault();
        setSubmitting(true);
        setError(null);

        const result = await authClient.twoFactor.disable({
            password: disablePassword,
        });

        setSubmitting(false);

        if (result.error) {
            setError(result.error.message ?? "Не удалось отключить 2FA");
            return;
        }

        setDisableDialogOpen(false);
        setDisablePassword("");
        toast.success("Двухфакторная аутентификация отключена");
        window.location.reload();
    }

    async function handleRegenerateBackupCodes(e: React.FormEvent) {
        e.preventDefault();
        setSubmitting(true);
        setError(null);

        const result = await authClient.twoFactor.generateBackupCodes({
            password: backupPassword,
        });

        setSubmitting(false);

        if (result.error) {
            setError(result.error.message ?? "Не удалось сгенерировать коды");
            return;
        }

        setNewBackupCodes(result.data?.backupCodes ?? []);
        setBackupPassword("");
    }

    if (setupData) {
        return (
            <TwoFactorSetup
                setupData={setupData}
                submitting={submitting}
                error={error}
                verifyCode={verifyCode}
                onVerifyCodeChange={setVerifyCode}
                onVerify={handleVerify}
            />
        );
    }

    if (isEnabled) {
        return (
            <TwoFactorEnabled
                submitting={submitting}
                error={error}
                disableDialogOpen={disableDialogOpen}
                onDisableDialogChange={(open) => {
                    setDisableDialogOpen(open);
                    if (!open) {
                        setDisablePassword("");
                        setError(null);
                    }
                }}
                disablePassword={disablePassword}
                onDisablePasswordChange={setDisablePassword}
                onDisable={handleDisable}
                backupDialogOpen={backupDialogOpen}
                onBackupDialogChange={(open) => {
                    setBackupDialogOpen(open);
                    if (!open) {
                        setBackupPassword("");
                        setNewBackupCodes(null);
                        setError(null);
                    }
                }}
                backupPassword={backupPassword}
                onBackupPasswordChange={setBackupPassword}
                onRegenerateBackupCodes={handleRegenerateBackupCodes}
                newBackupCodes={newBackupCodes}
            />
        );
    }

    return (
        <TwoFactorDisabled
            submitting={submitting}
            error={error}
            enableDialogOpen={enableDialogOpen}
            onEnableDialogChange={(open) => {
                setEnableDialogOpen(open);
                if (!open) {
                    setEnablePassword("");
                    setError(null);
                }
            }}
            enablePassword={enablePassword}
            onEnablePasswordChange={setEnablePassword}
            onEnable={handleEnable}
        />
    );
}
