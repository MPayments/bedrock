"use client";

import { SectionErrorState } from "@/components/section-error-state";

export default function OperationsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <SectionErrorState
      title="Не удалось загрузить операции"
      description="Журнал документов временно недоступен."
      reset={reset}
    />
  );
}
