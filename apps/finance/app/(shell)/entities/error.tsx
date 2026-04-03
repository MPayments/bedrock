"use client";

import { SectionErrorState } from "@/components/section-error-state";

export default function EntitiesError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <SectionErrorState
      title="Не удалось загрузить справочники"
      description="Повторите попытку. Если ошибка повторяется, проверьте backend-сервисы."
      reset={reset}
    />
  );
}
