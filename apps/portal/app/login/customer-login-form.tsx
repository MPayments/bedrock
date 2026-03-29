"use client";

import { AlertCircle, Mail } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { authClient } from "@/lib/auth-client";

type Mode = "login" | "register";

export function CustomerLoginForm() {
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
        await authClient.signUp.email({
          email,
          password,
          name,
          callbackURL: "/",
        });
      } else {
        await authClient.signIn.email({
          email,
          password,
          callbackURL: "/",
        });
      }
      router.push("/");
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
    <div className="w-full">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Mail className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-xl font-bold">Личный кабинет</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Войдите или зарегистрируйтесь
        </p>
      </div>

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

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === "register" ? (
          <div className="space-y-1.5">
            <Label htmlFor="name">Имя Фамилия / Название компании</Label>
            <Input
              id="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Иванов Иван Иванович"
              required
              disabled={loading}
              className="h-12 text-base"
              autoComplete="name"
            />
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="your@email.com"
            required
            disabled={loading}
            className="h-12 text-base"
            autoComplete="email"
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Пароль</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            required
            disabled={loading}
            className="h-12 text-base"
            autoComplete={mode === "register" ? "new-password" : "current-password"}
          />
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <Button type="submit" className="h-12 w-full text-base font-medium" disabled={loading}>
          {loading
            ? "Загрузка..."
            : mode === "login"
              ? "Войти"
              : "Зарегистрироваться"}
        </Button>
      </form>
    </div>
  );
}
