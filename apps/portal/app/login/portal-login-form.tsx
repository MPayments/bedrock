"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@bedrock/sdk-ui/components/field";
import { Input } from "@bedrock/sdk-ui/components/input";
import { Tabs, TabsList, TabsTrigger } from "@bedrock/sdk-ui/components/tabs";

import { authClient } from "@/lib/auth-client";

type Mode = "login" | "register";

export function PortalLoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "register") {
        const registrationResponse = await fetch(
          `/api/portal/register`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
              email,
              password,
              name,
            }),
          },
        );

        if (!registrationResponse.ok) {
          const payload = (await registrationResponse
            .json()
            .catch(() => null)) as { error?: string } | null;
          setError(
            payload?.error ??
              "Не удалось зарегистрироваться. Попробуйте позже.",
          );
          return;
        }

        const signInResult = await authClient.signIn.email({
          email,
          password,
          callbackURL: "/onboard",
        });

        if (signInResult.error) {
          setError(signInResult.error.message ?? "Не удалось войти в портал.");
          return;
        }
      } else {
        const signInResult = await authClient.signIn.email({
          email,
          password,
          callbackURL: "/",
        });

        if (signInResult.error) {
          setError(signInResult.error.message ?? "Неверный email или пароль.");
          return;
        }
      }

      router.push(mode === "register" ? "/onboard" : "/");
      router.refresh();
    } catch (submitError) {
      setError(
        mode === "login"
          ? "Неверный email или пароль."
          : "Не удалось зарегистрироваться. Попробуйте позже.",
      );
      console.error("Auth error:", submitError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Личный кабинет</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs
          value={mode}
          onValueChange={(value) => {
            setMode(value as Mode);
            setError("");
          }}
          className="mb-6"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Вход</TabsTrigger>
            <TabsTrigger value="register">Регистрация</TabsTrigger>
          </TabsList>
        </Tabs>

        <form onSubmit={handleSubmit}>
          <FieldGroup>
            {mode === "register" ? (
              <Field>
                <FieldLabel htmlFor="name">
                  Имя Фамилия / Название компании
                </FieldLabel>
                <Input
                  id="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Иванов Иван Иванович"
                  required
                  disabled={loading}
                  autoComplete="name"
                />
              </Field>
            ) : null}

            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                type="email"
                inputMode="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="m@example.com"
                required
                disabled={loading}
                autoComplete="email"
                autoFocus
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="password">Пароль</FieldLabel>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                disabled={loading}
                autoComplete={
                  mode === "register" ? "new-password" : "current-password"
                }
              />
            </Field>

            {error ? (
              <p className="text-center text-sm text-destructive">{error}</p>
            ) : null}

            <Field>
              <Button
                type="submit"
                className="h-12 w-full text-base font-medium"
                disabled={loading}
              >
                {loading
                  ? "Загрузка..."
                  : mode === "login"
                    ? "Войти"
                    : "Зарегистрироваться"}
              </Button>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
