"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, CircleAlert } from "lucide-react";

import { Button } from "@bedrock/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@bedrock/ui/components/empty";

export default function NotFound() {
  const router = useRouter();

  function handleBack() {
    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <Empty className="max-w-xl border-border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CircleAlert className="size-4" />
          </EmptyMedia>
          <EmptyTitle>Страница не найдена</EmptyTitle>
          <EmptyDescription>
            Запрошенный ресурс не существует или был перемещен.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button type="button" onClick={handleBack}>
            <ArrowLeft className="size-4" />
            Вернуться назад
          </Button>
        </EmptyContent>
      </Empty>
    </main>
  );
}
